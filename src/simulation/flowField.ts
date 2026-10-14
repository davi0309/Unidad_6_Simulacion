/**
 * flowField.ts
 * Motor de Campo de Flujo (Flow Field) 100% Toroidal y Continuo (Estilo Imagen de Referencia):
 * - BORDES SIN PAREDES (TORO CONTINUO): No existen paredes ni rebotes. Las partículas que cruzan
 *   arriba salen abajo, las de la derecha salen por la izquierda con continuidad matemática perfecta.
 * - CURL NOISE DIVERGENCIA-CERO: Las líneas de corriente forman ríos y filamentos orgánicos
 *   sedosos que se trenzan por toda la pantalla.
 * - 10 comportamientos dinámicos únicos para las teclas Q a P.
 */

export interface Point2D {
  x: number;
  y: number;
}

export interface DynamicImpulse {
  type: string; // 'shockwave' | 'cyclone' | 'jet' | 'sine' | 'counter_cyclone' | 'chaos' | 'magnet' | 'lift' | 'twin' | 'shimmer'
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

  // Impulsos activos de las 10 teclas distintas
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
   * Potencial escalar toroidal perfectamente periódico en X (periodo W) y en Y (periodo H).
   * Al cruzar x=0 <-> x=W o y=0 <-> y=H, el campo es matemáticamente idéntico y continuo.
   * Los bordes NO actúan como paredes: son un toro continuo.
   */
  public toroidalPotential(x: number, y: number, time: number): number {
    const W = this.width;
    const H = this.height;

    const u = (((x % W) + W) % W) / W;
    const v = (((y % H) + H) % H) / H;

    const th = u * Math.PI * 2;
    const ph = v * Math.PI * 2;

    const cosTh = Math.cos(th);
    const sinTh = Math.sin(th);
    const cosPh = Math.cos(ph);
    const sinPh = Math.sin(ph);

    // Muestreo toroidal 4D con 2 octavas de ruido Perlin
    const n1 = this.noise2D((cosTh + 1.2) * 1.6 + time * 0.03, (sinTh + 1.2) * 1.6 + (cosPh + 1.2) * 1.6);
    const n2 = this.noise2D((cosPh + 1.5) * 2.4 - time * 0.025, (sinPh + 1.5) * 2.4 + (sinTh + 1.5) * 2.0);

    // Ondas sinusoidales periódicas que generan los ríos trenzados y filamentos de la imagen
    const w1 = Math.sin(th * 2.0 + ph * 1.0 + time * 0.15) * 1.3;
    const w2 = Math.cos(th * 1.0 - ph * 2.0 - time * 0.12) * 1.1;
    const w3 = Math.sin(th * 3.0 + ph * 2.0 + time * 0.08) * 0.7;

    return n1 * 2.4 + n2 * 1.4 + w1 + w2 + w3;
  }

