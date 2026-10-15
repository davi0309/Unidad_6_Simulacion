/**
 * flowField.ts
 * Motor de Campo de Flujo (Flow Field 2D) para HEAL:
 * - Campo continuo con ruido fractal y domain warping periódico (toro continuo).
 * - Interpolación espacial bilineal en O(1) con rejilla precalculada.
 * - Soporte para perturbaciones dinámicas locales (impulsos, vórtices, frenos, expansiones).
 */

export interface FlowPerturbation {
  id: string;
  type: 'deflect' | 'slow' | 'turbulence' | 'concentrate' | 'open' | 'ripple' | 'vortex';
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  strength: number;
  life: number;
  maxLife: number;
  direction?: { x: number; y: number };
}

export class FlowField {
  public width: number;
  public height: number;

  public readonly cols: number = 72;
  public readonly rows: number = 44;
  private gridVx: Float32Array;
  private gridVy: Float32Array;

  // Perturbaciones activas inyectadas por teclas o heridas
  public perturbations: FlowPerturbation[] = [];

  // Tabla de permutación para ruido suave 2D/4D
  private perm: Uint8Array;

  constructor(w: number, h: number) {
    this.width = w;
    this.height = h;

    const totalCells = this.cols * this.rows;
    this.gridVx = new Float32Array(totalCells);
    this.gridVy = new Float32Array(totalCells);

    this.perm = new Uint8Array(512);
    for (let i = 0; i < 256; i++) {
      this.perm[i] = Math.floor(Math.sin(i * 127.1 + 311.7) * 43758.5453) & 255;
      this.perm[i + 256] = this.perm[i];
    }

    this.rebuildGrid(0);
  }

  public resize(w: number, h: number) {
    this.width = w;
    this.height = h;
  }

  /**
   * Ruido gradiente 2D optimizado
   */
  private noise2D(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);

    const u = xf * xf * xf * (xf * (xf * 6.0 - 15.0) + 10.0);
    const v = yf * yf * yf * (yf * (yf * 6.0 - 15.0) + 10.0);

    const p = this.perm;
    const aa = p[p[X] + Y];
    const ab = p[p[X] + Y + 1];
    const ba = p[p[X + 1] + Y];
    const bb = p[p[X + 1] + Y + 1];

    const grad = (hash: number, gx: number, gy: number) => {
      const h = hash & 7;
      const u = h < 4 ? gx : gy;
      const v = h < 4 ? gy : gx;
      return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    };

