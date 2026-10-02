/**
 * woundSDF.ts
 * Generación procedural y actualización dinámica del campo de distancia con signo (SDF)
 * para la herida de "Heal".
 *
 * - Grieta principal de ~55% del viewport en diagonal suave.
 * - 2 a 4 ramas secundarias cortas.
 * - Borde con ruido fractal y ancho variable de 6 a 18 px.
 * - SDF < 0 dentro de la herida, > 0 fuera.
 * - Gradiente ∇SDF apunta hacia afuera (el campo de dolor).
 * - Soporte para microfracturas cuando stress > 1.
 * - 6 a 10 cicatrices antiguas en la región exterior (1.6x) al 25% de brillo.
 */

export interface Point2D {
  x: number;
  y: number;
}

export interface Segment {
  p0: Point2D;
  p1: Point2D;
  w0: number;
  w1: number;
}

export interface AncientScar {
  segments: Segment[];
}

// Generador de ruido pseudoaleatorio 2D reproducible
function hash21(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function noise2D(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;

  // Curva de interpolación suave (Hermite)
  const ux = fx * fx * (3.0 - 2.0 * fx);
  const uy = fy * fy * (3.0 - 2.0 * fy);

  const a0 = hash21(ix, iy);
  const a1 = hash21(ix + 1, iy);
  const b0 = hash21(ix, iy + 1);
  const b1 = hash21(ix + 1, iy + 1);

  return (a0 * (1 - ux) + a1 * ux) * (1 - uy) + (b0 * (1 - ux) + b1 * ux) * uy;
}

function fbm(x: number, y: number): number {
  let val = 0;
  let amp = 0.55;
  let freq = 1.0;
  for (let i = 0; i < 3; i++) {
    val += amp * (noise2D(x * freq, y * freq) - 0.5);
    freq *= 2.1;
    amp *= 0.48;
  }
  return val;
}

function distToSegmentSquared(
  px: number,
  py: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number
): { distSq: number; t: number } {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-6) {
    const ddx = px - x0;
    const ddy = py - y0;
    return { distSq: ddx * ddx + ddy * ddy, t: 0 };
  }
  let t = ((px - x0) * dx + (py - y0) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = x0 + t * dx;
  const projY = y0 + t * dy;
  const rx = px - projX;
  const ry = py - projY;
  return { distSq: rx * rx + ry * ry, t };
}

export class WoundSystem {
  public simWidth: number;
  public simHeight: number;
  public domainWidth: number;
  public domainHeight: number;

  public segments: Segment[] = [];
  public ancientScars: AncientScar[] = [];
  public center: Point2D = { x: 0, y: 0 };

  // Buffer de datos Float32 para el SDF: negativo dentro, positivo fuera
  public sdfData: Float32Array;
  // Gradiente precalculado para el campo de dolor (gradX, gradY)
  public gradData: Float32Array;

  // Máscara binaria que cuenta píxeles dentro de la herida
  public totalWoundPixels: number = 0;
  public woundMask: Uint8Array;

  constructor(domainW: number, domainH: number, simW: number, simH: number) {
    this.domainWidth = domainW;
    this.domainHeight = domainH;
    this.simWidth = simW;
    this.simHeight = simH;

    this.sdfData = new Float32Array(simW * simH);
    this.gradData = new Float32Array(simW * simH * 2);
    this.woundMask = new Uint8Array(simW * simH);

    this.generateProceduralWound();
    this.generateAncientScars();
    this.recomputeSDF();
  }

  public resize(domainW: number, domainH: number, simW: number, simH: number) {
    this.domainWidth = domainW;
    this.domainHeight = domainH;
    this.simWidth = simW;
    this.simHeight = simH;

    this.sdfData = new Float32Array(simW * simH);
    this.gradData = new Float32Array(simW * simH * 2);
    this.woundMask = new Uint8Array(simW * simH);

    this.generateProceduralWound();
    this.generateAncientScars();
    this.recomputeSDF();
  }

  /**
   * Genera la grieta principal y sus 2 a 4 ramas secundarias.
   * La grieta principal cubre ~55% del viewport en diagonal suave.
   */
  public generateProceduralWound() {
    this.segments = [];
    const W = this.domainWidth / 1.6; // ancho del viewport central
    const H = this.domainHeight / 1.6;

    const startX = this.domainWidth * 0.5 - W * 0.28;
    const startY = this.domainHeight * 0.5 - H * 0.15;
    const endX = this.domainWidth * 0.5 + W * 0.28;
    const endY = this.domainHeight * 0.5 + H * 0.16;

    this.center = {
      x: (startX + endX) * 0.5,
      y: (startY + endY) * 0.5
    };

    // Subdividir la línea principal en segmentos con perturbación orgánica
    const steps = 14;
    const pts: Point2D[] = [];
    const widths: number[] = [];

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const baseX = startX + (endX - startX) * t;
      const baseY = startY + (endY - startY) * t;

      // Desplazamiento perpendicular orgánico
      const perpAngle = Math.atan2(endY - startY, endX - startX) + Math.PI * 0.5;
      const wobble = Math.sin(t * Math.PI) * (noise2D(t * 5.0, 1.23) - 0.5) * 52.0;

      const px = baseX + Math.cos(perpAngle) * wobble;
      const py = baseY + Math.sin(perpAngle) * wobble;
      pts.push({ x: px, y: py });

      // Ancho variable de 6 a 18 px: más ancho en el centro, afinándose en los extremos
      const wBase = Math.sin(t * Math.PI) * 11.0 + 6.5;
      widths.push(wBase);
    }

    for (let i = 0; i < steps; i++) {
      this.segments.push({
        p0: pts[i],
        p1: pts[i + 1],
        w0: widths[i],
        w1: widths[i + 1]
      });
    }

    // 2 a 4 ramas secundarias cortas que nacen de la grieta principal
    const branchCount = 2 + Math.floor(Math.random() * 3);
    const candidateNodes = [3, 5, 8, 10];

    for (let b = 0; b < branchCount && b < candidateNodes.length; b++) {
      const nodeIdx = candidateNodes[b];
      const root = pts[nodeIdx];
      const mainDir = Math.atan2(
        pts[nodeIdx + 1].y - pts[nodeIdx - 1].y,
        pts[nodeIdx + 1].x - pts[nodeIdx - 1].x
      );
      const sign = b % 2 === 0 ? 1 : -1;
      const branchAngle = mainDir + sign * (0.8 + Math.random() * 0.45);
      const branchLen = 35.0 + Math.random() * 45.0;

      const branchSteps = 4;
      let currX = root.x;
      let currY = root.y;
      let currW = widths[nodeIdx] * 0.65;

      for (let s = 1; s <= branchSteps; s++) {
        const segLen = branchLen / branchSteps;
        const curA = branchAngle + (noise2D(s * 2.0, b * 3.7) - 0.5) * 0.35;
        const nextX = currX + Math.cos(curA) * segLen;
        const nextY = currY + Math.sin(curA) * segLen;
        const nextW = Math.max(3.5, currW * 0.72);

        this.segments.push({
          p0: { x: currX, y: currY },
          p1: { x: nextX, y: nextY },
          w0: currW,
          w1: nextW
        });

        currX = nextX;
        currY = nextY;
        currW = nextW;
      }
    }
  }

  /**
   * Genera de 6 a 10 cicatrices antiguas procedurales en la región exterior del dominio (1.6x)
   * que se revelarán con el zoom final de la tecla Enter.
   */
  public generateAncientScars() {
    this.ancientScars = [];
    const scarCount = 7 + Math.floor(Math.random() * 4);

    const vpW = this.domainWidth / 1.6;
    const vpH = this.domainHeight / 1.6;
    const halfVpW = vpW * 0.5;
    const halfVpH = vpH * 0.5;
    const centerX = this.domainWidth * 0.5;
    const centerY = this.domainHeight * 0.5;

    for (let i = 0; i < scarCount; i++) {
      const angle = (i / scarCount) * Math.PI * 2.0 + Math.random() * 0.4;
      const dist = (0.75 + Math.random() * 0.45) * Math.min(halfVpW, halfVpH);
      const originX = centerX + Math.cos(angle) * dist * 1.35;
      const originY = centerY + Math.sin(angle) * dist * 1.35;

      const scarSegments: Segment[] = [];
      const len = 30 + Math.random() * 45;
      const scarAngle = angle + (Math.random() - 0.5) * 1.5;
      const steps = 3 + Math.floor(Math.random() * 3);

      let pX = originX;
      let pY = originY;
      let w = 4.5 + Math.random() * 4.0;

      for (let s = 0; s < steps; s++) {
        const segLen = len / steps;
        const a = scarAngle + (noise2D(s, i) - 0.5) * 0.5;
        const nX = pX + Math.cos(a) * segLen;
        const nY = pY + Math.sin(a) * segLen;
        const nW = Math.max(2.0, w * 0.7);

        scarSegments.push({
          p0: { x: pX, y: pY },
          p1: { x: nX, y: nY },
          w0: w,
          w1: nW
        });

        pX = nX;
        pY = nY;
        w = nW;
      }

      this.ancientScars.push({ segments: scarSegments });
    }
  }

  /**
   * Agrega una microfractura por estrés en un punto aleatorio del borde de la herida.
   * Segmento de 10 a 40 px.
   */
  public addMicrofracture(): { origin: Point2D; end: Point2D } {
    if (this.segments.length === 0) return { origin: this.center, end: this.center };

    const parentSeg = this.segments[Math.floor(Math.random() * this.segments.length)];
    const t = Math.random();
    const origin: Point2D = {
      x: parentSeg.p0.x + (parentSeg.p1.x - parentSeg.p0.x) * t,
      y: parentSeg.p0.y + (parentSeg.p1.y - parentSeg.p0.y) * t
    };

    const mainAngle = Math.atan2(parentSeg.p1.y - parentSeg.p0.y, parentSeg.p1.x - parentSeg.p0.x);
    const sign = Math.random() > 0.5 ? 1 : -1;
    const branchAngle = mainAngle + sign * (0.8 + Math.random() * 0.7);
    const length = 12.0 + Math.random() * 28.0;

    const end: Point2D = {
      x: origin.x + Math.cos(branchAngle) * length,
      y: origin.y + Math.sin(branchAngle) * length
    };

    this.segments.push({
      p0: origin,
      p1: end,
      w0: 5.5,
      w1: 2.5
    });

    this.recomputeSDF();
    return { origin, end };
  }

  /**
   * Recalcula el Signed Distance Field (SDF) y el gradiente sobre la grilla de simulación.
   */
  public recomputeSDF() {
    const sw = this.simWidth;
    const sh = this.simHeight;
    const scaleX = this.domainWidth / sw;
    const scaleY = this.domainHeight / sh;

    let woundCount = 0;

    for (let j = 0; j < sh; j++) {
      const worldY = (j + 0.5) * scaleY;
      const rowOffset = j * sw;

      for (let i = 0; i < sw; i++) {
        const worldX = (i + 0.5) * scaleX;

        let minDistSq = 1e9;
        let interpW = 10.0;

        for (let s = 0; s < this.segments.length; s++) {
          const seg = this.segments[s];
          const res = distToSegmentSquared(
            worldX,
            worldY,
            seg.p0.x,
            seg.p0.y,
            seg.p1.x,
            seg.p1.y
          );
          if (res.distSq < minDistSq) {
            minDistSq = res.distSq;
            interpW = seg.w0 * (1 - res.t) + seg.w1 * res.t;
          }
        }

        const dist = Math.sqrt(minDistSq);
        // Ruido fractal en los bordes de la grieta
        const noiseVal = fbm(worldX * 0.045, worldY * 0.045) * 6.5;
        const sdf = dist - (interpW * 0.5 + noiseVal);

        const idx = rowOffset + i;
        this.sdfData[idx] = sdf;

        if (sdf < 0) {
          this.woundMask[idx] = 1;
          woundCount++;
        } else {
          this.woundMask[idx] = 0;
        }
      }
    }

    this.totalWoundPixels = woundCount;

    // Calcular gradiente ∇SDF: apunta hacia afuera de la herida (campo de dolor)
    for (let j = 0; j < sh; j++) {
      const rowOffset = j * sw;
      const prevRow = Math.max(0, j - 1) * sw;
      const nextRow = Math.min(sh - 1, j + 1) * sw;

      for (let i = 0; i < sw; i++) {
        const prevCol = Math.max(0, i - 1);
        const nextCol = Math.min(sw - 1, i + 1);

        const dx = (this.sdfData[rowOffset + nextCol] - this.sdfData[rowOffset + prevCol]) * 0.5;
        const dy = (this.sdfData[nextRow + i] - this.sdfData[prevRow + i]) * 0.5;

        const len = Math.sqrt(dx * dx + dy * dy);
        const gradIdx = (rowOffset + i) * 2;
        if (len > 1e-5) {
          this.gradData[gradIdx] = dx / len;
          this.gradData[gradIdx + 1] = dy / len;
        } else {
          this.gradData[gradIdx] = 0;
          this.gradData[gradIdx + 1] = 0;
        }
      }
    }
  }

  /**
   * Evalúa el SDF en cualquier coordenada del mundo.
   */
  public sampleSDF(worldX: number, worldY: number): number {
    const u = (worldX / this.domainWidth) * this.simWidth;
    const v = (worldY / this.domainHeight) * this.simHeight;
    const ix = Math.max(0, Math.min(this.simWidth - 1, Math.floor(u)));
    const iy = Math.max(0, Math.min(this.simHeight - 1, Math.floor(v)));
    return this.sdfData[iy * this.simWidth + ix];
  }

  /**
   * Evalúa el gradiente del SDF (campo de dolor) en cualquier coordenada del mundo.
   */
  public sampleGradient(worldX: number, worldY: number): { gx: number; gy: number } {
    const u = (worldX / this.domainWidth) * this.simWidth;
    const v = (worldY / this.domainHeight) * this.simHeight;
    const ix = Math.max(0, Math.min(this.simWidth - 1, Math.floor(u)));
    const iy = Math.max(0, Math.min(this.simHeight - 1, Math.floor(v)));
    const idx = (iy * this.simWidth + ix) * 2;
    return {
      gx: this.gradData[idx],
      gy: this.gradData[idx + 1]
    };
  }

  /**
   * Proyecta un punto (por ejemplo el cursor) hacia la grieta descendiendo el gradiente del SDF.
   */
  public projectOntoWound(worldX: number, worldY: number): Point2D {
    let currX = worldX;
    let currY = worldY;

    // Descenso del gradiente en 4 pasos
    for (let step = 0; step < 4; step++) {
      const sdf = this.sampleSDF(currX, currY);
      if (sdf <= 0) break;
      const grad = this.sampleGradient(currX, currY);
      currX -= grad.gx * sdf * 0.85;
      currY -= grad.gy * sdf * 0.85;
    }

    return { x: currX, y: currY };
  }
}
