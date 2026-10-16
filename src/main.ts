/**
 * main.ts
 * Punto de entrada principal para el Instrumento Visual Interactivo: HEAL
 * Inspirado en la metáfora del Kintsugi y la obra musical de Tom Odell.
 */

import './styles.css';
import { FlowField } from './engine/flowField';
import { WoundManager } from './engine/woundManager';
import { AgentSystem } from './engine/agentSystem';
import { TrailSystem } from './engine/trailSystem';
import { KeyboardController } from './engine/keyboardController';
import { AudioController } from './engine/audioController';
import { UIOverlay } from './ui/uiOverlay';

function initApp() {
  let screenW = window.innerWidth;
  let screenH = window.innerHeight;

  // 1. Lienzo principal de renderizado
  const canvas = document.createElement('canvas');
  canvas.id = 'renderCanvas';
  canvas.width = screenW;
  canvas.height = screenH;
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d', { willReadFrequently: false })!;

  // 2. Inicialización de subsistemas desacoplados
  const flowField = new FlowField(screenW, screenH);
  const woundManager = new WoundManager(screenW, screenH);
  const agentSystem = new AgentSystem(screenW, screenH, 3600);
  const trailSystem = new TrailSystem(screenW, screenH);
  const audioController = new AudioController();

  const restartExperience = () => {
    woundManager.clear();
    trailSystem.clear();
    agentSystem.initAgents();
    audioController.restart();
  };

  const keyboardController = new KeyboardController(
    flowField,
    woundManager,
    agentSystem,
    restartExperience
  );

  const uiOverlay = new UIOverlay(
    audioController,
    keyboardController,
    restartExperience
  );

  // 3. Manejo de redimensionado de ventana continuo
  window.addEventListener('resize', () => {
    screenW = window.innerWidth;
    screenH = window.innerHeight;

    canvas.width = screenW;
    canvas.height = screenH;

    flowField.resize(screenW, screenH);
    woundManager.resize(screenW, screenH);
    agentSystem.resize(screenW, screenH);
    trailSystem.resize(screenW, screenH);
  });

  // 4. Bucle principal de animación a 60 FPS con dilatación temporal cinemática
  let lastTime = performance.now();
  let currentSpeedScale = 0.55; // Velocidad base global más lenta y contemplativa

  function animate(now: number) {
    const rawDt = Math.min((now - lastTime) / 1000.0, 0.08);
    lastTime = now;

    // Velocidad base serena (0.55x). Al sostener el clic y dibujar una herida, cae a cámara lenta profunda (0.16x)
    const targetSpeedScale = keyboardController.isDrawingWound ? 0.16 : 0.55;
    // Transición suave exponencial hacia la velocidad objetivo (cámara lenta gradual y orgánica)
    currentSpeedScale += (targetSpeedScale - currentSpeedScale) * 0.12;

    const dt = rawDt * currentSpeedScale;
    const timeSec = now * 0.001 * currentSpeedScale;

    // A. Actualizar estado del audio
    audioController.update();

    // B. Dinámicas de simulación
    woundManager.update(dt);
    flowField.update(dt, timeSec);
    agentSystem.update(dt, flowField);

    // C. Renderizado y persistencia de estelas (Azul, Rojo herida, Oro Kintsugi)
    trailSystem.render(agentSystem, woundManager, ctx);

    // D. Actualizar interfaz y feedback
    uiOverlay.update();

    requestAnimationFrame(animate);
  }

  requestAnimationFrame(animate);
}

window.addEventListener('DOMContentLoaded', initApp);
