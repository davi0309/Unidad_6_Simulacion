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

  // ARQUETIPOS GENERATIVOS 3D ----------------------------------------------
  const applyPreset = (id) => {
    if (id === 'silkFlower') {
      // Flor de Seda 3D: cáliz floral ondulante
      params.harmonics.value = 5.0;
      params.symmetryType.value = 0.0;
      params.swirl.value = 1.3;
      params.petalMorph.value = 1.25;
      params.curlStrength.value = 0.55;
      params.paletteId.value = 1.0;
    } else if (id === 'wings') {
      // Alas Cósmicas 3D: lóbulos de mariposa con simetría bilateral
      params.harmonics.value = 2.0;
      params.symmetryType.value = 1.0;
      params.swirl.value = 0.9;
      params.petalMorph.value = 1.45;
      params.curlStrength.value = 0.65;
      params.paletteId.value = 3.0;
    } else if (id === 'nebulaVortex') {
      // Vórtice Toroidal 3D: toroide y circulación poloidal
      params.harmonics.value = 3.0;
      params.symmetryType.value = 2.0;
      params.swirl.value = 2.4;
      params.petalMorph.value = 0.8;
      params.curlStrength.value = 0.95;
      params.paletteId.value = 2.0;
    } else if (id === 'supernova') {
      // Supernova 3D: radiación esférica con ondulación armónica
      params.harmonics.value = 8.0;
      params.symmetryType.value = 3.0;
      params.swirl.value = 0.4;
      params.petalMorph.value = 1.5;
      params.curlStrength.value = 0.45;
      params.paletteId.value = 0.0;
    } else if (id === 'causticRays') {
      // Rayos Helicoidales 3D: corrientes helicoidales en el eje vertical
      params.harmonics.value = 1.0;
      params.symmetryType.value = 4.0;
      params.swirl.value = 0.3;
      params.petalMorph.value = 0.6;
      params.curlStrength.value = 1.1;
      params.paletteId.value = 4.0;
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
    onSpeedChange: (mult) => setSpeedMultiplier(mult)
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

    // C: Ciclar paleta de color
    if (event.code === 'KeyC' && !event.repeat) {
      params.paletteId.value = (params.paletteId.value + 1) % 5;
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
  renderer.setAnimationLoop(() => {
    const audio = audioManager.update();

    // El audio modula únicamente iluminación y fulgor sutil
    params.audioGlow.value = audio.bass * 0.7 + audio.energy * 0.4;
    params.audioShimmer.value = audio.treble;

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
