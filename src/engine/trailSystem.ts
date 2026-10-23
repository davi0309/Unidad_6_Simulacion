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

  // Parámetro de desvanecimiento calibrado para lágrimas y gotas de lluvia fluidas
  public decayRate: number = 0.046;

  // Alpha de transparencia del fondo de arena (oscuro, sutil y transparente)
  public sandAlpha: number = 0.32;

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
   * Genera la textura pre-renderizada de arena de mar oscura (tono piel / duna nocturna):
   * - Tonalidad oscurecida y profunda para máximo contraste con los flow fields (#483424 -> #0b0603).
   * - Ondulaciones orgánicas de marea con sombreado sutil y crestas delicadas.
   * - Micro-granulación táctil de arena costera con destellos tenues.
   * - Pre-renderizado en canvas desacoplado (0 ms de coste por frame).
   */
  public generateSandTexture() {
    const W = this.width;
    const H = this.height;
    const sCtx = this.sandCtx;

    // 1. Gradiente base: Arena de mar oscura con matiz cálido tono piel/duna nocturna
    const bgGrad = sCtx.createRadialGradient(W * 0.5, H * 0.45, W * 0.08, W * 0.5, H * 0.5, Math.hypot(W, H) * 0.65);
    bgGrad.addColorStop(0.0, '#483424'); // Centro: arena de mar oscura con tono piel/ocre cálido tenue (RGB: 72, 52, 36)
    bgGrad.addColorStop(0.35, '#332115'); // Matiz intermedio en penumbra cálida
    bgGrad.addColorStop(0.70, '#1c110a'); // Arena húmeda nocturna
    bgGrad.addColorStop(1.0, '#0b0603');  // Bordes profundos en sombra
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
      sCtx.strokeStyle = 'rgba(0, 0, 0, 0.09)';
      for (let x = 0; x <= W + 40; x += 35) {
        const y = baseY + Math.sin(x * 0.0042 + phase) * 17.0 + Math.cos(x * 0.0022 - phase * 0.45) * 8.5;
        if (x === 0) sCtx.moveTo(x, y);
        else sCtx.lineTo(x, y);
      }
      sCtx.stroke();

      // Cresta de la ondulación iluminada suavemente con calidez tenue
      sCtx.beginPath();
      sCtx.lineWidth = 2.0;
      sCtx.strokeStyle = 'rgba(240, 205, 175, 0.025)';
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

      // Granulación táctil de arena de mar oscura (42% de los píxeles)
      if (rVal < 0.42) {
        const grain = (fastRand() - 0.5) * 14;
        data[i] = Math.min(255, Math.max(0, data[i] + grain * 1.15));
        data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + grain * 0.95));
        data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + grain * 0.70));
      } else if (rVal > 0.993) {
        // Micro-destellos de conchilla y cuarzo marino
        if (fastRand() > 0.50) {
          data[i] = Math.min(255, data[i] + 36);
          data[i + 1] = Math.min(255, data[i + 1] + 28);
          data[i + 2] = Math.min(255, data[i + 2] + 10);
        } else {
          data[i] = Math.min(255, data[i] + 28);
          data[i + 1] = Math.min(255, data[i + 1] + 25);
          data[i + 2] = Math.min(255, data[i + 2] + 20);
        }
      }
    }

    sCtx.putImageData(grainImg, 0, 0);

    // 4. Viñeteado oscuro y profundo en los bordes para máximo contraste central
    const vignette = sCtx.createRadialGradient(W * 0.5, H * 0.5, W * 0.28, W * 0.5, H * 0.5, Math.hypot(W, H) * 0.58);
    vignette.addColorStop(0.0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1.0, 'rgba(8, 4, 2, 0.60)');
    sCtx.fillStyle = vignette;
    sCtx.fillRect(0, 0, W, H);
  }

  /**
   * Renderiza el paso de simulación con acumulación y respuesta de color difuminada (feathering)
   */
  public render(
    agentSystem: AgentSystem,
    woundManager: WoundManager,
    targetCtx: CanvasRenderingContext2D,
    songProgress: number = 0,
    songTime: number = 0
  ) {
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

    // Buffers de estela acuosa y cabezas esféricas de lágrimas agrupadas por color
    // A. Azul natural
    const blueBatchesX1: number[][] = [[], [], [], [], []];
    const blueBatchesY1: number[][] = [[], [], [], [], []];
    const blueBatchesX2: number[][] = [[], [], [], [], []];
    const blueBatchesY2: number[][] = [[], [], [], [], []];
    const blueHeadsX: number[][] = [[], [], [], [], []];
    const blueHeadsY: number[][] = [[], [], [], [], []];
    const blueHeadsR: number[][] = [[], [], [], [], []];

    // B1. Rojo núcleo intenso
    const redCoreBatchesX1: number[][] = [[], [], [], [], []];
    const redCoreBatchesY1: number[][] = [[], [], [], [], []];
    const redCoreBatchesX2: number[][] = [[], [], [], [], []];
    const redCoreBatchesY2: number[][] = [[], [], [], [], []];
    const redCoreHeadsX: number[][] = [[], [], [], [], []];
    const redCoreHeadsY: number[][] = [[], [], [], [], []];
    const redCoreHeadsR: number[][] = [[], [], [], [], []];

    // B2. Rojo difuminado suave (orquídea/magenta que se funde con el azul)
    const redSoftBatchesX1: number[][] = [[], [], [], [], []];
    const redSoftBatchesY1: number[][] = [[], [], [], [], []];
    const redSoftBatchesX2: number[][] = [[], [], [], [], []];
    const redSoftBatchesY2: number[][] = [[], [], [], [], []];
    const redSoftHeadsX: number[][] = [[], [], [], [], []];
    const redSoftHeadsY: number[][] = [[], [], [], [], []];
    const redSoftHeadsR: number[][] = [[], [], [], [], []];

    // C1. Oro núcleo puro 24K
    const goldCoreBatchesX1: number[][] = [[], [], [], [], []];
    const goldCoreBatchesY1: number[][] = [[], [], [], [], []];
    const goldCoreBatchesX2: number[][] = [[], [], [], [], []];
    const goldCoreBatchesY2: number[][] = [[], [], [], [], []];
    const goldCoreHeadsX: number[][] = [[], [], [], [], []];
    const goldCoreHeadsY: number[][] = [[], [], [], [], []];
    const goldCoreHeadsR: number[][] = [[], [], [], [], []];

    // C2. Oro difuminado suave (miel/turquesa que se funde con el azul)
    const goldSoftBatchesX1: number[][] = [[], [], [], [], []];
    const goldSoftBatchesY1: number[][] = [[], [], [], [], []];
    const goldSoftBatchesX2: number[][] = [[], [], [], [], []];
    const goldSoftBatchesY2: number[][] = [[], [], [], [], []];
    const goldSoftHeadsX: number[][] = [[], [], [], [], []];
    const goldSoftHeadsY: number[][] = [[], [], [], [], []];
    const goldSoftHeadsR: number[][] = [[], [], [], [], []];

    // Destellos especulares de agua cristalina (catchlights en cada gota/lágrima)
    const glintsX: number[] = [];
    const glintsY: number[] = [];
    const glintsR: number[] = [];

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
      const r = a.dropRadius;

      // Micro-destello de luz sobre la gota en el punto superior/frontal
      glintsX.push(a.x - a.vx * 0.22);
      glintsY.push(a.y - a.vy * 0.22);
      glintsR.push(r * 0.35);

      // Evaluar la influencia difuminada continua del espacio trigger
      const inf = woundManager.getZoneInfluence(a.x, a.y);

      if (inf) {
        const { zone, intensity } = inf;

        // Transmutación progresiva de rojo a oro Kintsugi (Tecla U)
        const goldRatio = woundManager.getZoneGoldRatio(zone, a.x, a.y);
        const isGold = Math.random() < goldRatio;

        if (isGold) {
          if (intensity > 0.60) {
            goldCoreBatchesX1[cIdx].push(a.prevX);
            goldCoreBatchesY1[cIdx].push(a.prevY);
            goldCoreBatchesX2[cIdx].push(a.x);
            goldCoreBatchesY2[cIdx].push(a.y);
            goldCoreHeadsX[cIdx].push(a.x);
            goldCoreHeadsY[cIdx].push(a.y);
            goldCoreHeadsR[cIdx].push(r);
          } else {
            // Perímetro exterior difuminado: fundido suave estocástico
            if (intensity > 0.18 || Math.random() < (intensity / 0.18)) {
              goldSoftBatchesX1[cIdx].push(a.prevX);
              goldSoftBatchesY1[cIdx].push(a.prevY);
              goldSoftBatchesX2[cIdx].push(a.x);
              goldSoftBatchesY2[cIdx].push(a.y);
              goldSoftHeadsX[cIdx].push(a.x);
              goldSoftHeadsY[cIdx].push(a.y);
              goldSoftHeadsR[cIdx].push(r);
            } else {
              blueBatchesX1[cIdx].push(a.prevX);
              blueBatchesY1[cIdx].push(a.prevY);
              blueBatchesX2[cIdx].push(a.x);
              blueBatchesY2[cIdx].push(a.y);
              blueHeadsX[cIdx].push(a.x);
              blueHeadsY[cIdx].push(a.y);
              blueHeadsR[cIdx].push(r);
            }
          }
        } else {
          // Espacio de fractura roja
          if (intensity > 0.60) {
            redCoreBatchesX1[cIdx].push(a.prevX);
            redCoreBatchesY1[cIdx].push(a.prevY);
            redCoreBatchesX2[cIdx].push(a.x);
            redCoreBatchesY2[cIdx].push(a.y);
            redCoreHeadsX[cIdx].push(a.x);
            redCoreHeadsY[cIdx].push(a.y);
            redCoreHeadsR[cIdx].push(r);
          } else {
            // Perímetro exterior difuminado: fundido suave estocástico
            if (intensity > 0.18 || Math.random() < (intensity / 0.18)) {
              redSoftBatchesX1[cIdx].push(a.prevX);
              redSoftBatchesY1[cIdx].push(a.prevY);
              redSoftBatchesX2[cIdx].push(a.x);
              redSoftBatchesY2[cIdx].push(a.y);
              redSoftHeadsX[cIdx].push(a.x);
              redSoftHeadsY[cIdx].push(a.y);
              redSoftHeadsR[cIdx].push(r);
            } else {
              blueBatchesX1[cIdx].push(a.prevX);
              blueBatchesY1[cIdx].push(a.prevY);
              blueBatchesX2[cIdx].push(a.x);
              blueBatchesY2[cIdx].push(a.y);
              blueHeadsX[cIdx].push(a.x);
              blueHeadsY[cIdx].push(a.y);
              blueHeadsR[cIdx].push(r);
            }
          }
        }
      } else {
        // Fuera de cualquier espacio trigger: color natural azul
        blueBatchesX1[cIdx].push(a.prevX);
        blueBatchesY1[cIdx].push(a.prevY);
        blueBatchesX2[cIdx].push(a.x);
        blueBatchesY2[cIdx].push(a.y);
        blueHeadsX[cIdx].push(a.x);
        blueHeadsY[cIdx].push(a.y);
        blueHeadsR[cIdx].push(r);
      }
    }

    // Función auxiliar para dibujar cabezas de gotas esféricas de agua
    const drawDropletHeads = (hX: number[], hY: number[], hR: number[], fillStyle: string) => {
      if (hX.length === 0) return;
      ctx.beginPath();
      for (let k = 0; k < hX.length; k++) {
        const rad = hR[k];
        ctx.moveTo(hX[k] + rad, hY[k]);
        ctx.arc(hX[k], hY[k], rad, 0, Math.PI * 2);
      }
      ctx.fillStyle = fillStyle;
      ctx.fill();
    };

    // 1. Estelas y gotas de lluvia azul natural
    ctx.lineWidth = 1.25;
    for (let c = 0; c < 5; c++) {
      const bX1 = blueBatchesX1[c];
      if (bX1.length > 0) {
        ctx.beginPath();
        for (let k = 0; k < bX1.length; k++) {
          ctx.moveTo(bX1[k], blueBatchesY1[c][k]);
          ctx.lineTo(blueBatchesX2[c][k], blueBatchesY2[c][k]);
        }
        ctx.strokeStyle = agentSystem.bluePalette[c];
        ctx.stroke();
      }
      drawDropletHeads(blueHeadsX[c], blueHeadsY[c], blueHeadsR[c], agentSystem.bluePalette[c]);
    }

    // 2. Estelas y gotas rojas difuminadas (borde exterior magenta/orquídea)
    ctx.lineWidth = 1.25;
    for (let c = 0; c < 5; c++) {
      const rX1 = redSoftBatchesX1[c];
      if (rX1.length > 0) {
        ctx.beginPath();
        for (let k = 0; k < rX1.length; k++) {
          ctx.moveTo(rX1[k], redSoftBatchesY1[c][k]);
          ctx.lineTo(redSoftBatchesX2[c][k], redSoftBatchesY2[c][k]);
        }
        ctx.strokeStyle = agentSystem.redSoftPalette[c];
        ctx.stroke();
      }
      drawDropletHeads(redSoftHeadsX[c], redSoftHeadsY[c], redSoftHeadsR[c], agentSystem.redSoftPalette[c]);
    }

    // 3. Estelas y lágrimas de herida roja núcleo (carmesí vivo / dolor)
    ctx.lineWidth = 1.25;
    for (let c = 0; c < 5; c++) {
      const rX1 = redCoreBatchesX1[c];
      if (rX1.length > 0) {
        ctx.beginPath();
        for (let k = 0; k < rX1.length; k++) {
          ctx.moveTo(rX1[k], redCoreBatchesY1[c][k]);
          ctx.lineTo(redCoreBatchesX2[c][k], redCoreBatchesY2[c][k]);
        }
        ctx.strokeStyle = agentSystem.redPalette[c];
        ctx.stroke();
      }
      drawDropletHeads(redCoreHeadsX[c], redCoreHeadsY[c], redCoreHeadsR[c], agentSystem.redPalette[c]);
    }

    // 4. Estelas y gotas doradas difuminadas suaves (ámbar / miel)
    ctx.lineWidth = 1.25;
    for (let c = 0; c < 5; c++) {
      const gX1 = goldSoftBatchesX1[c];
      if (gX1.length > 0) {
        ctx.beginPath();
        for (let k = 0; k < gX1.length; k++) {
          ctx.moveTo(gX1[k], goldSoftBatchesY1[c][k]);
          ctx.lineTo(goldSoftBatchesX2[c][k], goldSoftBatchesY2[c][k]);
        }
        ctx.strokeStyle = agentSystem.goldSoftPalette[c];
        ctx.stroke();
      }
      drawDropletHeads(goldSoftHeadsX[c], goldSoftHeadsY[c], goldSoftHeadsR[c], agentSystem.goldSoftPalette[c]);
    }

    // 5. Estelas y lágrimas de oro puro 24K resplandeciente (Kintsugi)
    ctx.lineWidth = 1.25;
    for (let c = 0; c < 5; c++) {
      const gX1 = goldCoreBatchesX1[c];
      if (gX1.length > 0) {
        ctx.beginPath();
        for (let k = 0; k < gX1.length; k++) {
          ctx.moveTo(gX1[k], goldCoreBatchesY1[c][k]);
          ctx.lineTo(goldCoreBatchesX2[c][k], goldCoreBatchesY2[c][k]);
        }
        ctx.strokeStyle = agentSystem.goldPalette[c];
        ctx.stroke();
      }
      drawDropletHeads(goldCoreHeadsX[c], goldCoreHeadsY[c], goldCoreHeadsR[c], agentSystem.goldPalette[c]);
    }

    // Un grupo pequeño de agentes adopta una silueta de lágrima según su dirección.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < count; i += 24) {
      const agent = agents[i];
      const dx = Math.abs(agent.x - agent.prevX);
      const dy = Math.abs(agent.y - agent.prevY);
      if (dx > halfW || dy > halfH) continue;

      const influence = woundManager.getZoneInfluence(agent.x, agent.y);
      const colorIndex = agent.colorIndex;
      const color = influence
        ? (woundManager.getZoneGoldRatio(influence.zone, agent.x, agent.y) > 0.5
          ? agentSystem.goldPalette[colorIndex]
          : agentSystem.redPalette[colorIndex])
        : agentSystem.bluePalette[colorIndex];
      const radius = agent.dropRadius;

      ctx.save();
      ctx.translate(agent.x, agent.y);
      ctx.rotate(Math.atan2(agent.vy, agent.vx) - Math.PI / 2);
      ctx.scale(radius * 0.82, radius * 1.45);
      ctx.shadowColor = color;
      ctx.shadowBlur = 4;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, -1.7);
      ctx.bezierCurveTo(0.55, -0.85, 1.25, 0.05, 1.0, 0.72);
      ctx.quadraticCurveTo(0.78, 1.55, 0, 1.55);
      ctx.quadraticCurveTo(-0.78, 1.55, -1.0, 0.72);
      ctx.bezierCurveTo(-1.25, 0.05, -0.55, -0.85, 0, -1.7);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    // 6. Micro-destellos de agua cristalina (specular catchlights de las lágrimas)
    if (glintsX.length > 0) {
      ctx.beginPath();
      for (let k = 0; k < glintsX.length; k++) {
        const rad = glintsR[k];
        ctx.moveTo(glintsX[k] + rad, glintsY[k]);
        ctx.arc(glintsX[k], glintsY[k], rad, 0, Math.PI * 2);
      }
      ctx.fillStyle = 'rgba(255, 255, 255, 0.90)';
      ctx.fill();
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

    const rainFadeIn = Math.max(0, Math.min(1, (songProgress - 0.65) / 0.035));
    const rainFadeOut = Math.max(0, Math.min(1, (0.87 - songProgress) / 0.035));
    const rainIntensity = Math.min(rainFadeIn, rainFadeOut);
    if (rainIntensity > 0) {
      this.drawRainOnGlass(targetCtx, songTime, rainIntensity);
    }
  }

  private drawRainOnGlass(ctx: CanvasRenderingContext2D, time: number, intensity: number) {
    const W = this.width;
    const H = this.height;
    const smoothIntensity = intensity * intensity * (3 - 2 * intensity);

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = smoothIntensity * 0.62;

    for (let i = 0; i < 17; i++) {
      const seed = (i * 0.61803398875 + 0.13) % 1;
      const x = seed * W + Math.sin(time * 0.16 + i * 2.4) * 14;
      const radius = 4 + (i % 4) * 1.8;
      const cycle = (time * (0.035 + (i % 3) * 0.008) + seed * 1.7) % 1;
      const y = cycle * (H + 100) - 50;
      const tailLength = 12 + radius * 2.5;

      const trail = ctx.createLinearGradient(x, y - tailLength, x, y);
      trail.addColorStop(0, 'rgba(173, 220, 255, 0)');
      trail.addColorStop(1, 'rgba(173, 220, 255, 0.32)');
      ctx.strokeStyle = trail;
      ctx.lineWidth = Math.max(1, radius * 0.28);
      ctx.beginPath();
      ctx.moveTo(x - 2, y - tailLength);
      ctx.quadraticCurveTo(x + 3, y - tailLength * 0.45, x, y);
      ctx.stroke();

      const drop = ctx.createRadialGradient(
        x - radius * 0.32,
        y - radius * 0.32,
        0.5,
        x,
        y,
        radius * 1.25
      );
      drop.addColorStop(0, 'rgba(241, 250, 255, 0.86)');
      drop.addColorStop(0.3, 'rgba(177, 224, 255, 0.58)');
      drop.addColorStop(1, 'rgba(96, 165, 250, 0.08)');
      ctx.fillStyle = drop;
      ctx.beginPath();
      ctx.ellipse(x, y, radius * 0.78, radius * 1.18, -0.12, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
