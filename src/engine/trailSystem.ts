/**
 * trailSystem.ts
 * Sistema de Renderizado de Estelas y Espacios Trigger Difuminados para HEAL:
 * - Lienzo dinámico con persistencia y desvanecimiento suave sobre fondo azul-noche (#02040a).
 * - Difuminado continuo (feathering): el color de los filamentos cambia de forma gradual y orgánica.
 * - Sin cortes abruptos ni bordes definidos: el rojo y el oro se funden suavemente con el río azul.
 * - Cero estelas estáticas o agentes inmóviles: flujo 100% cinético y vivo a 60 FPS.
 */

import { AgentSystem } from './agentSystem';
import { WoundManager, ZoneType } from './woundManager';

export class TrailSystem {
  public width: number;
  public height: number;

  public mainCanvas: HTMLCanvasElement;
  public mainCtx: CanvasRenderingContext2D;

  // Parámetro de desvanecimiento general calibrado para velocidad más lenta y meditativa
  public decayRate: number = 0.016;

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
   * Renderiza el paso de simulación con acumulación y respuesta de color difuminada (feathering)
   */
  public render(agentSystem: AgentSystem, woundManager: WoundManager, targetCtx: CanvasRenderingContext2D) {
    const W = this.width;
    const H = this.height;
    const halfW = W * 0.5;
    const halfH = H * 0.5;

    const ctx = this.mainCtx;

    // 1. Desvanecimiento suave en el lienzo principal (preserva estelas vivas sin ensuciar el fondo)
    ctx.fillStyle = `rgba(2, 4, 10, ${this.decayRate.toFixed(4)})`;
    ctx.fillRect(0, 0, W, H);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Buffers de trazo agrupados por gradiente y color para 60 FPS fluidos
    // A. Azul natural
    const blueBatchesX1: number[][] = [[], [], [], [], []];
    const blueBatchesY1: number[][] = [[], [], [], [], []];
    const blueBatchesX2: number[][] = [[], [], [], [], []];
    const blueBatchesY2: number[][] = [[], [], [], [], []];

    // B1. Rojo núcleo intenso
    const redCoreBatchesX1: number[][] = [[], [], [], [], []];
    const redCoreBatchesY1: number[][] = [[], [], [], [], []];
    const redCoreBatchesX2: number[][] = [[], [], [], [], []];
    const redCoreBatchesY2: number[][] = [[], [], [], [], []];

    // B2. Rojo difuminado suave (orquídea/magenta que se funde con el azul)
    const redSoftBatchesX1: number[][] = [[], [], [], [], []];
    const redSoftBatchesY1: number[][] = [[], [], [], [], []];
    const redSoftBatchesX2: number[][] = [[], [], [], [], []];
    const redSoftBatchesY2: number[][] = [[], [], [], [], []];

    // C1. Oro núcleo puro 24K
    const goldCoreBatchesX1: number[][] = [[], [], [], [], []];
    const goldCoreBatchesY1: number[][] = [[], [], [], [], []];
    const goldCoreBatchesX2: number[][] = [[], [], [], [], []];
    const goldCoreBatchesY2: number[][] = [[], [], [], [], []];

    // C2. Oro difuminado suave (miel/turquesa que se funde con el azul)
    const goldSoftBatchesX1: number[][] = [[], [], [], [], []];
    const goldSoftBatchesY1: number[][] = [[], [], [], [], []];
    const goldSoftBatchesX2: number[][] = [[], [], [], [], []];
    const goldSoftBatchesY2: number[][] = [[], [], [], [], []];

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

      // Evaluar la influencia difuminada continua del espacio trigger
      const inf = woundManager.getZoneInfluence(a.x, a.y);

      if (inf) {
        const { zone, intensity } = inf;

        if (zone.type === ZoneType.GOLD) {
          if (intensity > 0.60) {
            goldCoreBatchesX1[cIdx].push(a.prevX);
            goldCoreBatchesY1[cIdx].push(a.prevY);
            goldCoreBatchesX2[cIdx].push(a.x);
            goldCoreBatchesY2[cIdx].push(a.y);
          } else {
            // Perímetro exterior difuminado: fundido suave estocástico
            if (intensity > 0.18 || Math.random() < (intensity / 0.18)) {
              goldSoftBatchesX1[cIdx].push(a.prevX);
              goldSoftBatchesY1[cIdx].push(a.prevY);
              goldSoftBatchesX2[cIdx].push(a.x);
              goldSoftBatchesY2[cIdx].push(a.y);
            } else {
              blueBatchesX1[cIdx].push(a.prevX);
              blueBatchesY1[cIdx].push(a.prevY);
              blueBatchesX2[cIdx].push(a.x);
              blueBatchesY2[cIdx].push(a.y);
            }
          }
        } else {
          // Espacio de fractura roja
          if (intensity > 0.60) {
            redCoreBatchesX1[cIdx].push(a.prevX);
            redCoreBatchesY1[cIdx].push(a.prevY);
            redCoreBatchesX2[cIdx].push(a.x);
            redCoreBatchesY2[cIdx].push(a.y);
          } else {
            // Perímetro exterior difuminado: fundido suave estocástico
            if (intensity > 0.18 || Math.random() < (intensity / 0.18)) {
              redSoftBatchesX1[cIdx].push(a.prevX);
              redSoftBatchesY1[cIdx].push(a.prevY);
              redSoftBatchesX2[cIdx].push(a.x);
              redSoftBatchesY2[cIdx].push(a.y);
            } else {
              blueBatchesX1[cIdx].push(a.prevX);
              blueBatchesY1[cIdx].push(a.prevY);
              blueBatchesX2[cIdx].push(a.x);
              blueBatchesY2[cIdx].push(a.y);
            }
          }
        }
      } else {
        // Fuera de cualquier espacio trigger: color natural azul
        blueBatchesX1[cIdx].push(a.prevX);
        blueBatchesY1[cIdx].push(a.prevY);
        blueBatchesX2[cIdx].push(a.x);
        blueBatchesY2[cIdx].push(a.y);
      }
    }

