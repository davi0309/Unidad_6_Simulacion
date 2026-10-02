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
  camera.position.set(0, 2.5, 11);

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

  // CONDUCCIÓN EXPRESIVA CON EL PUNTERO / RATÓN ----------------------------
  const pointerNdc = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  const interactionPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const hit = new THREE.Vector3();

  window.addEventListener('pointermove', (event) => {
    pointerNdc.x = (event.clientX / innerWidth) * 2 - 1;
    pointerNdc.y = -(event.clientY / innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointerNdc, camera);
    if (raycaster.ray.intersectPlane(interactionPlane, hit)) {
      params.attractor.value.copy(hit);
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

  // CONTROLADOR DE TRANSICIÓN GRADUAL DE COLORES (CERO SALTOS BRUSCOS) -----
  let transitionDuration = 20.0; // duración en segundos de la transición (ultra-lenta y majestuosa)

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

  // CONFIGURACIÓN DE LOS 5 ARQUETIPOS 3D (Inspirados en las imágenes de referencia)
  const shapeConfigs = {
    astrolabe: {
      id: 0,
      label: 'Astrolabio de Cristal Óptico',
      harmonics: 4.0,
      swirl: 1.8,
      petalMorph: 1.4,
      curlStrength: 0.35,
      palette: 4.0
    },
    tornado: {
      id: 1,
      label: 'Red de Micro-Vórtices y Eyectores 3D',
      harmonics: 2.0,
      swirl: 3.2,
      petalMorph: 1.1,
      curlStrength: 0.55,
      palette: 1.0
    },
    cosmicVeil: {
      id: 2,
      label: 'Velo Cósmico Multicapa',
      harmonics: 3.0,
      swirl: 0.8,
      petalMorph: 1.9,
      curlStrength: 1.25,
      palette: 1.0
    },
    celestialLotus: {
      id: 3,
      label: 'Loto Celestial / Alas de Serafín',
      harmonics: 7.0,
      swirl: 1.2,
      petalMorph: 1.7,
      curlStrength: 0.45,
      palette: 0.0
    },
    astralPillar: {
      id: 4,
      label: 'Pilar Astral / Alma Ascendente',
      harmonics: 1.0,
      swirl: 0.6,
      petalMorph: 0.7,
      curlStrength: 0.35,
      palette: 2.0
    }
  };

  // CONTROLADOR DE TRANSICIÓN SUAVE DE MORFOLOGÍA Y FUERZAS 3D (CRAIG REYNOLDS)
  let shapeMorphDuration = 5.0; // segundos para migrar entre figuras orgánicamente
  let targetHarmonics = params.harmonics.value;
  let targetSwirl = params.swirl.value;
  let targetPetalMorph = params.petalMorph.value;
  let targetCurlStrength = params.curlStrength.value;

  const transitionToShape = (targetShapeId, duration = 5.0) => {
    const roundedTarget = Math.round(targetShapeId);
    if (Math.round(params.shapeB.value) === roundedTarget && params.shapeMorph.value >= 1.0) {
      return;
    }

    if (params.shapeMorph.value < 1.0) {
      params.shapeA.value = params.shapeMorph.value > 0.5 ? params.shapeB.value : params.shapeA.value;
    } else {
      params.shapeA.value = params.shapeB.value;
    }

    params.shapeB.value = roundedTarget;
    params.symmetryType.value = roundedTarget;
    params.shapeMorph.value = 0.0;
    shapeMorphDuration = Math.max(1.0, duration);
  };

  // ARQUETIPOS GENERATIVOS 3D ----------------------------------------------
  const applyPreset = (key) => {
    const config = shapeConfigs[key];
    if (!config) return;

    // Transición de campo de fuerzas en 3D (los agentes maniobran con steering hacia la nueva forma)
    transitionToShape(config.id, 5.0);
    targetHarmonics = config.harmonics;
    targetSwirl = config.swirl;
    targetPetalMorph = config.petalMorph;
    targetCurlStrength = config.curlStrength;

    // También transiciona la paleta correspondiente con suavidad
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
      ? '<strong>LAB</strong> · P: performance · R: mutar 3D · T: velocidad · Shift: turbo · Flechas: forma'
      : '<strong>PERFORMANCE</strong> · P: lab · Espacio: acento · Shift: turbo · T: velocidad · Rotar: orbitar 3D';
  };

  const hud = document.createElement('div');
  hud.className = 'hud';
  document.body.append(hud);

  const panel = createLabPanel({
    params,
    audioManager,
    onResetVisuals: () => simulation.resetVisuals(),
    onApplyPreset: applyPreset,
    onModeChange: () => setMode(mode === 'LAB' ? 'PERFORMANCE' : 'LAB'),
    onSpeedChange: (mult) => setSpeedMultiplier(mult),
    onBlendingChange: (bMode) => simulation.setBlendingMode(bMode),
    onPaletteChange: (idx) => transitionToPalette(idx, params.transitionDuration.value)
  });

  setMode('LAB');

  // MAPEO DE TECLADO PARA TOCAR EL INSTRUMENTO EN VIVO ----------------------
  let shiftPressed = false;
  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyP' && !event.repeat) setMode(mode === 'LAB' ? 'PERFORMANCE' : 'LAB');

    // R: Mutar visuales sin reiniciar la música
    if (event.code === 'KeyR' && !event.repeat) {
      simulation.resetVisuals();
      panel.refresh();
    }

    // T: Ciclar velocidad entre Lenta, Moderada y Rápida
    if (event.code === 'KeyT' && !event.repeat) {
      speedLevel = (speedLevel + 1) % 3;
      setSpeedMultiplier(speedMultipliers[speedLevel]);
      panel.refresh();
    }

    // Shift: Turbo / acelerador momentáneo mientras se mantiene presionado
    if ((event.code === 'ShiftLeft' || event.code === 'ShiftRight') && !shiftPressed) {
      shiftPressed = true;
      params.speedMultiplier.value = speedMultipliers[speedLevel] * 2.2;
    }

    // 1-5: Cambios de sección y morfología armónica 3D (Transición orgánica sin saltos)
    if (event.code === 'Digit1') { applyPreset('astrolabe'); panel.refresh(); }
    if (event.code === 'Digit2') { applyPreset('tornado'); panel.refresh(); }
    if (event.code === 'Digit3') { applyPreset('cosmicVeil'); panel.refresh(); }
    if (event.code === 'Digit4') { applyPreset('celestialLotus'); panel.refresh(); }
    if (event.code === 'Digit5') { applyPreset('astralPillar'); panel.refresh(); }

    // C: Ciclar paleta de color con transición gradual suave
    if (event.code === 'KeyC' && !event.repeat) {
      const nextPal = (Math.round(params.paletteB.value) + 1) % 5;
      transitionToPalette(nextPal, params.transitionDuration.value);
      panel.refresh();
    }

    // F: Invertir sentido del flujo (implosión vs expansión)
    if (event.code === 'KeyF' && !event.repeat) {
      params.flowDirection.value *= -1.0;
      panel.refresh();
    }

    // Espacio: Acento musical manual
    if (event.code === 'Space' && !event.repeat) {
      event.preventDefault();
      params.userPulse.value = 1.0;
    }

    // Flechas Arriba/Abajo: Modular torsión/vorticidad
    if (event.code === 'ArrowUp') {
      params.swirl.value = Math.min(4.0, params.swirl.value + 0.2);
      panel.refresh();
    }
    if (event.code === 'ArrowDown') {
      params.swirl.value = Math.max(-4.0, params.swirl.value - 0.2);
      panel.refresh();
    }

    // Flechas Izquierda/Derecha: Modular armónicos / pétalos 3D
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
    if (event.code === 'Space') {
      params.userPulse.value = 0.0;
    }
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
      shiftPressed = false;
      params.speedMultiplier.value = speedMultipliers[speedLevel];
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

    // Tiempo acumulado para ondas planetarias viajeras y pulsaciones armónicas
    if (params.elapsedTime) params.elapsedTime.value += dt;

    // Deriva lenta y continua del espectro: los colores fluyen orgánicamente por los filamentos 3D
    params.chromaShift.value += dt * 0.035;

    // Interpolación suave y gradual entre paletas (avanza de a poco)
    if (params.paletteMix.value < 1.0) {
      params.paletteMix.value = Math.min(1.0, params.paletteMix.value + dt / transitionDuration);
    }

    // Avance gradual del morphing de formas 3D por fuerzas del sistema (Craig Reynolds)
    if (params.shapeMorph.value < 1.0) {
      params.shapeMorph.value = Math.min(1.0, params.shapeMorph.value + dt / shapeMorphDuration);

      // Interpolación continua y suave de los parámetros armónicos hacia la figura destino
      const lerpSpeed = Math.min(1.0, dt * 2.2);
      params.harmonics.value += (targetHarmonics - params.harmonics.value) * lerpSpeed;
      params.swirl.value += (targetSwirl - params.swirl.value) * lerpSpeed;
      params.petalMorph.value += (targetPetalMorph - params.petalMorph.value) * lerpSpeed;
      params.curlStrength.value += (targetCurlStrength - params.curlStrength.value) * lerpSpeed;
    }

    const audio = audioManager.update();

    // LA MÚSICA ÚNICAMENTE CAMBIA LA PALETA ESPECTRAL SEGÚN LA ETAPA DE LA CANCIÓN
    if (audioManager.getIsPlaying()) {
      const curTime = audioManager.getCurrentTime();
      const duration = audioManager.getDuration();
      let currentStage = 0;

      let stageDesc = '';
      if (duration > 0 && duration <= 230) {
        // Estructura específica para Motion Picture Soundtrack de Radiohead
        if (curTime < 52) {
          currentStage = 4; // Etapa 1: Armonio solo -> Azul Cian Profundo
          stageDesc = '🎹 <strong>Etapa 1 (0:00 - 0:52):</strong> Armonio solitario<br>✦ Paleta: <em>Bioluminiscencia Azul Cian</em>';
        } else if (curTime < 90) {
          currentStage = 1; // Etapa 2: Contrabajo -> Seda Ópalo y Amatista
          stageDesc = '🎻 <strong>Etapa 2 (0:52 - 1:30):</strong> Entrada de bajo y melancolía<br>✦ Paleta: <em>Seda Ópalo y Amatista</em>';
        } else if (curTime < 140) {
          currentStage = 0; // Etapa 3: Arpa y Coros -> Prisma Espectral Arcoíris
          stageDesc = '✨ <strong>Etapa 3 (1:30 - 2:20):</strong> Clímax celestial con arpas<br>✦ Paleta: <em>Prisma Espectral Arcoíris</em>';
        } else {
          currentStage = 2; // Etapa 4: Coda y Desvanecimiento -> Fuego Dorado y Ámbar
          stageDesc = '🌅 <strong>Etapa 4 (2:20 - Fin):</strong> Coda final ("I will see you...")<br>✦ Paleta: <em>Fuego Dorado y Ámbar</em>';
        }
      } else if (duration > 0) {
        // Para cualquier otra canción según su porcentaje de avance
        const prog = curTime / duration;
        if (prog < 0.25) {
          currentStage = 4;
          stageDesc = '🎵 <strong>Etapa 1 (0-25%):</strong> Introducción<br>✦ Paleta: <em>Bioluminiscencia Azul Cian</em>';
        } else if (prog < 0.50) {
          currentStage = 1;
          stageDesc = '🎵 <strong>Etapa 2 (25-50%):</strong> Desarrollo armónico<br>✦ Paleta: <em>Seda Ópalo y Amatista</em>';
        } else if (prog < 0.75) {
          currentStage = 0;
          stageDesc = '🎵 <strong>Etapa 3 (50-75%):</strong> Clímax sonoro<br>✦ Paleta: <em>Prisma Espectral Arcoíris</em>';
        } else {
          currentStage = 2;
          stageDesc = '🎵 <strong>Etapa 4 (75-100%):</strong> Conclusión<br>✦ Paleta: <em>Fuego Dorado y Ámbar</em>';
        }
      }

      if (currentStage !== lastStage) {
        lastStage = currentStage;
        // Transición lenta, majestuosa y etérea (20 segundos por defecto)
        const songFadeDuration = Math.max(20.0, params.transitionDuration ? params.transitionDuration.value : 20.0);
        transitionToPalette(currentStage, songFadeDuration);
        if (panel?.refresh) panel.refresh();
        if (panel?.setStageInfo) panel.setStageInfo(stageDesc);
      }
    }

    if (mode === 'LAB') {
      panel.updateAudioMeters(audio);
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
