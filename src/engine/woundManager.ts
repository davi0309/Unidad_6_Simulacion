/**
 * woundManager.ts
 * Gestor de Espacios Tipo Trigger (Fracturas Rojas y Costuras Doradas Kintsugi):
 * - Los espacios se construyen a lo largo de las líneas de flujo (no aleatorios).
 * - Cuando los filamentos pasan por la posición de un espacio rojo, se colorean de ROJO mientras estén dentro.
 * - Cuando los filamentos pasan por la posición de un espacio dorado, se colorean de ORO mientras estén dentro.
 * - Al salir del espacio, retornan inmediatamente a su color natural (AZUL).
 * - Cero agentes inmóviles: el flujo es continuo, cinéticamente libre y a 60 FPS.
 */

export enum ZoneType {
  WOUND = 'WOUND',   // Espacio de fractura roja
  GOLD = 'GOLD'      // Espacio áureo Kintsugi
}

export interface WoundPoint {
  x: number;
  y: number;
}

export interface WoundBranch {
  points: WoundPoint[];
}

export interface TriggerZone {
  id: string;
  type: ZoneType;
  x: number;
  y: number;
  branches: WoundBranch[];
  corridorWidth: number; // Radio del corredor (ancho de influencia)
  intensity: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  pulseTime: number;
}

// Alias de conveniencia para compatibilidad
export type Wound = TriggerZone;

export class WoundManager {
  public width: number;
  public height: number;
  public zones: TriggerZone[] = [];

  // Acceso para compatibilidad
  public get wounds(): TriggerZone[] {
    return this.zones;
  }

  constructor(w: number, h: number) {
    this.width = w;
    this.height = h;
  }

  public resize(w: number, h: number) {
    this.width = w;
    this.height = h;
  }

  /**
   * Crea un espacio tipo trigger a lo largo de las líneas de corriente del Flow Field (no aleatorio)
   */
  public createZone(
    startX: number,
    startY: number,
    type: ZoneType = ZoneType.WOUND,
    sampleFlow?: (x: number, y: number) => { vx: number; vy: number },
    intensity: number = 1.0
  ): TriggerZone {
    const id = Math.random().toString(36).substring(2, 9);
    const mainBranch: WoundPoint[] = [{ x: startX, y: startY }];

    let minX = startX;
    let maxX = startX;
    let minY = startY;
    let maxY = startY;

    // 1. Trazado coherente y compacto siguiendo la corriente del río hacia adelante (12 pasos)
    let cx = startX;
    let cy = startY;
    const forwardSteps = 12;
    const stepLen = 7.5;

    for (let s = 0; s < forwardSteps; s++) {
      let vx = 0;
      let vy = 1;
      if (sampleFlow) {
        const f = sampleFlow(cx, cy);
        const len = Math.hypot(f.vx, f.vy) || 1.0;
        vx = f.vx / len;
        vy = f.vy / len;
      }
      // Ondulación armónica sutil
      const harmonic = Math.sin(s * 0.45) * 0.18;
      const nx = cx + (vx - vy * harmonic) * stepLen;
      const ny = cy + (vy + vx * harmonic) * stepLen;

      mainBranch.push({ x: nx, y: ny });
      minX = Math.min(minX, nx);
      maxX = Math.max(maxX, nx);
      minY = Math.min(minY, ny);
      maxY = Math.max(maxY, ny);

      cx = nx;
      cy = ny;
    }

    // 2. Trazado continuo corriente arriba (8 pasos)
    cx = startX;
    cy = startY;
    const backwardSteps = 8;
    for (let s = 0; s < backwardSteps; s++) {
      let vx = 0;
      let vy = 1;
      if (sampleFlow) {
        const f = sampleFlow(cx, cy);
        const len = Math.hypot(f.vx, f.vy) || 1.0;
        vx = f.vx / len;
        vy = f.vy / len;
      }
      const harmonic = Math.cos(s * 0.45) * 0.18;
      const nx = cx - (vx - vy * harmonic) * stepLen;
      const ny = cy - (vy + vx * harmonic) * stepLen;

      mainBranch.unshift({ x: nx, y: ny });
      minX = Math.min(minX, nx);
      maxX = Math.max(maxX, nx);
      minY = Math.min(minY, ny);
      maxY = Math.max(maxY, ny);

      cx = nx;
      cy = ny;
    }

    // 3. Ramificación afluente compacta
    const branches: WoundBranch[] = [{ points: mainBranch }];
    const branchPointIdx = Math.floor(mainBranch.length * 0.50);
    const branchRoot = mainBranch[branchPointIdx];

    if (branchRoot) {
      const subBranch: WoundPoint[] = [{ x: branchRoot.x, y: branchRoot.y }];
      let bx = branchRoot.x;
      let by = branchRoot.y;
      for (let s = 0; s < 6; s++) {
        let vx = 1;
        let vy = 1;
        if (sampleFlow) {
          const f = sampleFlow(bx, by);
          const len = Math.hypot(f.vx, f.vy) || 1.0;
          vx = (-f.vy * 0.55 + f.vx * 0.85) / len;
          vy = (f.vx * 0.55 + f.vy * 0.85) / len;
        }
        bx += vx * 6.5;
        by += vy * 6.5;
        subBranch.push({ x: bx, y: by });
        minX = Math.min(minX, bx);
        maxX = Math.max(maxX, bx);
        minY = Math.min(minY, by);
        maxY = Math.max(maxY, by);
      }
      branches.push({ points: subBranch });
    }

    const corridorWidth = 13.0; // Corredor más pequeño y ajustado
    const zone: TriggerZone = {
      id,
      type,
      x: startX,
      y: startY,
      branches,
      corridorWidth,
      intensity,
      minX: minX - corridorWidth,
      maxX: maxX + corridorWidth,
      minY: minY - corridorWidth,
      maxY: maxY + corridorWidth,
      pulseTime: 0.0
    };

    this.zones.push(zone);
    return zone;
  }

