import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import WebGPU from 'three/addons/capabilities/WebGPU.js';
import './styles.css';

import { createParameters } from './simulation/parameters.js';
import { createSimulation } from './simulation/createSimulation.js';
import { createAudioManager } from './simulation/audioManager.js';
import { createLabPanel } from './ui/labPanel.js';

const PARTICLE_COUNT = 131072; // 2^17 agentes en GPU para filamentos densos

async function main() {
  const mount = document.querySelector('#app');

  if (!WebGPU.isAvailable()) {
    mount.appendChild(WebGPU.getErrorMessage());
    throw new Error('Este proyecto requiere WebGPU para ejecutar los compute shaders de agentes.');
  }

  // ESCENA SOBRE FONDO NEGRO PURO ------------------------------------------
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#000000');

  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.05, 100);
  camera.position.set(0, 0, 9.5);

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
    // Si no es un clic sobre la interfaz HTML
    if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT' && !e.target.closest('.panel')) {
      params.attractorStrength.value = 5.5; // Activa el atractor/vórtice manual
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

  // ARQUETIPOS GENERATIVOS PARA INTERPRETAR EN VIVO -------------------------
  const applyPreset = (id) => {
    if (id === 'silkFlower') {
      params.harmonics.value = 5.0;
      params.symmetryType.value = 0.0;
      params.swirl.value = 1.3;
      params.petalMorph.value = 1.1;
      params.curlStrength.value = 0.6;
      params.paletteId.value = 1.0;
    } else if (id === 'wings') {
      params.harmonics.value = 2.0;
      params.symmetryType.value = 1.0; // Simetría bilateral
      params.swirl.value = 0.9;
      params.petalMorph.value = 1.35;
      params.curlStrength.value = 0.75;
      params.paletteId.value = 3.0;
    } else if (id === 'nebulaVortex') {
      params.harmonics.value = 3.0;
      params.symmetryType.value = 0.0;
      params.swirl.value = 2.6;
      params.petalMorph.value = 0.7;
      params.curlStrength.value = 1.1;
      params.paletteId.value = 2.0;
    } else if (id === 'supernova') {
      params.harmonics.value = 8.0;
      params.symmetryType.value = 0.0;
      params.swirl.value = 0.4;
      params.petalMorph.value = 1.4;
      params.curlStrength.value = 0.5;
      params.paletteId.value = 0.0;
    } else if (id === 'causticRays') {
      params.harmonics.value = 1.0;
      params.symmetryType.value = 0.0;
      params.swirl.value = 0.2;
      params.petalMorph.value = 0.5;
      params.curlStrength.value = 1.3;
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
    hud.innerHTML = lab
      ? '<strong>LAB</strong> · P: performance · R: mutar (sin pausar música) · Espacio: acento · Flechas: ajustar forma'
      : '<strong>PERFORMANCE</strong> · P: lab · Espacio: acento · Arrastrar: conducir · Flechas: modular';
  };

  const hud = document.createElement('div');
  hud.className = 'hud';
  document.body.append(hud);

  const panel = createLabPanel({
    params,
    audioManager,
    onResetVisuals: () => simulation.resetVisuals(),
    onApplyPreset: applyPreset,
    onModeChange: () => setMode(mode === 'LAB' ? 'PERFORMANCE' : 'LAB')
  });

  setMode('LAB');

  // MAPEO DE TECLADO PARA TOCAR EL INSTRUMENTO EN VIVO ----------------------
  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;

    if (event.code === 'KeyP') setMode(mode === 'LAB' ? 'PERFORMANCE' : 'LAB');

    // R: Mutar visuales sin reiniciar la música
    if (event.code === 'KeyR') {
      simulation.resetVisuals();
      panel.refresh();
    }

    // 1-5: Cambios de sección y morfología armónica
    if (event.code === 'Digit1') { applyPreset('silkFlower'); panel.refresh(); }
    if (event.code === 'Digit2') { applyPreset('wings'); panel.refresh(); }
    if (event.code === 'Digit3') { applyPreset('nebulaVortex'); panel.refresh(); }
    if (event.code === 'Digit4') { applyPreset('supernova'); panel.refresh(); }
    if (event.code === 'Digit5') { applyPreset('causticRays'); panel.refresh(); }

    // C: Ciclar paleta de color
    if (event.code === 'KeyC') {
      params.paletteId.value = (params.paletteId.value + 1) % 5;
      panel.refresh();
    }

    // F: Invertir sentido del flujo (implosión vs expansión)
    if (event.code === 'KeyF') {
      params.flowDirection.value *= -1.0;
      panel.refresh();
    }

    // Espacio: Acento musical manual del intérprete
    if (event.code === 'Space') {
      event.preventDefault();
      params.userPulse.value = 1.0;
    }

    // Flechas Arriba/Abajo: Modular torsión/vorticidad en vivo
    if (event.code === 'ArrowUp') {
      params.swirl.value = Math.min(4.0, params.swirl.value + 0.2);
      panel.refresh();
    }
    if (event.code === 'ArrowDown') {
      params.swirl.value = Math.max(-4.0, params.swirl.value - 0.2);
      panel.refresh();
    }

    // Flechas Izquierda/Derecha: Modular armónicos / pétalos en vivo
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
  });

  window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  simulation.reset();

  // FRAME ANIMATION LOOP ---------------------------------------------------
  renderer.setAnimationLoop(() => {
    // 1. Extraer datos de la música
    const audio = audioManager.update();

    // 2. ÚNICAMENTE modular brillo y fulgor sutil con el audio (CERO FUERZA FÍSICA)
    params.audioGlow.value = audio.bass * 0.7 + audio.energy * 0.4;
    params.audioShimmer.value = audio.treble;

    // 3. Vúmetros en modo LAB
    if (mode === 'LAB') {
      panel.updateAudioMeters(audio);
    }

    // 4. Paso de simulación de agentes en compute shaders
    simulation.stepSimulation();

    // 5. Renderizado
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
