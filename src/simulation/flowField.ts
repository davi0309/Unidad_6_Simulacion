/**
 * flowField.ts
 * Motor de Campo de Flujo (Flow Field) 100% divergencia-cero (Divergence-Free):
 * - Movimiento ultra-fluido que conserva el área: las partículas NUNCA se amontonan
 *   ni dejan vacíos en el centro.
 * - Vortices orbitales y arcos concéntricos suaves (Imagen 2).
 * - Espina dorsal orgánica de la herida para guiar el desgarro carmesí y la curación de oro.
 * - Ondas armónicas reactivas y visibles al presionar las teclas Q a P.
 */

export interface Point2D {
  x: number;
  y: number;
}

export interface KeyPulse {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  speed: number;
  strength: number;
  life: number;
  maxLife: number;
  freq: number;
  swirl: number;
}

export interface WoundSegment {
  p0: Point2D;
  p1: Point2D;
  width: number;
  branchLevel: number;
  healed: number; // 0.0 (abierta) a 1.0 (sellada con oro)
}

export class FlowFieldEngine {
  public width: number;
  public height: number;

  private permTable: Uint8Array;

  // Centros de vórtice suaves (función de corriente)
  public vortexCenters: { x: number; y: number; radius: number; strength: number }[] = [];

  // Pulsos y ondas de teclado activas
  public activePulses: KeyPulse[] = [];

  // Red de la herida (geometría de la fractura)
  public woundSegments: WoundSegment[] = [];

  constructor(w: number, h: number) {
    this.width = w;
    this.height = h;

    this.permTable = new Uint8Array(512);
    for (let i = 0; i < 256; i++) {
      this.permTable[i] = Math.floor(Math.sin(i * 127.1 + 311.7) * 43758.5453) & 255;
      this.permTable[i + 256] = this.permTable[i];
    }

    this.initVortices();
    this.buildWoundSegments();
  }

  public resize(w: number, h: number) {
    this.width = w;
    this.height = h;
    this.initVortices();
    this.buildWoundSegments();
  }

  /**
   * Inicializa centros de vórtice suaves distribuidos para que las líneas formen
   * arcos fluidos y curvas concéntricas (Imagen 2) sin acumular partículas en ningún punto.
   */
  public initVortices() {
    this.vortexCenters = [
      { x: this.width * 0.25, y: this.height * 0.35, radius: this.height * 0.35, strength: 1.8 },
      { x: this.width * 0.72, y: this.height * 0.28, radius: this.height * 0.32, strength: -1.6 },
      { x: this.width * 0.50, y: this.height * 0.52, radius: this.height * 0.38, strength: 1.5 },
      { x: this.width * 0.22, y: this.height * 0.75, radius: this.height * 0.34, strength: -1.7 },
      { x: this.width * 0.78, y: this.height * 0.70, radius: this.height * 0.36, strength: 1.6 }
    ];
  }

  /**
   * Construye la red de la herida orgánica visible con fractalidad suave.
   */
  public buildWoundSegments() {
    this.woundSegments = [];
    const W = this.width;
    const H = this.height;

    // Tronco principal diagonal (de izquierda-abajo a derecha-arriba)
    const pts: Point2D[] = [
      { x: W * 0.08, y: H * 0.85 },
      { x: W * 0.22, y: H * 0.76 },
      { x: W * 0.36, y: H * 0.62 },
      { x: W * 0.48, y: H * 0.50 },
      { x: W * 0.62, y: H * 0.40 },
      { x: W * 0.76, y: H * 0.25 },
      { x: W * 0.92, y: H * 0.12 }
    ];

    // Subdividir con perturbación suave
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const midX = (p0.x + p1.x) * 0.5 + (Math.sin(i * 3.7) * (W * 0.02));
      const midY = (p0.y + p1.y) * 0.5 + (Math.cos(i * 2.9) * (H * 0.025));

      this.woundSegments.push({
        p0,
        p1: { x: midX, y: midY },
        width: 6.0,
        branchLevel: 0,
        healed: 0.0
      });
      this.woundSegments.push({
        p0: { x: midX, y: midY },
        p1,
        width: 5.5,
        branchLevel: 0,
        healed: 0.0
      });
    }

    // Ramas secundarias
    const branch1: Point2D[] = [
      { x: W * 0.36, y: H * 0.62 },
      { x: W * 0.26, y: H * 0.54 },
      { x: W * 0.16, y: H * 0.50 }
    ];
    for (let i = 0; i < branch1.length - 1; i++) {
      this.woundSegments.push({
        p0: branch1[i],
        p1: branch1[i + 1],
        width: 3.8 - i * 0.8,
        branchLevel: 1,
        healed: 0.0
      });
    }

    const branch2: Point2D[] = [
      { x: W * 0.62, y: H * 0.40 },
      { x: W * 0.58, y: H * 0.22 },
      { x: W * 0.52, y: H * 0.10 }
    ];
    for (let i = 0; i < branch2.length - 1; i++) {
      this.woundSegments.push({
        p0: branch2[i],
        p1: branch2[i + 1],
        width: 3.5 - i * 0.8,
        branchLevel: 1,
        healed: 0.0
      });
    }

