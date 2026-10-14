/**
 * flowField.ts
 * Motor de Campo de Flujo (Flow Field) orgánico con Curl Noise para "Heal".
 *
 * Inspirado directamente en la Imagen de Referencia 4:
 * - Espacio ambiente de filamentos sedosos en movimiento continuo perpetuo.
 * - Gran cañón / fisura de herida orgánica por donde convergen las líneas de flujo.
 * - Crecimiento orgánico de la herida conforme avanza la canción de Tom Odell.
 * - Perturbaciones musicales en las partículas blancas (teclas Q a P).
 * - Protección estricta del flujo interno de la herida: las partículas dentro de la herida
 *   siguen exclusivamente la corriente arterial de la grieta.
 */

export interface Point2D {
  x: number;
  y: number;
}

export interface WoundInfluence {
  isInside: boolean;
  distance: number;
  tangentX: number;
  tangentY: number;
  normalX: number;
  normalY: number;
  spineT: number;
  woundWidth: number;
  isHealed: boolean;
}

export interface KeyPerturbation {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  frequency: number;
  strength: number;
  life: number;
  maxLife: number;
  swirlDir: number;
}

export class FlowFieldEngine {
  public width: number;
  public height: number;

  // Ruido pseudo-aleatorio reproducible para Curl Noise
  private permTable: Uint8Array;

  // Perturbaciones activas generadas por las teclas Q a P
  public activePerturbations: KeyPerturbation[] = [];

  // Parámetros de la espina dorsal de la herida
  public woundSpine: Point2D[] = [];
  public woundBranches: { parentT: number; points: Point2D[]; maxGrowth: number }[] = [];
  public woundGrowth: number = 0.25; // 0.25 al inicio -> 1.0 hacia el final de la canción
  public baseWoundWidth: number = 24.0;

  // Control de curación de la espina (0 a 1 por segmento)
  public spineHealedRatio: Float32Array;

  constructor(w: number, h: number) {
    this.width = w;
    this.height = h;

    this.permTable = new Uint8Array(512);
    for (let i = 0; i < 256; i++) {
      this.permTable[i] = Math.floor(Math.sin(i * 91.3 + 17.5) * 43758.5453) & 255;
      this.permTable[i + 256] = this.permTable[i];
    }

    this.spineHealedRatio = new Float32Array(64);
    this.buildWoundGeometry();
  }

  public resize(w: number, h: number) {
    this.width = w;
    this.height = h;
    this.buildWoundGeometry();
  }

  /**
   * Genera la espina sinuosa de la herida que cruza elegantemente la pantalla
   * y sus ramas secundarias fractales.
   */
  public buildWoundGeometry() {
    this.woundSpine = [];
    this.woundBranches = [];

    const W = this.width;
    const H = this.height;

    // Puntos de control de la curva principal (diagonal orgánica de izquierda a derecha)
    const steps = 36;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      // Progresión sinusoidal ondulada como en la imagen 4
      const x = W * (0.16 + 0.68 * t);
      const wave1 = Math.sin(t * Math.PI * 2.2 + 0.3) * (H * 0.11);
      const wave2 = Math.cos(t * Math.PI * 4.5) * (H * 0.04);
      const y = H * 0.50 + wave1 + wave2;

      this.woundSpine.push({ x, y });
    }

    this.spineHealedRatio = new Float32Array(this.woundSpine.length);

    // 4 ramas secundarias que brotan de la espina
    const branchConfigs = [
      { t: 0.28, angle: -0.75, length: H * 0.13, steps: 8 },
      { t: 0.45, angle: 0.85, length: H * 0.16, steps: 10 },
      { t: 0.64, angle: -0.80, length: H * 0.14, steps: 8 },
      { t: 0.80, angle: 0.70, length: H * 0.11, steps: 6 }
    ];

