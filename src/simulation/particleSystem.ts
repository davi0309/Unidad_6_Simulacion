/**
 * particleSystem.ts
 * Sistema de partículas en flujo (Flow Particles) para "Heal":
 *
 * Basado en las Imágenes de Referencia 4 y 5:
 * - 9.000 a 12.000 partículas en movimiento perpetuo (liviano, 60+ FPS, sin bugs).
 * - Partículas ambiente: filamentos sedosos blancos, lavanda y azul profundo (Imagen 4).
 * - Partículas de herida: al entrar en la fisura se convierten en agrupaciones de filamentos carmesí/magenta ardientes.
 * - Células sanadoras / oro Kintsugi: liberadas con las teclas Q-P, viajan a la herida y depositan oro metálico 24K (Imagen 5).
 * - Acumulación suave de rastros (trail persistence) para dar el efecto de fibras y filamentos continuos.
 */

import { FlowFieldEngine, Point2D } from './flowField';
import { KintsugiLayer } from './kintsugiLayer';
import { HealParameters } from './parameters';

export interface Particle {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  age: number;
  maxAge: number;
  speed: number;
  paletteIdx: number; // 0..2 para variación de tonos suaves
  isGold: boolean;
  targetWoundX: number;
  targetWoundY: number;
  goldLife: number;
}

export class FlowParticleSystem {
  public width: number;
  public height: number;
  public count: number;

  public particles: Particle[] = [];
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;

  // Paletas de color (Imagen 4)
  private readonly ambientColors = [
    'rgba(240, 245, 255, 0.40)', // Blanco perla
    'rgba(175, 190, 225, 0.28)', // Lavanda suave
    'rgba(65, 85, 130, 0.22)'    // Azul índigo profundo
  ];

  private readonly woundColors = [
    'rgba(255, 32, 78, 0.75)',   // Rojo carmesí vivo
    'rgba(255, 0, 60, 0.85)',    // Rojo rubí intenso
    'rgba(255, 133, 161, 0.90)',  // Magenta / rosado eléctrico
    'rgba(180, 10, 45, 0.60)'    // Granate profundo
  ];

  private readonly healedWoundColor = 'rgba(215, 150, 85, 0.40)'; // Ámbar cálido al sanar

