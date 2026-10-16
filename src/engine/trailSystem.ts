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

  // Parámetro de desvanecimiento calibrado para que las estelas no ensucien la arena
  public decayRate: number = 0.038;

  // Alpha de transparencia del fondo de arena (más bajo, transparente y sutil)
  public sandAlpha: number = 0.38;

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
   * Genera la textura pre-renderizada de arena de mar (tono piel / duna cálida y mate):
   * - Tonalidad de arena de mar cálida, con matiz ocre/piel suave y no brillante (#9c7a60 -> #24160e).
   * - Ondulaciones orgánicas de marea y viento marino (crestas suaves y surcos en sombra).
   * - Micro-granulación táctil de arena costera con destellos tenues de cuarzo marino y nácar de conchilla.
   * - Pre-renderizado en canvas desacoplado (0 ms de coste por frame).
   */
  public generateSandTexture() {
    const W = this.width;
    const H = this.height;
    const sCtx = this.sandCtx;

    // 1. Gradiente base: Arena de mar cálida con tono piel/duna (mate, no estridente ni brillante)
    const bgGrad = sCtx.createRadialGradient(W * 0.5, H * 0.45, W * 0.08, W * 0.5, H * 0.5, Math.hypot(W, H) * 0.65);
    bgGrad.addColorStop(0.0, '#9c7a60'); // Centro: arena de mar cálida tono piel suave (RGB: 156, 122, 96)
    bgGrad.addColorStop(0.35, '#7f5c45'); // Matiz intermedio cálido de arena de playa
    bgGrad.addColorStop(0.70, '#523727'); // Arena húmeda en sombra cálida
    bgGrad.addColorStop(1.0, '#24160e');  // Bordes en viñeta profunda de bajamar nocturna
    sCtx.fillStyle = bgGrad;
    sCtx.fillRect(0, 0, W, H);

    // 2. Ondulaciones de marea marina (surcos sutiles que deja el agua al retirarse)
    sCtx.save();
    const rippleSpacing = 34.0;
    const totalRipples = Math.ceil(H / rippleSpacing) + 4;

    for (let r = 0; r < totalRipples; r++) {
      const baseY = r * rippleSpacing - 20;
      const phase = r * 0.38;

      // Depresión en sombra del surco de la marea
      sCtx.beginPath();
      sCtx.lineWidth = 15.0;
      sCtx.strokeStyle = 'rgba(28, 16, 10, 0.065)';
      for (let x = 0; x <= W + 40; x += 35) {
        const y = baseY + Math.sin(x * 0.0042 + phase) * 17.0 + Math.cos(x * 0.0022 - phase * 0.45) * 8.5;
        if (x === 0) sCtx.moveTo(x, y);
        else sCtx.lineTo(x, y);
      }
      sCtx.stroke();

      // Cresta de la ondulación iluminada suavemente con calidez
      sCtx.beginPath();
      sCtx.lineWidth = 2.2;
      sCtx.strokeStyle = 'rgba(255, 238, 218, 0.040)';
      for (let x = 0; x <= W + 40; x += 35) {
        const y = baseY - 2.5 + Math.sin(x * 0.0042 + phase) * 17.0 + Math.cos(x * 0.0022 - phase * 0.45) * 8.5;
        if (x === 0) sCtx.moveTo(x, y);
        else sCtx.lineTo(x, y);
      }
      sCtx.stroke();
    }
    sCtx.restore();

    // 3. Textura de micro-granos de arena marina (sílice, conchilla triturada y cuarzo)
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

      // Granulación táctil de arena de mar (45% de los píxeles)
      if (rVal < 0.45) {
        const grain = (fastRand() - 0.5) * 16;
        data[i] = Math.min(255, Math.max(0, data[i] + grain * 1.15));       // Más cálido (Rojo/Piel)
        data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + grain * 1.0)); // Amarillo suave (Verde)
        data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + grain * 0.75));// Menos azul
      } else if (rVal > 0.992) {
        // Micro-destellos de conchilla nacarada y granos dorados de cuarzo marino
        if (fastRand() > 0.50) {
          // Grano de cuarzo dorado / sílice marina cálida
          data[i] = Math.min(255, data[i] + 45);
          data[i + 1] = Math.min(255, data[i + 1] + 36);
          data[i + 2] = Math.min(255, data[i + 2] + 12);
        } else {
          // Destello sutil de nácar de conchilla triturada
          data[i] = Math.min(255, data[i] + 35);
          data[i + 1] = Math.min(255, data[i + 1] + 32);
          data[i + 2] = Math.min(255, data[i + 2] + 26);
        }
      }
    }

    sCtx.putImageData(grainImg, 0, 0);

    // 4. Viñeteado cálido y suave en los bordes para preservar foco y profundidad
    const vignette = sCtx.createRadialGradient(W * 0.5, H * 0.5, W * 0.30, W * 0.5, H * 0.5, Math.hypot(W, H) * 0.60);
    vignette.addColorStop(0.0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1.0, 'rgba(20, 11, 7, 0.45)');
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
    // Base nocturna profunda (#02040a)
    targetCtx.fillStyle = '#02040a';
    targetCtx.fillRect(0, 0, W, H);

    // Primero, el lecho de arena de mar con alpha translúcido y sutil
    targetCtx.save();
    targetCtx.globalAlpha = this.sandAlpha;
    targetCtx.drawImage(this.sandCanvas, 0, 0);
    targetCtx.restore();

    // Segundo, los filamentos luminosos que fluyen sobre la arena
    targetCtx.drawImage(this.mainCanvas, 0, 0);
  }
}
