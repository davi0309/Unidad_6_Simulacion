/**
 * particleSystem.ts
 * Sistema de partículas gráficas estilizadas (Imagen 2):
 * - Tonos BLANCOS Y AZULES CLAROS LUMINOSOS (Cian neón #00f0ff, azul cielo #38bdf8, agua #67e8f9, blanco #ffffff).
 * - Las partículas NUNCA se eliminan: circulan eternamente con envoltura toroidal suave.
 * - Cobertura uniforme en todo el lienzo (incluido el centro).
 * - Figuras geométricas estilizadas:
 *   1. Píldoras / líneas con doble borde (borde cian luminoso + núcleo blanco puro).
 *   2. Anillos concéntricos (anillo exterior cian + punto central blanco).
 *   3. Cadenas de cuentas punteadas en cian y blanco.
 *   4. Arcos circulares suaves.
 * - Reacción visual inmediata y fluida a los pulsos de las teclas Q a P.
 */

import { FlowFieldEngine } from './flowField';
import { HealParameters } from './parameters';

export type GraphicShapeType = 'pill' | 'ring' | 'dotted' | 'arc';

export interface GraphicParticle {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  heading: number;
  shapeType: GraphicShapeType;
  length: number;
  radius: number;
  dotCount: number;
  outerColor: string;
  speed: number;
  trail: { x: number; y: number }[];
}

export class FlowParticleSystem {
  public width: number;
  public height: number;
  public count: number;

  public particles: GraphicParticle[] = [];
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;

  // Paleta de azules claros luminosos y cianes neón (Imagen 2)
  private readonly brightCyanBlues = [
    '#00f0ff', // Cian neón eléctrico
    '#38bdf8', // Azul cielo brillante
    '#67e8f9', // Aqua luminoso
    '#00e5ff', // Cian vivo
    '#a5f3fc', // Azul hielo claro
    '#22d3ee'  // Turquesa cian radiante
  ];