    for (const b of branchConfigs) {
      const parentIdx = Math.floor(b.t * steps);
      const root = this.woundSpine[parentIdx];
      const next = this.woundSpine[Math.min(steps, parentIdx + 1)];
      const baseDir = Math.atan2(next.y - root.y, next.x - root.x);

      const branchPts: Point2D[] = [{ x: root.x, y: root.y }];
      let cx = root.x;
      let cy = root.y;
      const branchAngle = baseDir + b.angle;

      for (let s = 1; s <= b.steps; s++) {
        const segLen = (b.length / b.steps);
        const curA = branchAngle + Math.sin(s * 0.8) * 0.28;
        cx += Math.cos(curA) * segLen;
        cy += Math.sin(curA) * segLen;
        branchPts.push({ x: cx, y: cy });
      }

      this.woundBranches.push({
        parentT: b.t,
        points: branchPts,
        maxGrowth: 1.0
      });
    }
  }

  /**
   * Actualiza el crecimiento de la herida en función de la duración de la canción.
   */
  public updateSongProgress(currentTime: number, duration: number) {
    if (duration > 1.0) {
      const songRatio = Math.max(0.0, Math.min(1.0, currentTime / duration));
      // La herida comienza con un 30% de extensión y se desarrolla orgánicamente hasta el clímax
      this.woundGrowth = 0.30 + songRatio * 0.70;
    }
  }

  // Ruido 2D suave de Hermite
  private rawNoise(x: number, y: number): number {
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
   * Curl Noise bidimensional: garantiza un campo no divergente (laminar),
   * produciendo filamentos sedosos y continuos como en la Imagen 4.
   */
  public curlNoise(x: number, y: number, time: number): { vx: number; vy: number } {
    const eps = 2.0;
    const scale = 0.0022;
    const nx = x * scale;
    const ny = y * scale;
    const nt = time * 0.08;

    const nUp = this.rawNoise(nx, ny + eps * scale + nt);
    const nDown = this.rawNoise(nx, ny - eps * scale + nt);
    const nRight = this.rawNoise(nx + eps * scale, ny + nt);
    const nLeft = this.rawNoise(nx - eps * scale, ny + nt);

    // curl = (dF/dy, -dF/dx)
    const dFdy = (nUp - nDown) / (2.0 * eps);
    const dFdx = (nRight - nLeft) / (2.0 * eps);

    return {
      vx: dFdy * 450.0 + 0.8, // flujo dominante suave hacia la derecha
      vy: -dFdx * 450.0
    };
  }

  /**
   * Calcula la influencia de la herida en cualquier punto (x, y).
   */
  public getWoundInfluence(x: number, y: number): WoundInfluence {
    const pts = this.woundSpine;
    const activeCount = Math.floor(pts.length * this.woundGrowth);

    let minDistSq = 1e9;
    let closestT = 0;
    let tangX = 1;
    let tangY = 0;
    let normX = 0;
    let normY = 1;
    let healed = false;

    // Buscar el segmento más cercano en la espina activa
    for (let i = 0; i < activeCount - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];

      const dx = p1.x - p0.x;
      const dy = p1.y - p0.y;
      const lenSq = dx * dx + dy * dy;
      if (lenSq < 1e-5) continue;

      let u = ((x - p0.x) * dx + (y - p0.y) * dy) / lenSq;
      u = Math.max(0, Math.min(1, u));

      const projX = p0.x + u * dx;
      const projY = p0.y + u * dy;
      const rx = x - projX;
      const ry = y - projY;
      const dSq = rx * rx + ry * ry;

      if (dSq < minDistSq) {
        minDistSq = dSq;
        closestT = (i + u) / pts.length;

        const segLen = Math.sqrt(lenSq);
        tangX = dx / segLen;
        tangY = dy / segLen;

        const dist = Math.sqrt(dSq);
        if (dist > 1e-4) {
          normX = -ry / dist;
          normY = rx / dist;
        }

        healed = this.spineHealedRatio[i] > 0.45;
      }
    }

    // Verificar también las ramas secundarias
    for (let b = 0; b < this.woundBranches.length; b++) {
      const branch = this.woundBranches[b];
      if (branch.parentT > this.woundGrowth) continue;

      const bPts = branch.points;
      const bActiveCount = Math.max(2, Math.floor(bPts.length * this.woundGrowth));

      for (let i = 0; i < bActiveCount - 1; i++) {
        const p0 = bPts[i];
        const p1 = bPts[i + 1];
        const dx = p1.x - p0.x;
        const dy = p1.y - p0.y;
        const lenSq = dx * dx + dy * dy;
        if (lenSq < 1e-5) continue;

        let u = ((x - p0.x) * dx + (y - p0.y) * dy) / lenSq;
        u = Math.max(0, Math.min(1, u));

        const projX = p0.x + u * dx;
        const projY = p0.y + u * dy;
        const rx = x - projX;
        const ry = y - projY;
        const dSq = rx * rx + ry * ry;

        if (dSq < minDistSq) {
          minDistSq = dSq;
          const segLen = Math.sqrt(lenSq);
          tangX = dx / segLen;
          tangY = dy / segLen;
          const dist = Math.sqrt(dSq);
          if (dist > 1e-4) {
            normX = -ry / dist;
            normY = rx / dist;
          }
        }
      }
    }

    const dist = Math.sqrt(minDistSq);
    // Ancho variable de la herida (más ancha en el centro, afinándose en los bordes)
    const widthFactor = Math.sin(closestT * Math.PI) * 0.7 + 0.5;
    const currentWoundWidth = this.baseWoundWidth * widthFactor;

    return {
      isInside: dist < currentWoundWidth,
      distance: dist,
      tangentX: tangX,
      tangentY: tangY,
      normalX: normX,
      normalY: normY,
      spineT: closestT,
      woundWidth: currentWoundWidth,
      isHealed: healed
    };
  }

  /**
   * Dispara una perturbación armónica musical en el espacio ambiente con las teclas Q a P.
   */
  public triggerKeyPerturbation(x: number, y: number, keyCode: string) {
    // Mapeo musical: de Q (grave, cálido, amplio) a P (agudo, rápido, ondulante)
    const keyMap: Record<string, { radius: number; freq: number; str: number; life: number }> = {
      KeyQ: { radius: 240, freq: 1.5, str: 3.2, life: 2.4 },
      KeyW: { radius: 220, freq: 1.8, str: 3.0, life: 2.2 },
      KeyE: { radius: 200, freq: 2.2, str: 2.8, life: 2.0 },
      KeyR: { radius: 180, freq: 2.5, str: 2.6, life: 1.9 },
      KeyT: { radius: 160, freq: 2.8, str: 2.4, life: 1.8 },
      KeyY: { radius: 150, freq: 3.2, str: 2.2, life: 1.7 },
      KeyU: { radius: 140, freq: 3.6, str: 2.0, life: 1.6 },
      KeyI: { radius: 130, freq: 4.0, str: 1.8, life: 1.5 },
      KeyO: { radius: 120, freq: 4.4, str: 1.6, life: 1.4 },
      KeyP: { radius: 110, freq: 4.8, str: 1.5, life: 1.3 }
    };

    const cfg = keyMap[keyCode] || { radius: 180, freq: 2.5, str: 2.5, life: 1.8 };

    this.activePerturbations.push({
      x,
      y,
      radius: 10,
      maxRadius: cfg.radius,
      frequency: cfg.freq,
      strength: cfg.str,
      life: cfg.life,
      maxLife: cfg.life,
      swirlDir: Math.random() > 0.5 ? 1 : -1
    });

    if (this.activePerturbations.length > 25) {
      this.activePerturbations.shift();
    }
  }

  /**
   * Actualiza el ciclo de vida de las perturbaciones musicales activas.
   */
  public update(dt: number) {
    for (let i = this.activePerturbations.length - 1; i >= 0; i--) {
      const p = this.activePerturbations[i];
      p.life -= dt;
      p.radius += (p.maxRadius - p.radius) * (dt * 3.5);

      if (p.life <= 0) {
        this.activePerturbations.splice(i, 1);
      }
    }
  }

  /**
   * Muestrea el vector de velocidad total para una partícula en (x, y).
   * REGLA CLAVE:
   * Si está DENTRO de la herida, sigue estrictamente el flujo arterial de la grieta
   * y no se ve afectada por las perturbaciones de Q a P.
   */
  public sampleVelocity(x: number, y: number, time: number): { vx: number; vy: number; inWound: boolean; woundInf: WoundInfluence } {
    const wound = this.getWoundInfluence(x, y);

    // CASO 1: PARTÍCULA DENTRO DE LA HERIDA
    if (wound.isInside) {
      // Flujo arterial rápido y alineado a lo largo de la grieta
      const arterialSpeed = 3.6;
      return {
        vx: wound.tangentX * arterialSpeed,
        vy: wound.tangentY * arterialSpeed,
        inWound: true,
        woundInf: wound
      };
    }

    // CASO 2: PARTÍCULA EN EL ESPACIO AMBIENTE
    // 1. Campo base Curl Noise (filamentos sedosos continuos)
    const curl = this.curlNoise(x, y, time);
    let vx = curl.vx;
    let vy = curl.vy;

    // 2. Atracción gravitacional suave hacia la grieta (forma el río de filamentos de la Imagen 4)
    const pullDist = 180.0;
    if (wound.distance < pullDist) {
      const pullFactor = (1.0 - wound.distance / pullDist);
      const pullStrength = pullFactor * pullFactor * 1.6;
      // Empujar en dirección al centro de la herida
      vx += wound.normalX * pullStrength;
      vy += wound.normalY * pullStrength;
    }

    // 3. Modificaciones armónicas por teclas Q a P (SÓLO afectan a las partículas blancas ambiente)
    for (const p of this.activePerturbations) {
      const dx = x - p.x;
      const dy = y - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < p.radius && dist > 1.0) {
        const falloff = (1.0 - dist / p.radius) * (p.life / p.maxLife);
        const wave = Math.sin(dist * 0.08 * p.frequency) * p.strength * falloff;

        // Vórtice tangencial + onda radial
        const perpX = -dy / dist;
        const perpY = dx / dist;

        vx += perpX * wave * p.swirlDir * 2.2;
        vy += perpY * wave * p.swirlDir * 2.2;
      }
    }

    return {
      vx,
      vy,
      inWound: false,
      woundInf: wound
    };
  }
}
