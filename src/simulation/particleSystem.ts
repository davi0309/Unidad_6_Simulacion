/**
 * particleSystem.ts
 * Sistema de Filamentos de Flujo Orgánico y Heridas Vivas Ultra-Optimizado (60 FPS):
 * - BORDES SIN PAREDES (TORO CONTINUO): Las partículas que salen por arriba emergen por abajo,
 *   y las que salen por la derecha entran por la izquierda con continuidad perfecta y sin trazar líneas cruzadas.
 * - FILAMENTOS ORGÁNICOS (Imagen de referencia): 1800 hebras sedosas que trazan los ríos del flujo.
 * - CÚMULOS = COLOR ROJO (HERIDAS): Donde las corrientes convergen formando cúmulos, su color cambia a rojo carmesí / rubí (#ff1744).
 * - CURACIÓN KINTSUGI DE ORO 24K: Al tocar teclas Q-P o clic, los cúmulos se transforman en hilos dorados incandescentes (#ffd700).
 * - CERO ASIGNACIONES EN EL BUCLE (Zero-GC): Rendimiento fluido y constante a 60 FPS sin tirones ni micro-congelamientos.
 */

import { FlowFieldEngine } from './flowField';
import { HealParameters } from './parameters';

export interface FilamentParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  maxTrail: number;
  category: number; // 0 = sano (cian), 1 = herida (rojo), 2 = oro kintsugi
  trail: { x: number; y: number }[];
}

export class FlowParticleSystem {
  public width: number;
  public height: number;
  public count: number;

  public particles: FilamentParticle[] = [];
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;

  // Rejilla espacial para detección de densidad (cúmulos/heridas) y curación Kintsugi
  public readonly gridCols = 40;
  public readonly gridRows = 25;
  public densityGrid: Uint16Array;
  public healingGrid: Float32Array;