  constructor(w: number, h: number, count: number = 10000) {
    this.width = w;
    this.height = h;
    this.count = count;

    this.canvas = document.createElement('canvas');
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: false })!;

    // Fondo inicial
    this.ctx.fillStyle = '#05070a';
    this.ctx.fillRect(0, 0, w, h);

    this.initParticles();
  }

  public resize(w: number, h: number) {
    this.width = w;
    this.height = h;
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx.fillStyle = '#05070a';
    this.ctx.fillRect(0, 0, w, h);
    this.initParticles();
  }

  private initParticles() {
    this.particles = [];
    for (let i = 0; i < this.count; i++) {
      const px = Math.random() * this.width;
      const py = Math.random() * this.height;
      this.particles.push({
        x: px,
        y: py,
        prevX: px,
        prevY: py,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        age: Math.random() * 200,
        maxAge: 200 + Math.random() * 300,
        speed: 0.85 + Math.random() * 0.5,
        paletteIdx: i % 3,
        isGold: false,
        targetWoundX: 0,
        targetWoundY: 0,
        goldLife: 0
      });
    }
  }

  /**
   * Libera células sanadoras doradas al presionar teclas Q a P o al hacer clic.
   */
  public spawnHealingCells(
    originX: number,
    originY: number,
    count: number,
    targetPoint: Point2D
  ) {
    let spawned = 0;
    for (let i = 0; i < this.particles.length && spawned < count; i++) {
      const p = this.particles[i];
      if (!p.isGold) {
        p.isGold = true;
        p.x = originX + (Math.random() - 0.5) * 24.0;
        p.y = originY + (Math.random() - 0.5) * 24.0;
        p.prevX = p.x;
        p.prevY = p.y;
        p.targetWoundX = targetPoint.x;
        p.targetWoundY = targetPoint.y;
        p.goldLife = 10.0;
        p.vx = (Math.random() - 0.5) * 1.5;
        p.vy = (Math.random() - 0.5) * 1.5;
        spawned++;
      }
    }
  }

  /**
   * Actualiza el flujo de todas las partículas y dibuja los filamentos continuos.
   */
  public updateAndRender(
    dt: number,
    time: number,
    flowEngine: FlowFieldEngine,
    kintsugi: KintsugiLayer,
    params: HealParameters
  ) {
    const ctx = this.ctx;
    const W = this.width;
    const H = this.height;

    // 1. Desvanecimiento suave del lienzo (persistencia de filamentos sedosos como en Imagen 4)
    // Con Sustain (Espacio) el desvanecimiento es ultra-lento para crear velos majestuosos
    const fadeAlpha = params.isSustain ? 0.025 : 0.085;
    ctx.fillStyle = `rgba(5, 7, 10, ${fadeAlpha})`;
    ctx.fillRect(0, 0, W, H);

    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';

    const numParticles = this.particles.length;

    for (let i = 0; i < numParticles; i++) {
      const p = this.particles[i];
      p.age += 1;
      p.prevX = p.x;
      p.prevY = p.y;

      // ==============================================================
      // CASO A: PARTÍCULA DORADA KINTSUGI (Célula sanadora)
      // ==============================================================
      if (p.isGold) {
        p.goldLife -= dt;

        // Comportamiento de búsqueda (Seek / Arrive hacia la herida)
        const dx = p.targetWoundX - p.x;
        const dy = p.targetWoundY - p.y;
        const distToTarget = Math.sqrt(dx * dx + dy * dy);

        if (distToTarget > 12.0) {
          const steerSpeed = 4.2;
          const steerX = (dx / distToTarget) * steerSpeed;
          const steerY = (dy / distToTarget) * steerSpeed;
          p.vx = p.vx * 0.88 + steerX * 0.12;
          p.vy = p.vy * 0.88 + steerY * 0.12;
        } else {
          // Ha entrado en la herida: sigue el flujo arterial de la grieta
          const flow = flowEngine.sampleVelocity(p.x, p.y, time);
          p.vx = p.vx * 0.85 + flow.vx * 0.15;
          p.vy = p.vy * 0.85 + flow.vy * 0.15;

          // Depositar oro permanente en el KintsugiLayer (Imagen 5)
          kintsugi.depositGoldVein(p.prevX, p.prevY, p.x, p.y, flow.woundInf.spineT);
        }

        p.x += p.vx * (dt * 60.0);
        p.y += p.vy * (dt * 60.0);

        // Dibujar trazo de oro fundido brillante
        ctx.strokeStyle = '#ffd700';
        ctx.beginPath();
        ctx.moveTo(p.prevX, p.prevY);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();

        // Destello blanco central
        ctx.strokeStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(p.prevX, p.prevY);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();

        // Si se agota su tiempo de vida, vuelve a ser partícula ambiente normal
        if (p.goldLife <= 0 || p.x < -20 || p.x > W + 20 || p.y < -20 || p.y > H + 20) {
          p.isGold = false;
          p.x = Math.random() * W;
          p.y = Math.random() * H;
          p.prevX = p.x;
          p.prevY = p.y;
          p.age = 0;
        }
        continue;
      }

      // ==============================================================
      // CASO B: PARTÍCULA AMBIENTE / HERIDA NORMAL
      // ==============================================================
      // Muestrear campo de flujo
      const flow = flowEngine.sampleVelocity(p.x, p.y, time);

      // Inercia suave para dar sensación de filamento fluido
      const inertia = 0.86;
      p.vx = p.vx * inertia + flow.vx * (1.0 - inertia) * p.speed;
      p.vy = p.vy * inertia + flow.vy * (1.0 - inertia) * p.speed;

      p.x += p.vx * (dt * 60.0);
      p.y += p.vy * (dt * 60.0);

      // Si sale de los bordes o expira su edad, re-aparece suavemente
      if (p.x < -30 || p.x > W + 30 || p.y < -30 || p.y > H + 30 || p.age > p.maxAge) {
        p.x = Math.random() < 0.65 ? -10 : Math.random() * W;
        p.y = Math.random() * H;
        p.prevX = p.x;
        p.prevY = p.y;
        p.age = 0;
        p.vx = 0.5;
        p.vy = 0;
        continue;
      }

      // Dibujar filamento con color según su estado (Imagen 4)
      if (flow.inWound) {
        // DENTRO DE LA HERIDA: se convierte en filamento carmesí / magenta brillante
        if (flow.woundInf.isHealed) {
          // Si el segmento está sanado con oro, el rojo se calma en un ámbar cálido
          ctx.strokeStyle = this.healedWoundColor;
        } else {
          const colIdx = (i + Math.floor(time * 4)) % this.woundColors.length;
          ctx.strokeStyle = this.woundColors[colIdx];
        }
      } else {
        // ESPACIO AMBIENTE: filamento sedoso blanco perla / lavanda / índigo
        ctx.strokeStyle = this.ambientColors[p.paletteIdx];
      }

      ctx.beginPath();
      ctx.moveTo(p.prevX, p.prevY);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
  }
}
