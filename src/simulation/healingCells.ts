/**
 * healingCells.ts
 * Células sanadoras con comportamientos de dirección (Craig Reynolds Steering Behaviors):
 * - Seek / Arrive hacia la herida
 * - Wander (deambulación orgánica)
 * - Campo de dolor (gradiente del SDF que empuja hacia afuera) + curl noise en clímax
 * - Transformación a agentes dorados al penetrar la herida (SDF < 0)
 * - Modo forzado cuando stress > 1: rasgan el tejido, velocidad 6, no generan oro.
 */

import { HealParameters } from './parameters';
import { WoundSystem, Point2D } from './woundSDF';

export interface HealingCell {
  x: number;
  y: number;
  vx: number;
  vy: number;
  wanderAngle: number;
  target: Point2D;
  life: number;
  maxLife: number;
  tint: { r: number; g: number; b: number };
  isForced: boolean;
}

export interface SparkFlash {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  tint: { r: number; g: number; b: number };
}

export interface TearTread {
  x: number;
  y: number;
}

// Mapeo cromático de teclas agudas: Q cálido a P blanco frío
export const KEY_TINTS: Record<string, { r: number; g: number; b: number }> = {
  KeyQ: { r: 1.0, g: 0.81, b: 0.54 },   // #ffcf8a cálido
  KeyW: { r: 1.0, g: 0.85, b: 0.62 },   // #ffd99e
  KeyE: { r: 1.0, g: 0.88, b: 0.70 },   // #ffe2b2
  KeyR: { r: 1.0, g: 0.92, b: 0.78 },   // #ffebc6
  KeyT: { r: 1.0, g: 0.95, b: 0.86 },   // #fff4db
  KeyY: { r: 0.98, g: 0.96, b: 0.91 },  // #f9f6e8
  KeyU: { r: 0.96, g: 0.96, b: 0.95 },  // #f4f6f2
  KeyI: { r: 0.94, g: 0.96, b: 0.97 },  // #eff4f8
  KeyO: { r: 0.92, g: 0.95, b: 0.99 },  // #eaf2fc
  KeyP: { r: 0.96, g: 0.96, b: 1.00 }   // #f4f6ff blanco frío
};

function curlNoise(x: number, y: number): { cx: number; cy: number } {
  const eps = 1.0;
  const n1 = Math.sin(x * 0.015 + y * 0.012) + Math.cos(x * 0.024 - y * 0.018);
  const n2 = Math.sin((x + eps) * 0.015 + y * 0.012) + Math.cos((x + eps) * 0.024 - y * 0.018);
  const n3 = Math.sin(x * 0.015 + (y + eps) * 0.012) + Math.cos(x * 0.024 - (y + eps) * 0.018);
  const dndx = (n2 - n1) / eps;
  const dndy = (n3 - n1) / eps;
  return { cx: dndy, cy: -dndx };
}

export class HealingCellSystem {
  public cells: HealingCell[] = [];
  public sparks: SparkFlash[] = [];
  public recentTears: TearTread[] = [];

  private onGoldAgentSpawnCallback?: (x: number, y: number) => void;

  constructor(onGoldAgentSpawn?: (x: number, y: number) => void) {
    this.onGoldAgentSpawnCallback = onGoldAgentSpawn;
  }

  public spawnCells(
    cursorX: number,
    cursorY: number,
    keyCode: string,
    params: HealParameters,
    woundSystem: WoundSystem
  ) {
    const tint = KEY_TINTS[keyCode] || { r: 1.0, g: 0.9, b: 0.7 };
    const count = params.isClimax ? 60 : 6 + Math.floor(Math.random() * 7); // 6 a 12 (o 60 en clímax)
    const isForced = params.stress > 1.0 && !params.isClimax;

    // Calcular proyección del cursor hacia la grieta
    const target = woundSystem.projectOntoWound(cursorX, cursorY);

    for (let i = 0; i < count; i++) {
      if (this.cells.length >= params.cellPoolMax) break;

      // Dispersión inicial de 20 px alrededor del cursor
      const angle = Math.random() * Math.PI * 2.0;
      const dist = Math.random() * 20.0;
      const px = cursorX + Math.cos(angle) * dist;
      const py = cursorY + Math.sin(angle) * dist;

      // Velocidad inicial hacia el objetivo
      const toTargetX = target.x - px;
      const toTargetY = target.y - py;
      const toLen = Math.sqrt(toTargetX * toTargetX + toTargetY * toTargetY) || 1.0;
      const initSpeed = isForced ? 3.0 : 0.8;

      this.cells.push({
        x: px,
        y: py,
        vx: (toTargetX / toLen) * initSpeed + (Math.random() - 0.5) * 0.5,
        vy: (toTargetY / toLen) * initSpeed + (Math.random() - 0.5) * 0.5,
        wanderAngle: Math.random() * Math.PI * 2.0,
        target: { x: target.x, y: target.y },
        life: params.cellLifeMax,
        maxLife: params.cellLifeMax,
        tint,
        isForced
      });
    }
  }

