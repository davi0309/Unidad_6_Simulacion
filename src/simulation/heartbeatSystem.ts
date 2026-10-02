/**
 * heartbeatSystem.ts
 * Sistema de latidos para las teclas Z X C V B N M.
 *
 * - Onda gaussiana radial que nace desde el centro de la herida.
 * - Desplaza radialmente a los agentes de tejido.
 * - Z = onda más grande y lenta; M = más pequeña y rápida.
 * - Destello global de +6% de brillo que decae en 300 ms.
 * - Con Shift (Clímax): latidos x2 en amplitud y destello.
 */

import { Point2D } from './woundSDF';
import { HealParameters } from './parameters';

export interface HeartbeatWave {
  centerX: number;
  centerY: number;
  radius: number;
  speed: number;
  sigma: number;
  amplitude: number;
  maxRadius: number;
  age: number;
}

// Configuración por tecla (Z más grande/lenta, M más pequeña/rápida)
const BEAT_CONFIGS: Record<string, { speed: number; sigma: number; amplitude: number }> = {
  KeyZ: { speed: 180.0, sigma: 70.0, amplitude: 22.0 },
  KeyX: { speed: 220.0, sigma: 60.0, amplitude: 19.0 },
  KeyC: { speed: 260.0, sigma: 50.0, amplitude: 16.0 },
  KeyV: { speed: 300.0, sigma: 42.0, amplitude: 14.0 },
  KeyB: { speed: 350.0, sigma: 34.0, amplitude: 12.0 },
  KeyN: { speed: 410.0, sigma: 26.0, amplitude: 10.0 },
  KeyM: { speed: 470.0, sigma: 18.0, amplitude: 8.0 }
};

export class HeartbeatSystem {
  public activeWaves: HeartbeatWave[] = [];

  public triggerBeat(keyCode: string, center: Point2D, params: HealParameters, maxDomainDist: number) {
    const config = BEAT_CONFIGS[keyCode] || BEAT_CONFIGS.KeyC;
    const mult = params.isClimax ? 2.0 : 1.0;

    // Destello global de brillo (+6% normal, +12% en clímax)
    params.heartbeatFlash = 0.06 * mult;

    this.activeWaves.push({
      centerX: center.x,
      centerY: center.y,
      radius: 0.0,
      speed: config.speed,
      sigma: config.sigma,
      amplitude: config.amplitude * mult,
      maxRadius: maxDomainDist,
      age: 0.0
    });
  }

  public update(dt: number, params: HealParameters) {
    // Decaimiento del destello en 300 ms (t = 0.3s)
    if (params.heartbeatFlash > 0) {
      params.heartbeatFlash = Math.max(0.0, params.heartbeatFlash - (dt / 0.3) * 0.06);
    }

    // Avanzar ondas
    for (let i = this.activeWaves.length - 1; i >= 0; i--) {
      const w = this.activeWaves[i];
      w.age += dt;
      w.radius += w.speed * dt;

      if (w.radius > w.maxRadius) {
        this.activeWaves.splice(i, 1);
      }
    }
  }

  /**
   * Evalúa el desplazamiento radial producido por las ondas activas en un punto (px, py).
   */
  public evaluateDisplacement(px: number, py: number): { dx: number; dy: number } {
    let totalDx = 0;
    let totalDy = 0;

    for (let i = 0; i < this.activeWaves.length; i++) {
      const w = this.activeWaves[i];
      const rx = px - w.centerX;
      const ry = py - w.centerY;
      const dist = Math.sqrt(rx * rx + ry * ry);
      if (dist < 1e-4) continue;

      const diff = dist - w.radius;
      const gauss = Math.exp(-(diff * diff) / (2.0 * w.sigma * w.sigma));
      const disp = w.amplitude * gauss;

      totalDx += (rx / dist) * disp;
      totalDy += (ry / dist) * disp;
    }

    return { dx: totalDx, dy: totalDy };
  }

  public clear() {
    this.activeWaves = [];
  }
}