  constructor(w: number, h: number, count: number = 1100) {
    this.width = w;
    this.height = h;
    this.count = count;

    this.canvas = document.createElement('canvas');
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: false })!;

    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, w, h);

    this.initUniformParticles();
  }

  public resize(w: number, h: number) {
    this.width = w;
    this.height = h;
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, w, h);
    this.initUniformParticles();
  }

  /**
   * Distribución estratificada uniforme para que todo el espacio (incluido el centro)
   * esté perfectamente poblado sin vacíos.
   */
  public initUniformParticles() {
    this.particles = [];
    const shapes: GraphicShapeType[] = ['pill', 'pill', 'ring', 'dotted', 'arc'];

    const cols = Math.ceil(Math.sqrt(this.count * (this.width / this.height)));
    const rows = Math.ceil(this.count / cols);
    const cellW = this.width / cols;
    const cellH = this.height / rows;

    let created = 0;
    for (let r = 0; r < rows && created < this.count; r++) {
      for (let c = 0; c < cols && created < this.count; c++) {
        // Posición dentro de la celda con dispersión aleatoria suave
        const px = (c + Math.random()) * cellW;
        const py = (r + Math.random()) * cellH;
        const shapeType = shapes[created % shapes.length];
        const cyanColor = this.brightCyanBlues[created % this.brightCyanBlues.length];

        this.particles.push({
          x: px,
          y: py,
          prevX: px,
          prevY: py,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          heading: Math.random() * Math.PI * 2,
          shapeType,
          length: 16.0 + Math.random() * 26.0,
          radius: 3.5 + Math.random() * 3.5,
          dotCount: 3 + Math.floor(Math.random() * 3),
          outerColor: cyanColor,
          speed: 0.95 + Math.random() * 0.45,
          trail: [{ x: px, y: py }]
        });

        created++;
      }
    }
  }

  /**
   * Actualiza el movimiento de los agentes sin eliminarlos nunca, con envoltura toroidal.
   */
  public updateAndRender(
    dt: number,
    time: number,
    flowEngine: FlowFieldEngine,
    params: HealParameters
  ) {
    const ctx = this.ctx;
    const W = this.width;
    const H = this.height;

    // Desvanecimiento suave sobre fondo negro puro (#000000)
    // Con Sustain (Espacio) la persistencia se prolonga
    const fadeAlpha = params.isSustain ? 0.07 : 0.18;
    ctx.fillStyle = `rgba(0, 0, 0, ${fadeAlpha})`;
    ctx.fillRect(0, 0, W, H);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const numParticles = this.particles.length;

    for (let i = 0; i < numParticles; i++) {
      const p = this.particles[i];
      p.prevX = p.x;
      p.prevY = p.y;

      // Muestrear velocidad del campo de flujo divergencia-cero
      const flow = flowEngine.sampleVelocity(p.x, p.y, time);

      // Inercia fluida (filamentos suaves sin saltos bruscos)
      const inertia = 0.88;
      p.vx = p.vx * inertia + flow.vx * (1.0 - inertia) * p.speed;
      p.vy = p.vy * inertia + flow.vy * (1.0 - inertia) * p.speed;

      // Respuesta dinámica adicional si una onda de tecla pasa sobre la partícula
      for (const pulse of flowEngine.activePulses) {
        const dx = p.x - pulse.x;
        const dy = p.y - pulse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (Math.abs(dist - pulse.radius) < 35.0) {
          const push = (1.0 - Math.abs(dist - pulse.radius) / 35.0) * (pulse.life / pulse.maxLife);
          p.vx += (dx / (dist || 1)) * push * 2.5;
          p.vy += (dy / (dist || 1)) * push * 2.5;
        }
      }

      p.x += p.vx * (dt * 60.0);
      p.y += p.vy * (dt * 60.0);

      // Envoltura toroidal suave: NUNCA se eliminan ni se destruyen agentes
      if (p.x < 0) {
        p.x += W;
        p.prevX = p.x;
        p.trail = [{ x: p.x, y: p.y }];
      } else if (p.x > W) {
        p.x -= W;
        p.prevX = p.x;
        p.trail = [{ x: p.x, y: p.y }];
      }

      if (p.y < 0) {
        p.y += H;
        p.prevY = p.y;
        p.trail = [{ x: p.x, y: p.y }];
      } else if (p.y > H) {
        p.y -= H;
        p.prevY = p.y;
        p.trail = [{ x: p.x, y: p.y }];
      }

      // Orientación según la velocidad
      const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      if (spd > 0.05) {
        p.heading = Math.atan2(p.vy, p.vx);
      }

      // ==============================================================
      // RENDERIZADO DE FIGURAS BLANCAS Y AZULES CLARAS (Imagen 2)
      // ==============================================================
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.heading);

      const hLen = p.length * 0.5;

      switch (p.shapeType) {
        // FIGURA 1: PÍLDORA / LÍNEA CON DOBLE BORDE (Azul claro exterior, Blanco puro interior)
        case 'pill': {
          const w = 4.0;
          // 1. Trazo exterior azul claro brillante / cian neón
          ctx.beginPath();
          ctx.moveTo(-hLen, 0);
          ctx.lineTo(hLen, 0);
          ctx.strokeStyle = p.outerColor;
          ctx.lineWidth = w;
          ctx.stroke();

          // 2. Trazo interior blanco puro brillante
          ctx.beginPath();
          ctx.moveTo(-hLen + 1.5, 0);
          ctx.lineTo(hLen - 1.5, 0);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.8;
          ctx.stroke();
          break;
        }

        // FIGURA 2: CÍRCULO / ANILLO CONCÉNTRICO (Anillo exterior cian + centro blanco)
        case 'ring': {
          const r = p.radius;
          // Anillo exterior cian claro
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.strokeStyle = p.outerColor;
          ctx.lineWidth = 1.8;
          ctx.stroke();

          // Punto central blanco brillante
          ctx.beginPath();
          ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          break;
        }

        // FIGURA 3: LÍNEA DE PUNTOS / CUENTAS ALINEADAS (Blanco y cian alternados)
        case 'dotted': {
          const count = p.dotCount;
          const step = p.length / count;
          const startX = -hLen;

          for (let d = 0; d < count; d++) {
            const dotX = startX + d * step;
            const isWhite = d % 2 === 0;

            // Halo cian
            ctx.beginPath();
            ctx.arc(dotX, 0, 2.8, 0, Math.PI * 2);
            ctx.fillStyle = p.outerColor;
            ctx.fill();

            // Núcleo blanco
            ctx.beginPath();
            ctx.arc(dotX, 0, 1.4, 0, Math.PI * 2);
            ctx.fillStyle = isWhite ? '#ffffff' : p.outerColor;
            ctx.fill();
          }
          break;
        }

        // FIGURA 4: ARCO CURVADO (Doble trazo)
        case 'arc': {
          const r = p.radius * 1.8;
          ctx.beginPath();
          ctx.arc(0, -r * 0.5, r, 0.4, 1.8);
          ctx.strokeStyle = p.outerColor;
          ctx.lineWidth = 3.6;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(0, -r * 0.5, r, 0.4, 1.8);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.6;
          ctx.stroke();
          break;
        }
      }

      ctx.restore();
    }
  }
}
