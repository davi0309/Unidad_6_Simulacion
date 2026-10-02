/**
 * main.ts
 * Instrumento Visual "Heal" — Orquestador principal.
 *
 * Diseñado exclusivamente para acompañar la canción "Heal" de Tom Odell.
 * Kintsugi, tejido vivo, persistencia y resiliencia.
 * Sin análisis de audio.
 */

import * as THREE from 'three/webgpu';
import WebGPU from 'three/addons/capabilities/WebGPU.js';
import './styles.css';

import { createDefaultParameters, updateTissueParameters } from './simulation/parameters';
import { WoundSystem } from './simulation/woundSDF';
import { FractureSystem } from './simulation/fractureFragments';
import { StressSystem } from './simulation/stressSystem';
import { HeartbeatSystem } from './simulation/heartbeatSystem';
import { HealingCellSystem } from './simulation/healingCells';
import { TissuePhysarumSystem } from './simulation/tissuePhysarum';
import { GoldPhysarumSystem } from './simulation/goldPhysarum';
import { CompositePass } from './rendering/compositePass';
import { StartScreen } from './ui/startScreen';
import { DebugPanel } from './ui/debugPanel';

async function main() {
  const mount = document.querySelector('#app') as HTMLElement;

  if (!WebGPU.isAvailable()) {
    mount.appendChild(WebGPU.getErrorMessage());
    throw new Error('Este instrumento visual requiere WebGPU para ejecutar la simulación de Physarum en GPU.');
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

  // 2. DIMENSIONES DEL DOMINIO Y DE LA SIMULACIÓN
  const screenW = window.innerWidth;
  const screenH = window.innerHeight;
  // Dominio de simulación = 1.6x el viewport (para el zoom final de Enter)
  const domainW = screenW * 1.6;
  const domainH = screenH * 1.6;
  // Resolución de simulación = mitad de la resolución de pantalla
  const simW = Math.max(256, Math.floor(screenW * 0.8));
  const simH = Math.max(256, Math.floor(screenH * 0.8));

  // 3. PARÁMETROS Y SISTEMA DE HERIDA (SDF)
  const params = createDefaultParameters();
  const woundSystem = new WoundSystem(domainW, domainH, simW, simH);

  // 4. SISTEMAS DE FÍSICA Y DINÁMICA
  const fractureSystem = new FractureSystem();
  const stressSystem = new StressSystem((origin, _end) => {
    // Callback al dispararse una microfractura por estrés > 1
    tissuePhysarum.updateSDFTexture(woundSystem);
  });
  const heartbeatSystem = new HeartbeatSystem();

  // 5. ESPECIES DE PHYSARUM
  const tissuePhysarum = new TissuePhysarumSystem(
    domainW,
    domainH,
    simW,
    simH,
    params.tissueCount,
    woundSystem
  );

  const goldPhysarum = new GoldPhysarumSystem(
    domainW,
    domainH,
    simW,
    simH,
    params.goldPoolMax,
    woundSystem
  );

  // 6. CÉLULAS SANADORAS (STEERING BEHAVIORS)
  const healingCellSystem = new HealingCellSystem((wx, wy) => {
    // Al entrar a la herida (SDF < 0), la célula se convierte en 1 agente dorado
    const life = params.isSustain ? params.goldLifeSustain : params.goldLifeNormal;
    goldPhysarum.spawnAgent(wx, wy, life);
  });

  // 7. CANVAS OVERLAY 2D (Células sanadoras con halo y fragmentos de fractura)
  const overlayCanvas = document.createElement('canvas');
  overlayCanvas.width = screenW;
  overlayCanvas.height = screenH;
  const overlayCtx = overlayCanvas.getContext('2d')!;

  // 8. PASO DE COMPOSICIÓN FINAL
  const compositePass = new CompositePass(
    tissuePhysarum.trailRT_A,
    goldPhysarum.goldTrailRT_A,
    goldPhysarum.scarRT,
    (tissuePhysarum as any).woundSDFTexture,
    overlayCanvas
  );

  // 9. REINICIO DE HERIDA
  const resetWound = () => {
    woundSystem.generateProceduralWound();
    woundSystem.generateAncientScars();
    woundSystem.recomputeSDF();
    tissuePhysarum.updateSDFTexture(woundSystem);
    tissuePhysarum.reset(woundSystem);
    goldPhysarum.reset(woundSystem);
    healingCellSystem.clear();
    fractureSystem.clear();
    heartbeatSystem.clear();
    params.healingProgress = 0.0;
    params.stress = 0.0;
    params.zoom = 1.0;
    params.isFinalZooming = false;
    params.finalZoomProgress = 0.0;
  };

  // 10. INTERFAZ Y PANTALLA INICIAL
  new StartScreen();
  new DebugPanel(
    params,
    () => resetWound(),
    () => {
      const { origin } = woundSystem.addMicrofracture();
      fractureSystem.spawnFragments(origin.x, origin.y, 30);
      tissuePhysarum.updateSDFTexture(woundSystem);
    }
  );

  // 11. MANEJO DE ENTRADAS (RATÓN Y TECLADO)
  const mouseScreen = { x: screenW * 0.5, y: screenH * 0.5 };
  const mouseDomain = { x: domainW * 0.5, y: domainH * 0.5 };

  const updateMouseCoords = (clientX: number, clientY: number) => {
    mouseScreen.x = clientX;
    mouseScreen.y = clientY;

    // Convertir coordenadas de pantalla a coordenadas del dominio de simulación
    const offsetX = (domainW - screenW) * 0.5;
    const offsetY = (domainH - screenH) * 0.5;
    mouseDomain.x = clientX + offsetX;
    mouseDomain.y = clientY + offsetY;
  };

  window.addEventListener('pointermove', (e: PointerEvent) => {
    updateMouseCoords(e.clientX, e.clientY);
  });

  // TECLADO: INTERPRETACIÓN MUSICAL
  const HEALING_KEYS = new Set(['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP']);
  const HEARTBEAT_KEYS = new Set(['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM']);

  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return;

    const now = performance.now();

    // Espacio (mantener): Sustain
    if (e.code === 'Space') {
      params.isSustain = true;
      e.preventDefault();
      return;
    }

    // Shift (mantener): Clímax
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      params.isClimax = true;
      params.stress = 0.0;
      return;
    }

    // Enter: Final (zoom de 1.0 a 0.35 en 8 s con easing)
    if (e.code === 'Enter' && !e.repeat) {
      params.isFinalZooming = true;
      params.finalZoomProgress = 0.0;
      return;
    }

    // Escape: Reiniciar con una herida nueva
    if (e.code === 'Escape' && !e.repeat) {
      resetWound();
      return;
    }

    // Teclas agudas Q–P: Células sanadoras
    if (HEALING_KEYS.has(e.code)) {
      stressSystem.registerKeyPress(now, params.isClimax, params);
      healingCellSystem.spawnCells(mouseDomain.x, mouseDomain.y, e.code, params, woundSystem);
      return;
    }

    // Teclas Z–M: Latidos radiales
    if (HEARTBEAT_KEYS.has(e.code)) {
      stressSystem.registerKeyPress(now, params.isClimax, params);
      const maxDist = Math.hypot(domainW, domainH) * 0.6;
      heartbeatSystem.triggerBeat(e.code, woundSystem.center, params, maxDist);
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
    const nw = window.innerWidth;
    const nh = window.innerHeight;
    renderer.setSize(nw, nh);
    overlayCanvas.width = nw;
    overlayCanvas.height = nh;
  });

  // 12. BUCLE PRINCIPAL DE ANIMACIÓN A 60 FPS
  let lastTime = performance.now();
  let frameCounter = 0;

  renderer.setAnimationLoop(() => {
    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000.0, 0.08);
    lastTime = now;
    frameCounter++;

    // A. Zoom final de Enter (de 1.0 a 0.35 en 8 s con easing)
    if (params.isFinalZooming) {
      params.finalZoomProgress = Math.min(1.0, params.finalZoomProgress + dt / 8.0);
      // Easing suave (smoothstep cúbico)
      const t = params.finalZoomProgress;
      const ease = t * t * (3.0 - 2.0 * t);
      params.zoom = 1.0 + (0.35 - 1.0) * ease;
    }

    // B. Rampa de Clímax (Shift)
    if (params.isClimax) {
      params.climaxIntensity = Math.min(1.0, params.climaxIntensity + dt / 1.5);
      params.bloomStrength = 0.6 + (1.4 - 0.6) * params.climaxIntensity;
    } else {
      params.climaxIntensity = Math.max(0.0, params.climaxIntensity - dt / 1.5);
      params.bloomStrength = 0.6 + (1.4 - 0.6) * params.climaxIntensity;
    }

    // C. Actualizar sistemas de estrés, latidos y partículas
    stressSystem.update(dt, params, woundSystem, fractureSystem);
    heartbeatSystem.update(dt, params);
    healingCellSystem.update(dt, params, woundSystem);
    fractureSystem.update(dt);

    // D. Interpolación de parámetros de tejido según healingProgress
    updateTissueParameters(params);
    tissuePhysarum.updateUniforms(params);
    goldPhysarum.updateUniforms(params, dt);

    // E. Estimación periódica de healingProgress cada 10 frames
    if (frameCounter % 10 === 0) {
      // El progreso de curación aumenta a medida que los agentes dorados consolidan la herida
      const targetHealedRatio = Math.min(1.0, goldPhysarum.activeCount / 120.0);
      params.healingProgress = Math.max(params.healingProgress, targetHealedRatio);
    }

    // F. Renderizar células sanadoras y fragmentos de fractura en el overlay canvas
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    const offsetX = (domainW - screenW) * 0.5;
    const offsetY = (domainH - screenH) * 0.5;

    // 1. Dibujar fragmentos de microfractura (líneas #5a0f17)
    overlayCtx.strokeStyle = '#5a0f17';
    overlayCtx.lineWidth = 2.0;
    for (const f of fractureSystem.fragments) {
      const sx = f.x - offsetX;
      const sy = f.y - offsetY;
      const angle = Math.atan2(f.vy, f.vx);
      overlayCtx.beginPath();
      overlayCtx.moveTo(sx, sy);
      overlayCtx.lineTo(sx - Math.cos(angle) * f.len, sy - Math.sin(angle) * f.len);
      overlayCtx.stroke();
    }

    // 2. Dibujar células sanadoras
    for (const c of healingCellSystem.cells) {
      const sx = c.x - offsetX;
      const sy = c.y - offsetY;
      const alpha = Math.min(1.0, c.life);

      if (c.isForced) {
        // Modo forzado: líneas orientadas color #ffb3b3, largo = vel * 4 px
        const spd = Math.sqrt(c.vx * c.vx + c.vy * c.vy);
        const len = spd * 4.0;
        const ang = Math.atan2(c.vy, c.vx);
        overlayCtx.strokeStyle = `rgba(255, 179, 179, ${alpha.toFixed(2)})`;
        overlayCtx.lineWidth = 2.2;
        overlayCtx.beginPath();
        overlayCtx.moveTo(sx, sy);
        overlayCtx.lineTo(sx - Math.cos(ang) * len, sy - Math.sin(ang) * len);
        overlayCtx.stroke();
      } else {
        // Modo normal: núcleo de 2.5 px con halo de 8 px, blending aditivo
        const tr = Math.round(c.tint.r * 255);
        const tg = Math.round(c.tint.g * 255);
        const tb = Math.round(c.tint.b * 255);

        // Halo suave de 8 px al 35% de opacidad
        const haloGrad = overlayCtx.createRadialGradient(sx, sy, 1.0, sx, sy, 8.0);
        haloGrad.addColorStop(0.0, `rgba(255, 217, 160, ${(0.35 * alpha).toFixed(2)})`);
        haloGrad.addColorStop(1.0, 'rgba(255, 217, 160, 0.0)');
        overlayCtx.fillStyle = haloGrad;
        overlayCtx.beginPath();
        overlayCtx.arc(sx, sy, 8.0, 0, Math.PI * 2);
        overlayCtx.fill();

        // Núcleo brillante de 2.5 px teñido con su tecla
        overlayCtx.fillStyle = `rgba(${tr}, ${tg}, ${tb}, ${alpha.toFixed(2)})`;
        overlayCtx.beginPath();
        overlayCtx.arc(sx, sy, 2.5, 0, Math.PI * 2);
        overlayCtx.fill();
      }
    }

    // 3. Dibujar destellos de llegada (sparks)
    for (const sp of healingCellSystem.sparks) {
      const sx = sp.x - offsetX;
      const sy = sp.y - offsetY;
      const t = sp.life / sp.maxLife;
      const radius = 12.0 * (1.0 - t);
      const sparkGrad = overlayCtx.createRadialGradient(sx, sy, 0.5, sx, sy, Math.max(1.0, radius));
      sparkGrad.addColorStop(0.0, `rgba(255, 246, 230, ${t.toFixed(2)})`);
      sparkGrad.addColorStop(1.0, 'rgba(255, 210, 122, 0.0)');
      overlayCtx.fillStyle = sparkGrad;
      overlayCtx.beginPath();
      overlayCtx.arc(sx, sy, radius, 0, Math.PI * 2);
      overlayCtx.fill();
    }

    // G. Pasos de simulación en GPU
    tissuePhysarum.step(renderer);
    goldPhysarum.step(renderer);

    // H. Renderizado de la composición final
    compositePass.update(params, now * 0.001);
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
