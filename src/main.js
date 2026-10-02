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
  let transitionDuration = 4.5; // duración en segundos de la transición

  const transitionToPalette = (targetId, duration = 4.5) => {
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
    transitionDuration = Math.max(0.5, duration);
  };

  // ARQUETIPOS GENERATIVOS 3D ----------------------------------------------
  const applyPreset = (id) => {
    if (id === 'silkFlower') {
      // Flor de Seda 3D: cáliz floral ondulante
      params.harmonics.value = 5.0;
      params.symmetryType.value = 0.0;
      params.swirl.value = 1.3;
      params.petalMorph.value = 1.25;
      params.curlStrength.value = 0.55;
      transitionToPalette(1.0, 3.5);
    } else if (id === 'wings') {
      // Alas Cósmicas 3D: lóbulos de mariposa con simetría bilateral
      params.harmonics.value = 2.0;
      params.symmetryType.value = 1.0;
      params.swirl.value = 0.9;
      params.petalMorph.value = 1.45;
      params.curlStrength.value = 0.65;
      transitionToPalette(3.0, 3.5);
    } else if (id === 'nebulaVortex') {
      // Vórtice Toroidal 3D: toroide y circulación poloidal
      params.harmonics.value = 3.0;
      params.symmetryType.value = 2.0;
      params.swirl.value = 2.4;
      params.petalMorph.value = 0.8;
      params.curlStrength.value = 0.95;
      transitionToPalette(2.0, 3.5);
    } else if (id === 'supernova') {
      // Supernova 3D: radiación esférica con ondulación armónica
      params.harmonics.value = 8.0;
      params.symmetryType.value = 3.0;
      params.swirl.value = 0.4;
      params.petalMorph.value = 1.5;
      params.curlStrength.value = 0.45;
      transitionToPalette(0.0, 3.5);
    } else if (id === 'causticRays') {
      // Rayos Helicoidales 3D: corrientes helicoidales en el eje vertical
      params.harmonics.value = 1.0;
      params.symmetryType.value = 4.0;
      params.swirl.value = 0.3;
      params.petalMorph.value = 0.6;
      params.curlStrength.value = 1.1;
      transitionToPalette(4.0, 3.5);
    }
    simulation.resetVisuals();
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
    onPaletteChange: (idx) => transitionToPalette(idx, 2.5)
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

    // 1-5: Cambios de sección y morfología armónica 3D
    if (event.code === 'Digit1') { applyPreset('silkFlower'); panel.refresh(); }
    if (event.code === 'Digit2') { applyPreset('wings'); panel.refresh(); }
    if (event.code === 'Digit3') { applyPreset('nebulaVortex'); panel.refresh(); }
    if (event.code === 'Digit4') { applyPreset('supernova'); panel.refresh(); }
    if (event.code === 'Digit5') { applyPreset('causticRays'); panel.refresh(); }

    // C: Ciclar paleta de color con transición gradual suave
    if (event.code === 'KeyC' && !event.repeat) {
      const nextPal = (Math.round(params.paletteB.value) + 1) % 5;
      transitionToPalette(nextPal, 2.8);
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

    // Deriva lenta y continua del espectro: los colores fluyen orgánicamente por los filamentos 3D
    params.chromaShift.value += dt * 0.035;

    // Interpolación suave y gradual entre paletas (avanza de a poco)
    if (params.paletteMix.value < 1.0) {
      params.paletteMix.value = Math.min(1.0, params.paletteMix.value + dt / transitionDuration);
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
        // Transición lenta, majestuosa y etérea de 6.0 segundos
        transitionToPalette(currentStage, 6.0);
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
