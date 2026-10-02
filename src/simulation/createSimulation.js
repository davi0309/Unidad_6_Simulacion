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
  // ESTADO DE AGENTES EN GPU (Buffers instanciados 3D) ------------------------
  const positionBuffer = instancedArray(count, 'vec3');
  const velocityBuffer = instancedArray(count, 'vec3');

  // INICIALIZACIÓN DE AGENTES DENTRO DE LA ESFERA 3D -------------------------
  const initParticles = Fn(() => {
    const i = instanceIndex;
    const p = positionBuffer.element(i);
    const v = velocityBuffer.element(i);

    const r1 = hash(i.add(uint(17)));
    const r2 = hash(i.add(uint(31)));
    const r3 = hash(i.add(uint(47)));
    const r4 = hash(i.add(uint(61)));

    // Distribución tridimensional dentro de la esfera
    const theta = r1.mul(6.2831853);
    const phi = asin(r2.mul(2.0).sub(1.0)); // Elevación uniforme en la esfera
    const rad = pow(r3, 0.45).mul(params.sphereRadius.mul(0.85)).add(0.15);

    const x = rad.mul(cos(phi)).mul(cos(theta));
    const y = rad.mul(cos(phi)).mul(sin(theta));
    const z = rad.mul(sin(phi));

    p.assign(vec3(x, y, z));

    // Velocidad tangencial suave 3D inicial
    const spd = params.initialSpeed.mul(r4.mul(0.4).add(0.8));
    v.assign(vec3(sin(theta).negate(), cos(theta), cos(phi.mul(2.0)).mul(0.3)).mul(spd));
  })().compute(count).setName('Init Agents 3D');

  // COMPUTE PASS: CAMPO DE FLUJO 3D, CONFINAMIENTO ESFÉRICO Y STEERING --------
  const updateParticles = Fn(() => {
    const i = instanceIndex;
    const p = positionBuffer.element(i);
    const v = velocityBuffer.element(i);

    const dt = params.dt.mul(params.timeScale);

    // Coordenadas esféricas y cilíndricas 3D percibidas por el agente
    const rSph = length(p).max(0.001);          // Distancia al centro de la esfera
    const rho = length(p.xy).max(0.001);        // Radio cilíndrico en plano XY
    const theta = atan(p.y, p.x);               // Ángulo azimutal
    const phi = atan(p.z, rho);                 // Ángulo de elevación

    // Vectores base en plano 2D radial y tangencial
    const radial = vec3(cos(theta), sin(theta), 0.0);
    const tangent = vec3(sin(theta).negate(), cos(theta), 0.0);

    // 1. GENERACIÓN DE CAMPOS DE FLUJO 3D POR ARQUETIPO ----------------------
    // Flow Field para Flor de Seda 3D (Arquetipo 0):
    // Los pétalos se pliegan y ondulan en el espacio tridimensional como un cáliz floral
    const harmFlower = sin(theta.mul(params.harmonics).add(params.seed));
    const zCup = harmFlower.mul(rho).mul(0.4).mul(params.petalMorph);
    const flowFlower = radial.mul(harmFlower.mul(params.petalMorph).mul(params.flowDirection))
      .add(tangent.mul(params.swirl.add(harmFlower.mul(0.35))))
      .add(vec3(0.0, 0.0, zCup.sub(p.z).mul(1.5)));

    // Flow Field para Alas Cósmicas 3D (Arquetipo 1):
    // Dos lóbulos orbitales tridimensionales con simetría bilateral (mariposa/Lorenz)
    const xSym = abs(p.x);
    const thetaWing = atan(p.y, xSym.sub(0.8));
    const rWing = length(vec2(xSym.sub(0.8), p.y)).max(0.001);
    const zWing = sin(thetaWing.mul(2.0)).mul(rWing).mul(0.55).mul(params.petalMorph);
    const flowWing = vec3(
      sin(thetaWing).negate().mul(sign(p.x)).mul(1.4),
      cos(thetaWing).mul(1.4),
      zWing.sub(p.z).mul(1.8)
    );

    // Flow Field para Vórtice Toroidal 3D (Arquetipo 2):
    // Circulación toroidal 3D (giro azimutal + rotación en el plano poloidal)
    const flowTorus = tangent.mul(params.swirl.mul(1.6))
      .add(vec3(0.0, 0.0, sin(rho.mul(1.1)).negate().mul(1.5)))
      .add(radial.mul(cos(p.z.mul(1.1)).mul(1.1)));

    // Flow Field para Supernova 3D (Arquetipo 3):
    // Expansión radial esférica con ondulación armónica tridimensional
    const sphHarm = sin(theta.mul(params.harmonics)).mul(cos(phi.mul(3.0)));
    const flowSupernova = normalize(p).mul(sphHarm.mul(params.petalMorph).add(1.2).mul(params.flowDirection))
      .add(tangent.mul(params.swirl.mul(0.5)));

    // Flow Field para Rayos Cáusticos 3D (Arquetipo 4):
    // Corrientes helicoidales que ascienden por el eje Z de la esfera
    const flowCaustic = vec3(
      sin(p.z.mul(1.4).add(theta)).negate().mul(0.9),
      cos(p.z.mul(1.4).add(theta)).mul(0.9),
      float(1.5).mul(params.flowDirection)
    );

    // Selección del campo 3D según params.symmetryType
    const flowField3D = flowFlower.toVar();
    If(params.symmetryType.equal(1.0), () => { flowField3D.assign(flowWing); });
    If(params.symmetryType.equal(2.0), () => { flowField3D.assign(flowTorus); });
    If(params.symmetryType.equal(3.0), () => { flowField3D.assign(flowSupernova); });
    If(params.symmetryType.equal(4.0), () => { flowField3D.assign(flowCaustic); });

    // Turbulencia curl 3D orgánica suave
    const curlX = sin(p.y.mul(1.2).add(params.seed)).add(cos(p.z.mul(0.9)));
    const curlY = cos(p.x.mul(1.2).add(params.seed)).negate().add(sin(p.z.mul(0.9)));
    const curlZ = sin(p.x.mul(0.9)).negate().add(cos(p.y.mul(0.9)));
    flowField3D.addAssign(vec3(curlX, curlY, curlZ).mul(params.curlStrength));

    // 2. CONFINAMIENTO DENTRO DE LA GRAN ESFERA 3D ----------------------------
    // Si el agente se acerca al borde de la esfera, una fuerza suave y elástica
    // lo devuelve hacia el interior, manteniéndolo siempre dentro de la esfera.
    const sphereRadius = params.sphereRadius;
    const outsideDist = rSph.sub(sphereRadius);
    const sphereNormal = normalize(p);
    const sphereContainmentForce = sphereNormal.mul(outsideDist.max(0.0).mul(-14.0));

    // 3. STEERING BEHAVIORS (CRAIG REYNOLDS) EN 3D ---------------------------
    // Velocidad deseada modulada por el multiplicador de velocidad
    const currentMaxSpeed = params.maxSpeed.mul(params.speedMultiplier);
    const desiredVelocity = normalize(flowField3D).mul(currentMaxSpeed);

    // Fuerza de maniobra
    const steerForce = desiredVelocity.sub(v);
    const steerLen = length(steerForce).max(0.001);
    const clampedSteer = steerForce.div(steerLen).mul(min(steerLen, params.steerStrength));

    const totalForce = clampedSteer.toVar();
    totalForce.addAssign(sphereContainmentForce);

    // Arrastre viscoso (Drag): F_drag = -c * v
    totalForce.addAssign(v.mul(params.dragCoefficient).negate());

    // Conducción manual con el puntero en 3D
    const toPointer = params.attractor.sub(p);
    const pointerDist = length(toPointer).max(0.3);
    const pointerDir = toPointer.div(pointerDist);
    totalForce.addAssign(pointerDir.mul(params.attractorStrength).div(pointerDist));

    // Acento manual de energía (Espacio)
    const userPulseForce = normalize(p).mul(params.userPulse.mul(7.0));
    totalForce.addAssign(userPulseForce);

    // 4. INTEGRACIÓN FÍSICA (Semi-implicit Euler) ----------------------------
    v.addAssign(totalForce.mul(dt));

    // Limitar a la velocidad máxima actual
    const curSpeed = length(v);
    If(curSpeed.greaterThan(currentMaxSpeed), () => {
      v.assign(v.normalize().mul(currentMaxSpeed));
    });

    p.addAssign(v.mul(dt));

    // Reciclaje si escapa accidentalmente de la esfera
    If(rSph.greaterThan(sphereRadius.mul(1.25)), () => {
      const respawnTheta = hash(i.add(uint(91))).mul(6.2831853);
      const respawnPhi = asin(hash(i.add(uint(93))).mul(2.0).sub(1.0));
      const respawnRad = hash(i.add(uint(97))).mul(0.65).add(0.1);
      p.assign(vec3(
        respawnRad.mul(cos(respawnPhi)).mul(cos(respawnTheta)),
        respawnRad.mul(cos(respawnPhi)).mul(sin(respawnTheta)),
        respawnRad.mul(sin(respawnPhi))
      ));
      v.assign(vec3(sin(respawnTheta).negate(), cos(respawnTheta), 0.0).mul(params.initialSpeed));
    });
  })().compute(count).setName('Update Agents 3D');

  // RENDER PASS: FILAMENTOS ORIENTADOS EN EL ESPACIO DE VISTA ----------------
  const material = new THREE.SpriteNodeMaterial({
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true
  });

  material.positionNode = positionBuffer.toAttribute();

  // Transformar la velocidad 3D al espacio de vista de la cámara
  // para que el filamento se alinee con su dirección aparente en pantalla
  const vAttr = velocityBuffer.toAttribute();
  const vView = modelViewMatrix.mul(vec4(vAttr, 0.0)).xy;
  material.rotationNode = atan(vView.y, vView.x);

  // Elongación nítida del filamento
  material.scaleNode = Fn(() => {
    const spdView = length(vView);
    // Longitud proporcional al movimiento proyectado
    const len = params.lineLength.mul(spdView.clamp(0.15, 2.5));
    return vec2(len, params.lineWidth);
  })();

  // Dispersión cromática y brillo reactivo al audio
  material.colorNode = Fn(() => {
    const spd = length(vAttr);
    const pAttr = positionBuffer.toAttribute();
    const rDist = length(pAttr).mul(0.1);
    const ang = atan(vView.y, vView.x).div(6.2831853).add(0.5);

    const t = ang.add(rDist).add(params.chromaShift).add(params.audioShimmer.mul(0.2));

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

    // Fulgor y saturación central
    const audioLuminance = params.audioGlow.mul(0.8);
    const coreGlow = spd.div(params.maxSpeed.mul(params.speedMultiplier).max(0.1)).pow(1.8).mul(0.65).add(audioLuminance);
    const finalCol = mix(baseCol, vec3(1.0, 1.0, 1.0), coreGlow.clamp(0.0, 0.95));

    const brightness = float(1.0).add(params.audioGlow.mul(0.5));
    return vec4(finalCol.mul(brightness), 1.0);
  })();

  // Perfil elíptico de opacidad
  material.opacityNode = Fn(() => {
    const coords = uv().sub(0.5);
    const ellipseDist = coords.x.mul(coords.x).mul(1.4).add(coords.y.mul(coords.y).mul(4.5));
    const baseOpacity = float(1.0).sub(ellipseDist.mul(1.7)).clamp(0.0, 1.0).pow(1.5);
    return baseOpacity.mul(float(0.9).add(params.audioGlow.mul(0.3)));
  })();

  const geometry = new THREE.PlaneGeometry(1, 1);
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.frustumCulled = false;
  scene.add(mesh);

  // Representación visual sutil del contorno de la esfera contenedora en modo LAB
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
    reset,
    resetVisuals,
    stepSimulation,
    setSphereHelperVisible,
    dispose
  };
}
