/**
 * woundManager.ts
 * Gestor de Heridas y Fracturas Kintsugi para HEAL:
 * - Creación y manipulación de múltiples heridas coexistentes.
 * - Deformación orgánica del flujo en torno a la fractura.
 * - Progreso gradual de reparación Kintsugi (0.0 a 1.0).
 * - Campo de influencia espacial para percepción de agentes rojos y dorados.
 */

export interface Wound {
  id: string;
  x: number;
  y: number;
  radius: number;
  intensity: number;
  repairProgress: number; // 0.0 (abierta/roja) a 1.0 (sellada de oro)
  isRepaired: boolean;
  pulseTime: number;
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
   * Crea una nueva herida en la posición especificada (Tecla Q o clic)
   */
  public createWound(x: number, y: number, radius: number = 130.0, intensity: number = 1.0): Wound {
    const id = Math.random().toString(36).substring(2, 9);
    const wound: Wound = {
      id,
      x,
      y,
      radius,
      intensity,
      repairProgress: 0.0,
      isRepaired: false,
      pulseTime: 0.0
    };

    this.wounds.push(wound);
    return wound;
  }

  /**
   * Mueve la herida más cercana a una nueva posición sin interrumpir la simulación
   */
  public moveNearestWound(x: number, y: number, newX: number, newY: number) {
    let nearest: Wound | null = null;
    let minDist = 1e9;

    for (const w of this.wounds) {
      const d = Math.hypot(w.x - x, w.y - y);
      if (d < minDist && d < w.radius * 1.5) {
        minDist = d;
        nearest = w;
      }
    }

    if (nearest) {
      nearest.x = newX;
      nearest.y = newY;
    }
  }

  /**
   * Devuelve información de herida si el punto (x, y) está dentro de alguna zona afectada
   */
  public getWoundAt(x: number, y: number): { dist: number; intensity: number; isRepaired: boolean } | null {
    for (let i = 0; i < this.wounds.length; i++) {
      const w = this.wounds[i];
      const dist = Math.hypot(w.x - x, w.y - y);
      if (dist < w.radius) {
        return {
          dist,
          intensity: w.intensity * (1.0 - w.repairProgress * 0.7),
          isRepaired: w.isRepaired
        };
      }
    }
    return null;
  }

  /**
   * Encuentra la herida no reparada más cercana para la quimiotaxis de los agentes dorados
   */
  public getNearestWound(x: number, y: number): { x: number; y: number; intensity: number; isRepaired: boolean } | null {
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
        isRepaired: nearest.isRepaired
      };
    }
    return null;
  }

  /**
   * Deposita curación dorada en una posición (agentes dorados o tecla U)
   */
  public addHealing(x: number, y: number, amount: number = 0.05) {
    for (let i = 0; i < this.wounds.length; i++) {
      const w = this.wounds[i];
      const dist = Math.hypot(w.x - x, w.y - y);
      if (dist < w.radius * 1.2) {
        w.repairProgress = Math.min(1.0, w.repairProgress + amount);
        if (w.repairProgress >= 0.95) {
          w.isRepaired = true;
        }
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