  /**
   * Crea un espacio de fractura roja (Tecla Q)
   */
  public createWound(
    startX: number,
    startY: number,
    sampleFlow?: (x: number, y: number) => { vx: number; vy: number },
    intensity: number = 1.0
  ): TriggerZone {
    return this.createZone(startX, startY, ZoneType.WOUND, sampleFlow, intensity);
  }

  /**
   * Transforma la herida roja más cercana en un espacio dorado Kintsugi (Tecla U),
   * o crea un nuevo espacio dorado si no hay heridas existentes.
   */
  public transformOrCreateGoldZone(
    x: number,
    y: number,
    sampleFlow?: (x: number, y: number) => { vx: number; vy: number }
  ): { zone: TriggerZone; wasTransformed: boolean } {
    let nearestWound: TriggerZone | null = null;
    let minDist = 1e9;

    for (let i = 0; i < this.zones.length; i++) {
      const z = this.zones[i];
      if (z.type === ZoneType.WOUND) {
        const d = Math.hypot(z.x - x, z.y - y);
        if (d < minDist) {
          minDist = d;
          nearestWound = z;
        }
      }
    }

    // Si hay una herida en pantalla, transmutar su espacio en oro
    if (nearestWound) {
      nearestWound.type = ZoneType.GOLD;
      return { zone: nearestWound, wasTransformed: true };
    }

    // Si no había herida, crear un espacio dorado en la posición actual
    const newGoldZone = this.createZone(x, y, ZoneType.GOLD, sampleFlow, 1.0);
    return { zone: newGoldZone, wasTransformed: false };
  }

  /**
   * Distancia mínima al cuadrado desde (px, py) al segmento (x1, y1) -> (x2, y2)
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
   * Determina si el punto (x, y) de un agente está dentro del corredor de algún espacio trigger.
   * Retorna la zona activa o null.
   */
  public getZoneAt(x: number, y: number): TriggerZone | null {
    for (let i = 0; i < this.zones.length; i++) {
      const z = this.zones[i];

      // Descarte rápido mediante caja delimitadora
      if (x < z.minX || x > z.maxX || y < z.minY || y > z.maxY) {
        continue;
      }

      const corridorSq = z.corridorWidth * z.corridorWidth;

      for (let b = 0; b < z.branches.length; b++) {
        const pts = z.branches[b].points;
        for (let p = 0; p < pts.length - 1; p++) {
          const dSq = this.distToSegmentSq(x, y, pts[p].x, pts[p].y, pts[p + 1].x, pts[p + 1].y);
          if (dSq < corridorSq) {
            return z;
          }
        }
      }
    }
    return null;
  }

  /**
   * Mueve el espacio trigger más cercano
   */
  public moveNearestZone(x: number, y: number, newX: number, newY: number) {
    let nearest: TriggerZone | null = null;
    let minDist = 1e9;

    for (const z of this.zones) {
      const d = Math.hypot(z.x - x, z.y - y);
      if (d < minDist && d < 180.0) {
        minDist = d;
        nearest = z;
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
   * Actualiza el pulso sutil de los espacios
   */
  public update(dt: number) {
    for (let i = 0; i < this.zones.length; i++) {
      this.zones[i].pulseTime += dt;
    }
  }

  /**
   * Los espacios trigger son 100% transparentes e invisibles en el fondo.
   * Lo único que cambia de color son los filamentos del flow field al cruzar por ellos.
   */
  public renderAmbientSpaces(_ctx: CanvasRenderingContext2D) {
    // Totalmente transparente: no dibuja ninguna silueta ni aura en el fondo
  }

  public clear() {
    this.zones = [];
  }
}