    const x1 = (1.0 - u) * grad(aa, xf, yf) + u * grad(ba, xf - 1.0, yf);
    const x2 = (1.0 - u) * grad(ab, xf, yf - 1.0) + u * grad(bb, xf - 1.0, yf - 1.0);
    return (1.0 - v) * x1 + v * x2;
  }

  /**
   * Ángulo toroidal periódico 4D con Domain Warping fractal (sin costuras)
   */
  private getAngle(u: number, v: number, time: number): number {
    const th = u * Math.PI * 2;
    const ph = v * Math.PI * 2;

    const cosTh = Math.cos(th);
    const sinTh = Math.sin(th);
    const cosPh = Math.cos(ph);
    const sinPh = Math.sin(ph);

    const t = time * 0.012;

    // Nivel 1 de domain warp (pliegues orgánicos)
    const qx = this.noise2D((cosTh + 1.4) * 1.5 + t, (sinTh + 1.4) * 1.5);
    const qy = this.noise2D((cosPh + 1.4) * 1.5, (sinPh + 1.4) * 1.5 - t);

    // Nivel 2 de domain warp (meandros y corrientes ramificadas)
    const rx = this.noise2D((cosTh + 2.2 * qx + 1.1) * 1.3, (cosPh + 2.2 * qy + 1.6) * 1.3);
    const ry = this.noise2D((sinTh + 2.2 * qx + 2.3) * 1.3, (sinPh + 2.2 * qy + 3.1) * 1.3);

    // Ondulación de corriente amplia
    const meander = Math.sin(ph * 1.0 + cosTh * 1.2 + t * 1.8) * 0.65 + Math.cos(ph * 2.0 + t) * 0.35;

    // Detalle fino
    const detail = this.noise2D((cosTh + 2.0 * rx) * 1.6, (sinPh + 2.0 * ry) * 1.6 + t * 0.4) * 1.8;

    return Math.PI * 0.5 + meander + detail;
  }

  /**
   * Reconstruye la rejilla de vectores interpolados incorporando perturbaciones activas
   */
  public rebuildGrid(timeSec: number) {
    const cols = this.cols;
    const rows = this.rows;
    const W = this.width;
    const H = this.height;
    const cellW = W / cols;
    const cellH = H / rows;

    for (let j = 0; j < rows; j++) {
      const v = j / rows;
      const cellY = (j + 0.5) * cellH;

      for (let i = 0; i < cols; i++) {
        const u = i / cols;
        const cellX = (i + 0.5) * cellW;

        const baseAngle = this.getAngle(u, v, timeSec);
        let vx = Math.cos(baseAngle);
        let vy = Math.sin(baseAngle);

        // Aplicar perturbaciones locales activas
        for (let pIdx = 0; pIdx < this.perturbations.length; pIdx++) {
          const p = this.perturbations[pIdx];
          const dx = cellX - p.x;
          const dy = cellY - p.y;
          const dist = Math.hypot(dx, dy);

          if (dist < p.radius && dist > 1.0) {
            const factor = (1.0 - dist / p.radius) * p.strength * (p.life / p.maxLife);

            switch (p.type) {
              case 'deflect':
                if (p.direction) {
                  vx += p.direction.x * factor * 3.5;
                  vy += p.direction.y * factor * 3.5;
                }
                break;
              case 'vortex':
              case 'turbulence':
                vx += (-dy / dist) * factor * 4.0;
                vy += (dx / dist) * factor * 4.0;
                break;
              case 'slow':
                vx *= (1.0 - factor * 0.85);
                vy *= (1.0 - factor * 0.85);
                break;
              case 'concentrate':
                vx -= (dx / dist) * factor * 3.2;
                vy -= (dy / dist) * factor * 3.2;
                break;
              case 'open':
                vx += (dx / dist) * factor * 4.0;
                vy += (dy / dist) * factor * 4.0;
                break;
              case 'ripple':
                const wave = Math.sin(dist * 0.08 - p.life * 6.0) * factor * 3.0;
                vx += (dx / dist) * wave;
                vy += (dy / dist) * wave;
                break;
            }
          }
        }

        const idx = j * cols + i;
        this.gridVx[idx] = vx;
        this.gridVy[idx] = vy;
      }
    }
  }

  /**
   * Muestreo bilineal continuo O(1) de la velocidad en cualquier posición (x, y)
   */
  public sampleVelocity(x: number, y: number): { vx: number; vy: number } {
    const W = this.width;
    const H = this.height;

    const u = (((x % W) + W) % W) / W;
    const v = (((y % H) + H) % H) / H;

    const cols = this.cols;
    const rows = this.rows;

    const fx = u * cols;
    const fy = v * rows;

    const i0 = Math.floor(fx);
    const j0 = Math.floor(fy);
    const i1 = (i0 + 1) % cols;
    const j1 = (j0 + 1) % rows;

    const tx = fx - i0;
    const ty = fy - j0;

    const idx00 = j0 * cols + i0;
    const idx10 = j0 * cols + i1;
    const idx01 = j1 * cols + i0;
    const idx11 = j1 * cols + i1;

    const vx0 = this.gridVx[idx00] * (1.0 - tx) + this.gridVx[idx10] * tx;
    const vx1 = this.gridVx[idx01] * (1.0 - tx) + this.gridVx[idx11] * tx;
    const vx = vx0 * (1.0 - ty) + vx1 * ty;

    const vy0 = this.gridVy[idx00] * (1.0 - tx) + this.gridVy[idx10] * tx;
    const vy1 = this.gridVy[idx01] * (1.0 - tx) + this.gridVy[idx11] * tx;
    const vy = vy0 * (1.0 - ty) + vy1 * ty;

    return { vx, vy };
  }

  public addPerturbation(p: Omit<FlowPerturbation, 'id'>) {
    const id = Math.random().toString(36).substring(2, 9);
    this.perturbations.push({ ...p, id });
    if (this.perturbations.length > 25) {
      this.perturbations.shift();
    }
  }

  public update(dt: number, timeSec: number) {
    for (let i = this.perturbations.length - 1; i >= 0; i--) {
      const p = this.perturbations[i];
      p.life -= dt;
      p.radius += (p.maxRadius - p.radius) * Math.min(dt * 3.5, 1.0);

      if (p.life <= 0) {
        this.perturbations.splice(i, 1);
      }
    }

    this.rebuildGrid(timeSec);
  }
}