  public update(dt: number, params: HealParameters, woundSystem: WoundSystem) {
    this.recentTears = [];
    const isGlobalForced = params.stress > 1.0 && !params.isClimax;

    // Actualizar destellos (sparks)
    for (let s = this.sparks.length - 1; s >= 0; s--) {
      this.sparks[s].life -= dt;
      if (this.sparks[s].life <= 0) {
        this.sparks.splice(s, 1);
      }
    }

    const maxSpeedNormal = params.cellMaxSpeed;
    const maxSpeedForced = 6.0;
    const brakeRadius = params.cellBrakeRadius;
    const wanderStrengthNormal = params.cellWanderStrength;
    const wanderStrengthForced = 1.5;
    const painStrength = params.cellPainFieldStrength * (1.0 - params.healingProgress);

    for (let i = this.cells.length - 1; i >= 0; i--) {
      const c = this.cells[i];
      c.life -= dt;
      c.isForced = isGlobalForced;

      if (c.life <= 0) {
        this.cells.splice(i, 1);
        continue;
      }

      const maxSpeed = c.isForced ? maxSpeedForced : maxSpeedNormal;
      const wanderStrength = c.isForced ? wanderStrengthForced : wanderStrengthNormal;

      // 1. ARRIVE STEERING FORCE
      const dx = c.target.x - c.x;
      const dy = c.target.y - c.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      let desiredVx = 0;
      let desiredVy = 0;
      if (dist > 1e-4) {
        const speed = dist < brakeRadius ? maxSpeed * (dist / brakeRadius) : maxSpeed;
        desiredVx = (dx / dist) * speed;
        desiredVy = (dy / dist) * speed;
      }
      const steerArriveX = desiredVx - c.vx;
      const steerArriveY = desiredVy - c.vy;

      // 2. WANDER STEERING FORCE
      c.wanderAngle += (Math.random() - 0.5) * 0.75;
      const wanderCircleRadius = 15.0;
      const wanderCircleDist = 25.0;
      const heading = Math.atan2(c.vy, c.vx) || 0;
      const circleCenterX = c.x + Math.cos(heading) * wanderCircleDist;
      const circleCenterY = c.y + Math.sin(heading) * wanderCircleDist;
      const wanderTargetX = circleCenterX + Math.cos(c.wanderAngle) * wanderCircleRadius;
      const wanderTargetY = circleCenterY + Math.sin(c.wanderAngle) * wanderCircleRadius;
      const steerWanderX = (wanderTargetX - c.x) * 0.1;
      const steerWanderY = (wanderTargetY - c.y) * 0.1;

      // 3. CAMPO DE DOLOR (Gradiente del SDF hacia afuera)
      const grad = woundSystem.sampleGradient(c.x, c.y);
      let painFx = grad.gx * painStrength;
      let painFy = grad.gy * painStrength;

      // Durante clímax con Shift: añadir ruido curl al campo con amplitud 0.6
      if (params.isClimax) {
        const curl = curlNoise(c.x, c.y);
        painFx += curl.cx * 0.6;
        painFy += curl.cy * 0.6;
      }

      // FUERZA TOTAL
      const fx = steerArriveX * 1.0 + steerWanderX * wanderStrength + painFx;
      const fy = steerArriveY * 1.0 + steerWanderY * wanderStrength + painFy;

      // Integrar velocidad y posición
      c.vx += fx * (dt * 60.0);
      c.vy += fy * (dt * 60.0);

      const curSpeed = Math.sqrt(c.vx * c.vx + c.vy * c.vy);
      if (curSpeed > maxSpeed) {
        c.vx = (c.vx / curSpeed) * maxSpeed;
        c.vy = (c.vy / curSpeed) * maxSpeed;
      }

      c.x += c.vx * (dt * 60.0);
      c.y += c.vy * (dt * 60.0);

      // Evaluar SDF en la posición actual de la célula
      const sdf = woundSystem.sampleSDF(c.x, c.y);

      if (c.isForced) {
        // En modo forzado: restan 0.3 a tissueTrail por donde pasan, rasgando el tejido
        this.recentTears.push({ x: c.x, y: c.y });
      } else {
        // En modo normal: al entrar en la herida (woundSDF < 0), la célula desaparece
        // con un destello y se convierte en 1 agente dorado (especie 2)
        if (sdf < 0.0) {
          // Spark de llegada
          this.sparks.push({
            x: c.x,
            y: c.y,
            life: 0.35,
            maxLife: 0.35,
            tint: c.tint
          });

          // Nacimiento de 1 agente dorado
          if (this.onGoldAgentSpawnCallback) {
            this.onGoldAgentSpawnCallback(c.x, c.y);
          }

          this.cells.splice(i, 1);
        }
      }
    }
  }

  public clear() {
    this.cells = [];
    this.sparks = [];
    this.recentTears = [];
  }
}