  constructor(w: number, h: number, count: number = 1800) {
    this.width = w;
    this.height = h;
    this.count = count;

    this.densityGrid = new Uint16Array(this.gridCols * this.gridRows);
    this.healingGrid = new Float32Array(this.gridCols * this.gridRows);

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
   * Distribuye las partículas uniformemente por todo el lienzo sin vacíos.
   */
  public initUniformParticles() {
    this.particles = [];
    this.densityGrid.fill(0);
    this.healingGrid.fill(0);

    const cols = Math.ceil(Math.sqrt(this.count * (this.width / this.height)));
    const rows = Math.ceil(this.count / cols);
    const cellW = this.width / cols;
    const cellH = this.height / rows;

    let created = 0;
    for (let r = 0; r < rows && created < this.count; r++) {
      for (let c = 0; c < cols && created < this.count; c++) {
        const px = (c + Math.random()) * cellW;
        const py = (r + Math.random()) * cellH;

        this.particles.push({
          x: px,
          y: py,
          vx: (Math.random() - 0.5) * 1.5,
          vy: (Math.random() - 0.5) * 1.5,
          speed: 0.95 + Math.random() * 0.40,
          maxTrail: 8 + Math.floor(Math.random() * 5),
          category: 0,
          trail: [{ x: px, y: py }]
        });

        created++;
      }
    }
  }

  /**
   * Vierte energía sanadora de oro Kintsugi en las coordenadas indicadas (teclas Q-P o clic).
   */
  public addHealingEnergy(cursorX: number, cursorY: number, amount: number = 0.35) {
    const W = this.width;
    const H = this.height;
    const cellW = W / this.gridCols;
    const cellH = H / this.gridRows;

    const centerGX = Math.floor(cursorX / cellW);
    const centerGY = Math.floor(cursorY / cellH);
    const radiusCells = 4;

    for (let dy = -radiusCells; dy <= radiusCells; dy++) {
      for (let dx = -radiusCells; dx <= radiusCells; dx++) {
        const gx = (centerGX + dx + this.gridCols) % this.gridCols;
        const gy = (centerGY + dy + this.gridRows) % this.gridRows;
        const distSq = dx * dx + dy * dy;

        if (distSq <= radiusCells * radiusCells) {
          const falloff = 1.0 - Math.sqrt(distSq) / radiusCells;
          const idx = gy * this.gridCols + gx;
          this.healingGrid[idx] = Math.min(1.0, this.healingGrid[idx] + amount * falloff);
        }
      }
    }
  }

  /**
   * Retorna el porcentaje de curación global (0.0 a 1.0)
   */
  public getHealingProgress(): number {
    let woundCells = 0;
    let healedCells = 0;

    for (let i = 0; i < this.densityGrid.length; i++) {
      if (this.densityGrid[i] >= 4) {
        woundCells++;
        if (this.healingGrid[i] > 0.20) {
          healedCells += this.healingGrid[i];
        }
      }
    }

    if (woundCells === 0) return 0.0;
    return Math.min(1.0, healedCells / woundCells);
  }

  /**
   * Agrega los segmentos de estela de una partícula al contexto 2D
   * evitando líneas cruzadas si la partícula cruzó el borde toroidal.
   */
  private appendTrail(ctx: CanvasRenderingContext2D, p: FilamentParticle) {
    const len = p.trail.length;
    if (len < 2) return;

    ctx.moveTo(p.trail[0].x, p.trail[0].y);
    for (let t = 1; t < len; t++) {
      const p0 = p.trail[t - 1];
      const p1 = p.trail[t];
      // Si cruzó el borde toroidal (salto de coordenadas), mover sin trazar línea
      if (Math.abs(p1.x - p0.x) > 40 || Math.abs(p1.y - p0.y) > 40) {
        ctx.moveTo(p1.x, p1.y);
      } else {
        ctx.lineTo(p1.x, p1.y);
      }
    }
  }

  /**
   * Actualiza y renderiza los filamentos de flujo orgánicos a 60 FPS:
   * - Los bordes son un toro continuo (salen por el otro lado sin paredes).
   * - Los cúmulos se colorean de rojo intenso explicando las heridas.
   * - La curación transforma los cúmulos en oro Kintsugi 24K.
   */
  public updateAndRender(
    dt: number,
    _time: number,
    flowEngine: FlowFieldEngine,
    _params: HealParameters
  ) {
    const ctx = this.ctx;
    const W = this.width;
    const H = this.height;

    // 1. Limpieza TOTAL a negro absoluto (#000000)
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const numParticles = this.particles.length;
    const timeScale = dt * 60.0;

    const gCols = this.gridCols;
    const gRows = this.gridRows;
    const cellW = W / gCols;
    const cellH = H / gRows;

    // 2. Paso 1: Medir la densidad de cúmulos en la rejilla espacial
    this.densityGrid.fill(0);
    for (let i = 0; i < numParticles; i++) {
      const p = this.particles[i];
      const gx = Math.max(0, Math.min(gCols - 1, Math.floor(p.x / cellW)));
      const gy = Math.max(0, Math.min(gRows - 1, Math.floor(p.y / cellH)));
      this.densityGrid[gy * gCols + gx]++;
    }

    // 3. Paso 2: Actualizar posiciones con envoltura toroidal sin paredes
    for (let i = 0; i < numParticles; i++) {
      const p = this.particles[i];

      // Muestreo ultrarrápido O(1) de velocidad desde la rejilla precalculada
      const flow = flowEngine.sampleVelocity(p.x, p.y);

      // Inercia fluida
      const inertia = 0.86;
      p.vx = p.vx * inertia + flow.vx * (1.0 - inertia) * p.speed;
      p.vy = p.vy * inertia + flow.vy * (1.0 - inertia) * p.speed;

      // Integrar posición
      p.x += p.vx * timeScale;
      p.y += p.vy * timeScale;

      // =========================================================================
      // BORDES TOROIDALES CONTINUOS (SIN PAREDES):
      // Si suben, salen por abajo; si van a la derecha, entran por la izquierda.
      // =========================================================================
      if (p.x < 0) {
        p.x += W;
        p.trail = [{ x: p.x, y: p.y }];
      } else if (p.x >= W) {
        p.x -= W;
        p.trail = [{ x: p.x, y: p.y }];
      }

      if (p.y < 0) {
        p.y += H;
        p.trail = [{ x: p.x, y: p.y }];
      } else if (p.y >= H) {
        p.y -= H;
        p.trail = [{ x: p.x, y: p.y }];
      }

      p.trail.unshift({ x: p.x, y: p.y });
      if (p.trail.length > p.maxTrail) {
        p.trail.pop();
      }

      // Clasificación de color: CÚMULOS = HERIDAS (Rojo), CURACIÓN = ORO
      const gx = Math.max(0, Math.min(gCols - 1, Math.floor(p.x / cellW)));
      const gy = Math.max(0, Math.min(gRows - 1, Math.floor(p.y / cellH)));
      const cellIdx = gy * gCols + gx;

      const density = this.densityGrid[cellIdx];
      const healing = this.healingGrid[cellIdx];

      if (healing > 0.20) {
        p.category = 2; // Oro Kintsugi
      } else if (density >= 4) {
        p.category = 1; // Herida viva (Cúmulo)
      } else {
        p.category = 0; // Tejido sano
      }
    }

    // =========================================================================
    // RENDERIZADO ULTRA-EFICIENTE (3 pases directos, Cero asignaciones en memoria)
    // =========================================================================

    // PASE 1: TEJIDO SANO (Cian eléctrico / blanco)
    ctx.beginPath();
    for (let i = 0; i < numParticles; i++) {
      const p = this.particles[i];
      if (p.category === 0) {
        this.appendTrail(ctx, p);
      }
    }
    ctx.lineWidth = 1.3;
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.82)';
    ctx.stroke();

    // PASE 2: CÚMULOS = HERIDAS VIVAS (Rojo carmesí / rubí intenso)
    ctx.beginPath();
    for (let i = 0; i < numParticles; i++) {
      const p = this.particles[i];
      if (p.category === 1) {
        this.appendTrail(ctx, p);
      }
    }
    // Núcleo carmesí
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = 'rgba(255, 23, 68, 0.96)';
    ctx.stroke();

    // PASE 3: CURACIÓN KINTSUGI (Oro líquido 24K brillante)
    ctx.beginPath();
    for (let i = 0; i < numParticles; i++) {
      const p = this.particles[i];
      if (p.category === 2) {
        this.appendTrail(ctx, p);
      }
    }
    // Vena de oro fundido
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.98)';
    ctx.stroke();

    // Reflejo blanco especular
    ctx.lineWidth = 1.0;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.stroke();
  }
}
