/**
 * flowField.ts
 * Motor de Campo de Flujo (Flow Field) con Domain-Warping Toroidal:
 * - Diseñado para reproducir fielmente la imagen de referencia (ríos y filamentos sedosos).
 * - BORDES SIN PAREDES (TORO CONTINUO 4D): Las coordenadas están proyectadas en un toro periódico.
 *   El campo en la parte superior e inferior, izquierda y derecha es matemáticamente idéntico y continuo.
 * - DOMAIN WARPING FRACTAL: Produce las sinuosas ramificaciones y afluentes que convergen en ríos principales.
 * - Rejilla vectorial de 64x40 precalculada para un rendimiento ultra-fluido (60 FPS estables).
 */

export interface Point2D {
  x: number;
  y: number;
}

export interface DynamicImpulse {
  type: string;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  strength: number;
  life: number;
  maxLife: number;
}

export class FlowFieldEngine {
  public width: number;
  public height: number;

  private permTable: Uint8Array;

  // Rejilla de vectores para rendimiento de 60 FPS
  public readonly gridCols = 64;
  public readonly gridRows = 40;
  private gridVx: Float32Array;
  private gridVy: Float32Array;
  private gridAngle: Float32Array;

  // Impulsos dinámicos (interacciones de teclado/ratón)
  public activeImpulses: DynamicImpulse[] = [];
  public get activePulses(): DynamicImpulse[] {
    return this.activeImpulses;
  }

  constructor(w: number, h: number) {
    this.width = w;
    this.height = h;

    this.permTable = new Uint8Array(512);
    for (let i = 0; i < 256; i++) {
      this.permTable[i] = Math.floor(Math.sin(i * 91.3 + 17.5) * 43758.5453) & 255;
      this.permTable[i + 256] = this.permTable[i];
    }

    const totalCells = this.gridCols * this.gridRows;
    this.gridVx = new Float32Array(totalCells);
    this.gridVy = new Float32Array(totalCells);
    this.gridAngle = new Float32Array(totalCells);

    this.rebuildVectorGrid(0);
  }

  public resize(w: number, h: number) {
    this.width = w;
    this.height = h;
  }

  private noise2D(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = xf * xf * (3.0 - 2.0 * xf);
    const v = yf * yf * (3.0 - 2.0 * yf);

    const p = this.permTable;
    const A = p[X] + Y;
    const B = p[X + 1] + Y;

    const s1 = p[A] / 255.0;
    const s2 = p[B] / 255.0;
    const s3 = p[A + 1] / 255.0;
    const s4 = p[B + 1] / 255.0;

    const x1 = s1 * (1.0 - u) + s2 * u;
    const x2 = s3 * (1.0 - u) + s4 * u;
    return x1 * (1.0 - v) + x2 * v;
  }

  /**
   * Genera el ángulo del flujo mediante Domain-Warping toroidal periódico 4D.
   * Esto crea las ramificaciones arteriales y ríos sinuosos de la imagen de referencia.
   */
  private getDomainWarpedAngle(u: number, v: number, time: number): number {
    const th = u * Math.PI * 2;
    const ph = v * Math.PI * 2;

    const cosTh = Math.cos(th);
    const sinTh = Math.sin(th);
    const cosPh = Math.cos(ph);
    const sinPh = Math.sin(ph);

    // Muestreo toroidal periódico 4D suave
    const t = time * 0.012;

    // Nivel 1 de distorsión de coordenadas (Domain Warp 1)
    const qx = this.noise2D((cosTh + 1.5) * 1.6 + t, (sinTh + 1.5) * 1.6);
    const qy = this.noise2D((cosPh + 1.5) * 1.6, (sinPh + 1.5) * 1.6 - t);

    // Nivel 2: pliegues dendríticos profundos que canalizan los ríos principales
    const rx = this.noise2D((cosTh + 2.4 * qx + 1.2) * 1.4, (cosPh + 2.4 * qy + 1.8) * 1.4);
    const ry = this.noise2D((sinTh + 2.4 * qx + 2.4) * 1.4, (sinPh + 2.4 * qy + 3.2) * 1.4);

    // Meandro vertical predominante (top-to-bottom como en la imagen de referencia)
    const meander = Math.sin(ph * 1.0 + cosTh * 1.2 + t * 1.8) * 0.70 + Math.cos(ph * 2.0 + t) * 0.35;

    // Pliegues y afluentes que alimentan los ríos principales desde los laterales
    const foldNoise = (this.noise2D((cosTh + 2.2 * rx) * 1.7, (sinPh + 2.2 * ry) * 1.7 + t * 0.3) - 0.5) * 2.0;

    // Flujo vertical hacia abajo (Math.PI * 0.5) modulado por los meandros y pliegues sinuosos
    return Math.PI * 0.5 + meander + foldNoise;
  }

