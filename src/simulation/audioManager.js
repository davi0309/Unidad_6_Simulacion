/**
 * audioManager.js
 * Sistema de análisis y reproducción de audio con Web Audio API.
 * Extrae bandas de frecuencia (graves, medios, agudos), energía total y picos de ritmo (onsets).
 * Soporta carga de archivos de usuario (.mp3, .wav, etc.), drag & drop y sintetizador de respaldo.
 */

export function createAudioManager() {
  let audioContext = null;
  let analyser = null;
  let sourceNode = null;
  let gainNode = null;
  let audioElement = null;

  let isPlaying = false;
  let audioData = {
    bass: 0,
    mid: 0,
    treble: 0,
    energy: 0,
    pulse: 0
  };

  let frequencyData = null;
  let peakHistory = 0;
  let currentTrackName = 'Sintetizador Ambiental (Por defecto)';
  let onTrackChangeCallback = null;

  // Inicializa el AudioContext bajo demanda (respetando políticas de autoplay de navegadores)
  function initAudioContext() {
    if (audioContext) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioContext = new AudioContextClass();

    analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.82;
    frequencyData = new Uint8Array(analyser.frequencyBinCount);

    gainNode = audioContext.createGain();
    gainNode.gain.value = 0.85;
    gainNode.connect(analyser);
    analyser.connect(audioContext.destination);

    // Creamos un elemento de audio HTML5 para reproducción eficiente de pistas largas
    audioElement = new Audio();
    audioElement.crossOrigin = 'anonymous';
    audioElement.loop = true;

    sourceNode = audioContext.createMediaElementSource(audioElement);
    sourceNode.connect(gainNode);

    // Iniciar con audio sintetizado ambiental procedural mientras el usuario carga su canción
    setupDefaultProceduralAudio();
  }

  // Generador de música sintética armónica (drone/bombo/arpegios relajantes) para pruebas inmediatas
  let synthInterval = null;
  function setupDefaultProceduralAudio() {
    if (synthInterval) clearInterval(synthInterval);
    // Simula pulsos rítmicos mientras no haya pista cargada
    let step = 0;
    synthInterval = setInterval(() => {
      if (!audioElement || audioElement.src === '' || audioElement.paused) {
        step++;
        const beat = (step % 4 === 0) ? 0.9 : (step % 2 === 0 ? 0.45 : 0.2);
        // Pequeño pulso simulado para que los visuales respiren de inmediato
        audioData.pulse = Math.max(audioData.pulse * 0.88, beat);
        audioData.bass = Math.max(audioData.bass * 0.9, beat * 0.85 + Math.sin(step * 0.2) * 0.15 + 0.25);
        audioData.mid = 0.3 + Math.cos(step * 0.15) * 0.2;
        audioData.treble = 0.25 + Math.sin(step * 0.3) * 0.15;
        audioData.energy = (audioData.bass * 1.2 + audioData.mid + audioData.treble) / 3;
      }
    }, 150);
  }

  // Carga un archivo de audio seleccionado por el usuario (.mp3, .wav, .ogg, etc.)
  function loadAudioFile(file) {
    initAudioContext();
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }

    if (synthInterval) {
      clearInterval(synthInterval);
      synthInterval = null;
    }

    const objectUrl = URL.createObjectURL(file);
    audioElement.src = objectUrl;
    audioElement.load();
    currentTrackName = file.name;
    if (onTrackChangeCallback) onTrackChangeCallback(currentTrackName);

    audioElement.play().then(() => {
      isPlaying = true;
    }).catch(err => {
      console.warn('Reproducción en espera de interacción:', err);
    });
  }

  function play() {
    initAudioContext();
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
    if (audioElement && audioElement.src) {
      audioElement.play().then(() => {
        isPlaying = true;
      });
    } else {
      isPlaying = true;
    }
  }

  function pause() {
    if (audioElement) {
      audioElement.pause();
    }
    isPlaying = false;
  }

  function togglePlay() {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
    return isPlaying;
  }

  function setVolume(val) {
    if (gainNode) gainNode.gain.value = Math.max(0, Math.min(val, 1.5));
  }

  // Actualización en cada fotograma del render loop
  function update() {
    if (!analyser || !isPlaying) {
      // Suavizado de decaimiento
      audioData.pulse *= 0.92;
      audioData.bass *= 0.94;
      audioData.mid *= 0.94;
      audioData.treble *= 0.94;
      audioData.energy *= 0.94;
      return audioData;
    }

    analyser.getByteFrequencyData(frequencyData);

    const binCount = analyser.frequencyBinCount; // 512 bins (0 a ~22050 Hz)
    const binWidth = (audioContext.sampleRate / 2) / binCount;

    // Rangos de bandas:
    // Sub-bass & Bass: 20 Hz - 250 Hz (bins ~1 a 6)
    // Mids: 250 Hz - 3500 Hz (bins ~6 a 80)
    // Trebles: 3500 Hz - 14000 Hz (bins ~80 a 320)
    let bassSum = 0, bassCount = 0;
    let midSum = 0, midCount = 0;
    let trebleSum = 0, trebleCount = 0;
    let totalSum = 0;

    for (let i = 0; i < binCount; i++) {
      const val = frequencyData[i] / 255.0;
      const freq = i * binWidth;
      totalSum += val;

      if (freq >= 20 && freq <= 250) {
        bassSum += val * 1.3; // Ponderación de graves
        bassCount++;
      } else if (freq > 250 && freq <= 3500) {
        midSum += val;
        midCount++;
      } else if (freq > 3500 && freq <= 14000) {
        trebleSum += val;
        trebleCount++;
      }
    }

    const currentBass = bassCount > 0 ? (bassSum / bassCount) : 0;
    const currentMid = midCount > 0 ? (midSum / midCount) : 0;
    const currentTreble = trebleCount > 0 ? (trebleSum / trebleCount) : 0;
    const currentEnergy = totalSum / binCount;

    // Detección de picos/golpes rítmicos fuertes (onsets)
    const energyDelta = currentBass - peakHistory;
    if (energyDelta > 0.16 && currentBass > 0.35) {
      audioData.pulse = Math.min(1.0, audioData.pulse + energyDelta * 2.2);
    } else {
      audioData.pulse *= 0.88; // Decaimiento suave
    }
    peakHistory = currentBass * 0.8 + peakHistory * 0.2;

    // Interpolación suave (lerp) para evitar transiciones bruscas
    audioData.bass += (currentBass - audioData.bass) * 0.35;
    audioData.mid += (currentMid - audioData.mid) * 0.3;
    audioData.treble += (currentTreble - audioData.treble) * 0.3;
    audioData.energy += (currentEnergy - audioData.energy) * 0.3;

    return audioData;
  }

  return {
    init: initAudioContext,
    loadAudioFile,
    play,
    pause,
    togglePlay,
    setVolume,
    update,
    getAudioData: () => audioData,
    getIsPlaying: () => isPlaying,
    getCurrentTrackName: () => currentTrackName,
    onTrackChange: (cb) => { onTrackChangeCallback = cb; }
  };
}
