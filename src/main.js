import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import WebGPU from 'three/addons/capabilities/WebGPU.js';
import './styles.css';

import { createParameters } from './simulation/parameters.js';
import { createSimulation } from './simulation/createSimulation.js';
import { createAudioManager } from './simulation/audioManager.js';
import { createLabPanel } from './ui/labPanel.js';

const PARTICLE_COUNT = 131072; // 2^17 agentes en GPU en volumen esférico 3D

async function main() {
  const mount = document.querySelector('#app');

  if (!WebGPU.isAvailable()) {
    mount.appendChild(WebGPU.getErrorMessage());
    throw new Error('Este proyecto requiere WebGPU para ejecutar los compute shaders de agentes.');
  }

  // ESCENA 3D SOBRE FONDO NEGRO PURO ---------------------------------------
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#000000');

  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.05, 100);
  camera.position.set(0, 2.0, 11);

  const renderer = new THREE.WebGPURenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  mount.appendChild(renderer.domElement);
  await renderer.init();

  const orbit = new OrbitControls(camera, renderer.domElement);
  orbit.enableDamping = true;
  orbit.dampingFactor = 0.05;
  orbit.target.set(0, 0, 0);

  // MÓDULO DE AUDIO Y PARÁMETROS -------------------------------------------
  const audioManager = createAudioManager();
  const params = createParameters();
  const simulation = createSimulation({ renderer, scene, params, count: PARTICLE_COUNT });

  // GESTIÓN DE VELOCIDAD DINÁMICA (Por defecto lenta y serena) -------------
  let speedLevel = 0; // 0 = Lenta (1.0), 1 = Moderada (1.75), 2 = Rápida (2.8)
  const speedMultipliers = [1.0, 1.75, 2.8];

  const setSpeedMultiplier = (mult) => {
    params.speedMultiplier.value = mult;
    panel.updateSpeedButtons(mult);
  };

  // 1. LA VOZ (EL MOUSE) CON ECOS DE REVERBERACIÓN -------------------------
  // El cursor es el punto luminoso de canto; atractores fantasma repiten la trayectoria con retraso
  const pointerNdc = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  const interactionPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const hit = new THREE.Vector3();

  const voiceHistory = []; // { pos: Vector3, time: number }
  const lastVoicePos = new THREE.Vector3();
  let lastVoiceTime = performance.now();
  let lastMoveTime = 0;

  window.addEventListener('pointermove', (event) => {
    pointerNdc.x = (event.clientX / innerWidth) * 2 - 1;
    pointerNdc.y = -(event.clientY / innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointerNdc, camera);
    if (raycaster.ray.intersectPlane(interactionPlane, hit)) {
      params.attractor.value.copy(hit);
      params.voicePos.value.copy(hit);
      params.voiceActive.value = 1.0;
      lastMoveTime = performance.now();
    }
  });

  window.addEventListener('pointerdown', (e) => {
    if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT' && !e.target.closest('.panel')) {
      params.attractorStrength.value = 5.5;
    }
  });

  window.addEventListener('pointerup', () => {
    params.attractorStrength.value = 0.0;
  });

  // CARGA DE AUDIO MEDIANTE DRAG & DROP ------------------------------------
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('audio/') || file.name.match(/\.(mp3|wav|ogg|m4a|aac)$/i)) {
        audioManager.loadAudioFile(file);
      }
    }
  });

  // CONTROLADOR DE TRANSICIÓN GRADUAL DE COLORES ---------------------------
  let transitionDuration = 20.0;

  const transitionToPalette = (targetId, duration = null) => {
    const actualDuration = duration !== null ? duration : (params.transitionDuration ? params.transitionDuration.value : 20.0);
    const roundedTarget = Math.round(targetId);
    if (Math.round(params.paletteB.value) === roundedTarget && params.paletteMix.value >= 1.0) {
      return;
    }

    if (params.paletteMix.value < 1.0) {
      params.paletteA.value = params.paletteMix.value > 0.5 ? params.paletteB.value : params.paletteA.value;
    } else {
      params.paletteA.value = params.paletteB.value;
    }

    params.paletteB.value = roundedTarget;
    params.paletteId.value = roundedTarget;
    params.paletteMix.value = 0.0;
    transitionDuration = Math.max(1.0, actualDuration);
  };

  // 2. ACORDES DEL ARMONIO (FILA CENTRAL A S D F G H J K) -------------------
  let chordDuration = 3.2; // segundos para derretirse lentamente de un acorde al siguiente
  const transitionToChord = (targetId, duration = 3.2) => {
    const rounded = Math.round(targetId);
    if (Math.round(params.chordB.value) === rounded && params.chordMorph.value >= 1.0 && params.chordWeight.value >= 0.99) {
      return;
    }
    if (params.chordMorph.value < 1.0) {
      params.chordA.value = params.chordMorph.value > 0.5 ? params.chordB.value : params.chordA.value;
    } else {
      params.chordA.value = params.chordB.value;
    }
    params.chordB.value = rounded;
    params.chordMorph.value = 0.0;
    params.chordWeight.value = 1.0;
    chordDuration = duration;
    panel?.updateActiveChord(rounded);
  };

  // 3. GLISSANDO DE ARPAS (FILA NUMÉRICA 1 AL 0) ---------------------------
  const numberKeyMap = {
    'Digit1': 0, 'Digit2': 1, 'Digit3': 2, 'Digit4': 3, 'Digit5': 4,
    'Digit6': 5, 'Digit7': 6, 'Digit8': 7, 'Digit9': 8, 'Digit0': 9
  };
  let lastHarpKey = -1;
  let lastHarpTime = 0;

  const triggerHarpGlissando = (dir = 1.0, keyIdx = null) => {
    params.harpActive.value = 1.0;
    params.harpWaveDir.value = dir;
    if (keyIdx !== null) {
      const xPos = ((keyIdx / 9.0) - 0.5) * 7.0;
      params.harpWavePos.value = xPos;
    } else {
      params.harpWavePos.value = dir > 0 ? -4.2 : 4.2;
    }
    panel?.flashHarp(dir);
  };

  // 4. CRÉDITOS FINALES Y SILENCIO (ENTER) ---------------------------------
  let creditsState = 'IDLE'; // 'IDLE' | 'ROLLING' | 'SILENCE'
  let creditsElapsed = 0;

  const triggerCredits = () => {
    if (creditsState === 'IDLE') {
      creditsState = 'ROLLING';
      creditsElapsed = 0;
      params.creditsActive.value = 1.0;
      params.codaSilence.value = 0.0;
      params.codaMotePulse.value = 0.0;
    } else {
      // Reiniciar y volver a la pieza activa
      creditsState = 'IDLE';
      params.creditsActive.value = 0.0;
      params.codaSilence.value = 0.0;
      params.codaMotePulse.value = 0.0;
    }
    panel?.updateCreditsState(creditsState);
  };

  // ARQUETIPOS DE PRESET NUMÉRICOS (Mantenidos para compatibilidad) ---------
  const shapeConfigs = {
    astrolabe: { id: 0, harmonics: 4.0, swirl: 1.8, petalMorph: 1.4, curlStrength: 0.35, palette: 4.0 },
    tornado: { id: 1, harmonics: 2.0, swirl: 3.2, petalMorph: 1.1, curlStrength: 0.55, palette: 1.0 },
    cosmicVeil: { id: 2, harmonics: 3.0, swirl: 0.8, petalMorph: 1.9, curlStrength: 1.25, palette: 1.0 },
    celestialLotus: { id: 3, harmonics: 7.0, swirl: 1.2, petalMorph: 1.7, curlStrength: 0.45, palette: 0.0 },
    astralPillar: { id: 4, harmonics: 1.0, swirl: 0.6, petalMorph: 0.7, curlStrength: 0.35, palette: 2.0 }
  };

  let shapeMorphDuration = 5.0;
  let targetHarmonics = params.harmonics.value;
  let targetSwirl = params.swirl.value;
  let targetPetalMorph = params.petalMorph.value;
  let targetCurlStrength = params.curlStrength.value;

  const applyPreset = (key) => {
    const config = shapeConfigs[key];
    if (!config) return;
    params.chordWeight.value = 0.0; // Cambia a modo arquetipo visual
    const roundedTarget = Math.round(config.id);
    if (params.shapeMorph.value < 1.0) {
      params.shapeA.value = params.shapeMorph.value > 0.5 ? params.shapeB.value : params.shapeA.value;
    } else {
      params.shapeA.value = params.shapeB.value;
    }
    params.shapeB.value = roundedTarget;
    params.shapeMorph.value = 0.0;
    shapeMorphDuration = 5.0;

    targetHarmonics = config.harmonics;
    targetSwirl = config.swirl;
    targetPetalMorph = config.petalMorph;
    targetCurlStrength = config.curlStrength;
    transitionToPalette(config.palette);
  };

  // CONTROL DE MODOS LAB / PERFORMANCE -------------------------------------
  let mode = 'LAB';
  const setMode = (next) => {
    mode = next;
    const lab = mode === 'LAB';
    panel.setVisible(lab);
    simulation.setSphereHelperVisible(lab);
    hud.innerHTML = lab
      ? '<strong>PELÍCULA & ARMONIO</strong> · Espacio: Fuelle · A-K: Acordes · 1-0: Arpas · Shift: Celestial · Enter: Créditos'
      : '<strong>CINEMA EN VIVO</strong> · Espacio: Respirar · A-K: Acordes · 1-0: Arpas · Shift: Celestial · Enter: Créditos · P: Lab';
  };

  const hud = document.createElement('div');
  hud.className = 'hud';
  document.body.append(hud);

  let spaceHolding = false;
  let shiftHolding = false;

  const panel = createLabPanel({
    params,
    audioManager,
    onResetVisuals: () => simulation.resetVisuals(),
    onApplyPreset: applyPreset,
    onChordChange: (cId) => transitionToChord(cId),
    onBellowsToggle: (holding) => { spaceHolding = holding; },
    onHarpGlissando: (dir) => triggerHarpGlissando(dir),
    onCelestialHold: (holding) => { shiftHolding = holding; },
    onCreditsToggle: () => triggerCredits(),
    onCodaMotePulse: () => { params.codaMotePulse.value = 1.0; },
    onModeChange: () => setMode(mode === 'LAB' ? 'PERFORMANCE' : 'LAB'),
    onSpeedChange: (mult) => setSpeedMultiplier(mult),
    onBlendingChange: (bMode) => simulation.setBlendingMode(bMode),
    onPaletteChange: (idx) => transitionToPalette(idx, params.transitionDuration.value)
  });

  setMode('LAB');

  // MAPEO DE TECLADO PARA TOCAR EL INSTRUMENTO EN VIVO ----------------------
  const chordKeys = {
    'KeyA': 0, 'KeyS': 1, 'KeyD': 2, 'KeyF': 3,
    'KeyG': 4, 'KeyH': 5, 'KeyJ': 6, 'KeyK': 7
  };

  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyP' && !event.repeat) setMode(mode === 'LAB' ? 'PERFORMANCE' : 'LAB');

    // EN SILENCIO TRAS LOS CRÉDITOS: cualquier tecla despierta motas tenues de polvo
    if (creditsState === 'SILENCE' && event.code !== 'Enter') {
      params.codaMotePulse.value = 1.0;
      return;
    }

    // ESPACIO (Mantener): Inhalar con el fuelle del armonio
    if (event.code === 'Space' && !event.repeat) {
      event.preventDefault();
      spaceHolding = true;
    }

    // ACORDES DE LA FILA CENTRAL (A S D F G H J K):
    if (event.code in chordKeys && !event.repeat) {
      transitionToChord(chordKeys[event.code]);
      panel.refresh();
    }

    // BARRIDO DE ARPAS (FILA 1 AL 0):
    if (event.code in numberKeyMap) {
      const curIdx = numberKeyMap[event.code];
      const now = performance.now();
      let dir = 1.0;
      if (lastHarpKey !== -1 && (now - lastHarpTime) < 650) {
        dir = curIdx >= lastHarpKey ? 1.0 : -1.0;
      } else {
        dir = curIdx >= 5 ? -1.0 : 1.0;
      }
      lastHarpKey = curIdx;
      lastHarpTime = now;
      triggerHarpGlissando(dir, curIdx);
    }

    // SHIFT (Mantener): Ascenso celestial (gravedad invertida + Physarum)
    if ((event.code === 'ShiftLeft' || event.code === 'ShiftRight') && !shiftHolding) {
      shiftHolding = true;
    }

    // ENTER: Créditos finales y pantalla vacía de celuloide
    if (event.code === 'Enter' && !event.repeat) {
      triggerCredits();
    }

    // R: Mutar visuales / nueva semilla
    if (event.code === 'KeyR' && !event.repeat) {
      simulation.resetVisuals();
      panel.refresh();
    }

    // T: Ciclar velocidad
    if (event.code === 'KeyT' && !event.repeat) {
      speedLevel = (speedLevel + 1) % 3;
      setSpeedMultiplier(speedMultipliers[speedLevel]);
      panel.refresh();
    }

    // C: Ciclar paleta
    if (event.code === 'KeyC' && !event.repeat) {
      const nextPal = (Math.round(params.paletteB.value) + 1) % 5;
      transitionToPalette(nextPal, params.transitionDuration.value);
      panel.refresh();
    }

    // F: Invertir sentido del flujo
    if (event.code === 'KeyF' && !event.repeat) {
      params.flowDirection.value *= -1.0;
      panel.refresh();
    }

    // Flechas: modular giro y armónicos
    if (event.code === 'ArrowUp') {
      params.swirl.value = Math.min(4.0, params.swirl.value + 0.2);
      panel.refresh();
    }
    if (event.code === 'ArrowDown') {
      params.swirl.value = Math.max(-4.0, params.swirl.value - 0.2);
      panel.refresh();
    }
    if (event.code === 'ArrowRight') {
      params.harmonics.value = Math.min(9.0, params.harmonics.value + 1.0);
      panel.refresh();
    }
    if (event.code === 'ArrowLeft') {
      params.harmonics.value = Math.max(1.0, params.harmonics.value - 1.0);
      panel.refresh();
    }
  });

  window.addEventListener('keyup', (event) => {
    // Al soltar ESPACIO: Exhalar y expandir el aire del fuelle
    if (event.code === 'Space') {
      spaceHolding = false;
    }
    // Al soltar SHIFT: Desactivar ascenso celestial
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
      shiftHolding = false;
    }
  });

  window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  simulation.reset();

  // FRAME ANIMATION LOOP ---------------------------------------------------
  let lastStage = -1;
  let lastTime = performance.now();

  renderer.setAnimationLoop(() => {
    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    // Tiempo continuo para ondas planetarias, grano 24 FPS y parpadeo
    if (params.elapsedTime) params.elapsedTime.value += dt;

    // Deriva lenta y continua del espectro cromático
    params.chromaShift.value += dt * 0.028;

    // 1. EL FUELLE DEL ARMONIO (Dinámica continua de respiración)
    if (spaceHolding) {
      params.bellowsInhale.value = Math.min(1.0, params.bellowsInhale.value + dt * 2.2);
    } else {
      params.bellowsInhale.value = Math.max(0.0, params.bellowsInhale.value - dt * 1.5);
    }
    panel?.updateBellows(params.bellowsInhale.value);

    // 2. INTERPOLACIÓN LENTA DE ACORDES ("como un fuelle llenándose de aire")
    if (params.chordMorph.value < 1.0) {
      params.chordMorph.value = Math.min(1.0, params.chordMorph.value + dt / chordDuration);
    }

    // 3. LA VOZ (MOUSE) Y SUS 3 ECOS DE REVERBERACIÓN
    if (now - lastMoveTime < 1800) {
      voiceHistory.push({ pos: hit.clone(), time: now });
      while (voiceHistory.length > 0 && (now - voiceHistory[0].time) > 1300) {
        voiceHistory.shift();
      }
      const dtVoice = Math.max(0.016, (now - lastVoiceTime) / 1000);
      params.voiceVel.value.subVectors(hit, lastVoicePos).divideScalar(dtVoice);
      lastVoicePos.copy(hit);
      lastVoiceTime = now;

      const findEcho = (delayMs) => {
        const targetTime = now - delayMs;
        let bestPos = hit;
        let bestDiff = Infinity;
        for (let i = 0; i < voiceHistory.length; i++) {
          const diff = Math.abs(voiceHistory[i].time - targetTime);
          if (diff < bestDiff) {
            bestDiff = diff;
            bestPos = voiceHistory[i].pos;
          }
        }
        return bestPos;
      };

      params.voiceEcho1.value.copy(findEcho(200));
      params.voiceEcho2.value.copy(findEcho(450));
      params.voiceEcho3.value.copy(findEcho(750));
    } else {
      params.voiceActive.value = Math.max(0.0, params.voiceActive.value - dt * 1.5);
    }

    // 4. PROPAGACIÓN DE ONDA ACÚSTICA DE LAS ARPAS
    if (params.harpActive.value > 0.0) {
      params.harpWavePos.value += params.harpWaveDir.value * dt * 9.5;
      params.harpActive.value = Math.max(0.0, params.harpActive.value - dt * 0.35);
    }

    // 5. ASCENSO CELESTIAL AL MANTENER SHIFT
    if (shiftHolding) {
      params.celestialActive.value = Math.min(1.0, params.celestialActive.value + dt * 2.5);
      params.speedMultiplier.value = 1.85;
    } else {
      params.celestialActive.value = Math.max(0.0, params.celestialActive.value - dt * 1.8);
      params.speedMultiplier.value = speedMultipliers[speedLevel];
    }

    // 6. CONTROL DE CRÉDITOS Y SILENCIO FINAL
    if (creditsState === 'ROLLING') {
      creditsElapsed += dt;
      if (creditsElapsed > 6.5) {
        creditsState = 'SILENCE';
        params.creditsActive.value = 0.0;
        params.codaSilence.value = 1.0;
        panel?.updateCreditsState(creditsState);
      }
    } else if (creditsState === 'SILENCE') {
      if (params.codaMotePulse.value > 0.0) {
        params.codaMotePulse.value = Math.max(0.0, params.codaMotePulse.value - dt * 0.45);
      }
    }

    // Interpolación suave y gradual entre paletas
    if (params.paletteMix.value < 1.0) {
      params.paletteMix.value = Math.min(1.0, params.paletteMix.value + dt / transitionDuration);
    }

    // Avance gradual del morphing de formas 3D
    if (params.shapeMorph.value < 1.0) {
      params.shapeMorph.value = Math.min(1.0, params.shapeMorph.value + dt / shapeMorphDuration);
      const lerpSpeed = Math.min(1.0, dt * 2.2);
      params.harmonics.value += (targetHarmonics - params.harmonics.value) * lerpSpeed;
      params.swirl.value += (targetSwirl - params.swirl.value) * lerpSpeed;
      params.petalMorph.value += (targetPetalMorph - params.petalMorph.value) * lerpSpeed;
      params.curlStrength.value += (targetCurlStrength - params.curlStrength.value) * lerpSpeed;
    }

    const audio = audioManager.update();

    // SINCRONIZACIÓN DE LA PARTITURA VISUAL CON RADIOHEAD
    if (audioManager.getIsPlaying()) {
      const curTime = audioManager.getCurrentTime();
      const duration = audioManager.getDuration();
      let currentStage = 0;
      let stageDesc = '';

      if (duration > 0 && duration <= 230) {
        if (curTime < 52) {
          currentStage = 0; // Paleta 0: Película de Celuloide Antiguo (Añil, pizarra y marfil)
          stageDesc = '🎹 <strong>Etapa 1 (0:00 - 0:52):</strong> Armonio solitario y celuloide<br>✦ <em>Fuelle con Espacio · Toca los acordes con A S D F G H J K</em>';
        } else if (curTime < 90) {
          currentStage = 2; // Paleta 2: Madera cálida y ámbar
          stageDesc = '🎻 <strong>Etapa 2 (0:52 - 1:30):</strong> Entrada de bajo · La voz de Thom<br>✦ <em>El mouse es la voz: dibuja la melodía y observa los 3 ecos</em>';
        } else if (curTime < 140) {
          currentStage = 1; // Paleta 1: Seda Ópalo y Prisma
          stageDesc = '✨ <strong>Etapa 3 (1:30 - 2:20):</strong> Clímax celestial con arpa y coros<br>✦ <em>Barre 1 al 0 para arpas · Mantén Shift para ascensión celestial</em>';
        } else {
          currentStage = 0;
          stageDesc = '🌅 <strong>Etapa 4 (2:20 - Fin):</strong> Desvanecimiento y Coda<br>✦ <em>Presiona Enter para rodar créditos · Toca teclas en el silencio</em>';
        }
      } else if (duration > 0) {
        const prog = curTime / duration;
        if (prog < 0.25) {
          currentStage = 0;
          stageDesc = '🎵 <strong>Etapa 1 (0-25%):</strong> Armonio y celuloide';
        } else if (prog < 0.50) {
          currentStage = 2;
          stageDesc = '🎵 <strong>Etapa 2 (25-50%):</strong> Bajo y voz';
        } else if (prog < 0.75) {
          currentStage = 1;
          stageDesc = '🎵 <strong>Etapa 3 (50-75%):</strong> Clímax celestial';
        } else {
          currentStage = 0;
          stageDesc = '🎵 <strong>Etapa 4 (75-100%):</strong> Coda y créditos';
        }
      }

      if (currentStage !== lastStage) {
        lastStage = currentStage;
        const songFadeDuration = Math.max(15.0, params.transitionDuration ? params.transitionDuration.value : 15.0);
        transitionToPalette(currentStage, songFadeDuration);
        panel?.refresh();
        panel?.setStageInfo(stageDesc);
      }
    }

    simulation.stepSimulation();
    orbit.update();
    renderer.render(scene, camera);
  });
}

main().catch((error) => {
  console.error(error);
  const pre = document.createElement('pre');
  pre.style.cssText = 'position:fixed;inset:16px;white-space:pre-wrap;color:#ff5555;background:#111;padding:16px;z-index:50';
  pre.textContent = String(error?.stack || error);
  document.body.append(pre);
});
