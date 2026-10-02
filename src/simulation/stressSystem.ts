/**
 * stressSystem.ts
 * Sistema de estrés para el instrumento "Heal": "No se puede forzar".
 *
 * - Ventana deslizante de 1.0 s con las marcas de tiempo de las pulsaciones.
 * - Sin Shift, si la tasa supera 5 teclas/s: stress += 0.15 por cada pulsación extra.
 * - stress decae 0.4 por segundo.
 * - Con Shift (Clímax): stress se desactiva (stress = 0).
 * - Mientras stress > 1:
 *   - Modo forzado activo en células sanadoras.
 *   - Cada 0.5 s agrega una microfractura en el borde de la herida y genera 20 a 40 fragmentos.
 */

import { HealParameters } from './parameters';
import { WoundSystem, Point2D } from './woundSDF';
import { FractureSystem } from './fractureFragments';

export class StressSystem {
  private keyTimestamps: number[] = [];
  private microfractureTimer: number = 0;
  private onMicrofractureCallback?: (origin: Point2D, end: Point2D) => void;

  constructor(onMicrofracture?: (origin: Point2D, end: Point2D) => void) {
    this.onMicrofractureCallback = onMicrofracture;
  }

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

  public update(
    dt: number,
    params: HealParameters,
    woundSystem: WoundSystem,
    fractureSystem: FractureSystem
  ) {
    if (params.isClimax) {
      params.stress = 0.0;
      this.microfractureTimer = 0;
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

    // Manejo de microfracturas cada 0.5 s mientras stress > 1
    if (params.stress > 1.0) {
      this.microfractureTimer += dt;
      if (this.microfractureTimer >= 0.5) {
        this.microfractureTimer -= 0.5;

        // Generar microfractura en el borde de la herida
        const { origin, end } = woundSystem.addMicrofracture();

        // Generar 20 a 40 fragmentos de fractura
        const fragmentCount = 20 + Math.floor(Math.random() * 21);
        fractureSystem.spawnFragments(origin.x, origin.y, fragmentCount);

        if (this.onMicrofractureCallback) {
          this.onMicrofractureCallback(origin, end);
        }
      }
    } else {
      this.microfractureTimer = 0;
    }
  }
}