    const branch3: Point2D[] = [
      { x: W * 0.48, y: H * 0.50 },
      { x: W * 0.60, y: H * 0.64 },
      { x: W * 0.74, y: H * 0.68 },
      { x: W * 0.88, y: H * 0.65 }
    ];
    for (let i = 0; i < branch3.length - 1; i++) {
      this.woundSegments.push({
        p0: branch3[i],
        p1: branch3[i + 1],
        width: 3.2 - i * 0.6,
        branchLevel: 1,
        healed: 0.0
      });
    }
  }

  // Ruido pseudo-perlin suave
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
   * Función de Corriente Escalar Ψ(x, y, t):
   * Derivando este potencial escalar mediante (dΨ/dy, -dΨ/dx) se obtiene un campo
   * de velocidad MATEMÁTICAMENTE DIVERGENCIA-CERO (∇·v = 0).
   * Conserva el área en cada punto: NUNCA amontona agentes ni deja el centro vacío.
   */
  public streamFunction(x: number, y: number, t: number): number {
    const scale = 0.0016;
    let psi = this.rawNoise(x * scale, y * scale + t * 0.05) * 120.0;

    // Aporte suave de los vórtices
    for (const v of this.vortexCenters) {
      const dx = x - v.x;
      const dy = y - v.y;
      const rSq = dx * dx + dy * dy;
      const rMaxSq = v.radius * v.radius;
      if (rSq < rMaxSq) {
        const factor = 1.0 - rSq / rMaxSq;
        psi += v.strength * factor * factor * 90.0;
      }
    }

    // Aporte de las ondas de teclas activas
    for (const p of this.activePulses) {
      const dx = x - p.x;
      const dy = y - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < p.radius && dist > 1.0) {
        const wave = Math.sin((dist - p.radius * 0.5) * 0.06 * p.freq);
        const falloff = (1.0 - dist / p.radius) * (p.life / p.maxLife);
        psi += wave * p.strength * falloff * p.swirl * 70.0;
      }
    }

    return psi;
  }

  /**
   * Muestreo del vector de velocidad mediante derivadas centrales de la función de corriente.
   */
  public sampleVelocity(x: number, y: number, time: number): { vx: number; vy: number } {
    const eps = 3.0;

    const psiUp = this.streamFunction(x, y + eps, time);
    const psiDown = this.streamFunction(x, y - eps, time);
    const psiRight = this.streamFunction(x + eps, y, time);
    const psiLeft = this.streamFunction(x - eps, y, time);

    // v = (dΨ/dy, -dΨ/dx)
    const vx = (psiUp - psiDown) / (2.0 * eps);
    const vy = -(psiRight - psiLeft) / (2.0 * eps);

    return { vx, vy };
  }

  /**
   * Dispara una onda armónica reactiva claramente visible al presionar teclas Q a P.
   */
  public triggerKeyPulse(x: number, y: number, keyCode: string) {
    const keyMap: Record<string, { maxR: number; speed: number; str: number; freq: number; life: number }> = {
      KeyQ: { maxR: 380, speed: 280, str: 4.8, freq: 1.5, life: 2.2 },
      KeyW: { maxR: 350, speed: 300, str: 4.5, freq: 1.8, life: 2.0 },
      KeyE: { maxR: 320, speed: 320, str: 4.2, freq: 2.2, life: 1.9 },
      KeyR: { maxR: 300, speed: 340, str: 4.0, freq: 2.5, life: 1.8 },
      KeyT: { maxR: 280, speed: 360, str: 3.8, freq: 2.8, life: 1.7 },
      KeyY: { maxR: 260, speed: 380, str: 3.6, freq: 3.2, life: 1.6 },
      KeyU: { maxR: 240, speed: 400, str: 3.4, freq: 3.6, life: 1.5 },
      KeyI: { maxR: 220, speed: 420, str: 3.2, freq: 4.0, life: 1.4 },
      KeyO: { maxR: 200, speed: 440, str: 3.0, freq: 4.4, life: 1.3 },
      KeyP: { maxR: 190, speed: 460, str: 2.8, freq: 4.8, life: 1.2 }
    };

    const cfg = keyMap[keyCode] || { maxR: 300, speed: 350, str: 4.0, freq: 2.5, life: 1.8 };

    this.activePulses.push({
      x,
      y,
      radius: 10,
      maxRadius: cfg.maxR,
      speed: cfg.speed,
      strength: cfg.str,
      life: cfg.life,
      maxLife: cfg.life,
      freq: cfg.freq,
      swirl: Math.random() > 0.5 ? 1 : -1
    });

    if (this.activePulses.length > 15) {
      this.activePulses.shift();
    }
  }

  public update(dt: number) {
    for (let i = this.activePulses.length - 1; i >= 0; i--) {
      const p = this.activePulses[i];
      p.life -= dt;
      p.radius += p.speed * dt;

      if (p.life <= 0 || p.radius >= p.maxRadius) {
        this.activePulses.splice(i, 1);
      }
    }
  }

  /**
   * Busca la distancia a la herida y si está sanada en ese punto.
   */
  public getWoundDistance(x: number, y: number): { dist: number; isHealed: boolean } {
    let minDistSq = 1e9;
    let healedRatio = 0.0;

    for (let i = 0; i < this.woundSegments.length; i++) {
      const seg = this.woundSegments[i];
      const dx = seg.p1.x - seg.p0.x;
      const dy = seg.p1.y - seg.p0.y;
      const lenSq = dx * dx + dy * dy;
      if (lenSq < 1e-5) continue;

      let u = ((x - seg.p0.x) * dx + (y - seg.p0.y) * dy) / lenSq;
      u = Math.max(0, Math.min(1, u));

      const px = seg.p0.x + u * dx;
      const py = seg.p0.y + u * dy;
      const rx = x - px;
      const ry = y - py;
      const dSq = rx * rx + ry * ry;

      if (dSq < minDistSq) {
        minDistSq = dSq;
        healedRatio = seg.healed;
      }
    }

    return {
      dist: Math.sqrt(minDistSq),
      isHealed: healedRatio > 0.35
    };
  }
}
