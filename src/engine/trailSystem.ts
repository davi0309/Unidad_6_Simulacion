/**
 * trailSystem.ts
 * Sistema de Renderizado de Estelas y Espacios Trigger para HEAL:
 * - Lienzo dinámico con persistencia y desvanecimiento controlado sobre fondo azul-noche (#02040a).
 * - Renderizado en lotes por color a 60 FPS estables.
 * - Los filamentos cambian dinámicamente de color al cruzar espacios tipo trigger (Rojo para fracturas, Oro para Kintsugi).
 * - Al salir del espacio trigger, retornan inmediatamente a su color natural azul.
 * - Cero estelas estáticas o agentes inmóviles: flujo 100% cinético y vivo.
 */

import { AgentSystem } from './agentSystem';
import { WoundManager, ZoneType } from './woundManager';

export class TrailSystem {
  public width: number;
  public height: number;

  public mainCanvas: HTMLCanvasElement;
  public mainCtx: CanvasRenderingContext2D;

  // Parámetro de desvanecimiento general (fade/decay rate)
  public decayRate: number = 0.022;

  constructor(w: number, h: number) {
    this.width = w;
    this.height = h;

    this.mainCanvas = document.createElement('canvas');
    this.mainCanvas.width = w;
    this.mainCanvas.height = h;
    this.mainCtx = this.mainCanvas.getContext('2d', { willReadFrequently: false })!;

    this.clear();
  }

  public resize(w: number, h: number) {
    this.width = w;
    this.height = h;
    this.mainCanvas.width = w;
    this.mainCanvas.height = h;
    this.clear();
  }

  public clear() {
    // Fondo azul casi negro (#02040a)
    this.mainCtx.fillStyle = '#02040a';
    this.mainCtx.fillRect(0, 0, this.width, this.height);
  }

  /**
   * Renderiza el paso de simulación con acumulación y respuesta dinámica de color según espacios trigger
   */
  public render(agentSystem: AgentSystem, woundManager: WoundManager, targetCtx: CanvasRenderingContext2D) {
    const W = this.width;
    const H = this.height;
    const halfW = W * 0.5;
    const halfH = H * 0.5;

    const ctx = this.mainCtx;

    // 1. Desvanecimiento suave en el lienzo principal (preserva estelas luminosas vivas sin ensuciar)
    ctx.fillStyle = `rgba(2, 4, 10, ${this.decayRate.toFixed(4)})`;
    ctx.fillRect(0, 0, W, H);

    // Los espacios trigger son 100% transparentes: solo los filamentos del flow field cambian de color

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Buffers de trazo agrupados por tipo y color para máximo rendimiento (60 FPS fluidos)
    const blueBatchesX1: number[][] = [[], [], [], [], []];
    const blueBatchesY1: number[][] = [[], [], [], [], []];
    const blueBatchesX2: number[][] = [[], [], [], [], []];
    const blueBatchesY2: number[][] = [[], [], [], [], []];

    const redBatchesX1: number[][] = [[], [], [], [], []];
    const redBatchesY1: number[][] = [[], [], [], [], []];
    const redBatchesX2: number[][] = [[], [], [], [], []];
    const redBatchesY2: number[][] = [[], [], [], [], []];

    const goldBatchesX1: number[][] = [[], [], [], [], []];
    const goldBatchesY1: number[][] = [[], [], [], [], []];
    const goldBatchesX2: number[][] = [[], [], [], [], []];
    const goldBatchesY2: number[][] = [[], [], [], [], []];

    const agents = agentSystem.agents;
    const count = agents.length;

    for (let i = 0; i < count; i++) {
      const a = agents[i];
      const dx = Math.abs(a.x - a.prevX);
      const dy = Math.abs(a.y - a.prevY);

      // Si cruzó el borde toroidal, no trazar línea diagonal transversal
      if (dx > halfW || dy > halfH) {
        continue;
      }

      const cIdx = a.colorIndex;

      // Evaluar si el filamento está en la posición de un espacio trigger
      const zone = woundManager.getZoneAt(a.x, a.y);

      if (zone) {
        if (zone.type === ZoneType.GOLD) {
          // Mientras esté dentro del espacio dorado: color ORO radiante
          goldBatchesX1[cIdx].push(a.prevX);
          goldBatchesY1[cIdx].push(a.prevY);
          goldBatchesX2[cIdx].push(a.x);
          goldBatchesY2[cIdx].push(a.y);
        } else {
          // Mientras esté dentro del espacio de fractura: color ROJO intenso
          redBatchesX1[cIdx].push(a.prevX);
          redBatchesY1[cIdx].push(a.prevY);
          redBatchesX2[cIdx].push(a.x);
          redBatchesY2[cIdx].push(a.y);
        }
      } else {
        // Fuera de cualquier espacio trigger: color natural AZUL luminoso
        blueBatchesX1[cIdx].push(a.prevX);
        blueBatchesY1[cIdx].push(a.prevY);
        blueBatchesX2[cIdx].push(a.x);
        blueBatchesY2[cIdx].push(a.y);
      }
    }

    // A. Dibujar lotes de trazo azul natural
    ctx.lineWidth = 1.15;
    for (let c = 0; c < 5; c++) {
      const bX1 = blueBatchesX1[c];
      if (bX1.length === 0) continue;
      const bY1 = blueBatchesY1[c];
      const bX2 = blueBatchesX2[c];
      const bY2 = blueBatchesY2[c];

      ctx.beginPath();
      for (let k = 0; k < bX1.length; k++) {
        ctx.moveTo(bX1[k], bY1[k]);
        ctx.lineTo(bX2[k], bY2[k]);
      }
      ctx.strokeStyle = agentSystem.bluePalette[c];
      ctx.stroke();
    }

    // B. Dibujar lotes de trazo rojo (filamentos pasando por espacios de fractura)
    ctx.lineWidth = 1.35;
    for (let c = 0; c < 5; c++) {
      const rX1 = redBatchesX1[c];
      if (rX1.length === 0) continue;
      const rY1 = redBatchesY1[c];
      const rX2 = redBatchesX2[c];
      const rY2 = redBatchesY2[c];

      ctx.beginPath();
      for (let k = 0; k < rX1.length; k++) {
        ctx.moveTo(rX1[k], rY1[k]);
        ctx.lineTo(rX2[k], rY2[k]);
      }
      ctx.strokeStyle = agentSystem.redPalette[c];
      ctx.stroke();
    }

    // C. Dibujar lotes de trazo dorado (filamentos pasando por espacios Kintsugi)
    ctx.lineWidth = 1.50;
    for (let c = 0; c < 5; c++) {
      const gX1 = goldBatchesX1[c];
      if (gX1.length === 0) continue;
      const gY1 = goldBatchesY1[c];
      const gX2 = goldBatchesX2[c];
      const gY2 = goldBatchesY2[c];

      ctx.beginPath();
      for (let k = 0; k < gX1.length; k++) {
        ctx.moveTo(gX1[k], gY1[k]);
        ctx.lineTo(gX2[k], gY2[k]);
      }
      ctx.strokeStyle = agentSystem.goldPalette[c];
      ctx.stroke();
    }

    // 3. Componer en el lienzo de destino
    targetCtx.drawImage(this.mainCanvas, 0, 0);
  }
}
