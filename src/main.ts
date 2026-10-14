/**
 * main.ts
 * Instrumento Visual "Heal" — Orquestador principal.
 *
 * Transformación estética solicitada:
 * - Fondo negro puro (#000000) sin viñeta.
 * - Curación: líneas doradas de oro Kintsugi sobre fondo negro (Imagen 1), sin pelotas.
 * - Partículas: figuras geométricas estilizadas en tonos blancos y azules (Imagen 2)
 *   (líneas/píldoras con borde de color, anillos concéntricos, cadenas de cuentas).
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

  // 1. RENDERER WEBGPU
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

  // 2. PARÁMETROS Y MOTORES
  const params = createDefaultParameters();
  params.vignette = 0.0;
  params.filmGrain = 0.0;

  const flowEngine = new FlowFieldEngine(screenW, screenH);
  const kintsugiLayer = new KintsugiLayer(screenW, screenH);
  const particleSystem = new FlowParticleSystem(screenW, screenH, 3800);
  const stressSystem = new StressSystem();
  const heartbeatSystem = new HeartbeatSystem();

  // 3. PASO DE COMPOSICIÓN WEBGPU FINAL
  const compositePass = new CompositePass(
    particleSystem.canvas,
    kintsugiLayer.canvas
  );

  // 4. FUNCIÓN DE REINICIO
  const resetExperience = () => {
    kintsugiLayer.clear();
    particleSystem.initUniformParticles();
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
      kintsugiLayer.addHealingEnergy(screenW * 0.5, screenH * 0.5, 0.2);
    }
  );

  // 6. ENTRADA DEL RATÓN
  const mouse = { x: screenW * 0.5, y: screenH * 0.5 };
  window.addEventListener('pointermove', (e: PointerEvent) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });

  // Al hacer clic, se vierte oro líquido directamente en las grietas cercanas
  window.addEventListener('pointerdown', (e: PointerEvent) => {
    if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.closest('.start-card') || (e.target as HTMLElement)?.closest('.heal-hud')) return;

    mouse.x = e.clientX;
    mouse.y = e.clientY;
    flowEngine.triggerKeyPulse(mouse.x, mouse.y, 'KeyG');
    particleSystem.addHealingEnergy(mouse.x, mouse.y, params.isClimax ? 0.40 : 0.25);
    kintsugiLayer.addHealingEnergy(mouse.x, mouse.y, params.isClimax ? 0.20 : 0.12);
    params.heartbeatFlash = Math.max(params.heartbeatFlash, 0.04);
  });

  // 7. TECLADO: INTERPRETACIÓN MUSICAL
  const HEALING_KEYS = new Set(['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP']);
  const HEARTBEAT_KEYS = new Set(['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM']);

  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return;

    const now = performance.now();

    // Espacio (mantener): Sustain (persistencia extendida de figuras)
    if (e.code === 'Space') {
      params.isSustain = true;
      e.preventDefault();
      return;
    }

    // Shift (mantener): Clímax (desactiva estrés, flujo veloz y oro abundante)
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      params.isClimax = true;
      params.stress = 0.0;
      return;
    }

    // Enter: Coda final (zoom de 1.0 a 0.35 en 8s)
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

    // Teclas agudas Q–P: Ondulan figuras blancas/azules y llenan las grietas con líneas de oro (Imagen 1)
    if (HEALING_KEYS.has(e.code)) {
      stressSystem.registerKeyPress(now, params.isClimax, params);

      // 1. Modifica visiblemente el movimiento de las figuras blancas y azules
      flowEngine.triggerKeyPulse(mouse.x, mouse.y, e.code);

      // 2. Vierte oro líquido directamente en las grietas visibles y cúmulos de herida
      const healAmount = params.isClimax ? 0.25 : 0.14;
      particleSystem.addHealingEnergy(mouse.x, mouse.y, params.isClimax ? 0.38 : 0.22);
      kintsugiLayer.addHealingEnergy(mouse.x, mouse.y, healAmount);

      // 3. Resplandor reactivo musical
      params.heartbeatFlash = Math.max(params.heartbeatFlash, 0.04);
      return;
    }

    // Teclas Z–M: Latidos radiales
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
    particleSystem.resize(screenW, screenH);
  });

  // 8. BUCLE PRINCIPAL DE ANIMACIÓN A 60 FPS
  let lastTime = performance.now();

  renderer.setAnimationLoop(() => {
    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000.0, 0.08);
    lastTime = now;
    const timeSec = now * 0.001;

    // A. Zoom final de Enter (de 1.0 a 0.35 en 8s con easing)
    if (params.isFinalZooming) {
      params.finalZoomProgress = Math.min(1.0, params.finalZoomProgress + dt / 8.0);
      const t = params.finalZoomProgress;
      const ease = t * t * (3.0 - 2.0 * t);
      params.zoom = 1.0 + (0.35 - 1.0) * ease;
    }

    // B. Dinámicas
    stressSystem.update(dt, params);
    heartbeatSystem.update(dt, params);
    flowEngine.update(dt, timeSec);

    // C. Actualizar y renderizar las figuras geométricas blancas y azules (Imagen 2)
    particleSystem.updateAndRender(dt, timeSec, flowEngine, params);

    // D. Actualizar y renderizar la herida visible y las grietas de oro puro Kintsugi (Imagen 1)
    kintsugiLayer.updateAndRender(dt, timeSec);

    // E. Progreso de curación real (0.0 a 1.0) medido por las líneas de oro selladas y cúmulos curados
    params.healingProgress = Math.max(kintsugiLayer.getHealingProgress(), particleSystem.getHealingProgress());

    // F. Actualizar HUD dinámico
    startScreen.updateHud(params.healingProgress, params.stress, params.showParticles);

    // G. Composición WebGPU en pantalla completa sin viñeta sobre fondo negro puro
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