  /**
   * Reconstruye la rejilla de vectores para que las partículas puedan muestrearla en O(1).
   */
  public rebuildVectorGrid(time: number) {
    const cols = this.gridCols;
    const rows = this.gridRows;
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

        let angle = this.getDomainWarpedAngle(u, v, time);

        let vx = Math.cos(angle) * 2.2;
        let vy = Math.sin(angle) * 2.2;

        // Impulsos dinámicos interactivos (teclas / clics)
        for (const imp of this.activeImpulses) {
          const dx = cellX - imp.x;
          const dy = cellY - imp.y;
          const dist = Math.hypot(dx, dy);
          const lifeRatio = imp.life / imp.maxLife;

          if (dist < imp.radius && dist > 1.0) {
            const factor = (1.0 - dist / imp.radius) * imp.strength * lifeRatio;
            switch (imp.type) {
              case 'cyclone_cw':
                vx += (-dy / dist) * factor * 5.5;
                vy += (dx / dist) * factor * 5.5;
                break;
              case 'cyclone_ccw':
                vx += (dy / dist) * factor * 5.5;
                vy += (-dx / dist) * factor * 5.5;
                break;
              case 'shockwave':
                vx += (dx / dist) * factor * 5.0;
                vy += (dy / dist) * factor * 5.0;
                break;
              case 'attractor':
                vx -= (dx / dist) * factor * 4.5;
                vy -= (dy / dist) * factor * 4.5;
                break;
              case 'jet_up':
                vy -= factor * 6.0;
                vx += Math.sin(cellY * 0.05) * factor * 2.0;
                break;
              case 'jet_down':
                vy += factor * 6.0;
                vx += Math.cos(cellY * 0.05) * factor * 2.0;
                break;
              case 'transverse_wave':
                vx += Math.sin((cellX - imp.x) * 0.04) * factor * 5.0;
                break;
              case 'divergence':
                vx += (dx / dist) * factor * 6.0;
                vy += (dy / dist) * factor * 6.0;
                break;
              case 'shear':
                vx += (dy > 0 ? 1 : -1) * factor * 5.0;
                break;
              case 'harmonic_ripple':
                vx += Math.cos(dist * 0.08) * factor * 4.2;
                vy += Math.sin(dist * 0.08) * factor * 4.2;
                break;
              default:
                vx += (-dy / dist) * factor * 4.5;
                vy += (dx / dist) * factor * 4.5;
                break;
            }
          }
        }

        // Velocidad normalizada asegurada
        const spd = Math.hypot(vx, vy);
        if (spd > 0.01) {
          angle = Math.atan2(vy, vx);
        }

        const idx = j * cols + i;
        this.gridVx[idx] = vx;
        this.gridVy[idx] = vy;
        this.gridAngle[idx] = angle;
      }
    }
  }

  /**
   * Muestreo ultra-rápido O(1) de velocidad y ángulo en cualquier punto (x, y).
   */
  public sampleVelocity(x: number, y: number): { vx: number; vy: number; angle: number } {
    const W = this.width;
    const H = this.height;

    const u = (((x % W) + W) % W) / W;
    const v = (((y % H) + H) % H) / H;

    const cols = this.gridCols;
    const rows = this.gridRows;

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

    const angle = this.gridAngle[idx00];

    return { vx, vy, angle };
  }

  public triggerKeyPulse(x: number, y: number, keyCode: string) {
    let type = 'cyclone_cw';
    let maxR = 380;
    let str = 5.0;
    let life = 2.0;

    switch (keyCode) {
      case 'KeyQ':
        type = 'shockwave';         // Onda expansiva radial
        maxR = 460;
        str = 6.0;
        break;
      case 'KeyW':
        type = 'cyclone_cw';        // Vórtice horario
        maxR = 360;
        str = 5.5;
        break;
      case 'KeyE':
        type = 'jet_up';            // Chorro ascendente
        maxR = 420;
        str = 6.2;
        break;
      case 'KeyR':
        type = 'cyclone_ccw';       // Vórtice antihorario
        maxR = 360;
        str = 5.5;
        break;
      case 'KeyT':
        type = 'attractor';         // Succión gravitacional
        maxR = 400;
        str = 4.8;
        break;
      case 'KeyY':
        type = 'transverse_wave';    // Onda sinusoidal transversal
        maxR = 440;
        str = 5.2;
        break;
      case 'KeyU':
        type = 'divergence';        // Apertura divergente
        maxR = 420;
        str = 5.8;
        break;
      case 'KeyI':
        type = 'jet_down';          // Cascada descendente
        maxR = 420;
        str = 6.2;
        break;
      case 'KeyO':
        type = 'shear';             // Cizalla tangencial
        maxR = 390;
        str = 5.0;
        break;
      case 'KeyP':
        type = 'harmonic_ripple';   // Vibración armónica rápida
        maxR = 450;
        str = 4.5;
        break;
      default:
        type = 'cyclone_cw';
        break;
    }

    this.activeImpulses.push({
      type,
      x,
      y,
      radius: 12,
      maxRadius: maxR,
      strength: str,
      life,
      maxLife: life
    });

    if (this.activeImpulses.length > 15) {
      this.activeImpulses.shift();
    }
  }

  public update(dt: number, timeSec: number = 0) {
    for (let i = this.activeImpulses.length - 1; i >= 0; i--) {
      const imp = this.activeImpulses[i];
      imp.life -= dt;
      imp.radius += (imp.maxRadius - imp.radius) * (dt * 3.5);

      if (imp.life <= 0) {
        this.activeImpulses.splice(i, 1);
      }
    }

    this.rebuildVectorGrid(timeSec);
  }
}