    // 1. Dibujar lotes de trazo azul natural
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

    // 2. Dibujar trazo rojo difuminado suave (borde exterior donde el rojo se disuelve en el azul)
    ctx.lineWidth = 1.20;
    for (let c = 0; c < 5; c++) {
      const rX1 = redSoftBatchesX1[c];
      if (rX1.length === 0) continue;
      const rY1 = redSoftBatchesY1[c];
      const rX2 = redSoftBatchesX2[c];
      const rY2 = redSoftBatchesY2[c];

      ctx.beginPath();
      for (let k = 0; k < rX1.length; k++) {
        ctx.moveTo(rX1[k], rY1[k]);
        ctx.lineTo(rX2[k], rY2[k]);
      }
      ctx.strokeStyle = agentSystem.redSoftPalette[c];
      ctx.stroke();
    }

    // 3. Dibujar trazo rojo núcleo (centro de la fractura)
    ctx.lineWidth = 1.35;
    for (let c = 0; c < 5; c++) {
      const rX1 = redCoreBatchesX1[c];
      if (rX1.length === 0) continue;
      const rY1 = redCoreBatchesY1[c];
      const rX2 = redCoreBatchesX2[c];
      const rY2 = redCoreBatchesY2[c];

      ctx.beginPath();
      for (let k = 0; k < rX1.length; k++) {
        ctx.moveTo(rX1[k], rY1[k]);
        ctx.lineTo(rX2[k], rY2[k]);
      }
      ctx.strokeStyle = agentSystem.redPalette[c];
      ctx.stroke();
    }

    // 4. Dibujar trazo dorado difuminado suave (borde exterior donde el oro se disuelve en el azul)
    ctx.lineWidth = 1.25;
    for (let c = 0; c < 5; c++) {
      const gX1 = goldSoftBatchesX1[c];
      if (gX1.length === 0) continue;
      const gY1 = goldSoftBatchesY1[c];
      const gX2 = goldSoftBatchesX2[c];
      const gY2 = goldSoftBatchesY2[c];

      ctx.beginPath();
      for (let k = 0; k < gX1.length; k++) {
        ctx.moveTo(gX1[k], gY1[k]);
        ctx.lineTo(gX2[k], gY2[k]);
      }
      ctx.strokeStyle = agentSystem.goldSoftPalette[c];
      ctx.stroke();
    }

    // 5. Dibujar trazo dorado núcleo (centro de Kintsugi)
    ctx.lineWidth = 1.45;
    for (let c = 0; c < 5; c++) {
      const gX1 = goldCoreBatchesX1[c];
      if (gX1.length === 0) continue;
      const gY1 = goldCoreBatchesY1[c];
      const gX2 = goldCoreBatchesX2[c];
      const gY2 = goldCoreBatchesY2[c];

      ctx.beginPath();
      for (let k = 0; k < gX1.length; k++) {
        ctx.moveTo(gX1[k], gY1[k]);
        ctx.lineTo(gX2[k], gY2[k]);
      }
      ctx.strokeStyle = agentSystem.goldPalette[c];
      ctx.stroke();
    }

    // 6. Componer en el lienzo de destino
    targetCtx.drawImage(this.mainCanvas, 0, 0);
  }
}