  /**
   * Muestreo del campo de velocidad base mediante CURL NOISE TOROIDAL:
   * vx =  dPotential/dy
   * vy = -dPotential/dx
   * Garantiza divergencia cero y continuidad infinita por los bordes (¡sin paredes!).
   */
  public sampleVelocity(x: number, y: number, time: number): { vx: number; vy: number } {
    const eps = 4.0;
    const pY1 = this.toroidalPotential(x, y + eps, time);
    const pY0 = this.toroidalPotential(x, y - eps, time);
    const pX1 = this.toroidalPotential(x + eps, y, time);
    const pX0 = this.toroidalPotential(x - eps, y, time);

    const dP_dy = (pY1 - pY0) / (2.0 * eps);
    const dP_dx = (pX1 - pX0) / (2.0 * eps);

    let vx = dP_dy * 320.0;
    let vy = -dP_dx * 320.0;

    // 2. Modificaciones dinámicas según los 10 tipos de impulsos de teclado
    for (const imp of this.activeImpulses) {
      const dx = x - imp.x;
      const dy = y - imp.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const lifeRatio = imp.life / imp.maxLife;

      switch (imp.type) {
        // Q: Onda expansiva radial (Radial Shockwave)
        case 'shockwave': {
          if (Math.abs(dist - imp.radius) < 70.0) {
            const push = (1.0 - Math.abs(dist - imp.radius) / 70.0) * imp.strength * lifeRatio;
            vx += (dx / (dist || 1)) * push * 4.5;
            vy += (dy / (dist || 1)) * push * 4.5;
          }
          break;
        }

        // W: Vórtice ciclónico horario (Cyclone Spiral)
        case 'cyclone': {
          if (dist < imp.radius && dist > 1.0) {
            const spin = (1.0 - dist / imp.radius) * imp.strength * lifeRatio;
            vx += (-dy / dist) * spin * 5.0;
            vy += (dx / dist) * spin * 5.0;
          }
          break;
        }

        // E: Torrente horizontal cometa (Jet Stream)
        case 'jet': {
          if (dist < imp.radius) {
            const jet = (1.0 - dist / imp.radius) * imp.strength * lifeRatio;
            vx += jet * 6.5;
            vy += Math.sin(x * 0.03) * jet * 1.2;
          }
          break;
        }

        // R: Onda serpentina transversal (Snake Undulation)
        case 'sine': {
          if (dist < imp.radius) {
            const s = (1.0 - dist / imp.radius) * imp.strength * lifeRatio;
            vy += Math.sin(x * 0.04 + imp.radius * 0.05) * s * 6.0;
            vx += Math.cos(y * 0.04) * s * 2.0;
          }
          break;
        }

        // T: Vórtice antihorario invertido (Counter-Cyclone)
        case 'counter_cyclone': {
          if (dist < imp.radius && dist > 1.0) {
            const spin = (1.0 - dist / imp.radius) * imp.strength * lifeRatio;
            vx += (dy / dist) * spin * 5.0;
            vy += (-dx / dist) * spin * 5.0;
          }
          break;
        }

        // Y: Dispersión caótica (Chaos Jitter)
        case 'chaos': {
          if (dist < imp.radius) {
            const c = (1.0 - dist / imp.radius) * imp.strength * lifeRatio;
            const rAng = this.noise2D(x * 0.05, y * 0.05) * Math.PI * 4;
            vx += Math.cos(rAng) * c * 5.5;
            vy += Math.sin(rAng) * c * 5.5;
          }
          break;
        }

        // U: Atracción gravitacional magnética
        case 'magnet': {
          if (dist < imp.radius && dist > 25.0) {
            const pull = (1.0 - dist / imp.radius) * imp.strength * lifeRatio;
            vx -= (dx / dist) * pull * 4.2;
            vy -= (dy / dist) * pull * 4.2;
          }
          break;
        }

        // I: Ascenso vertical géiser (Upward Lift)
        case 'lift': {
          if (dist < imp.radius) {
            const lift = (1.0 - dist / imp.radius) * imp.strength * lifeRatio;
            vy -= lift * 6.0;
            vx += (Math.random() - 0.5) * lift * 1.5;
          }
          break;
        }

        // O: Doble hélice / Vórtices binarios (Twin Orbit)
        case 'twin': {
          const d1 = Math.hypot(x - (imp.x - 60), y - imp.y);
          const d2 = Math.hypot(x - (imp.x + 60), y - imp.y);
          if (d1 < imp.radius && d1 > 2) {
            const p1 = (1.0 - d1 / imp.radius) * imp.strength * lifeRatio;
            vx += (-(y - imp.y) / d1) * p1 * 4.0;
            vy += ((x - (imp.x - 60)) / d1) * p1 * 4.0;
          }
          if (d2 < imp.radius && d2 > 2) {
            const p2 = (1.0 - d2 / imp.radius) * imp.strength * lifeRatio;
            vx += ((y - imp.y) / d2) * p2 * 4.0;
            vy += (-(x - (imp.x + 60)) / d2) * p2 * 4.0;
          }
          break;
        }

        // P: Vibración cristalina de alta frecuencia (Crystal Shimmer)
        case 'shimmer': {
          if (dist < imp.radius) {
            const shim = (1.0 - dist / imp.radius) * imp.strength * lifeRatio;
            vx += Math.sin(time * 50.0 + x * 0.1) * shim * 4.5;
            vy += Math.cos(time * 50.0 + y * 0.1) * shim * 4.5;
          }
          break;
        }
      }
    }

    // 3. Garantizar velocidad mínima permanente
    const curSpeed = Math.sqrt(vx * vx + vy * vy);
    if (curSpeed < 1.4) {
      const heading = curSpeed > 0.01 ? Math.atan2(vy, vx) : Math.random() * Math.PI * 2;
      vx = Math.cos(heading) * 1.8;
      vy = Math.sin(heading) * 1.8;
    } else if (curSpeed > 7.5) {
      vx = (vx / curSpeed) * 7.5;
      vy = (vy / curSpeed) * 7.5;
    }

    return { vx, vy };
  }

  /**
   * Dispara el comportamiento específico único para cada tecla de Q a P.
   */
  public triggerKeyPulse(x: number, y: number, keyCode: string) {
    this.triggerKeyAction(x, y, keyCode);
  }

  public triggerKeyAction(x: number, y: number, keyCode: string) {
    let type = 'shockwave';
    let maxR = 340;
    let str = 4.5;
    let life = 2.0;

    switch (keyCode) {
      case 'KeyQ':
        type = 'shockwave';
        maxR = 450;
        str = 6.0;
        life = 2.4;
        break;
      case 'KeyW':
        type = 'cyclone';
        maxR = 320;
        str = 5.5;
        life = 2.2;
        break;
      case 'KeyE':
        type = 'jet';
        maxR = 400;
        str = 6.5;
        life = 2.0;
        break;
      case 'KeyR':
        type = 'sine';
        maxR = 360;
        str = 5.0;
        life = 2.2;
        break;
      case 'KeyT':
        type = 'counter_cyclone';
        maxR = 320;
        str = 5.5;
        life = 2.2;
        break;
      case 'KeyY':
        type = 'chaos';
        maxR = 350;
        str = 5.5;
        life = 1.9;
        break;
      case 'KeyU':
        type = 'magnet';
        maxR = 380;
        str = 6.0;
        life = 2.5;
        break;
      case 'KeyI':
        type = 'lift';
        maxR = 380;
        str = 6.2;
        life = 2.0;
        break;
      case 'KeyO':
        type = 'twin';
        maxR = 340;
        str = 5.5;
        life = 2.4;
        break;
      case 'KeyP':
        type = 'shimmer';
        maxR = 300;
        str = 5.0;
        life = 1.6;
        break;
      default:
        type = 'shockwave';
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

    if (this.activeImpulses.length > 20) {
      this.activeImpulses.shift();
    }
  }

  public update(dt: number) {
    for (let i = this.activeImpulses.length - 1; i >= 0; i--) {
      const imp = this.activeImpulses[i];
      imp.life -= dt;
      imp.radius += (imp.maxRadius - imp.radius) * (dt * 3.5);

      if (imp.life <= 0) {
        this.activeImpulses.splice(i, 1);
      }
    }
  }
}
