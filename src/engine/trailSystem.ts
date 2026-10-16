/**
 * trailSystem.ts
 * Sistema de Renderizado de Estelas y Fondo de Arena Zen Mineral para HEAL:
 * - Fondo de arena mineral nocturna (estilo Zen Karesansui / obsidiana / Raku):
 *   gradiente profundo, surcos sutiles de rastrillo en sombra y luz rasante,
 *   micro-granos minerales y destellos microscópicos de cuarzo y mica dorada Kintsugi.
 * - Desvanecimiento transparente continuo de filamentos (sin ensuciar la arena).
 * - Difuminado continuo (feathering) de heridas rojas y Kintsugi dorado sobre el lecho de arena.
 * - Rendimiento óptimo a 60 FPS con textura de arena pre-renderizada en memoria (0 ms por frame).
 */

import { AgentSystem } from './agentSystem';
import { WoundManager, ZoneType } from './woundManager';

export class TrailSystem {
  public width: number;
  public height: number;

  public mainCanvas: HTMLCanvasElement;
  public mainCtx: CanvasRenderingContext2D;

  public sandCanvas: HTMLCanvasElement;
  public sandCtx: CanvasRenderingContext2D;

  // Parámetro de desvanecimiento suave de los filamentos sobre la arena
  public decayRate: number = 0.018;

  constructor(w: number, h: number) {
    this.width = w;
    this.height = h;

    this.mainCanvas = document.createElement('canvas');
    this.mainCanvas.width = w;
    this.mainCanvas.height = h;
    this.mainCtx = this.mainCanvas.getContext('2d', { willReadFrequently: false })!;

    this.sandCanvas = document.createElement('canvas');
    this.sandCanvas.width = w;
    this.sandCanvas.height = h;
    this.sandCtx = this.sandCanvas.getContext('2d', { willReadFrequently: false })!;

    this.generateSandTexture();
    this.clear();
  }

  public resize(w: number, h: number) {
    this.width = w;
    this.height = h;

    this.mainCanvas.width = w;
    this.mainCanvas.height = h;

    this.sandCanvas.width = w;
    this.sandCanvas.height = h;

    this.generateSandTexture();
    this.clear();
  }

  public clear() {
    this.mainCtx.clearRect(0, 0, this.width, this.height);
  }

  /**
   * Genera la textura pre-renderizada de arena Zen mineral oscura ("en nuestro estilo"):
   * - Gradiente base nocturno profundo (obsidiana, lapislázuli oscuro #040817 -> #010207).
   * - Micro-ondulaciones de rastrillo Zen / dunas suaves (Karesansui) con bajo contraste.
   * - Millares de micro-granos de arena mineral oscura, feldespato, grafito y destellos dorados de mica.
   * - Se pre-renderiza una sola vez en un canvas desacoplado (0 ms de coste por frame).
   */
  public generateSandTexture() {
    const W = this.width;
    const H = this.height;
    const sCtx = this.sandCtx;

    // 1. Gradiente base nocturno profundo (obsidiana y lapislázuli oscuro)
    const bgGrad = sCtx.createRadialGradient(W * 0.5, H * 0.45, W * 0.08, W * 0.5, H * 0.5, Math.hypot(W, H) * 0.65);
    bgGrad.addColorStop(0.0, '#04091a'); // Centro nocturno con sutil profundidad mineral azulada
    bgGrad.addColorStop(0.50, '#020612');
    bgGrad.addColorStop(1.0, '#010207'); // Bordes en sombra viñeteada
    sCtx.fillStyle = bgGrad;
    sCtx.fillRect(0, 0, W, H);

    // 2. Ondulaciones de arena peinada (Surcos sutiles de jardín Zen Karesansui)
    sCtx.save();
    const rippleSpacing = 32.0;
    const totalRipples = Math.ceil(H / rippleSpacing) + 4;

    for (let r = 0; r < totalRipples; r++) {
      const baseY = r * rippleSpacing - 20;
      const phase = r * 0.35;

      // Depresión en sombra del surco de arena
      sCtx.beginPath();
      sCtx.lineWidth = 14.0;
      sCtx.strokeStyle = 'rgba(0, 0, 0, 0.05)';
      for (let x = 0; x <= W + 40; x += 35) {
        const y = baseY + Math.sin(x * 0.0045 + phase) * 18.0 + Math.cos(x * 0.002 - phase * 0.4) * 9.0;
        if (x === 0) sCtx.moveTo(x, y);
        else sCtx.lineTo(x, y);
      }
      sCtx.stroke();

      // Cresta suavemente iluminada por luz lunar rasante
      sCtx.beginPath();
      sCtx.lineWidth = 2.0;
      sCtx.strokeStyle = 'rgba(186, 230, 253, 0.022)';
      for (let x = 0; x <= W + 40; x += 35) {
        const y = baseY - 2.5 + Math.sin(x * 0.0045 + phase) * 18.0 + Math.cos(x * 0.002 - phase * 0.4) * 9.0;
        if (x === 0) sCtx.moveTo(x, y);
        else sCtx.lineTo(x, y);
      }
      sCtx.stroke();
    }
    sCtx.restore();

    // 3. Textura de micro-granos de arena mineral (grafito, cuarzo y mica dorada)
    const grainImg = sCtx.getImageData(0, 0, W, H);
    const data = grainImg.data;
    const len = data.length;

    // Generador pseudo-aleatorio rápido con semilla fija para textura determinista
    let seed = 1337;
    const fastRand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return (seed & 0xffff) / 65536.0;
    };

    for (let i = 0; i < len; i += 4) {
      const rVal = fastRand();

      // Granulación táctil de arena mineral (42% de los píxeles)
      if (rVal < 0.42) {
        const grain = (fastRand() - 0.5) * 15;
        data[i] = Math.min(255, Math.max(0, data[i] + grain));
        data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + grain * 1.05));
        data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + grain * 1.35));
      } else if (rVal > 0.993) {
        // Micro-destellos microscópicos de mica dorada o cuarzo (0.7%)
        if (fastRand() > 0.55) {
          // Destello dorado tenue de mica Kintsugi
          data[i] = Math.min(255, data[i] + 48);
          data[i + 1] = Math.min(255, data[i + 1] + 38);
          data[i + 2] = Math.min(255, data[i + 2] + 12);
        } else {
          // Destello celeste de cuarzo mineral
          data[i] = Math.min(255, data[i] + 28);
          data[i + 1] = Math.min(255, data[i + 1] + 38);
          data[i + 2] = Math.min(255, data[i + 2] + 52);
        }
      }
    }

    sCtx.putImageData(grainImg, 0, 0);

    // 4. Viñeteado suave en los bordes para centrar el foco contemplativo
    const vignette = sCtx.createRadialGradient(W * 0.5, H * 0.5, W * 0.32, W * 0.5, H * 0.5, Math.hypot(W, H) * 0.58);
    vignette.addColorStop(0.0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1.0, 'rgba(1, 2, 7, 0.45)');
    sCtx.fillStyle = vignette;
    sCtx.fillRect(0, 0, W, H);
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

    // 1. Desvanecimiento transparente suave de las estelas (preserva la textura de arena intacta)
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = `rgba(0, 0, 0, ${this.decayRate.toFixed(4)})`;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

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

    // 6. Componer en el lienzo de destino:
    // Primero, el lecho de arena mineral Zen pre-renderizada
    targetCtx.drawImage(this.sandCanvas, 0, 0);

    // Segundo, los filamentos luminosos que fluyen sobre la arena
    targetCtx.drawImage(this.mainCanvas, 0, 0);
  }
}
