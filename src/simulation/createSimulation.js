import * as THREE from 'three/webgpu';
import {
  Fn,
  If,
  abs,
  atan,
  clamp,
  color,
  cos,
  float,
  hash,
  instanceIndex,
  instancedArray,
  length,
  max,
  min,
  mix,
  mod,
  normalize,
  pow,
  sign,
  sin,
  uint,
  uv,
  vec2,
  vec3,
  vec4
} from 'three/tsl';

export function createSimulation({ renderer, scene, params, count = 131072 }) {
  // ESTADO DE AGENTES EN GPU (Buffers instanciados) --------------------------
  const positionBuffer = instancedArray(count, 'vec3');
  const velocityBuffer = instancedArray(count, 'vec3');

  // INICIALIZACIÓN DE AGENTES -----------------------------------------------
  const initParticles = Fn(() => {
    const i = instanceIndex;
    const p = positionBuffer.element(i);
    const v = velocityBuffer.element(i);

    const r1 = hash(i.add(uint(17)));
    const r2 = hash(i.add(uint(31)));
    const r3 = hash(i.add(uint(47)));
    const r4 = hash(i.add(uint(61)));

    // Distribución armónica inicial para que emerjan las líneas de flujo
    const angle = r1.mul(6.2831853);
    const radius = pow(r2, 0.65).mul(4.0).add(0.08);

    const x = cos(angle).mul(radius);
    const y = sin(angle).mul(radius);
    const z = r3.sub(0.5).mul(0.2);

    p.assign(vec3(x, y, z));

    const speed = params.initialSpeed.mul(r4.mul(0.5).add(0.75));
    v.assign(vec3(sin(angle).negate(), cos(angle), 0.0).mul(speed));
  })().compute(count).setName('Init Agents');

  // COMPUTE PASS: CAMPO DE FLUJO Y STEERING CONDUCIDO POR EL INTÉRPRETE ------
  // IMPORTANTE: El movimiento y las fuerzas físicas son 100% decididos
  // por el usuario y los parámetros del instrumento. El audio NO mueve las partículas.
  const updateParticles = Fn(() => {
    const i = instanceIndex;
    const p = positionBuffer.element(i);
    const v = velocityBuffer.element(i);

    const dt = params.dt.mul(params.timeScale);

    // Coordenadas polares percibidas por el agente autónomo
    const r = length(p.xy).max(0.001);
    const theta = atan(p.y, p.x);

    // 1. Simetría y armónicos del campo (Flor vs Alas vs Vórtice)
    const thetaWing = atan(p.y, abs(p.x).sub(0.6).max(0.001));
    const isWing = params.symmetryType.greaterThan(0.5).and(params.symmetryType.lessThan(1.5));
    const effTheta = isWing.select(thetaWing, theta);

    // Ondulación armónica de los pétalos/alas fijada por el intérprete
    const harm = sin(effTheta.mul(params.harmonics).add(params.seed));
    const dynHarm = harm.mul(params.petalMorph);

    // Vectores base en plano 2D: radial y tangencial
    const radial = vec3(cos(theta), sin(theta), 0.0);
    const tangent = vec3(sin(theta).negate(), cos(theta), 0.0);

    // Campo de flujo armónico (Flow Field)
    const flowRadial = radial.mul(dynHarm.mul(params.flowDirection));
    const flowSwirl = tangent.mul(params.swirl.add(dynHarm.mul(0.35)));

    // Turbulencia curl orgánica suave (filamentos de seda)
    const curlX = sin(p.y.mul(1.2).add(params.seed)).add(cos(p.x.mul(0.8)));
    const curlY = cos(p.x.mul(1.2).add(params.seed)).negate().add(sin(p.y.mul(0.8)));
    const curlVec = vec3(curlX, curlY, 0.0).mul(params.curlStrength);

    // Vector objetivo del campo de flujo
    const flowField = flowRadial.add(flowSwirl).add(curlVec);

    // 2. Craig Reynolds Steering Behavior:
    // Desired Velocity: vector deseado según el campo de flujo
    const desiredSpeed = params.maxSpeed;
    const desiredVelocity = normalize(flowField).mul(desiredSpeed);

    // Fuerza de maniobra calculada por el agente autónomo
    const steerForce = desiredVelocity.sub(v);
    const steerLen = length(steerForce).max(0.001);
    const clampedSteer = steerForce.div(steerLen).mul(min(steerLen, params.steerStrength));

    // Fuerza resultante total
    const totalForce = clampedSteer.toVar();

    // Fuerza de arrastre viscoso (Drag): F_drag = -c * v
    totalForce.addAssign(v.mul(params.dragCoefficient).negate());

    // Interacción manual en vivo: Conducción con el ratón / gestos
    const toPointer = params.attractor.sub(p);
    const pointerDist = length(toPointer).max(0.3);
    const pointerDir = toPointer.div(pointerDist);
    totalForce.addAssign(pointerDir.mul(params.attractorStrength).div(pointerDist));

    // Acento manual del intérprete (Barra Espaciadora: onda de choque física)
    const userPulseForce = normalize(p.xy).mul(params.userPulse.mul(7.0));
    totalForce.addAssign(vec3(userPulseForce.x, userPulseForce.y, 0.0));

    // 3. Integración física (Euler semi-implícito)
    v.addAssign(totalForce.mul(dt));

    // Limitación de velocidad máxima
    const curSpeed = length(v);
    If(curSpeed.greaterThan(params.maxSpeed), () => {
      v.assign(v.normalize().mul(params.maxSpeed));
    });

    p.addAssign(v.mul(dt));

    // Reciclaje suave continuo de agentes al salir de los límites
    const maxBound = params.boundsSize.mul(0.5);
    const tooFar = r.greaterThan(maxBound).or(abs(p.x).greaterThan(maxBound)).or(abs(p.y).greaterThan(maxBound));

    If(tooFar, () => {
      const respawnAngle = hash(i.add(uint(91))).mul(6.2831853);
      const respawnRadius = hash(i.add(uint(97))).mul(0.65).add(0.05);
      p.assign(vec3(cos(respawnAngle).mul(respawnRadius), sin(respawnAngle).mul(respawnRadius), 0.0));
      v.assign(vec3(sin(respawnAngle).negate(), cos(respawnAngle), 0.0).mul(params.initialSpeed));
    });
  })().compute(count).setName('Update Agents');

  // RENDER PASS: FILAMENTOS ORIENTADOS CON BRILLO MODULADO POR AUDIO ----------
  // Aquí es donde el audio interviene de manera puramente visual:
  // modificando el brillo, fulgor y destellos de color sin mover las partículas.
  const material = new THREE.SpriteNodeMaterial({
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true
  });

  material.positionNode = positionBuffer.toAttribute();

  // 1. Orientación del filamento: alineado con la velocidad del agente
  const vAttr = velocityBuffer.toAttribute();
  material.rotationNode = atan(vAttr.y, vAttr.x);

  // 2. Elongación en forma de filamento fino
  material.scaleNode = Fn(() => {
    const spd = length(vAttr);
    const len = params.lineLength.mul(spd.clamp(0.2, 3.0));
    return vec2(len, params.lineWidth);
  })();

  // 3. Dispersión cromática y brillo reactivo al audio
  material.colorNode = Fn(() => {
    const spd = length(vAttr);
    const pAttr = positionBuffer.toAttribute();
    const ang = atan(vAttr.y, vAttr.x).div(6.2831853).add(0.5);
    const rDist = length(pAttr.xy).mul(0.12);

    // Fase espectral con destello sutil del audio
    const t = ang.add(rDist).add(params.chromaShift).add(params.audioShimmer.mul(0.2));

    // Paletas cosenoidales
    const c0 = cos(t.mul(6.2831853).add(vec3(0.0, 2.094, 4.188))).mul(0.5).add(0.5);
    const c1 = cos(t.mul(6.2831853).add(vec3(0.5, 0.2, 0.9))).mul(0.45).add(0.55);
    const c2 = vec3(
      cos(t.mul(4.0)).mul(0.4).add(0.6),
      cos(t.mul(4.0).add(1.0)).mul(0.3).add(0.4),
      cos(t.mul(4.0).add(2.0)).mul(0.2).add(0.15)
    );
    const c3 = vec3(
      cos(t.mul(5.0).add(0.2)).mul(0.45).add(0.5),
      cos(t.mul(5.0).add(2.2)).mul(0.25).add(0.3),
      cos(t.mul(5.0).add(4.0)).mul(0.5).add(0.5)
    );
    const c4 = vec3(
      cos(t.mul(6.0).add(3.0)).mul(0.25).add(0.2),
      cos(t.mul(6.0).add(1.0)).mul(0.45).add(0.55),
      cos(t.mul(6.0)).mul(0.4).add(0.6)
    );

    const baseCol = c0.toVar();
    If(params.paletteId.equal(1.0), () => { baseCol.assign(c1); });
    If(params.paletteId.equal(2.0), () => { baseCol.assign(c2); });
    If(params.paletteId.equal(3.0), () => { baseCol.assign(c3); });
    If(params.paletteId.equal(4.0), () => { baseCol.assign(c4); });

    // Modulación de fulgor/brillo por la música:
    // El audio incrementa el resplandor blanco y la intensidad luminosa
    const audioLuminance = params.audioGlow.mul(0.75);
    const coreGlow = spd.div(params.maxSpeed).pow(2.0).mul(0.6).add(audioLuminance);
    const finalCol = mix(baseCol, vec3(1.0, 1.0, 1.0), coreGlow.clamp(0.0, 0.95));

    // Multiplicador de brillo general modulado sutilmente por la música
    const brightness = float(1.0).add(params.audioGlow.mul(0.6));
    return vec4(finalCol.mul(brightness), 1.0);
  })();

  // 4. Perfil elíptico suave para unir los filamentos en velos de seda
  material.opacityNode = Fn(() => {
    const coords = uv().sub(0.5);
    const ellipseDist = coords.x.mul(coords.x).mul(1.5).add(coords.y.mul(coords.y).mul(5.0));
    // Suavizado con opacidad sensible al brillo musical
    const baseOpacity = float(1.0).sub(ellipseDist.mul(1.8)).clamp(0.0, 1.0).pow(1.6);
    return baseOpacity.mul(float(0.85).add(params.audioGlow.mul(0.35)));
  })();

  const geometry = new THREE.PlaneGeometry(1, 1);
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.frustumCulled = false;
  scene.add(mesh);

  function reset() {
    renderer.compute(initParticles);
  }

  function resetVisuals() {
    params.seed.value = Math.random() * 100.0;
    renderer.compute(initParticles);
  }

  function stepSimulation() {
    renderer.compute(updateParticles);
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
    scene.remove(mesh);
  }

  return {
    count,
    positionBuffer,
    velocityBuffer,
    reset,
    resetVisuals,
    stepSimulation,
    dispose
  };
}
