/**
 * particleSystem.ts
 * Sistema de partículas gráficas estilizadas (Imagen 2):
 * - Tonos BLANCOS Y AZULES CLAROS LUMINOSOS (Cian neón #00f0ff, azul cielo #38bdf8, agua #67e8f9, blanco #ffffff).
 * - Fondo 100% LIMPIO NEGRO PURO (#000000): Cada frame se limpia sin dejar manchas, estelas sucias ni residuos.
 * - Sombra / halo sutil directo detrás de cada partícula sin ensuciar el lienzo.
 * - ¡LAS PARTÍCULAS NUNCA SE DETIENEN!: Velocidad mínima garantizada en todo momento.
 * - Cobertura uniforme en toda la pantalla sin vacíos ni atascos en bordes.
 * - Figuras geométricas estilizadas:
 *   1. Píldoras / líneas con doble borde (borde cian luminoso + núcleo blanco puro).
 *   2. Anillos concéntricos (anillo exterior cian + punto central blanco).
 *   3. Cadenas de cuentas punteadas en cian y blanco.
 *   4. Arcos circulares suaves.
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

  constructor(w: number, h: number, count: number = 1300) {
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
        const px = (c + Math.random()) * cellW;
        const py = (r + Math.random()) * cellH;
        const shapeType = shapes[created % shapes.length];
        const cyanColor = this.brightCyanBlues[created % this.brightCyanBlues.length];

        this.particles.push({
          x: px,
          y: py,
          prevX: px,
          prevY: py,
          vx: (Math.random() - 0.5) * 1.5,
          vy: (Math.random() - 0.5) * 1.5,
          heading: Math.random() * Math.PI * 2,
          shapeType,
          length: 16.0 + Math.random() * 26.0,
          radius: 3.5 + Math.random() * 3.5,
          dotCount: 3 + Math.floor(Math.random() * 3),
          outerColor: cyanColor,
          speed: 0.95 + Math.random() * 0.45,
          trail: []
        });

        created++;
      }
    }
  }

  /**
   * Actualiza y renderiza los agentes:
   * - Fondo 100% limpio (#000000) en cada fotograma.
   * - Sombra suave detrás de cada partícula sin manchar el fondo.
   * - NUNCA se detienen ni se congelan tras ser empujadas.
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

    // 1. Limpieza TOTAL del lienzo: Cero manchas, cero residuos, fondo negro azabache puro
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const numParticles = this.particles.length;
    const timeScale = dt * 60.0;

    for (let i = 0; i < numParticles; i++) {
      const p = this.particles[i];
      p.prevX = p.x;
      p.prevY = p.y;

      // Guardar posición en el rastro para la sombrita inmediata
      p.trail.unshift({ x: p.x, y: p.y });
      if (p.trail.length > 4) {
        p.trail.pop();
      }

      // Muestrear velocidad del campo de flujo (que ya incluye las 10 teclas Q-P)
      const flow = flowEngine.sampleVelocity(p.x, p.y, time);

      // Inercia fluida
      const inertia = 0.86;
      p.vx = p.vx * inertia + flow.vx * (1.0 - inertia) * p.speed;
      p.vy = p.vy * inertia + flow.vy * (1.0 - inertia) * p.speed;

      // ¡GARANTIZAR QUE NUNCA SE QUEDEN QUIETAS!:
      // Si la velocidad cae por debajo del umbral mínimo, relanzarla suavemente
      const curSpd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      if (curSpd < 1.4) {
        const h = curSpd > 0.05 ? Math.atan2(p.vy, p.vx) : p.heading;
        p.vx = Math.cos(h) * 1.8 * p.speed;
        p.vy = Math.sin(h) * 1.8 * p.speed;
      }

      // Integrar posición
      p.x += p.vx * timeScale;
      p.y += p.vy * timeScale;

      // Recirculación suave en los bordes con margen para evitar atascos y vacíos
      const pad = 25;
      if (p.x < -pad) {
        p.x = W + pad * 0.4;
        p.trail = [];
      } else if (p.x > W + pad) {
        p.x = -pad * 0.4;
        p.trail = [];
      }

      if (p.y < -pad) {
        p.y = H + pad * 0.4;
        p.trail = [];
      } else if (p.y > H + pad) {
        p.y = -pad * 0.4;
        p.trail = [];
      }

      // Orientación según el vector de movimiento
      if (curSpd > 0.05) {
        p.heading = Math.atan2(p.vy, p.vx);
      }

      // ==============================================================
      // SOMBRITA SUAVE ATRÁS (NO ENSUCIA EL FONDO PORQUE SE LIMPIA CADA FRAME)
      // ==============================================================
      if (p.trail.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(p.trail[1].x, p.trail[1].y);
        ctx.lineTo(p.x, p.y);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.28)';
        ctx.lineWidth = 2.0;
        ctx.stroke();

        if (p.trail.length >= 3) {
          ctx.beginPath();
          ctx.moveTo(p.trail[2].x, p.trail[2].y);
          ctx.lineTo(p.trail[1].x, p.trail[1].y);
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.10)';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
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
          const w = 4.2;
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
