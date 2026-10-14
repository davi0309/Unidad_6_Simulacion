/**
 * flowField.ts
 * Motor de Campo de Flujo (Flow Field) con centros orbitales y Curl Noise:
 * - Genera las trayectorias concéntricas, arcos y curvas sinuosas características de la Imagen 2.
 * - Perturbaciones musicales en las figuras blancas y azules (teclas Q a P).
 * - Fondo negro absoluto.
 */

export interface Point2D {
  x: number;
  y: number;
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

export interface OrbitalCenter {
  x: number;
  y: number;
  radius: number;
  speed: number;
  dir: number; // 1 = horario, -1 = antihorario
}

export class FlowFieldEngine {
  public width: number;
  public height: number;

  // Ruido pseudo-aleatorio para Curl Noise
  private permTable: Uint8Array;

  // Centros orbitales que crean los círculos y arcos concéntricos de la Imagen 2
  public orbitalCenters: OrbitalCenter[] = [];

  // Perturbaciones activas generadas por las teclas Q a P
  public activePerturbations: KeyPerturbation[] = [];

  constructor(w: number, h: number) {
    this.width = w;
    this.height = h;

    this.permTable = new Uint8Array(512);
    for (let i = 0; i < 256; i++) {
      this.permTable[i] = Math.floor(Math.sin(i * 91.3 + 17.5) * 43758.5453) & 255;
      this.permTable[i + 256] = this.permTable[i];
    }

    this.initOrbitalCenters();
  }

  public resize(w: number, h: number) {
    this.width = w;
    this.height = h;
    this.initOrbitalCenters();
  }

  /**
   * Distribuye 6 centros orbitales que hacen girar las líneas en arcos concéntricos (Imagen 2).
   */
  public initOrbitalCenters() {
    this.orbitalCenters = [
      { x: this.width * 0.28, y: this.height * 0.36, radius: this.height * 0.28, speed: 1.4, dir: 1 },
      { x: this.width * 0.74, y: this.height * 0.22, radius: this.height * 0.22, speed: 1.2, dir: -1 },
      { x: this.width * 0.48, y: this.height * 0.18, radius: this.height * 0.18, speed: 1.1, dir: 1 },
      { x: this.width * 0.18, y: this.height * 0.78, radius: this.height * 0.24, speed: 1.3, dir: -1 },
      { x: this.width * 0.42, y: this.height * 0.72, radius: this.height * 0.26, speed: 1.2, dir: 1 },
      { x: this.width * 0.80, y: this.height * 0.68, radius: this.height * 0.25, speed: 1.3, dir: -1 }
    ];
  }

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

  public curlNoise(x: number, y: number, time: number): { vx: number; vy: number } {
    const eps = 2.0;
    const scale = 0.0022;
    const nx = x * scale;
    const ny = y * scale;
    const nt = time * 0.06;

    const nUp = this.rawNoise(nx, ny + eps * scale + nt);
    const nDown = this.rawNoise(nx, ny - eps * scale + nt);
    const nRight = this.rawNoise(nx + eps * scale, ny + nt);
    const nLeft = this.rawNoise(nx - eps * scale, ny + nt);

    const dFdy = (nUp - nDown) / (2.0 * eps);
    const dFdx = (nRight - nLeft) / (2.0 * eps);

    return {
      vx: dFdy * 380.0 + 0.6,
      vy: -dFdx * 380.0
    };
  }

  /**
   * Dispara perturbación armónica con las teclas Q a P.
   */
  public triggerKeyPerturbation(x: number, y: number, keyCode: string) {
    const keyMap: Record<string, { radius: number; freq: number; str: number; life: number }> = {
      KeyQ: { radius: 260, freq: 1.5, str: 3.5, life: 2.4 },
      KeyW: { radius: 240, freq: 1.8, str: 3.2, life: 2.2 },
      KeyE: { radius: 220, freq: 2.2, str: 3.0, life: 2.0 },
      KeyR: { radius: 200, freq: 2.5, str: 2.8, life: 1.9 },
      KeyT: { radius: 180, freq: 2.8, str: 2.6, life: 1.8 },
      KeyY: { radius: 160, freq: 3.2, str: 2.4, life: 1.7 },
      KeyU: { radius: 150, freq: 3.6, str: 2.2, life: 1.6 },
      KeyI: { radius: 140, freq: 4.0, str: 2.0, life: 1.5 },
      KeyO: { radius: 130, freq: 4.4, str: 1.8, life: 1.4 },
      KeyP: { radius: 120, freq: 4.8, str: 1.6, life: 1.3 }
    };

    const cfg = keyMap[keyCode] || { radius: 180, freq: 2.5, str: 2.5, life: 1.8 };

    this.activePerturbations.push({
      x,
      y,
      radius: 15,
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
   * Muestrea el vector de velocidad combinando centros orbitales (arcos concéntricos de Imagen 2),
   * curl noise de fondo y perturbaciones de teclas.
   */
  public sampleVelocity(x: number, y: number, time: number): { vx: number; vy: number } {
    let vx = 0;
    let vy = 0;

    // 1. Campo Curl Noise base
    const curl = this.curlNoise(x, y, time);
    vx += curl.vx * 0.45;
    vy += curl.vy * 0.45;

    // 2. Influencia de los centros orbitales (Imagen 2: arcos concéntricos y pistas circulares)
    for (const c of this.orbitalCenters) {
      const dx = x - c.x;
      const dy = y - c.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < c.radius && dist > 1.0) {
        const factor = (1.0 - dist / c.radius);
        const tanX = -dy / dist;
        const tanY = dx / dist;

        vx += tanX * c.speed * c.dir * factor * 2.8;
        vy += tanY * c.speed * c.dir * factor * 2.8;
      }
    }

    // 3. Perturbaciones de teclas Q a P
    for (const p of this.activePerturbations) {
      const dx = x - p.x;
      const dy = y - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < p.radius && dist > 1.0) {
        const falloff = (1.0 - dist / p.radius) * (p.life / p.maxLife);
        const wave = Math.sin(dist * 0.08 * p.frequency) * p.strength * falloff;

        const perpX = -dy / dist;
        const perpY = dx / dist;

        vx += perpX * wave * p.swirlDir * 2.4;
        vy += perpY * wave * p.swirlDir * 2.4;
      }
    }

    return { vx, vy };
  }
}
