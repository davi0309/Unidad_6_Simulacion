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
  cross,
  dot,
  floor,
  float,
  hash,
  instanceIndex,
  instancedArray,
  length,
  log,
  max,
  min,
  mix,
  modelViewMatrix,
  normalize,
  pow,
  round,
  sign,
  sin,
  smoothstep,
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

  // INICIALIZACIÓN: FUENTE VIVA DE FILAMENTOS EN TODA LA PANTALLA --------------
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

    // Distribución tridimensional amplia cubriendo toda la pantalla de borde a borde
    const theta = r1.mul(6.2831853);
    const rad = pow(r3, 0.55).mul(params.sphereRadius.mul(0.96)).add(0.2);
    const zSpread = r2.sub(0.5).mul(params.sphereRadius.mul(0.35));

    p.assign(vec3(
      rad.mul(cos(theta)),
      rad.mul(sin(theta)),
      zSpread
    ));

    const spd = params.initialSpeed.mul(r4.mul(0.5).add(0.75));
    v.assign(vec3(sin(theta).negate(), cos(theta), r2.sub(0.5).mul(0.3)).mul(spd));

    // Ciclo de vida orgánico (4 a 9 segundos) con desfasamiento continuo
    const maxLife = float(4.5).add(r5.mul(4.5));
    const curLife = r1.mul(maxLife);
    l.assign(vec2(curLife, maxLife));
  })().compute(count).setName('Init Agents Fullscreen');

  // COMPUTE PASS: PHYSARUM JEFF JONES + 36 POINTS + REACCIONES DE AUDIO --------
  const updateParticles = Fn(() => {
    const i = instanceIndex;
    const p = positionBuffer.element(i);
    const v = velocityBuffer.element(i);
    const l = lifeBuffer.element(i);

    const dt = params.dt.mul(params.timeScale);
    l.x.subAssign(dt);

    // Identidad y capa de cada agente (dispersión volumétrica permanente)
    const agentLayer = hash(i.add(uint(103))).sub(0.5).mul(2.0);
    const agentPhase = hash(i.add(uint(149))).sub(0.5).mul(1.5);
    const agentZOffset = hash(i.add(uint(197))).sub(0.5).mul(2.0);

    // Coordenadas espaciales cilíndricas y polares
    const rSph = length(p).max(0.001);
    const rho = length(p.xy).max(0.001);
    const theta = atan(p.y, p.x);

    const radial = vec3(cos(theta), sin(theta), 0.0);
    const tangent = vec3(sin(theta).negate(), cos(theta), 0.0);

    // =========================================================================
    // 5 CAMPOS DE FLUJO ARMÓNICOS (Inspirados en las 5 referencias visuales)
    // =========================================================================

    // ARQUETIPO 0 (Tecla 1 - Ref: media_1790970695936.png):
    // Sección Transversal Botánica Vascular (Tallo Acuático / Nelumbo / Equisetum)
    // 1. Núcleo medular central poroso (r < 1.9) con anillo circular doble
    // 2. 18 trabéculas / columnas radiales gruesas que irradian desde el núcleo
    // 3. 4 capas concéntricas de lagunas / alvéolos aéreos (células poligonales oscuras rodeadas de paredes brillantes)
    // 4. Corteza exterior festoneada y ondulada (scalloped perimeter con 12 lóbulos)
    const uTheta0 = cos(theta.mul(18.0));
    const bassPulse0 = params.audioBass.mul(0.45);
    const effRho0 = rho.sub(bassPulse0).max(0.001);
    const uRho0 = pow(effRho0.max(1.9).sub(1.9).div(7.5), 0.72).mul(12.566);

    // Perímetro festoneado y ondulado de la corteza exterior (12 lóbulos con micro-ondulaciones)
    const rCortex0 = float(9.4).add(cos(theta.mul(12.0)).mul(0.65)).add(sin(theta.mul(24.0)).mul(0.25));

    // Fuerzas hacia las paredes de las lagunas:
    // fTier0: atrae a los anillos concéntricos divisorios
    const fTier0 = radial.mul(sin(uRho0).mul(-1.5).mul(params.flowDirection));
    // fSpoke0: atrae a los 18 septos radiales (trabéculas)
    const fSpoke0 = tangent.mul(sin(theta.mul(18.0)).mul(-1.3));
    // fCirc0: circulación continua por los muros y canales vasculares
    const fCirc0 = tangent.mul(params.swirl.mul(1.15).add(0.55).add(uTheta0.mul(0.4)));

    // Núcleo medular interno (r < 1.9): micro-poros densos y vórtice suave
    const inCore0 = effRho0.lessThan(1.9);
    const fCore0 = tangent.mul(1.6).add(radial.mul(float(1.9).sub(effRho0).mul(2.2)));

    // Corteza exterior (r > rCortex0): contención estricta que traza el borde ondulado
    const fRim0 = radial.mul(effRho0.sub(rCortex0).max(0.0).mul(-7.0));
    const zCellular0 = vec3(0.0, 0.0, p.z.negate().mul(3.5));

    const flowCellular = inCore0.select(fCore0, fTier0.add(fSpoke0).add(fCirc0))
      .add(fRim0)
      .add(zCellular0);

    // ARQUETIPO 1 (Tecla 2 - Ref: media_1790969096547.png):
    // Iris Cósmico / Fingering Fúngico Espectral ("Weird Velocity Effect")
    // Pupila negra hueca central con fuerte repulsión + plumas radiales con 48 crenelaciones
    const pupilR = float(1.8).add(params.audioBass.mul(0.65));
    const inPupil = rho.lessThan(pupilR);
    const pupilRepel = radial.mul(pupilR.sub(rho).max(0.0).mul(6.0).add(inPupil.select(3.2, 0.0)));
    const fingerWave1 = cos(theta.mul(48.0).add(sin(rho.mul(2.8))));
    const fingerShear1 = sin(rho.mul(3.5).add(params.audioTreble.mul(3.5)));
    const plumeRadial1 = radial.mul(float(1.7).add(fingerWave1.mul(0.95)).add(params.audioEnergy.mul(1.3)));
    const plumeTangential1 = tangent.mul(params.swirl.mul(0.55).add(fingerShear1.mul(0.65)));
    const outerBrake1 = radial.mul(rho.sub(params.sphereRadius.mul(0.92)).max(0.0).mul(-4.5));
    const zIris1 = vec3(0.0, 0.0, p.z.negate().mul(1.7).add(fingerWave1.mul(0.25)));
    const flowIris = pupilRepel.add(plumeRadial1).add(plumeTangential1).add(outerBrake1).add(zIris1);

    // ARQUETIPO 2 (Tecla 3 - Ref: media_1790969148388.jpg):
    // Rosa Coralina Espiral / Pliegues 3D (Turbinaria Coral)
    // Espiral logarítmica con niveles superpuestos y 56 costillas radiales
    const logRho2 = log(rho.max(0.15));
    const coralSpiralCoord2 = theta.sub(logRho2.mul(1.75));
    const tierWave2 = sin(rho.mul(2.8).sub(coralSpiralCoord2));
    const ribWave2 = cos(coralSpiralCoord2.mul(56.0)).mul(0.22);
    const zTargetCoral2 = tierWave2.mul(float(1.25).add(params.audioMid.mul(0.85))).mul(smoothstep(0.4, 2.5, rho)).add(ribWave2);
    const coralRadial2 = radial.mul(tierWave2.mul(0.75).add(params.flowDirection.mul(0.4)));
    const coralTangent2 = tangent.mul(params.swirl.mul(1.15).add(0.65).add(params.audioMid.mul(0.5)));
    const coralZ2 = vec3(0.0, 0.0, zTargetCoral2.sub(p.z).mul(2.5));
    const flowCoral = coralRadial2.add(coralTangent2).add(coralZ2);

    // ARQUETIPO 3 (Tecla 4 - Ref: media_1790969169603.jpg):
    // Helecho Fractal / Nautilus Jade (Golden Spiral Fronds)
    // Espiral áurea con báculos enroscados auto-similares y ojo central de vórtice
    const fernCoord3 = theta.sub(log(rho.div(0.75).max(0.1)).mul(2.35));
    const frondWave3 = sin(fernCoord3.mul(14.0).add(theta.mul(2.0)));
    const tipRipple3 = cos(fernCoord3.mul(28.0).add(params.audioTreble.mul(4.0))).mul(0.3);
    const eyeSuction3 = float(-1.1).mul(smoothstep(1.3, 0.25, rho));
    const fernRadial3 = radial.mul(eyeSuction3.add(frondWave3.mul(0.7)).add(tipRipple3));
    const fernTangent3 = tangent.mul(params.swirl.mul(1.3).add(0.85).add(frondWave3.mul(0.4)));
    const zFern3 = vec3(0.0, 0.0, sin(fernCoord3.mul(3.0)).mul(0.45).sub(p.z.mul(1.8)));
    const flowFern = fernRadial3.add(fernTangent3).add(zFern3);

    // ARQUETIPO 4 (Tecla 5 - Ref: media_1790969193604.jpg):
    // "36 Points" Sage Jenson Espirografía Cromática RGB
    // 36 órbitas elípticas rotadas armónicamente con división cromática RGB
    const angle36_4 = theta.mul(36.0);
    const orbitOsc4 = sin(angle36_4);
    const spiroTangent4 = tangent.mul(float(1.9).add(params.audioEnergy.mul(0.85)).mul(params.swirl.mul(0.7).add(0.4)));
    const spiroRadial4 = radial.mul(orbitOsc4.mul(0.85).add(sin(rho.mul(1.8)).mul(0.35)));
    const zSpiro4 = vec3(0.0, 0.0, cos(theta.mul(18.0)).mul(0.3).sub(p.z.mul(1.6)));
    const flowSpirograph = spiroRadial4.add(spiroTangent4).add(zSpiro4);

    // =========================================================================
    // SENSOR DE CRESTA PHYSARUM (JEFF JONES 2010): 3 SENSORES (L / F / R)
    // =========================================================================
    const sampleRidge = (q, sId) => {
      const qRho = length(q).max(0.001);
      const qTheta = atan(q.y, q.x);

      // ARQUETIPO 0: Potencial escalar de paredes celulares y trabéculas botánicas
      const qEffRho0 = qRho.sub(params.audioBass.mul(0.45)).max(0.001);
      const qURho0 = pow(qEffRho0.max(1.9).sub(1.9).div(7.5), 0.72).mul(12.566);
      const qRCortex0 = float(9.4).add(cos(qTheta.mul(12.0)).mul(0.65));
      const sCore = float(1.0).div(qEffRho0.sub(1.9).abs().mul(4.0).add(1.0)).mul(1.5);
      const sRim = float(1.0).div(qEffRho0.sub(qRCortex0).abs().mul(4.0).add(1.0)).mul(1.4);
      const sSpokes = cos(qTheta.mul(18.0)).mul(0.6);
      const sTiers = cos(qURho0).mul(0.6);
      const sCavityWalls = sSpokes.add(sTiers)
        .mul(smoothstep(float(1.8), float(2.3), qEffRho0))
        .mul(smoothstep(qRCortex0.add(0.4), qRCortex0.sub(0.4), qEffRho0));
      const r0 = max(max(sCore, sRim), sCavityWalls.add(0.4));
      const r1 = cos(qTheta.mul(48.0).add(sin(qRho.mul(2.8)))).mul(0.5).add(sin(qRho.mul(1.8)).mul(0.5));
      const qLogRho = log(qRho.max(0.15));
      const qCoralCoord = qTheta.sub(qLogRho.mul(1.75));
      const r2 = sin(qRho.mul(2.8).sub(qCoralCoord)).mul(0.65).add(cos(qCoralCoord.mul(56.0)).mul(0.35));
      const qFernCoord = qTheta.sub(log(qRho.div(0.75).max(0.1)).mul(2.35));
      const r3 = sin(qFernCoord.mul(14.0).add(qTheta.mul(2.0))).mul(0.7).add(cos(qFernCoord.mul(2.0)).mul(0.3));
      const r4 = cos(qTheta.mul(36.0)).mul(0.6).add(cos(qRho.mul(1.8)).mul(0.4));

      const sIdx = floor(sId.add(0.5));
      const res = r0.toVar();
      If(sIdx.equal(1.0), () => { res.assign(r1); });
      If(sIdx.equal(2.0), () => { res.assign(r2); });
      If(sIdx.equal(3.0), () => { res.assign(r3); });
      If(sIdx.equal(4.0), () => { res.assign(r4); });
      return res;
    };

    // Dirección de rumbo del agente (heading)
    const vHeading = normalize(v.xy.add(tangent.xy.mul(0.02)));
    const ds = float(0.35); // Distancia del sensor
    // Rotación angular de los sensores izquierdo (+32°) y derecho (-32°)
    const cosPhi = float(0.8525);
    const sinPhi = float(0.5227);
    const vLeft = vec2(
      vHeading.x.mul(cosPhi).sub(vHeading.y.mul(sinPhi)),
      vHeading.x.mul(sinPhi).add(vHeading.y.mul(cosPhi))
    );
    const vRight = vec2(
      vHeading.x.mul(cosPhi).add(vHeading.y.mul(sinPhi)),
      vHeading.y.mul(cosPhi).sub(vHeading.x.mul(sinPhi))
    );

    const pLeft = p.xy.add(vLeft.mul(ds));
    const pRight = p.xy.add(vRight.mul(ds));

    const sLeftA = sampleRidge(pLeft, params.shapeA);
    const sRightA = sampleRidge(pRight, params.shapeA);
    const sLeftB = sampleRidge(pLeft, params.shapeB);
    const sRightB = sampleRidge(pRight, params.shapeB);

    const morphProg = smoothstep(float(0.0), float(1.0), params.shapeMorph.clamp(0.0, 1.0));
    const sLeft = mix(sLeftA, sLeftB, morphProg);
    const sRight = mix(sRightA, sRightB, morphProg);

    // Fuerza de giro lateral perpendicular al heading siguiendo el gradiente de Jeff Jones
    const steerPerp = vec3(vHeading.y.negate(), vHeading.x, 0.0);
    const physarumSteer = steerPerp.mul(sLeft.sub(sRight)).mul(2.2);

    // =========================================================================
    // SELECCIÓN Y MEZCLA DE CAMPOS DE FUERZA (Craig Reynolds Flocking)
    // =========================================================================
    const sampleArchetype = (shapeIdNode) => {
      const sIdx = floor(shapeIdNode.add(0.5));
      const res = flowCellular.toVar();
      If(sIdx.equal(1.0), () => { res.assign(flowIris); });
      If(sIdx.equal(2.0), () => { res.assign(flowCoral); });
      If(sIdx.equal(3.0), () => { res.assign(flowFern); });
      If(sIdx.equal(4.0), () => { res.assign(flowSpirograph); });
      return res;
    };

    const fieldA = sampleArchetype(params.shapeA);
    const fieldB = sampleArchetype(params.shapeB);
    const flowField3D = mix(fieldA, fieldB, morphProg).toVar();
    flowField3D.addAssign(physarumSteer);

    // Turbulencia curl divergence-free suave (volumen sin colapsos)
    const noiseScale = 0.38;
    const curlX = sin(p.y.mul(noiseScale).add(params.seed)).add(cos(p.z.mul(noiseScale).mul(0.8)));
    const curlY = cos(p.x.mul(noiseScale).add(params.seed)).negate().add(sin(p.z.mul(noiseScale).mul(0.8)));
    const curlZ = sin(p.x.mul(noiseScale).mul(0.8)).negate().add(cos(p.y.mul(noiseScale).mul(0.8)));
    flowField3D.addAssign(vec3(curlX, curlY, curlZ).mul(params.curlStrength));

    // Separación volumétrica entre capas de filamentos
    const spreadVec = vec3(
      cos(theta.add(1.57)).mul(agentLayer),
      sin(theta.add(1.57)).mul(agentLayer),
      agentZOffset
    ).mul(0.3);
    flowField3D.addAssign(spreadVec);

    // =========================================================================
    // CONFINAMIENTO EN TODA LA PANTALLA (Borde suave a sphereRadius)
    // =========================================================================
    const sphereRadius = params.sphereRadius;
    const outsideDist = rSph.sub(sphereRadius);
    const sphereNormal = normalize(p);
    const sphereContainmentForce = sphereNormal.mul(outsideDist.max(0.0).mul(-15.0));

    // STEERING BEHAVIORS (CRAIG REYNOLDS)
    const currentMaxSpeed = params.maxSpeed.mul(params.speedMultiplier);
    const desiredVelocity = normalize(flowField3D).mul(currentMaxSpeed);

    const steerForce = desiredVelocity.sub(v);
    const steerLen = length(steerForce).max(0.001);
    const clampedSteer = steerForce.div(steerLen).mul(min(steerLen, params.steerStrength));

    const totalForce = clampedSteer.toVar();
    totalForce.addAssign(sphereContainmentForce);
    totalForce.addAssign(v.mul(params.dragCoefficient).negate());

    // Conductor interactivo con el ratón
    const toPointer = params.attractor.sub(p);
    const pointerDist = length(toPointer).max(0.3);
    const pointerDir = toPointer.div(pointerDist);
    totalForce.addAssign(pointerDir.mul(params.attractorStrength).div(pointerDist));

    // Acento manual de energía (Barra espaciadora)
    const userPulseForce = normalize(p).mul(params.userPulse.mul(6.5));
    totalForce.addAssign(userPulseForce);

    // INTEGRACIÓN FÍSICA (Semi-implicit Euler)
    v.addAssign(totalForce.mul(dt));

    const curSpeed = length(v);
    If(curSpeed.greaterThan(currentMaxSpeed), () => {
      v.assign(v.normalize().mul(currentMaxSpeed));
    });

    p.addAssign(v.mul(dt));

    // RENOVACIÓN CONTINUA DE AGENTES EN TODA LA PANTALLA
    const expired = l.x.lessThanEqual(0.0).or(rSph.greaterThan(sphereRadius.mul(1.15)));
    If(expired, () => {
      const respawnTheta = hash(i.add(uint(91))).mul(6.2831853);
      const respawnRad = pow(hash(i.add(uint(97))), 0.55).mul(sphereRadius.mul(0.95)).add(0.2);
      const respawnZ = hash(i.add(uint(93))).sub(0.5).mul(sphereRadius.mul(0.3));
      p.assign(vec3(
        respawnRad.mul(cos(respawnTheta)),
        respawnRad.mul(sin(respawnTheta)),
        respawnZ
      ));
      v.assign(vec3(sin(respawnTheta).negate(), cos(respawnTheta), 0.0).mul(params.initialSpeed));
      l.x.assign(l.y);
    });
  })().compute(count).setName('Update Agents Fullscreen');

  // =========================================================================
  // RENDER PASS: PALETAS DE REFERENCIA EXACTAS Y DIVISIÓN CROMÁTICA RGB
  // =========================================================================
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
    const len = params.lineLength.mul(spdView.clamp(0.15, 2.5));
    return vec2(len, params.lineWidth);
  })();

  // COLOR ESPECTRAL 100% PURO BASADO EN LAS 5 IMÁGENES DE REFERENCIA
  // Cero quemado a blanco. Colores vivos sobre fondo negro puro.
  material.colorNode = Fn(() => {
    const pAttr = positionBuffer.toAttribute();
    const rDist = length(pAttr.xy).div(params.sphereRadius).clamp(0.0, 1.0);
    const ang = atan(vView.y, vView.x).div(6.2831853).add(0.5);
    const t = ang.add(rDist.mul(0.4)).add(params.chromaShift);

    const samplePalette = (idNode, tVal) => {
      // PALETA 0 (Ref: media_1790970695936.png):
      // Fluorescencia Botánica Bio-Cian (Núcleo luminoso, trabéculas azul cobalto y ribetes cian eléctrico)
      const c0_cobalt = vec3(0.0, 0.22, 0.88);
      const c0_cyan = vec3(0.0, 0.90, 1.0);
      const c0_highlight = vec3(0.48, 0.98, 1.0);
      const wallPulse0 = cos(tVal.mul(18.0)).mul(0.5).add(0.5);
      const c0 = mix(c0_cobalt, mix(c0_cyan, c0_highlight, wallPulse0), cos(tVal.mul(6.283)).mul(0.5).add(0.5));

      // PALETA 1 (Ref 2): Iris Cósmico / Fungal Plume (Rampa Espectral: Carmesí -> Oro -> Turquesa -> Amatista)
      const normR1 = rDist.sub(0.15).div(0.85).clamp(0.0, 1.0);
      const c1_crimson = vec3(0.96, 0.16, 0.05);
      const c1_gold = vec3(1.0, 0.80, 0.04);
      const c1_turquoise = vec3(0.04, 0.88, 0.78);
      const c1_purple = vec3(0.72, 0.12, 0.88);
      const c1_a = mix(c1_crimson, c1_gold, smoothstep(float(0.0), float(0.35), normR1));
      const c1_b = mix(c1_a, c1_turquoise, smoothstep(float(0.35), float(0.70), normR1));
      const c1 = mix(c1_b, c1_purple, smoothstep(float(0.70), float(1.0), normR1));

      // PALETA 2 (Ref 3): Rosa Coralina Espiral (Teal Océano Profundo, Esmeralda y Espuma Marina)
      const c2_deep = vec3(0.0, 0.16, 0.18);
      const c2_emerald = vec3(0.0, 0.42, 0.38);
      const c2_teal = vec3(0.0, 0.72, 0.65);
      const c2_seafoam = vec3(0.48, 1.0, 0.92);
      const c2 = mix(c2_deep, mix(c2_emerald, mix(c2_teal, c2_seafoam, sin(tVal.mul(18.84)).mul(0.5).add(0.5)), cos(tVal.mul(6.283)).mul(0.5).add(0.5)), sin(rDist.mul(10.0)).mul(0.5).add(0.5));

      // PALETA 3 (Ref 4): Helecho Fractal (Menta Neón y Jade Primaveral)
      const c3_dark = vec3(0.0, 0.18, 0.12);
      const c3_jade = vec3(0.0, 0.68, 0.45);
      const c3_mint = vec3(0.05, 1.0, 0.68);
      const c3_glow = vec3(0.45, 1.0, 0.82);
      const c3 = mix(c3_dark, mix(c3_jade, mix(c3_mint, c3_glow, sin(tVal.mul(14.0)).mul(0.5).add(0.5)), cos(tVal.mul(6.283)).mul(0.5).add(0.5)), cos(rDist.mul(8.0)).mul(0.5).add(0.5));

      // PALETA 4 (Ref 5): "36 Points" Sage Jenson (Separación Cromática RGB por Velocidad y Ángulo)
      const rComp = vView.x.mul(0.42).add(0.5).clamp(0.08, 1.0);
      const gComp = vView.y.mul(0.42).add(0.5).clamp(0.08, 1.0);
      const bComp = sin(ang.mul(36.0).add(params.chromaShift)).mul(0.45).add(0.55).clamp(0.08, 1.0);
      const c4 = vec3(rComp, gComp, bComp);

      const pIdx = floor(idNode.add(0.5));
      const col = c0.toVar();
      If(pIdx.equal(1.0), () => { col.assign(c1); });
      If(pIdx.equal(2.0), () => { col.assign(c2); });
      If(pIdx.equal(3.0), () => { col.assign(c3); });
      If(pIdx.equal(4.0), () => { col.assign(c4); });
      return col;
    };

    const colA = samplePalette(params.paletteA, t);
    const colB = samplePalette(params.paletteB, t);

    // Interpolación no lineal ultrasuave con dispersión radial como tinta en agua
    const waveOffset = rDist.mul(0.35);
    const localMix = params.paletteMix.mul(1.35).sub(waveOffset).clamp(0.0, 1.0);
    const easeMix = smoothstep(float(0.0), float(1.0), localMix);
    const finalCol = mix(colA, colB, easeMix);

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

  // Malla sutil oculta por defecto (pantalla limpia completa)
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
  sphereWireframe.visible = false;
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
