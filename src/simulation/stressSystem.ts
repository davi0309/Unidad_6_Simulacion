/**
 * stressSystem.ts
 * Sistema de estrés para el instrumento "Heal": "No se puede forzar".
 *
 * - Ventana deslizante de 1.0 s con marcas de tiempo de las pulsaciones.
 * - Sin Shift, si la tasa supera 5 teclas/s: stress += 0.15 por cada pulsación extra.
 * - stress decae 0.4 por segundo.
 * - Con Shift (Clímax): stress se desactiva (stress = 0).
 * - Mientras stress > 1:
 *   - Alerta de tensión en el HUD.
 *   - El progreso de curación retrocede levemente porque sanar con prisa reabre la herida.
 *   - SIN mini explosiones (eliminadas según solicitud del usuario).
 */

import { HealParameters } from './parameters';

export class StressSystem {
  private keyTimestamps: number[] = [];

  constructor() {}

  public registerKeyPress(now: number, isShift: boolean, params: HealParameters) {
    if (isShift) {
      params.stress = 0.0;
      return;
    }

    // Ventana deslizante de 1 segundo
    this.keyTimestamps.push(now);
    const windowStart = now - 1000;
    while (this.keyTimestamps.length > 0 && this.keyTimestamps[0] < windowStart) {
      this.keyTimestamps.shift();
    }

    // Si la tasa supera 5 teclas por segundo: stress += 0.15 por pulsación extra
    if (this.keyTimestamps.length > 5) {
      params.stress += 0.15;
    }
  }

  public update(dt: number, params: HealParameters) {
    if (params.isClimax) {
      params.stress = 0.0;
      return;
    }

    // Decaimiento del estrés: 0.4 por segundo
    if (params.stress > 0) {
      params.stress = Math.max(0.0, params.stress - 0.4 * dt);
    }

    // Limpiar timestamps fuera de la ventana
    const now = performance.now();
    const windowStart = now - 1000;
    while (this.keyTimestamps.length > 0 && this.keyTimestamps[0] < windowStart) {
      this.keyTimestamps.shift();
    }

    // Si el estrés supera 1.0, la prisa reabre la herida (retrocede suavemente la curación)
    if (params.stress > 1.0) {
      params.healingProgress = Math.max(0.0, params.healingProgress - 0.03 * dt);
    }
  }
}
