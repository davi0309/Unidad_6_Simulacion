/**
 * woundManager.ts
 * Gestor de Heridas y Fracturas Kintsugi para HEAL:
 * - Creación y manipulación de múltiples heridas coexistentes.
 * - Deformación orgánica del flujo en torno a la fractura.
 * - Progreso gradual de reparación Kintsugi (0.0 a 1.0).
 * - Campo de influencia espacial para percepción de agentes rojos y dorados.
 */

export interface WoundPoint {
  x: number;
  y: number;
}

export interface WoundBranch {
  points: WoundPoint[];
}

export interface Wound {
  id: string;
  x: number;
  y: number;
  branches: WoundBranch[];
  corridorWidth: number;   // Ancho del corredor de la grieta
  intensity: number;
  repairProgress: number;  // 0.0 (abierta/roja) a 1.0 (sellada de oro)
  isRepaired: boolean;
  pulseTime: number;
  // Caja delimitadora para descarte rápido
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export class WoundManager {
  public width: number;
  public height: number;
  public wounds: Wound[] = [];

  constructor(w: number, h: number) {
    this.width = w;
    this.height = h;
  }

  public resize(w: number, h: number) {
    this.width = w;
    this.height = h;
  }

  /**
   * Crea una nueva herida a lo largo de los caminos del Flow Field (Tecla Q o clic)
   */
  public createWound(
    startX: number,
    startY: number,
    sampleFlow?: (x: number, y: number) => { vx: number; vy: number },
    intensity: number = 1.0
  ): Wound {
    const id = Math.random().toString(36).substring(2, 9);
    const mainBranch: WoundPoint[] = [{ x: startX, y: startY }];

    let minX = startX;
    let maxX = startX;
    let minY = startY;
    let maxY = startY;

    // 1. Trazar hacia adelante siguiendo el camino del flow field (corriente abajo)
    let cx = startX;
    let cy = startY;
    const forwardSteps = 26;
    const stepLen = 9.0;

    for (let s = 0; s < forwardSteps; s++) {
      let vx = 0;
      let vy = 1;
      if (sampleFlow) {
        const f = sampleFlow(cx, cy);
        const len = Math.hypot(f.vx, f.vy) || 1.0;
        vx = f.vx / len;
        vy = f.vy / len;
      }
      // Pequeña oscilación fractal orgánica propia de una fractura
      const jitter = (Math.sin(s * 1.3) * 0.4 + (Math.random() - 0.5) * 0.5);
      const nx = cx + (vx - vy * jitter) * stepLen;
      const ny = cy + (vy + vx * jitter) * stepLen;

      mainBranch.push({ x: nx, y: ny });
      minX = Math.min(minX, nx);
      maxX = Math.max(maxX, nx);
      minY = Math.min(minY, ny);
      maxY = Math.max(maxY, ny);

      cx = nx;
      cy = ny;
    }

    // 2. Trazar hacia atrás (corriente arriba) para que la herida tenga continuidad a ambos lados
    cx = startX;
    cy = startY;
    const backwardSteps = 18;
    for (let s = 0; s < backwardSteps; s++) {
      let vx = 0;
      let vy = 1;
      if (sampleFlow) {
        const f = sampleFlow(cx, cy);
        const len = Math.hypot(f.vx, f.vy) || 1.0;
        vx = f.vx / len;
        vy = f.vy / len;
      }
      const jitter = (Math.cos(s * 1.5) * 0.4 + (Math.random() - 0.5) * 0.5);
      const nx = cx - (vx - vy * jitter) * stepLen;
      const ny = cy - (vy + vx * jitter) * stepLen;

      mainBranch.unshift({ x: nx, y: ny });
      minX = Math.min(minX, nx);
      maxX = Math.max(maxX, nx);
      minY = Math.min(minY, ny);
      maxY = Math.max(maxY, ny);

      cx = nx;
      cy = ny;
    }

    // 3. Ramificación capilar secundaria que se abre a lo largo de un afluente
    const branches: WoundBranch[] = [{ points: mainBranch }];
    const branchPointIdx = Math.floor(mainBranch.length * 0.55);
    const branchRoot = mainBranch[branchPointIdx];

    if (branchRoot) {
      const subBranch: WoundPoint[] = [{ x: branchRoot.x, y: branchRoot.y }];
      let bx = branchRoot.x;
      let by = branchRoot.y;
      for (let s = 0; s < 12; s++) {
        let vx = 1;
        let vy = 1;
        if (sampleFlow) {
          const f = sampleFlow(bx, by);
          const len = Math.hypot(f.vx, f.vy) || 1.0;
          vx = (-f.vy * 0.6 + f.vx * 0.8) / len;
          vy = (f.vx * 0.6 + f.vy * 0.8) / len;
        }
        bx += vx * 8.0;
        by += vy * 8.0;
        subBranch.push({ x: bx, y: by });
        minX = Math.min(minX, bx);
        maxX = Math.max(maxX, bx);
        minY = Math.min(minY, by);
        maxY = Math.max(maxY, by);
      }
      branches.push({ points: subBranch });
    }

    const corridorWidth = 24.0;
    const wound: Wound = {
      id,
      x: startX,
      y: startY,
      branches,
      corridorWidth,
      intensity,
      repairProgress: 0.0,
      isRepaired: false,
      pulseTime: 0.0,
      minX: minX - corridorWidth,
      maxX: maxX + corridorWidth,
      minY: minY - corridorWidth,
      maxY: maxY + corridorWidth
    };

    this.wounds.push(wound);
    return wound;
  }

  /**
   * Distancia mínima cuadrada desde un punto a un segmento de línea (x1, y1) -> (x2, y2)
   */
  private distToSegmentSq(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
    if (l2 === 0) return (px - x1) * (px - x1) + (py - y1) * (py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    const projX = x1 + t * (x2 - x1);
    const projY = y1 + t * (y2 - y1);
    return (px - projX) * (px - projX) + (py - projY) * (py - projY);
  }

  /**
   * Mueve la herida más cercana a una nueva posición sin interrumpir la simulación
   */
  public moveNearestWound(x: number, y: number, newX: number, newY: number) {
    let nearest: Wound | null = null;
    let minDist = 1e9;

    for (const w of this.wounds) {
      const d = Math.hypot(w.x - x, w.y - y);
      if (d < minDist && d < 180.0) {
        minDist = d;
        nearest = w;
      }
    }

    if (nearest) {
      const dx = newX - nearest.x;
      const dy = newY - nearest.y;
      nearest.x = newX;
      nearest.y = newY;
      nearest.minX += dx;
      nearest.maxX += dx;
      nearest.minY += dy;
      nearest.maxY += dy;

      for (const b of nearest.branches) {
        for (const pt of b.points) {
          pt.x += dx;
          pt.y += dy;
        }
      }
    }
  }

  /**
   * Devuelve información de herida si el punto (x, y) está dentro del corredor de una fractura
   */
  public getWoundAt(x: number, y: number): { dist: number; intensity: number; isRepaired: boolean; wound: Wound } | null {
    for (let i = 0; i < this.wounds.length; i++) {
      const w = this.wounds[i];

      // Descarte rápido con bounding box
      if (x < w.minX || x > w.maxX || y < w.minY || y > w.maxY) {
        continue;
      }

      const corridorSq = w.corridorWidth * w.corridorWidth;
      let minDistSq = 1e9;

      for (let b = 0; b < w.branches.length; b++) {
        const pts = w.branches[b].points;
        for (let p = 0; p < pts.length - 1; p++) {
          const dSq = this.distToSegmentSq(x, y, pts[p].x, pts[p].y, pts[p + 1].x, pts[p + 1].y);
          if (dSq < minDistSq) {
            minDistSq = dSq;
          }
        }
      }

      if (minDistSq < corridorSq) {
        const d = Math.sqrt(minDistSq);
        return {
          dist: d,
          intensity: w.intensity * (1.0 - w.repairProgress * 0.75),
          isRepaired: w.isRepaired,
          wound: w
        };
      }
    }
    return null;
  }

  /**
   * Encuentra la herida no reparada más cercana para la quimiotaxis de los agentes dorados
   */
  public getNearestWound(x: number, y: number): { x: number; y: number; intensity: number; isRepaired: boolean; wound: Wound } | null {
    let nearest: Wound | null = null;
    let minDist = 1e9;

    for (let i = 0; i < this.wounds.length; i++) {
      const w = this.wounds[i];
      if (w.isRepaired) continue;

      const dist = Math.hypot(w.x - x, w.y - y);
      if (dist < minDist) {
        minDist = dist;
        nearest = w;
      }
    }

    if (nearest) {
      return {
        x: nearest.x,
        y: nearest.y,
        intensity: nearest.intensity,
        isRepaired: nearest.isRepaired,
        wound: nearest
      };
    }
    return null;
  }

  /**
   * Obtiene la posición de entrada corriente arriba de una herida
   */
  public getUpstreamEntry(w: Wound): { x: number; y: number } {
    if (w.branches.length > 0 && w.branches[0].points.length > 0) {
      return w.branches[0].points[0];
    }
    return { x: w.x, y: w.y };
  }

  /**
   * Deposita curación dorada directamente sobre la fractura de la herida
   */
  public addHealing(x: number, y: number, amount: number = 0.05) {
    const woundInfo = this.getWoundAt(x, y);
    if (woundInfo) {
      const w = woundInfo.wound;
      w.repairProgress = Math.min(1.0, w.repairProgress + amount);
      if (w.repairProgress >= 0.95) {
        w.isRepaired = true;
      }
    }
  }

  /**
   * Actualiza el pulso sutil de las heridas
   */
  public update(dt: number) {
    for (let i = 0; i < this.wounds.length; i++) {
      const w = this.wounds[i];
      w.pulseTime += dt;
    }
  }

  /**
   * Reinicia todas las heridas
   */
  public clear() {
    this.wounds = [];
  }
}
