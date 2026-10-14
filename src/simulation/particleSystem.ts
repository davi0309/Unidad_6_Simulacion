/**
 * particleSystem.ts
 * Sistema de partículas gráficas estilizadas inspirado en la Imagen de Referencia 2:
 * - Exclusivamente en tonos BLANCOS y AZULES (blanco puro #ffffff, cian #00b4d8, zafiro #0077b6).
 * - Múltiples figuras geométricas orgánicas:
 *   1. Líneas y píldoras con doble borde (borde exterior azul eléctrico + centro blanco puro).
 *   2. Círculos y anillos concéntricos (anillo exterior azul + punto central blanco).
 *   3. Cadenas de cuentas y líneas punteadas (puntos blancos y azules alineados en la corriente).
 *   4. Arcos circulares y estelas curvas.
 * - Fondo negro puro (#000000) sin viñeta.
 * - Movimiento fluido continuo gobernado por campos de flujo orbitales.
 */

import { FlowFieldEngine } from './flowField';
import { HealParameters } from './parameters';

export type GraphicShapeType = 'pill' | 'ring' | 'dotted' | 'arc';

export interface GraphicParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  heading: number;
  shapeType: GraphicShapeType;
  length: number;
  radius: number;
  dotCount: number;
  outerColor: string;
  innerColor: string;
  speed: number;
  age: number;
  maxAge: number;
  trail: { x: number; y: number }[];
}

export class FlowParticleSystem {
  public width: number;
  public height: number;
  public count: number;

  public particles: GraphicParticle[] = [];
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;

  // Paleta exclusiva de blancos y azules (Imagen 2)
  private readonly blueShades = [
    '#00b4d8', // Azul cian eléctrico
    '#0077b6', // Azul real brillante
    '#48cae4', // Azul cielo luminoso
    '#0096c7', // Azul zafiro
    '#90e0ef', // Azul hielo claro
    '#023e8a'  // Azul cobalto profundo
  ];

  constructor(w: number, h: number, count: number = 850) {
    this.width = w;
    this.height = h;
    this.count = count;

    this.canvas = document.createElement('canvas');
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: false })!;

    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, w, h);

    this.initParticles();
  }

  public resize(w: number, h: number) {
    this.width = w;
    this.height = h;
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, w, h);
    this.initParticles();
  }

  private initParticles() {
    this.particles = [];
    const shapes: GraphicShapeType[] = ['pill', 'pill', 'ring', 'dotted', 'arc'];

    for (let i = 0; i < this.count; i++) {
      const px = Math.random() * this.width;
      const py = Math.random() * this.height;
      const shapeType = shapes[i % shapes.length];
      const blueCol = this.blueShades[Math.floor(Math.random() * this.blueShades.length)];

      this.particles.push({
        x: px,
        y: py,
        vx: 0,
        vy: 0,
        heading: Math.random() * Math.PI * 2,
        shapeType,
        length: 16.0 + Math.random() * 24.0,
        radius: 3.5 + Math.random() * 4.0,
        dotCount: 3 + Math.floor(Math.random() * 4),
        outerColor: blueCol,
        innerColor: '#ffffff',
        speed: 0.8 + Math.random() * 0.7,
        age: Math.random() * 300,
        maxAge: 300 + Math.random() * 400,
        trail: [{ x: px, y: py }]
      });
    }
  }

  /**
   * Actualiza y dibuja las figuras geométricas de tonos blancos y azules (Imagen 2).
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
    const fadeAlpha = params.isSustain ? 0.08 : 0.22;
    ctx.fillStyle = `rgba(0, 0, 0, ${fadeAlpha})`;
    ctx.fillRect(0, 0, W, H);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const numParticles = this.particles.length;

    for (let i = 0; i < numParticles; i++) {
      const p = this.particles[i];
      p.age += 1;

      // Muestrear campo de flujo
      const flow = flowEngine.sampleVelocity(p.x, p.y, time);

      // Inercia suave para seguir curvas fluidas
      const inertia = 0.85;
      p.vx = p.vx * inertia + flow.vx * (1.0 - inertia) * p.speed;
      p.vy = p.vy * inertia + flow.vy * (1.0 - inertia) * p.speed;

      p.x += p.vx * (dt * 60.0);
      p.y += p.vy * (dt * 60.0);

      // Orientación según la velocidad
      const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      if (spd > 0.05) {
        p.heading = Math.atan2(p.vy, p.vx);
      }

      // Guardar rastro para figuras continuas
      p.trail.unshift({ x: p.x, y: p.y });
      if (p.trail.length > 8) p.trail.pop();

      // Reciclado suave si sale de los límites
      if (p.x < -40 || p.x > W + 40 || p.y < -40 || p.y > H + 40 || p.age > p.maxAge) {
        p.x = Math.random() < 0.6 ? -10 : Math.random() * W;
        p.y = Math.random() * H;
        p.trail = [{ x: p.x, y: p.y }];
        p.age = 0;
        p.vx = 0.8;
        p.vy = 0;
        continue;
      }

      // ==============================================================
      // RENDERIZADO DE FIGURAS SEGÚN IMAGEN 2 (BLANCOS Y AZULES)
      // ==============================================================
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.heading);

      const hLen = p.length * 0.5;

      switch (p.shapeType) {
        // FIGURA 1: PÍLDORA / LÍNEA CON BORDE DE OTRO COLOR (Azul exterior, Blanco interior)
        case 'pill': {
          const w = 4.0;
          // 1. Trazo exterior azul eléctrico
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
          ctx.strokeStyle = p.innerColor;
          ctx.lineWidth = w * 0.45;
          ctx.stroke();
          break;
        }

        // FIGURA 2: CÍRCULO / ANILLO CONCÉNTRICO (Anillo exterior azul + centro blanco)
        case 'ring': {
          const r = p.radius;
          // Anillo exterior azul
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.strokeStyle = p.outerColor;
          ctx.lineWidth = 1.6;
          ctx.stroke();

          // Punto central blanco puro
          ctx.beginPath();
          ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
          ctx.fillStyle = p.innerColor;
          ctx.fill();
          break;
        }

        // FIGURA 3: LÍNEA DE PUNTOS / CUENTAS ALINEADAS (Blanco y azul alternados)
        case 'dotted': {
          const count = p.dotCount;
          const step = p.length / count;
          const startX = -hLen;

          for (let d = 0; d < count; d++) {
            const dotX = startX + d * step;
            const isWhite = d % 2 === 0;

            // Halo azul en puntos
            ctx.beginPath();
            ctx.arc(dotX, 0, 2.8, 0, Math.PI * 2);
            ctx.fillStyle = isWhite ? p.outerColor : 'rgba(0, 180, 216, 0.4)';
            ctx.fill();

            // Núcleo del punto
            ctx.beginPath();
            ctx.arc(dotX, 0, 1.4, 0, Math.PI * 2);
            ctx.fillStyle = isWhite ? p.innerColor : p.outerColor;
            ctx.fill();
          }
          break;
        }

        // FIGURA 4: ARCO CURVADO
        case 'arc': {
          const r = p.radius * 1.8;
          ctx.beginPath();
          ctx.arc(0, -r * 0.5, r, 0.4, 1.8);
          ctx.strokeStyle = p.outerColor;
          ctx.lineWidth = 3.2;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(0, -r * 0.5, r, 0.4, 1.8);
          ctx.strokeStyle = p.innerColor;
          ctx.lineWidth = 1.3;
          ctx.stroke();
          break;
        }
      }

      ctx.restore();
    }
  }
}
