/**
 * particleSystem.ts
 * Sistema de Filamentos de Flujo Orgánico y Heridas Vivas (Fiel a la Imagen de Referencia):
 * - BORDES SIN PAREDES (TORO CONTINUO): Las partículas que salen por arriba emergen por abajo,
 *   y las que salen por la derecha emergen por la izquierda sin rebotes ni paredes.
 * - FILAMENTOS ORGÁNICOS (Imagen de referencia): Miles de hebras sedosas continuas que trazan
 *   los ríos del campo de flujo divergencia-cero sobre fondo negro puro (#000000).
 * - CÚMULOS = COLOR ROJO (HERIDAS): Donde las corrientes convergen y forman cúmulos o nudos,
 *   su color cambia dinámicamente a rojo carmesí / rubí intenso (#ff1744, #d50032), explicando las heridas.
 * - CURACIÓN KINTSUGI DE ORO 24K: Al tocar teclas Q-P o clic, los cúmulos rojos se transforman
 *   en hilos dorados incandescentes con reflejos blancos (#ffd700, #ffffff) que sellan la cicatriz.
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

  // Paleta de tejido sano: cian neón, azul cielo, blanco hielo
  private readonly cyanColors = [
    'rgba(0, 240, 255, 0.85)',
    'rgba(56, 189, 248, 0.85)',
    'rgba(103, 232, 249, 0.80)',
    'rgba(240, 249, 255, 0.90)'
  ];

  constructor(w: number, h: number, count: number = 2600) {
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
          speed: 0.95 + Math.random() * 0.45,
          maxTrail: 9 + Math.floor(Math.random() * 7),
          trail: [{ x: px, y: py }]
        });

        created++;
      }
    }
  }

  /**
   * Vierte energía sanadora de oro Kintsugi en las coordenadas indicadas (teclas Q-P o clic).
   * La curación se propaga por los cúmulos de herida cercanos.
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
      if (this.densityGrid[i] >= 5) {
        woundCells++;
        if (this.healingGrid[i] > 0.25) {
          healedCells += this.healingGrid[i];
        }
      }
    }

    if (woundCells === 0) return 0.0;
    return Math.min(1.0, healedCells / woundCells);
  }

  /**
   * Actualiza y renderiza los filamentos de flujo orgánicos (Imagen de referencia):
   * - Los bordes son un toro continuo (salen por el otro lado sin paredes).
   * - Los cúmulos se colorean de rojo intenso explicando las heridas.
   * - La curación transforma los cúmulos en oro Kintsugi 24K.
   */
  public updateAndRender(
    dt: number,
    time: number,
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

    // 3. Paso 2: Crear trayectorias agrupadas por categoría cromática para máximo rendimiento (60 FPS)
    const cyanPath = new Path2D();
    const redWoundPath = new Path2D();
    const goldKintsugiPath = new Path2D();

    for (let i = 0; i < numParticles; i++) {
      const p = this.particles[i];

      // Muestreo del campo de velocidad toroidal sin paredes
      const flow = flowEngine.sampleVelocity(p.x, p.y, time);

      // Inercia fluida suave
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
      let wrapped = false;
      if (p.x < 0) {
        p.x += W;
        wrapped = true;
      } else if (p.x >= W) {
        p.x -= W;
        wrapped = true;
      }

      if (p.y < 0) {
        p.y += H;
        wrapped = true;
      } else if (p.y >= H) {
        p.y -= H;
        wrapped = true;
      }

      // Si cruzó el borde toroidal, reiniciar rastro para evitar líneas cruzadas en pantalla
      if (wrapped) {
        p.trail = [{ x: p.x, y: p.y }];
      } else {
        p.trail.unshift({ x: p.x, y: p.y });
        if (p.trail.length > p.maxTrail) {
          p.trail.pop();
        }
      }

      // Determinar si la partícula está en un CÚMULO (HERIDA) o en ORO KINTSUGI
      const gx = Math.max(0, Math.min(gCols - 1, Math.floor(p.x / cellW)));
      const gy = Math.max(0, Math.min(gRows - 1, Math.floor(p.y / cellH)));
      const cellIdx = gy * gCols + gx;

      const density = this.densityGrid[cellIdx];
      const healing = this.healingGrid[cellIdx];

      // Agregar los segmentos del filamento a la trayectoria correspondiente
      if (p.trail.length >= 2) {
        const targetPath = (healing > 0.20)
          ? goldKintsugiPath
          : (density >= 5)
            ? redWoundPath
            : cyanPath;

        targetPath.moveTo(p.trail[0].x, p.trail[0].y);
        for (let t = 1; t < p.trail.length; t++) {
          targetPath.lineTo(p.trail[t].x, p.trail[t].y);
        }
      }
    }

    // =========================================================================
    // RENDERIZADO DE FILAMENTOS (Imagen de referencia):
    // =========================================================================

    // 1. TEJIDO VIVO SANO: Filamentos cian eléctrico / azul cielo / blanco
    ctx.lineWidth = 1.3;
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.85)';
    ctx.stroke(cyanPath);

    // 2. CÚMULOS = HERIDAS VIVAS: Filamentos en rojo rubí / carmesí profundo
    // Halo sangrante exterior de las heridas
    ctx.lineWidth = 3.6;
    ctx.strokeStyle = 'rgba(230, 20, 60, 0.40)';
    ctx.stroke(redWoundPath);

    // Núcleo carmesí vivo
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = 'rgba(255, 23, 68, 0.98)';
    ctx.stroke(redWoundPath);

    // 3. CURACIÓN KINTSUGI: Filamentos de ORO LÍQUIDO 24K en las heridas curadas
    // Halo dorado áureo
    ctx.lineWidth = 4.2;
    ctx.strokeStyle = 'rgba(212, 160, 20, 0.50)';
    ctx.stroke(goldKintsugiPath);

    // Vena de oro puro 24K brillante
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.98)';
    ctx.stroke(goldKintsugiPath);

    // Reflejo especular blanco
    ctx.lineWidth = 1.0;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.stroke(goldKintsugiPath);
  }
}
