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

  // 4. Bucle principal de animación a 60 FPS
  let lastTime = performance.now();

  function animate(now: number) {
    const dt = Math.min((now - lastTime) / 1000.0, 0.08);
    lastTime = now;
    const timeSec = now * 0.001;

    // A. Actualizar estado del audio y modular progresión temporal lenta de oro
    const audioState = audioController.update();
    // Proporción de agentes dorados aumenta suavemente a lo largo de la canción (0.0 -> 0.70)
    agentSystem.goldRatio = audioState.progress * 0.70;

    // B. Dinámicas de simulación
    woundManager.update(dt);
    flowField.update(dt, timeSec);
    agentSystem.update(dt, flowField, woundManager);

    // C. Renderizado y persistencia de estelas (Azul, Rojo herida, Oro Kintsugi)
    trailSystem.render(agentSystem, woundManager, ctx);

    // D. Actualizar interfaz y feedback
    uiOverlay.update();

    requestAnimationFrame(animate);
  }

  requestAnimationFrame(animate);
}

window.addEventListener('DOMContentLoaded', initApp);
