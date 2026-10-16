/**
 * woundManager.ts
 * Gestor de Espacios Tipo Trigger Difuminados (Fracturas Rojas y Costuras Doradas Kintsugi):
 * - Los espacios se construyen a lo largo de las líneas de flujo (no aleatorios).
 * - Difuminado orgánico continuo (feathering): el color se funde suavemente sin bordes definidos o cortados.
 * - Los filamentos adquieren el color del trigger de forma gradual y vuelven al azul natural al salir.
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
  corridorWidth: number; // Radio del núcleo intenso (ej. 7px)
  featherWidth: number;  // Radio del perímetro difuminado (ej. 28px)
  intensity: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  pulseTime: number;

  // Sanación progresiva y lenta Kintsugi (Tecla U)
  healingProgress: number; // 0.0 (rojo puro) a 1.0 (oro puro)
  isHealing: boolean;      // true mientras la curación avanza
  healOriginX: number;     // Coordenada x de origen de la curación
  healOriginY: number;     // Coordenada y de origen de la curación
  maxBranchDist: number;   // Distancia máxima de la fractura para avance progresivo
}

export interface ZoneInfluence {
  zone: TriggerZone;
  intensity: number; // 0.0 (perímetro exterior) a 1.0 (núcleo interior)
  dist: number;
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

    // 3. Ramificación afluente compacta conectada en la sección media
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

    // Dimensiones de difusión: núcleo concentrado y perímetro suavemente difuminado
    const corridorWidth = 7.0; // Núcleo
    const featherWidth = 28.0; // Borde suave difuminado

    const zone: TriggerZone = {
      id,
      type,
      x: startX,
      y: startY,
      branches,
      corridorWidth,
      featherWidth,
      intensity,
      minX: minX - featherWidth,
      maxX: maxX + featherWidth,
      minY: minY - featherWidth,
      maxY: maxY + featherWidth,
      pulseTime: 0.0,
      healingProgress: type === ZoneType.GOLD ? 1.0 : 0.0,
      isHealing: false,
      healOriginX: startX,
      healOriginY: startY,
      maxBranchDist: 100.0
    };

    this.zones.push(zone);
    return zone;
  }

  /**
   * Crea un espacio de fractura roja por pulsación (Tecla Q)
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
   * Inicia el trazado interactivo de una herida con el mouse sostenido (modo lápiz)
   */
  public startDrawnWound(x: number, y: number): TriggerZone {
    const id = Math.random().toString(36).substring(2, 9);
    const corridorWidth = 7.0;
    const featherWidth = 28.0;

    const zone: TriggerZone = {
      id,
      type: ZoneType.WOUND,
      x,
      y,
      branches: [{ points: [{ x, y }] }],
      corridorWidth,
      featherWidth,
      intensity: 1.0,
      minX: x - featherWidth,
      maxX: x + featherWidth,
      minY: y - featherWidth,
      maxY: y + featherWidth,
      pulseTime: 0.0,
      healingProgress: 0.0,
      isHealing: false,
      healOriginX: x,
      healOriginY: y,
      maxBranchDist: 80.0
    };

    this.zones.push(zone);
    return zone;
  }

  /**
   * Añade un nuevo punto al trazo del lápiz conforme el usuario arrastra el mouse
   */
  public addPointToDrawnWound(zone: TriggerZone, x: number, y: number) {
    if (zone.branches.length === 0) return;
    const pts = zone.branches[0].points;
    const last = pts[pts.length - 1];

    // Distancia mínima de 6px entre puntos para evitar sobrecargar de vértices
    const distSq = (x - last.x) * (x - last.x) + (y - last.y) * (y - last.y);
    if (distSq < 36.0) return;

    pts.push({ x, y });

    // Actualizar dinámicamente la caja delimitadora con el radio difuminado
    zone.minX = Math.min(zone.minX, x - zone.featherWidth);
    zone.maxX = Math.max(zone.maxX, x + zone.featherWidth);
    zone.minY = Math.min(zone.minY, y - zone.featherWidth);
    zone.maxY = Math.max(zone.maxY, y + zone.featherWidth);
  }

  /**
   * Finaliza el trazo dibujado al soltar el clic y calcula su longitud total
   */
  public finishDrawnWound(zone: TriggerZone) {
    if (zone.branches.length === 0) return;
    const pts = zone.branches[0].points;
    // Si fue solo un clic estático, añadir un punto adyacente para definir el segmento
    if (pts.length === 1) {
      pts.push({ x: pts[0].x + 3.0, y: pts[0].y + 3.0 });
    }

    // Calcular longitud de la fractura dibujada
    let maxDist = 40.0;
    const origin = pts[0];
    for (const pt of pts) {
      const d = Math.hypot(pt.x - origin.x, pt.y - origin.y);
      if (d > maxDist) maxDist = d;
    }
    zone.maxBranchDist = maxDist;
  }

  /**
   * Activa la sanación progresiva y lenta Kintsugi (Tecla U) en la herida más cercana.
   * La curación se carga homogéneamente a lo largo de la fractura sin crear focos ni concentraciones.
   */
  public transformOrCreateGoldZone(
    x: number,
    y: number,
    _sampleFlow?: (x: number, y: number) => { vx: number; vy: number }
  ): { zone: TriggerZone | null; wasTransformed: boolean } {
    let nearestWound: TriggerZone | null = null;
    let minDist = 1e9;

    for (let i = 0; i < this.zones.length; i++) {
      const z = this.zones[i];
      // Buscar heridas que aún tengan componente rojo (no completamente sanadas)
      if (z.type === ZoneType.WOUND || z.healingProgress < 0.99) {
        const d = Math.hypot(z.x - x, z.y - y);
        if (d < minDist) {
          minDist = d;
          nearestWound = z;
        }
      }
    }

    // Si hay una herida en pantalla, activar su sanación lenta y progresiva Kintsugi
    if (nearestWound) {
      nearestWound.isHealing = true;
      return { zone: nearestWound, wasTransformed: true };
    }

    // Si no hay heridas por sanar, no creamos ningún foco ni zona artificial en el cursor
    return { zone: null, wasTransformed: false };
  }

  /**
   * Calcula el ratio de oro (0.0 = rojo puro, 1.0 = oro puro) para un punto de la herida.
   * Progresión suave, uniforme y contemplativa sin concentraciones ni frentes artificiales.
   */
  public getZoneGoldRatio(zone: TriggerZone, _x: number, _y: number): number {
    if (zone.type === ZoneType.GOLD && !zone.isHealing) {
      return 1.0;
    }
    if (zone.type === ZoneType.WOUND && !zone.isHealing && zone.healingProgress <= 0.0) {
      return 0.0;
    }

    const P = zone.healingProgress;
    if (P <= 0.0) return 0.0;
    if (P >= 1.0) return 1.0;

    // Carga progresiva armónica continua (smoothstep) en todo el cuerpo de la fractura
    return P * P * (3 - 2 * P);
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
   * Calcula la influencia difuminada continua (0.0 a 1.0) de un espacio trigger en (x, y).
   * Utiliza una curva cosinusoidal suave C1 para eliminar cualquier borde duro o definido.
   */
  public getZoneInfluence(x: number, y: number): ZoneInfluence | null {
    let bestZone: TriggerZone | null = null;
    let maxIntensity = 0;
    let bestDist = 1e9;

    for (let i = 0; i < this.zones.length; i++) {
      const z = this.zones[i];

      // Descarte rápido mediante caja delimitadora
      if (x < z.minX || x > z.maxX || y < z.minY || y > z.maxY) {
        continue;
      }

      const featherSq = z.featherWidth * z.featherWidth;
      let minDistSq = 1e9;

      for (let b = 0; b < z.branches.length; b++) {
        const pts = z.branches[b].points;
        for (let p = 0; p < pts.length - 1; p++) {
          const dSq = this.distToSegmentSq(x, y, pts[p].x, pts[p].y, pts[p + 1].x, pts[p + 1].y);
          if (dSq < minDistSq) {
            minDistSq = dSq;
          }
        }
      }

      if (minDistSq < featherSq) {
        const d = Math.sqrt(minDistSq);
        let intensity = 1.0;
        if (d > z.corridorWidth) {
          // Curva cosinusoidal suave C1 (difuminado sin cortes abruptos)
          const u = (d - z.corridorWidth) / (z.featherWidth - z.corridorWidth);
          intensity = 0.5 * (1 + Math.cos(Math.PI * Math.min(Math.max(u, 0), 1)));
        }

        if (intensity > maxIntensity) {
          maxIntensity = intensity;
          bestZone = z;
          bestDist = d;
        }
      }
    }

    if (bestZone && maxIntensity > 0.01) {
      return {
        zone: bestZone,
        intensity: maxIntensity,
        dist: bestDist
      };
    }
    return null;
  }

  /**
   * Determina si el punto (x, y) de un agente está dentro del corredor de algún espacio trigger (compatibilidad).
   */
  public getZoneAt(x: number, y: number): TriggerZone | null {
    const inf = this.getZoneInfluence(x, y);
    return inf && inf.intensity > 0.2 ? inf.zone : null;
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
   * Actualiza el pulso y la sanación progresiva y lenta Kintsugi
   */
  public update(dt: number) {
    for (let i = 0; i < this.zones.length; i++) {
      const z = this.zones[i];
      z.pulseTime += dt;

      // Sanación lenta y progresiva Kintsugi (Tecla U): ~5.5 segundos para transmutar completamente a oro
      if (z.isHealing && z.healingProgress < 1.0) {
        const healRate = 0.18; // 18% por segundo (~5.5 segundos de avance contemplativo)
        z.healingProgress = Math.min(1.0, z.healingProgress + dt * healRate);
        if (z.healingProgress >= 1.0) {
          z.type = ZoneType.GOLD;
          z.isHealing = false;
        }
      }
    }
  }

  public clear() {
    this.zones = [];
  }
}
