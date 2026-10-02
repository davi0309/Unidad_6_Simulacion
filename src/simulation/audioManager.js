/**
 * audioManager.js
 * Sistema de análisis y reproducción de audio con Web Audio API.
 * Provee tiempo de reproducción, duración y progreso para sincronizar las etapas de la canción.
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
  let currentTrackName = 'Sintetizador Ambiental (Por defecto)';
  let onTrackChangeCallback = null;

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

    audioElement = new Audio();
    audioElement.crossOrigin = 'anonymous';
    audioElement.loop = true;

    sourceNode = audioContext.createMediaElementSource(audioElement);
    sourceNode.connect(gainNode);
  }

  function loadAudioFile(file) {
    initAudioContext();
    if (audioContext.state === 'suspended') {
      audioContext.resume();
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

  function update() {
    if (!analyser || !isPlaying) {
      // Pulso orgánico de respiración procedural cuando no hay canción sonando
      const t = performance.now() * 0.001;
      audioData.bass = (Math.sin(t * 1.8) * 0.5 + 0.5) * 0.35;
      audioData.mid = (Math.cos(t * 2.4) * 0.5 + 0.5) * 0.25;
      audioData.treble = (Math.sin(t * 3.6) * 0.5 + 0.5) * 0.20;
      audioData.energy = (audioData.bass + audioData.mid + audioData.treble) / 3.0;
      audioData.pulse = audioData.bass;
      return audioData;
    }

    analyser.getByteFrequencyData(frequencyData);
    const binCount = analyser.frequencyBinCount;
    let sumBass = 0, countBass = 0;
    let sumMid = 0, countMid = 0;
    let sumTreble = 0, countTreble = 0;
    let sumTotal = 0;

    // Bins para fftSize 1024 (binCount = 512):
    // Graves (Bass): bins 1..14 (~40Hz - 300Hz)
    // Medios (Mid): bins 15..100 (~300Hz - 2200Hz)
    // Agudos (Treble): bins 101..300 (~2200Hz - 6500Hz)
    for (let i = 0; i < binCount; i++) {
      const val = frequencyData[i];
      sumTotal += val;
      if (i >= 1 && i <= 14) { sumBass += val; countBass++; }
      else if (i > 14 && i <= 100) { sumMid += val; countMid++; }
      else if (i > 100 && i <= 300) { sumTreble += val; countTreble++; }
    }

    audioData.energy = sumTotal / (binCount * 255.0);
    audioData.bass = countBass > 0 ? (sumBass / (countBass * 255.0)) : 0;
    audioData.mid = countMid > 0 ? (sumMid / (countMid * 255.0)) : 0;
    audioData.treble = countTreble > 0 ? (sumTreble / (countTreble * 255.0)) : 0;
    audioData.pulse = audioData.bass;

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
    getCurrentTime: () => (audioElement ? audioElement.currentTime : 0),
    getDuration: () => (audioElement && audioElement.duration ? audioElement.duration : 0),
    getProgress: () => (audioElement && audioElement.duration > 0 ? (audioElement.currentTime / audioElement.duration) : 0),
    onTrackChange: (cb) => { onTrackChangeCallback = cb; }
  };
}
