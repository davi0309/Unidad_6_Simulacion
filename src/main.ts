/**
 * main.ts
 * Instrumento Visual "Heal" — Orquestador principal.
 *
 * Diseñado exclusivamente para acompañar la canción "Heal" de Tom Odell.
 * Kintsugi, tejido en flujo sedoso (Flow Field) y cicatriz dorada permanente.
 *
 * Estética inspirada en las referencias:
 * - Imagen 4: Filamentos sedosos orgánicos que convergen en un río carmesí/magenta ardiente.
 * - Imagen 5: Fondo de porcelana obsidiana con grietas de oro metálico 24K puro.
 */

import * as THREE from 'three/webgpu';
import WebGPU from 'three/addons/capabilities/WebGPU.js';
import './styles.css';

import { createDefaultParameters } from './simulation/parameters';
import { FlowFieldEngine } from './simulation/flowField';
import { FlowParticleSystem } from './simulation/particleSystem';
import { KintsugiLayer } from './simulation/kintsugiLayer';
import { StressSystem } from './simulation/stressSystem';
import { HeartbeatSystem } from './simulation/heartbeatSystem';
import { CompositePass } from './rendering/compositePass';
import { StartScreen } from './ui/startScreen';
import { DebugPanel } from './ui/debugPanel';

async function main() {
  const mount = document.querySelector('#app') as HTMLElement;

  if (!WebGPU.isAvailable()) {
    mount.appendChild(WebGPU.getErrorMessage());
    throw new Error('Este instrumento visual requiere WebGPU.');
  }

  // 1. CONFIGURACIÓN DEL CANVAS Y RENDERER WEBGPU
  const renderer = new THREE.WebGPURenderer({
    antialias: true,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.domElement.style.position = 'absolute';
  renderer.domElement.style.inset = '0';
  mount.appendChild(renderer.domElement);
  await renderer.init();

  let screenW = window.innerWidth;
  let screenH = window.innerHeight;

  // 2. PARÁMETROS Y MOTORES DE SIMULACIÓN
  const params = createDefaultParameters();
  const flowEngine = new FlowFieldEngine(screenW, screenH);
  const kintsugiLayer = new KintsugiLayer(screenW, screenH);
  const particleSystem = new FlowParticleSystem(screenW, screenH, 10000);
  const stressSystem = new StressSystem();
  const heartbeatSystem = new HeartbeatSystem();

  // Precargar cicatrices antiguas periféricas en la porcelana (reveladas en el zoom de Enter)
  kintsugiLayer.paintAncientScars(screenW * 0.5, screenH * 0.5, screenW * 0.45, screenH * 0.45);

  // 3. PASO DE COMPOSICIÓN WEBGPU FINAL
  const compositePass = new CompositePass(
    particleSystem.canvas,
    kintsugiLayer.canvas
  );

  // 4. FUNCIÓN DE REINICIO
  const resetExperience = () => {
    flowEngine.buildWoundGeometry();
    kintsugiLayer.clear();
    kintsugiLayer.paintAncientScars(screenW * 0.5, screenH * 0.5, screenW * 0.45, screenH * 0.45);
    heartbeatSystem.clear();
    params.healingProgress = 0.0;
    params.stress = 0.0;
    params.zoom = 1.0;
    params.isFinalZooming = false;
    params.finalZoomProgress = 0.0;
  };

  // 5. INTERFAZ Y PANTALLA INICIAL (KINTSUGI)
  const startScreen = new StartScreen(
    undefined,
    () => {
      params.showParticles = !params.showParticles;
      startScreen.updateHud(params.healingProgress, params.stress, params.showParticles);
    }
  );

  new DebugPanel(
    params,
    () => resetExperience(),
    () => {
      // Disparar crecimiento forzado de la herida en debug
      flowEngine.woundGrowth = Math.min(1.0, flowEngine.woundGrowth + 0.15);
    }
  );

  // 6. ENTRADA DEL RATÓN
  const mouse = { x: screenW * 0.5, y: screenH * 0.5 };
  window.addEventListener('pointermove', (e: PointerEvent) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });

  // Clic directo también libera células sanadoras en el cursor
  window.addEventListener('pointerdown', (e: PointerEvent) => {
    if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.closest('.start-card') || (e.target as HTMLElement)?.closest('.heal-hud')) return;

    mouse.x = e.clientX;
    mouse.y = e.clientY;
    const woundInf = flowEngine.getWoundInfluence(mouse.x, mouse.y);
    const targetIdx = Math.floor(woundInf.spineT * (flowEngine.woundSpine.length - 1));
    const targetPt = flowEngine.woundSpine[targetIdx] || { x: screenW * 0.5, y: screenH * 0.5 };

    flowEngine.triggerKeyPerturbation(mouse.x, mouse.y, 'KeyG');
    particleSystem.spawnHealingCells(mouse.x, mouse.y, params.isClimax ? 30 : 12, targetPt);
  });

  // 7. TECLADO: INTERPRETACIÓN MUSICAL
  const HEALING_KEYS = new Set(['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP']);
  const HEARTBEAT_KEYS = new Set(['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM']);

  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return;

    const now = performance.now();

    // Espacio (mantener): Sustain (persistencia extendida de filamentos sedosos)
    if (e.code === 'Space') {
      params.isSustain = true;
      e.preventDefault();
      return;
    }

    // Shift (mantener): Clímax (desactiva estrés, flujo generoso y bloom)
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      params.isClimax = true;
      params.stress = 0.0;
      return;
    }

    // Enter: Coda final (zoom cinematográfico de 1.0 a 0.35 en 8s con easing)
    if (e.code === 'Enter' && !e.repeat) {
      params.isFinalZooming = true;
      params.finalZoomProgress = 0.0;
      return;
    }

    // Escape: Reiniciar
    if (e.code === 'Escape' && !e.repeat) {
      resetExperience();
      return;
    }

    // Teclas agudas Q–P: Modifican el flujo ambiente y liberan oro sanador
    if (HEALING_KEYS.has(e.code)) {
      stressSystem.registerKeyPress(now, params.isClimax, params);

      // 1. Perturba el flujo de las partículas blancas ambiente
      flowEngine.triggerKeyPerturbation(mouse.x, mouse.y, e.code);

      // 2. Libera células sanadoras doradas que buscan la herida
      const woundInf = flowEngine.getWoundInfluence(mouse.x, mouse.y);
      const targetIdx = Math.floor(woundInf.spineT * (flowEngine.woundSpine.length - 1));
      const targetPt = flowEngine.woundSpine[targetIdx] || { x: screenW * 0.5, y: screenH * 0.5 };

      const cellCount = params.isClimax ? 40 : 12;
      particleSystem.spawnHealingCells(mouse.x, mouse.y, cellCount, targetPt);
      return;
    }

    // Teclas Z–M: Latidos y respiración radial
    if (HEARTBEAT_KEYS.has(e.code)) {
      stressSystem.registerKeyPress(now, params.isClimax, params);
      const center = { x: screenW * 0.5, y: screenH * 0.5 };
      heartbeatSystem.triggerBeat(e.code, center, params, Math.hypot(screenW, screenH) * 0.6);
      return;
    }

    // V: Alternar visualización
    if (e.code === 'KeyV' && !e.repeat) {
      params.showParticles = !params.showParticles;
      startScreen.updateHud(params.healingProgress, params.stress, params.showParticles);
      return;
    }

    // H: Alternar visibilidad del HUD
    if (e.code === 'KeyH' && !e.repeat) {
      startScreen.toggleHud();
      return;
    }
  });

  window.addEventListener('keyup', (e: KeyboardEvent) => {
    if (e.code === 'Space') {
      params.isSustain = false;
    }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      params.isClimax = false;
    }
  });

  // REDIMENSIONADO DE VENTANA
  window.addEventListener('resize', () => {
    screenW = window.innerWidth;
    screenH = window.innerHeight;
    renderer.setSize(screenW, screenH);
    flowEngine.resize(screenW, screenH);
    kintsugiLayer.resize(screenW, screenH);
    kintsugiLayer.paintAncientScars(screenW * 0.5, screenH * 0.5, screenW * 0.45, screenH * 0.45);
    particleSystem.resize(screenW, screenH);
  });

  // 8. BUCLE PRINCIPAL DE ANIMACIÓN A 60 FPS
  let lastTime = performance.now();

  renderer.setAnimationLoop(() => {
    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000.0, 0.08);
    lastTime = now;
    const timeSec = now * 0.001;

    // A. Actualizar progreso de la canción y crecimiento de la herida
    const audioEl = startScreen.audioElement;
    if (audioEl && !audioEl.paused && audioEl.duration) {
      flowEngine.updateSongProgress(audioEl.currentTime, audioEl.duration);
    }

    // B. Zoom final de Enter (de 1.0 a 0.35 en 8s con easing suave)
    if (params.isFinalZooming) {
      params.finalZoomProgress = Math.min(1.0, params.finalZoomProgress + dt / 8.0);
      const t = params.finalZoomProgress;
      const ease = t * t * (3.0 - 2.0 * t);
      params.zoom = 1.0 + (0.35 - 1.0) * ease;
    }

    // C. Clímax (Shift)
    if (params.isClimax) {
      params.climaxIntensity = Math.min(1.0, params.climaxIntensity + dt / 1.5);
      params.bloomStrength = 0.6 + 0.8 * params.climaxIntensity;
    } else {
      params.climaxIntensity = Math.max(0.0, params.climaxIntensity - dt / 1.5);
      params.bloomStrength = 0.6 + 0.8 * params.climaxIntensity;
    }

    // D. Actualizar dinámicas
    stressSystem.update(dt, params);
    heartbeatSystem.update(dt, params);
    flowEngine.update(dt);

    // E. Actualizar y renderizar filamentos de flujo de partículas (Imagen 4)
    particleSystem.updateAndRender(dt, timeSec, flowEngine, kintsugiLayer, params);

    // F. Dibujar destellos estelares (✦) de los nodos de oro (Imagen 5)
    kintsugiLayer.drawGlints(particleSystem.ctx, dt);

    // G. Calcular progreso de curación real basado en las vetas de oro consolidadas
    const goldHealing = kintsugiLayer.getHealingProgress();
    params.healingProgress = Math.max(params.healingProgress, goldHealing);

    // Actualizar HUD
    startScreen.updateHud(params.healingProgress, params.stress, params.showParticles);

    // H. Composición final en WebGPU con tonemapping, bloom, grano analógico y viñeta
    compositePass.update(params, timeSec);
    compositePass.render(renderer);
  });
}

main().catch((err) => {
  console.error(err);
  const pre = document.createElement('pre');
  pre.style.cssText = 'position:fixed;inset:16px;white-space:pre-wrap;color:#ff5555;background:#111;padding:16px;z-index:999';
  pre.textContent = String(err?.stack || err);
  document.body.append(pre);
});
