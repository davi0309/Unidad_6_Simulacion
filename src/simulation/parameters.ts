/**
 * parameters.ts
 * Estado y parámetros centrales para el instrumento visual "Heal".
 */

export interface HealParameters {
  // Estado dinámico
  healingProgress: number; // 0..1
  stress: number;          // decae 0.4/s, >1 activa modo forzado y microfracturas
  isSustain: boolean;      // Espacio mantenido
  isClimax: boolean;       // Shift mantenido
  climaxIntensity: number; // 0..1 con rampa de 1.5s
  heartbeatFlash: number;  // destello global +6% que decae en 300ms

  // Conteo de agentes
  tissueCount: number;     // 1.000.000 (o 300.000 en fallback)
  goldPoolMax: number;     // 200.000
  cellPoolMax: number;     // 4.000

  // Tejido (Especie 1)
  tissueSensorAngle: number;
  tissueSensorDist: number;
  tissueTurnAngle: number;
  tissueStep: number;
  tissueDeposit: number;
  tissueDecay: number;

  // Oro (Especie 2)
  goldSensorAngle: number;
  goldSensorDist: number;
  goldTurnAngle: number;
  goldStep: number;
  goldDeposit: number;
  goldDecay: number;
  goldLifeNormal: number;
  goldLifeSustain: number;

  // Células sanadoras (Steering Reynolds)
  cellMaxSpeed: number;
  cellBrakeRadius: number;
  cellWanderStrength: number;
  cellPainFieldStrength: number;
  cellLifeMax: number;

  // Visuales y Post-proceso
  bloomThreshold: number;
  bloomStrength: number;
  filmGrain: number;
  vignette: number;
  zoom: number;            // 1.0 inicial -> 0.35 al presionar Enter
  isFinalZooming: boolean;
  finalZoomProgress: number;
}

export function createDefaultParameters(): HealParameters {
  return {
    healingProgress: 0.0,
    stress: 0.0,
    isSustain: false,
    isClimax: false,
    climaxIntensity: 0.0,
    heartbeatFlash: 0.0,

    tissueCount: 1000000,
    goldPoolMax: 200000,
    cellPoolMax: 4000,

    // Valores iniciales (Herido: healingProgress = 0.0)
    tissueSensorAngle: 35.0 * (Math.PI / 180.0),
    tissueSensorDist: 18.0,
    tissueTurnAngle: 40.0 * (Math.PI / 180.0),
    tissueStep: 1.0,
    tissueDeposit: 0.6,
    tissueDecay: 0.92,

    goldSensorAngle: 30.0 * (Math.PI / 180.0),
    goldSensorDist: 10.0,
    goldTurnAngle: 30.0 * (Math.PI / 180.0),
    goldStep: 1.1,
    goldDeposit: 0.25,
    goldDecay: 0.995,
    goldLifeNormal: 8.0,
    goldLifeSustain: 20.0,

    cellMaxSpeed: 1.8,
    cellBrakeRadius: 80.0,
    cellWanderStrength: 0.3,
    cellPainFieldStrength: 0.4,
    cellLifeMax: 6.0,

    bloomThreshold: 0.7,
    bloomStrength: 0.6,
    filmGrain: 0.04,
    vignette: 0.35,
    zoom: 1.0,
    isFinalZooming: false,
    finalZoomProgress: 0.0
  };
}

/**
 * Interpola suavemente los parámetros de Physarum del tejido en función de healingProgress:
 * Herido (0.0) -> Sanando (0.5) -> Cicatriz (1.0)
 */
export function updateTissueParameters(params: HealParameters) {
  const hp = Math.max(0.0, Math.min(1.0, params.healingProgress));

  let sensorAngleDeg = 35.0;
  let sensorDist = 18.0;
  let turnAngleDeg = 40.0;
  let step = 1.0;
  let deposit = 0.6;
  let decay = 0.92;

  if (hp <= 0.5) {
    const t = hp / 0.5;
    sensorAngleDeg = 35.0 + (25.0 - 35.0) * t;
    sensorDist = 18.0 + (12.0 - 18.0) * t;
    turnAngleDeg = 40.0 + (25.0 - 40.0) * t;
    step = 1.0 + (1.4 - 1.0) * t;
    deposit = 0.6 + (0.9 - 0.6) * t;
    decay = 0.92 + (0.95 - 0.92) * t;
  } else {
    const t = (hp - 0.5) / 0.5;
    sensorAngleDeg = 25.0 + (22.0 - 25.0) * t;
    sensorDist = 12.0 + (9.0 - 12.0) * t;
    turnAngleDeg = 25.0 + (18.0 - 25.0) * t;
    step = 1.4 + (1.2 - 1.4) * t;
    deposit = 0.9 + (1.0 - 0.9) * t;
    decay = 0.95 + (0.97 - 0.95) * t;
  }

  // Modificadores interactivos
  if (params.isSustain) {
    decay = Math.min(0.99, decay + 0.02);
  }
  if (params.isClimax) {
    deposit *= 1.5;
  }

  params.tissueSensorAngle = sensorAngleDeg * (Math.PI / 180.0);
  params.tissueSensorDist = sensorDist;
  params.tissueTurnAngle = turnAngleDeg * (Math.PI / 180.0);
  params.tissueStep = step;
  params.tissueDeposit = deposit;
  params.tissueDecay = decay;

  // Parámetros del oro
  params.goldDeposit = params.isClimax ? 0.25 * 3.0 : 0.25;
  params.goldDecay = params.isSustain ? 0.9995 : 0.995;
}
