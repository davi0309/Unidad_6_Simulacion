import * as THREE from 'three/webgpu';
import {
  Fn,
  If,
  abs,
  asin,
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
  modelViewMatrix,
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
  // ESTADO DE AGENTES EN GPU (Posición, Velocidad y Ciclo de Vida 3D) ----------
  const positionBuffer = instancedArray(count, 'vec3');
  const velocityBuffer = instancedArray(count, 'vec3');
  const lifeBuffer = instancedArray(count, 'vec2'); // x = vida actual, y = vida máxima

  // INICIALIZACIÓN: FUENTE VIVA DE FILAMENTOS EN LA ESFERA 3D ----------------
  const initParticles = Fn(() => {
    const i = instanceIndex;
    const p = positionBuffer.element(i);
    const v = velocityBuffer.element(i);
    const l = lifeBuffer.element(i);

    const r1 = hash(i.add(uint(17)));
    const r2 = hash(i.add(uint(31)));
    const r3 = hash(i.add(uint(47)));
    const r4 = hash(i.add(uint(61)));
    const r5 = hash(i.add(uint(79)));

    // Distribución tridimensional amplia en capas concéntricas
    const theta = r1.mul(6.2831853);
    const phi = asin(r2.mul(2.0).sub(1.0));
    const rad = pow(r3, 0.65).mul(params.sphereRadius.mul(0.85)).add(0.25);

    p.assign(vec3(
      rad.mul(cos(phi)).mul(cos(theta)),
      rad.mul(cos(phi)).mul(sin(theta)),
      rad.mul(sin(phi))
    ));

    const spd = params.initialSpeed.mul(r4.mul(0.4).add(0.8));
    v.assign(vec3(sin(theta).negate(), cos(theta), cos(phi.mul(2.5)).mul(0.3)).mul(spd));

    // Vida útil desfasada (de 4 a 9 segundos) para renovación continua
    const maxLife = float(4.5).add(r5.mul(4.5));
    const curLife = r1.mul(maxLife);
    l.assign(vec2(curLife, maxLife));
  })().compute(count).setName('Init Agents 3D');

  // COMPUTE PASS: MOVIMIENTO AMPLIO, MULTICAPA Y FLUJO NO REPETITIVO ---------
  const updateParticles = Fn(() => {
    const i = instanceIndex;
    const p = positionBuffer.element(i);
    const v = velocityBuffer.element(i);
    const l = lifeBuffer.element(i);

    const dt = params.dt.mul(params.timeScale);

    l.x.subAssign(dt);

    // Identidad y capa espacial de cada agente para evitar colapso a una línea
    const agentLayer = hash(i.add(uint(103))).sub(0.5).mul(2.0); // [-1.0 a 1.0]
    const agentPhase = hash(i.add(uint(149))).sub(0.5).mul(1.5);
    const agentZOffset = hash(i.add(uint(197))).sub(0.5).mul(2.0);

    // Coordenadas esféricas y cilíndricas 3D
    const rSph = length(p).max(0.001);          // Radio esférico 3D
    const rho = length(p.xy).max(0.001);        // Radio plano XY
    const theta = atan(p.y, p.x);               // Ángulo azimutal
    const phi = atan(p.z, rho);                 // Ángulo de elevación

    const radial = vec3(cos(theta), sin(theta), 0.0);
    const tangent = vec3(sin(theta).negate(), cos(theta), 0.0);

    // 1. CAMPOS DE FLUJO 3D MULTICAPA ----------------------------------------

    // ARQUETIPO 0: Flor de Seda 3D (Cáliz floral con pétalos en capas)
    const effThetaFlower = theta.add(agentPhase.mul(0.25));
    const harmFlower = sin(effThetaFlower.mul(params.harmonics).add(params.seed));
    const zPetalTarget = harmFlower.mul(rho).mul(0.38).mul(params.petalMorph).add(agentZOffset.mul(0.8));
    const flowFlower = radial.mul(harmFlower.mul(params.petalMorph).mul(params.flowDirection).add(0.4))
      .add(tangent.mul(params.swirl.add(harmFlower.mul(0.3)).add(agentLayer.mul(0.3))))
      .add(vec3(0.0, 0.0, zPetalTarget.sub(p.z).mul(1.2)));

    // ARQUETIPO 1: Alas Cósmicas 3D (Mariposa / Lorenz)
    const xSym = abs(p.x);
    const wingOriginX = float(1.4).add(agentLayer.mul(0.6));
    const thetaWing = atan(p.y, xSym.sub(wingOriginX));
    const rWing = length(vec2(xSym.sub(wingOriginX), p.y)).max(0.001);
    const zWingTarget = sin(thetaWing.mul(2.0)).mul(rWing).mul(0.45).mul(params.petalMorph).add(agentZOffset.mul(0.7));
    const flowWing = vec3(
      sin(thetaWing).negate().mul(sign(p.x)).mul(1.3),
      cos(thetaWing).mul(1.3),
      zWingTarget.sub(p.z).mul(1.4)
    );

    // ARQUETIPO 2: Vórtice Toroidal 3D (Toroide ancho con circulación interna)
    const tubeRadius = float(2.6).add(agentLayer.mul(1.2));
    const poloidalAngle = atan(p.z, rho.sub(tubeRadius));
    const flowTorus = tangent.mul(params.swirl.mul(1.4))
      .add(radial.mul(sin(poloidalAngle).negate().mul(1.1)))
      .add(vec3(0.0, 0.0, cos(poloidalAngle).mul(1.1)));

    // ARQUETIPO 3: Supernova Esférica 3D (Estallido radial por toda la esfera)
    const sphHarm = sin(theta.mul(params.harmonics).add(agentPhase)).mul(cos(phi.mul(3.0)));
    const flowSupernova = normalize(p).mul(sphHarm.mul(params.petalMorph).add(1.3).mul(params.flowDirection))
      .add(tangent.mul(params.swirl.mul(0.5).add(agentLayer.mul(0.3))));

    // ARQUETIPO 4: Rayos Helicoidales 3D (Columnas de luz cáustica)
    const helixRadius = float(2.2).add(agentLayer.mul(1.4));
    const flowCaustic = vec3(
      sin(p.z.mul(1.1).add(theta)).negate().mul(1.0),
      cos(p.z.mul(1.1).add(theta)).mul(1.0),
      float(1.3).mul(params.flowDirection)
    ).add(radial.mul(helixRadius.sub(rho).mul(0.4)));

    // Selección de campo
    const flowField3D = flowFlower.toVar();
    If(params.symmetryType.equal(1.0), () => { flowField3D.assign(flowWing); });
    If(params.symmetryType.equal(2.0), () => { flowField3D.assign(flowTorus); });
    If(params.symmetryType.equal(3.0), () => { flowField3D.assign(flowSupernova); });
    If(params.symmetryType.equal(4.0), () => { flowField3D.assign(flowCaustic); });

    // 2. TURBULENCIA CURL 3D (Divergence-free = Mantiene volumen amplio y no colapsa)
    const noiseScale = 0.45;
    const curlX = sin(p.y.mul(noiseScale).add(params.seed)).add(cos(p.z.mul(noiseScale).mul(0.8)));
    const curlY = cos(p.x.mul(noiseScale).add(params.seed)).negate().add(sin(p.z.mul(noiseScale).mul(0.8)));
    const curlZ = sin(p.x.mul(noiseScale).mul(0.8)).negate().add(cos(p.y.mul(noiseScale).mul(0.8)));
    flowField3D.addAssign(vec3(curlX, curlY, curlZ).mul(params.curlStrength));

    // Separación volumétrica permanente entre capas
    const spreadVec = vec3(
      cos(theta.add(1.57)).mul(agentLayer),
      sin(theta.add(1.57)).mul(agentLayer),
      agentZOffset
    ).mul(0.35);
    flowField3D.addAssign(spreadVec);

    // 3. CONFINAMIENTO DENTRO DE LA GRAN ESFERA 3D ----------------------------
    const sphereRadius = params.sphereRadius;
    const outsideDist = rSph.sub(sphereRadius);
    const sphereNormal = normalize(p);
    const sphereContainmentForce = sphereNormal.mul(outsideDist.max(0.0).mul(-15.0));

    // 4. STEERING BEHAVIORS (CRAIG REYNOLDS) EN 3D ---------------------------
    const currentMaxSpeed = params.maxSpeed.mul(params.speedMultiplier);
    const desiredVelocity = normalize(flowField3D).mul(currentMaxSpeed);

    const steerForce = desiredVelocity.sub(v);
    const steerLen = length(steerForce).max(0.001);
    const clampedSteer = steerForce.div(steerLen).mul(min(steerLen, params.steerStrength));

    const totalForce = clampedSteer.toVar();
    totalForce.addAssign(sphereContainmentForce);
    totalForce.addAssign(v.mul(params.dragCoefficient).negate());

    // Conductor manual con el puntero
    const toPointer = params.attractor.sub(p);
    const pointerDist = length(toPointer).max(0.3);
    const pointerDir = toPointer.div(pointerDist);
    totalForce.addAssign(pointerDir.mul(params.attractorStrength).div(pointerDist));

    // Acento manual de energía (Espacio)
    const userPulseForce = normalize(p).mul(params.userPulse.mul(6.5));
    totalForce.addAssign(userPulseForce);

    // 5. INTEGRACIÓN FÍSICA (Semi-implicit Euler) ----------------------------
    v.addAssign(totalForce.mul(dt));

    const curSpeed = length(v);
    If(curSpeed.greaterThan(currentMaxSpeed), () => {
      v.assign(v.normalize().mul(currentMaxSpeed));
    });

    p.addAssign(v.mul(dt));

    // 6. RENOVACIÓN CONTINUA DE AGENTES (Respawn tipo fuente viva) ------------
    const expired = l.x.lessThanEqual(0.0).or(rSph.greaterThan(sphereRadius.mul(1.15)));
    If(expired, () => {
      const respawnTheta = hash(i.add(uint(91))).mul(6.2831853);
      const respawnPhi = asin(hash(i.add(uint(93))).mul(2.0).sub(1.0));
      const respawnRad = hash(i.add(uint(97))).mul(0.9).add(0.2);
      p.assign(vec3(
        respawnRad.mul(cos(respawnPhi)).mul(cos(respawnTheta)),
        respawnRad.mul(cos(respawnPhi)).mul(sin(respawnTheta)),
        respawnRad.mul(sin(respawnPhi))
      ));
      v.assign(vec3(sin(respawnTheta).negate(), cos(respawnTheta), 0.0).mul(params.initialSpeed));
      l.x.assign(l.y);
    });
  })().compute(count).setName('Update Agents 3D');

  // RENDER PASS: COLORES PUROS VIBRANTES (SIN QUEMADO BLANCO) ----------------
  const material = new THREE.SpriteNodeMaterial({
    blending: THREE.NormalBlending,
    depthWrite: false,
    transparent: true
  });

  material.positionNode = positionBuffer.toAttribute();

  const vAttr = velocityBuffer.toAttribute();
  const vView = modelViewMatrix.mul(vec4(vAttr, 0.0)).xy;
  material.rotationNode = atan(vView.y, vView.x);

  material.scaleNode = Fn(() => {
    const spdView = length(vView);
    const len = params.lineLength.mul(spdView.clamp(0.12, 2.8));
    return vec2(len, params.lineWidth);
  })();

  // COLOR ESPECTRAL 100% PURO:
  // La música SOLO cambia la paleta espectral.
  // NO hay modificadores de brillo, ni multiplicadores de volumen, ni blanco.
  material.colorNode = Fn(() => {
    const pAttr = positionBuffer.toAttribute();
    const rDist = length(pAttr).mul(0.12);
    const ang = atan(vView.y, vView.x).div(6.2831853).add(0.5);

    const t = ang.add(rDist).add(params.chromaShift);

    // Paleta 0: Prisma Espectral Arcoíris Puro (Cian, Violeta, Naranja, Esmeralda)
    const c0 = cos(t.mul(6.2831853).add(vec3(0.0, 2.094, 4.188))).mul(0.5).add(0.5);

    // Paleta 1: Seda Ópalo y Amatista (Turquesa intenso, magenta vivo, violeta y rosa)
    const c1 = cos(t.mul(6.2831853).add(vec3(0.8, 0.1, 0.9))).mul(0.5).add(0.5);

    // Paleta 2: Fuego Dorado y Ámbar (Rojo rubí, naranja fuego, oro cálido)
    const c2 = vec3(
      cos(t.mul(4.0)).mul(0.48).add(0.52),
      cos(t.mul(4.0).add(1.2)).mul(0.38).add(0.42),
      cos(t.mul(4.0).add(2.4)).mul(0.15)
    );

    // Paleta 3: Neón Lavanda / Mariposa (Azul cobalto profundo, violeta eléctrico, rosa neón)
    const c3 = vec3(
      cos(t.mul(5.0).add(0.2)).mul(0.48).add(0.52),
      cos(t.mul(5.0).add(2.0)).mul(0.15).add(0.1),
      cos(t.mul(5.0).add(4.0)).mul(0.5).add(0.5)
    );

    // Paleta 4: Azul Cian y Océano Profundo (Azul marino puro, cian eléctrico, esmeralda)
    const c4 = vec3(
      cos(t.mul(6.0).add(3.0)).mul(0.1),
      cos(t.mul(6.0).add(1.0)).mul(0.45).add(0.55),
      cos(t.mul(6.0)).mul(0.45).add(0.55)
    );

    // Selección de la paleta dictada por la etapa de la música o el intérprete
    const palIdx = floor(params.paletteId.add(0.5));
    const finalCol = c0.toVar();
    If(palIdx.equal(1.0), () => { finalCol.assign(c1); });
    If(palIdx.equal(2.0), () => { finalCol.assign(c2); });
    If(palIdx.equal(3.0), () => { finalCol.assign(c3); });
    If(palIdx.equal(4.0), () => { finalCol.assign(c4); });

    return vec4(finalCol, 1.0);
  })();

  // OPACIDAD DE SEDA TRANSLÚCIDA CALIBRADA (Cero adición a blanco)
  material.opacityNode = Fn(() => {
    const coords = uv().sub(0.5);
    const ellipseDist = coords.x.mul(coords.x).mul(1.3).add(coords.y.mul(coords.y).mul(4.0));
    const lineFalloff = float(1.0).sub(ellipseDist.mul(1.6)).clamp(0.0, 1.0).pow(1.5);
    return lineFalloff.mul(params.filamentAlpha);
  })();

  const geometry = new THREE.PlaneGeometry(1, 1);
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.frustumCulled = false;
  scene.add(mesh);

  // Malla sutil de referencia de la esfera en modo LAB
  const sphereWireframe = new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 24),
    new THREE.MeshBasicMaterial({
      color: 0x388bfd,
      wireframe: true,
      transparent: true,
      opacity: 0.08
    })
  );
  sphereWireframe.scale.setScalar(params.sphereRadius.value);
  scene.add(sphereWireframe);

  function reset() {
    renderer.compute(initParticles);
  }

  function resetVisuals() {
    params.seed.value = Math.random() * 100.0;
    renderer.compute(initParticles);
  }

  function stepSimulation() {
    sphereWireframe.scale.setScalar(params.sphereRadius.value);
    renderer.compute(updateParticles);
  }

  function setSphereHelperVisible(visible) {
    sphereWireframe.visible = visible;
  }

  function setBlendingMode(modeName) {
    if (modeName === 'additive') {
      material.blending = THREE.AdditiveBlending;
    } else {
      material.blending = THREE.NormalBlending;
    }
    material.needsUpdate = true;
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
    sphereWireframe.geometry.dispose();
    sphereWireframe.material.dispose();
    scene.remove(mesh);
    scene.remove(sphereWireframe);
  }

  return {
    count,
    positionBuffer,
    velocityBuffer,
    lifeBuffer,
    reset,
    resetVisuals,
    stepSimulation,
    setSphereHelperVisible,
    setBlendingMode,
    dispose
  };
}
