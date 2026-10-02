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
  exp,
  floor,
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

    // 1. CAMPOS DE FLUJO 3D MULTICAPA (Inspirados en las 5 referencias visuales)

    // ARQUETIPO 0 (Tecla 1): Ondas Planetarias y Anillos Ópticos Cruzados (Ref: Imagen 1)
    // Líneas circulares concéntricas hacia el centro + ondas planetarias viajeras hacia afuera
    // + 4 lóbulos diagonales en cruz (X) con haz de lente horizontal
    const wavePhase = rho.mul(2.4).sub(params.elapsedTime.mul(2.5));
    const planetaryWave = sin(wavePhase);

    // 1. Fuerza de gravedad hacia el centro vs onda de expansión planetaria hacia afuera
    const inwardGravity = float(-1.1).div(rho.mul(0.25).add(0.7));
    const outwardWave = planetaryWave.mul(2.2);
    const radialWaveForce = radial.mul(inwardGravity.add(outwardWave).mul(params.flowDirection));

    // 2. Líneas circulares concéntricas (órbitas planetarias en capas continuas)
    const ringSpacing = float(1.25);
    const nearestRing = round(rho.div(ringSpacing)).mul(ringSpacing).clamp(1.0, 5.0);
    const ringAttract = radial.mul(nearestRing.sub(rho).mul(1.3));
    const circularOrbit = tangent.mul(params.swirl.mul(1.5)).add(ringAttract);

    // 3. Cuatro lóbulos de lente diagonales en cruz (X) inclinados en 3D
    const diagPattern = sin(theta.mul(2.0));
    const diagLobe = diagPattern.abs().pow(0.75);
    const zOrbital = diagPattern.mul(p.x.sub(p.y)).mul(0.26).add(agentZOffset.mul(0.35));
    const zAttract = vec3(0.0, 0.0, zOrbital.sub(p.z).mul(2.0));
    const lobeCirculation = radial.mul(diagLobe.mul(planetaryWave).mul(1.6));

    // 4. Haz horizontal de destello óptico (flare streak ecuatorial)
    const flareMask = abs(agentLayer).lessThan(0.25);
    const flareAttract = vec3(0.0, p.y.negate(), p.z.negate()).mul(2.2);
    const flareStream = vec3(sign(p.x).mul(float(1.5).add(planetaryWave.mul(0.8))), 0.0, 0.0);
    const flareForce = flareAttract.add(flareStream);

    const flowAstrolabe = radialWaveForce
      .add(circularOrbit)
      .add(zAttract)
      .add(lobeCirculation)
      .add(flareMask.select(flareForce, vec3(0.0)));

    // ARQUETIPO 1 (Tecla 2): Red de Micro-Vórtices y Eyectores 3D (Ref: Imagen 2)
    // Pequeños vórtices que amarran los agentes en anillos rotatorios concentrados
    // y luego los eyectan mediante haces parabólicos ("los sacan por otro lado") en un circuito cerrado continuo.
    const calcVortex = (center, axis, spinSpd, ringR, exitTarget) => {
      const r = p.sub(center);
      const h = r.dot(axis);
      const rPerp = r.sub(axis.mul(h));
      const rhoV = length(rPerp).max(0.001);
      const d = length(r).max(0.001);
      const perpDir = rPerp.div(rhoV);
      const spinDir = cross(axis, perpDir);

      // 1. Fuerza de amarre: sujeta y confina los agentes en un anillo circular definido
      const trapForce = perpDir.mul(ringR.sub(rhoV).mul(2.6));

      // 2. Giro vorticial veloz alrededor del eje polar del vórtice
      const spinForce = spinDir.mul(spinSpd.mul(params.swirl.mul(0.6).add(0.4)));

      // 3. Transporte helicoidal axial a lo largo del filamento
      const axialForce = axis.mul(sign(h).mul(1.3).mul(params.flowDirection));

      // 4. Eyección / Haces de lanzamiento: cuando superan el límite axial, son catapultados hacia otro lado
      const toNext = normalize(exitTarget.sub(p));
      const ejectJet = toNext.mul(3.8).add(spinDir.mul(1.4));
      const ejectMix = smoothstep(float(0.38), float(1.15), h.abs().div(1.3));

      const vLocal = mix(trapForce.add(spinForce).add(axialForce), ejectJet, ejectMix);
      const weight = float(1.0).div(d.pow(2.2).add(0.25));
      return { v: vLocal.mul(weight), w: weight };
    };

    // V0: Gran Vórtice Púrpura/Magenta Central (Luz principal inferior derecha)
    const v0 = calcVortex(vec3(0.7, -0.5, 0.2), normalize(vec3(0.3, 0.2, 0.95)), float(2.8), float(1.35), vec3(-2.0, 1.9, 0.7));
    // V1: Micro-vórtice Ámbar Superior Izquierdo (Burbuja circular dorada densa)
    const v1 = calcVortex(vec3(-2.0, 1.9, 0.7), normalize(vec3(-0.25, 0.35, 0.9)), float(3.4), float(0.85), vec3(-0.95, 2.4, -0.45));
    // V2: Micro-vórtice Secundario Ámbar (Burbuja satélite adyacente)
    const v2 = calcVortex(vec3(-0.95, 2.4, -0.45), normalize(vec3(0.35, -0.2, 0.9)), float(3.6), float(0.65), vec3(-1.3, -1.6, -0.3));
    // V3: Disco Espiral Turquesa / Cian (Amplio remolino con peines radiales)
    const v3 = calcVortex(vec3(-1.3, -1.6, -0.3), normalize(vec3(-0.15, 0.15, 0.98)), float(-2.6), float(2.1), vec3(2.2, 1.5, -0.5));
    // V4: Lazo de Retorno Esmeralda Periférico (Conecta de vuelta con V0)
    const v4 = calcVortex(vec3(2.2, 1.5, -0.5), normalize(vec3(0.5, -0.4, 0.77)), float(2.5), float(1.15), vec3(0.7, -0.5, 0.2));

    const totalVortexForce = v0.v.add(v1.v).add(v2.v).add(v3.v).add(v4.v);
    const totalVortexWeight = v0.w.add(v1.w).add(v2.w).add(v3.w).add(v4.w).max(0.001);
    const silkRipple = sin(p.x.mul(1.8).add(p.y.mul(1.8)).add(params.elapsedTime.mul(1.5))).mul(0.35);
    const flowMicroVortices = totalVortexForce.div(totalVortexWeight).add(vec3(silkRipple, silkRipple.negate(), silkRipple.mul(0.5)));

    // ARQUETIPO 2 (Tecla 3): Velo Cósmico Multicapa (Ref: Imagen 3)
    // Membranas y pliegues de seda ondulantes en múltiples niveles en 3D
    const zTargetVeil = sin(p.x.mul(0.85).add(agentLayer.mul(1.8)))
      .mul(cos(p.y.mul(0.85)))
      .mul(params.petalMorph.mul(1.6))
      .add(sin(rho.mul(1.4).sub(theta.mul(2.0))).mul(1.1))
      .add(agentZOffset.mul(0.8));
    const flowVeil = vec3(
      sin(p.y.mul(0.85).add(params.seed)).negate().mul(1.4),
      cos(p.x.mul(0.85).add(params.seed)).mul(1.4),
      zTargetVeil.sub(p.z).mul(1.8)
    ).add(tangent.mul(params.swirl.mul(0.7)));

    // ARQUETIPO 3 (Tecla 4): Loto Celestial / Alas de Serafín (Ref: Imagen 4)
    // Cáliz radiante de pétalos de plumas escalonadas en capas curvadas
    const petalHarm = sin(theta.mul(params.harmonics).add(agentPhase.mul(0.4)));
    const zLotusCalyx = rho.div(2.4).pow(1.8).mul(1.6)
      .sub(petalHarm.mul(rho).mul(0.35))
      .add(agentZOffset.mul(0.7));
    const flowLotus = radial.mul(petalHarm.mul(params.petalMorph).add(1.2).mul(params.flowDirection))
      .add(tangent.mul(params.swirl.mul(0.9).add(petalHarm.mul(0.4))))
      .add(vec3(0.0, 0.0, zLotusCalyx.sub(p.z).mul(1.6)));

    // ARQUETIPO 4 (Tecla 5): Pilar Astral / Alma Ascendente (Ref: Imagen 5)
    // Columna vertical estilizada, ascensión central y lluvia de chispas
    const spineRadius = float(1.2).add(agentLayer.mul(0.5));
    const inSpine = rho.lessThan(spineRadius);
    const ascendSpeed = float(2.4).mul(float(1.0).sub(rho.div(3.0)).clamp(0.1, 1.0));
    const fountainFall = float(-1.8).mul(params.flowDirection);
    const vZTarget = inSpine.select(ascendSpeed, fountainFall);
    const spineAttract = inSpine.select(
      radial.mul(float(-0.6)),
      radial.mul(float(1.1))
    );
    const flameWiggle = sin(p.z.mul(2.6).add(theta.mul(2.0))).mul(0.45);
    const flowAstralPillar = vec3(
      sin(theta.add(flameWiggle)).negate().mul(params.swirl.mul(0.6)),
      cos(theta.add(flameWiggle)).mul(params.swirl.mul(0.6)),
      vZTarget
    ).add(spineAttract);

    // Función selectora de campo de flujo por ID
    const sampleArchetype = (shapeIdNode) => {
      const sIdx = floor(shapeIdNode.add(0.5));
      const res = flowAstrolabe.toVar();
      If(sIdx.equal(1.0), () => { res.assign(flowMicroVortices); });
      If(sIdx.equal(2.0), () => { res.assign(flowVeil); });
      If(sIdx.equal(3.0), () => { res.assign(flowLotus); });
      If(sIdx.equal(4.0), () => { res.assign(flowAstralPillar); });
      return res;
    };

    // 2. ACORDES DEL ARMONIO (Fila Central A S D F G H J K):
    // Cada acorde configura polos magnéticos, vórtices y fuentes como limaduras de hierro
    const calcDipole = (pA, pB, strengthNode) => {
      const rA = p.sub(pA);
      const rB = p.sub(pB);
      const dA = length(rA).max(0.25);
      const dB = length(rB).max(0.25);
      const fA = rA.div(dA.pow(2.8));
      const fB = rB.div(dB.pow(2.8)).negate();
      return fA.add(fB).mul(strengthNode);
    };

    // A: Sol Mayor (G) - Tónica de apertura. Bipolar horizontal clásico
    const chordG = calcDipole(vec3(-2.2, 0.0, 0.0), vec3(2.2, 0.0, 0.0), float(1.8))
      .add(tangent.mul(params.swirl.mul(0.6)));

    // S: Si Menor (Bm) - Melancolía profunda. Bipolar oblicuo con torsión helicoidal
    const chordBm = calcDipole(vec3(-1.8, 1.5, 0.8), vec3(1.8, -1.5, -0.8), float(1.6))
      .add(vec3(p.y.negate(), p.x, p.z.mul(0.3)).mul(0.45));

    // D: Do Mayor (C) - Apertura y luz. Tríada de fuentes radiales a 120°
    const chordC = calcDipole(vec3(0.0, 2.2, 0.0), vec3(-1.9, -1.1, 0.0), float(1.4))
      .add(calcDipole(vec3(1.9, -1.1, 0.0), vec3(0.0, 0.0, 1.5), float(1.4)))
      .add(radial.mul(0.8));

    // F: Do Menor (Cm) - Tensión trágica. Cuadrupolo en cruz
    const chordCm = calcDipole(vec3(-1.6, -1.6, 0.0), vec3(1.6, 1.6, 0.0), float(1.5))
      .add(calcDipole(vec3(-1.6, 1.6, 0.0), vec3(1.6, -1.6, 0.0), float(1.5)).negate());

    // G: Sol/Si (G/B) - Inversión flotante. Bipolar asimétrico con corriente de deriva
    const chordGB = calcDipole(vec3(-2.2, -0.8, 0.0), vec3(1.5, 1.2, 0.0), float(1.6))
      .add(vec3(1.4, sin(p.x.mul(1.2)).mul(0.5), 0.0));

    // H: Mi Menor (Em) - Suspenso etéreo. Tres vórtices triangulares en resonancia
    const chordEm = vec3(
      sin(p.y.mul(1.4).add(params.elapsedTime.mul(0.4))),
      cos(p.x.mul(1.4).sub(params.elapsedTime.mul(0.4))),
      sin(p.z.mul(1.4))
    ).mul(1.9);

    // J: Do9 (Cadd9) - Doble hélice de resonancia armónica
    const chordCadd9 = vec3(
      sin(p.z.mul(1.8)).mul(1.5),
      cos(p.z.mul(1.8)).mul(1.5),
      sin(length(p.xy).mul(1.8))
    ).add(tangent.mul(params.swirl.mul(0.8)));

    // K: Re sus4 -> Re (Dsus4) - Preparación al arpa. Bipolar vertical norte-sur
    const chordDsus4 = calcDipole(vec3(0.0, 2.5, 0.0), vec3(0.0, -2.5, 0.0), float(1.8));

    const sampleChord = (cIdNode) => {
      const cIdx = floor(cIdNode.add(0.5));
      const res = chordG.toVar();
      If(cIdx.equal(1.0), () => { res.assign(chordBm); });
      If(cIdx.equal(2.0), () => { res.assign(chordC); });
      If(cIdx.equal(3.0), () => { res.assign(chordCm); });
      If(cIdx.equal(4.0), () => { res.assign(chordGB); });
      If(cIdx.equal(5.0), () => { res.assign(chordEm); });
      If(cIdx.equal(6.0), () => { res.assign(chordCadd9); });
      If(cIdx.equal(7.0), () => { res.assign(chordDsus4); });
      return res;
    };

    // Interpolación no lineal de acordes ("como un fuelle que tarda en llenarse de aire")
    const chordFlowA = sampleChord(params.chordA);
    const chordFlowB = sampleChord(params.chordB);
    const chordMorphProgress = smoothstep(float(0.0), float(1.0), params.chordMorph.clamp(0.0, 1.0));
    const activeChordFlow = mix(chordFlowA, chordFlowB, chordMorphProgress);

    // Campo base combinado (Acordes de armonio + Arquetipos visuales)
    const fieldA = sampleArchetype(params.shapeA);
    const fieldB = sampleArchetype(params.shapeB);
    const morphProgress = smoothstep(float(0.0), float(1.0), params.shapeMorph.clamp(0.0, 1.0));
    const archetypeFlow = mix(fieldA, fieldB, morphProgress);
    const flowField3D = mix(archetypeFlow, activeChordFlow, params.chordWeight.clamp(0.0, 1.0)).toVar();

    // 3. EL FUELLE DEL ARMONIO (Inhalación / Exhalación con Barra Espaciadora)
    // Al presionar: se contraen hacia el centro formando anillos concéntricos apretados (seek + cohesión)
    // Al soltar: exhalan y se expanden siguiendo el flow field
    const ringSpacingBellows = float(0.75).mul(float(1.0).sub(params.bellowsInhale.mul(0.35)));
    const targetBellowsRing = round(rho.div(ringSpacingBellows)).mul(ringSpacingBellows).clamp(0.35, 4.2);
    const ringClench = radial.mul(targetBellowsRing.sub(rho).mul(4.5));
    const seekCenter = radial.negate().mul(float(3.2).add(params.bellowsInhale.mul(2.2)));
    const zBellowsFlatten = vec3(0.0, 0.0, p.z.negate().mul(3.5));
    const inhaleVector = seekCenter.add(ringClench).add(zBellowsFlatten);
    flowField3D.assign(mix(flowField3D, inhaleVector, params.bellowsInhale.mul(0.92)));

    // 4. LA VOZ (El mouse es la voz: alignment de flocking + 3 ecos de reverberación)
    const toVoice0 = params.voicePos.sub(p);
    const dVoice0 = length(toVoice0).max(0.01);
    const prox0 = exp(dVoice0.mul(dVoice0).negate().mul(0.35)).mul(params.voiceActive);
    const voiceAlign0 = params.voiceVel.mul(prox0.mul(4.0));
    const voiceSeek0 = toVoice0.div(dVoice0).mul(prox0.mul(2.0));

    // Ecos fantasma de la voz (reverberación de catedral con retraso)
    const toEcho1 = params.voiceEcho1.sub(p);
    const dEcho1 = length(toEcho1).max(0.01);
    const prox1 = exp(dEcho1.mul(dEcho1).negate().mul(0.20)).mul(params.voiceActive).mul(0.55);
    const echoSeek1 = toEcho1.div(dEcho1).mul(prox1.mul(1.5));

    const toEcho2 = params.voiceEcho2.sub(p);
    const dEcho2 = length(toEcho2).max(0.01);
    const prox2 = exp(dEcho2.mul(dEcho2).negate().mul(0.12)).mul(params.voiceActive).mul(0.32);
    const echoSeek2 = toEcho2.div(dEcho2).mul(prox2.mul(1.2));

    const toEcho3 = params.voiceEcho3.sub(p);
    const dEcho3 = length(toEcho3).max(0.01);
    const prox3 = exp(dEcho3.mul(dEcho3).negate().mul(0.07)).mul(params.voiceActive).mul(0.18);
    const echoSeek3 = toEcho3.div(dEcho3).mul(prox3.mul(1.0));

    flowField3D.addAssign(voiceAlign0.add(voiceSeek0).add(echoSeek1).add(echoSeek2).add(echoSeek3));

    // 5. LAS ARPAS (Glissandos barriendo del 1 al 0: filamentos como cuerdas verticales con onda acústica)
    const harpStringX = round(p.x.div(0.55)).mul(0.55).clamp(-3.85, 3.85);
    const harpStringPull = vec3(harpStringX.sub(p.x).mul(6.5), 0.0, p.z.negate().mul(3.5));
    const harpWaveDist = abs(p.x.sub(params.harpWavePos));
    const harpWavePulse = exp(harpWaveDist.negate().mul(1.8));
    const harpVibY = sin(p.y.mul(9.0).add(params.elapsedTime.mul(26.0))).mul(harpWavePulse).mul(2.2);
    const harpVibZ = cos(p.y.mul(9.0).add(params.elapsedTime.mul(26.0))).mul(harpWavePulse).mul(1.6);
    const harpForce = harpStringPull.add(vec3(0.0, harpVibY, harpVibZ));
    flowField3D.assign(mix(flowField3D, harpForce, params.harpActive.mul(0.95)));

    // 6. EL FINAL CELESTIAL (Shift: Gravedad invertida + Physarum ramificado hacia arriba)
    const physarumBranchX = sin(p.y.mul(2.2).add(p.z.mul(1.5))).mul(cos(p.x.mul(1.8))).mul(1.5);
    const physarumBranchZ = cos(p.y.mul(2.2).sub(p.x.mul(1.5))).mul(sin(p.z.mul(1.8))).mul(1.5);
    const celestialHalo = vec3(p.z.negate(), 0.0, p.x).mul(1.4);
    const celestialLift = vec3(physarumBranchX, float(5.0), physarumBranchZ).add(celestialHalo);
    flowField3D.assign(mix(flowField3D, celestialLift, params.celestialActive.mul(0.95)));

    // 7. LOS CRÉDITOS Y EL SILENCIO FINAL (Enter)
    const creditRowY = round(p.y.div(0.42)).mul(0.42);
    const creditRoll = vec3(
      p.x.mul(0.04).negate(),
      creditRowY.sub(p.y).mul(5.5).add(1.8),
      p.z.negate().mul(3.5)
    );
    flowField3D.assign(mix(flowField3D, creditRoll, params.creditsActive.mul(0.98)));

    // Silencio: motas tenues de polvo cósmico flotando si se pulsa una tecla
    const silenceMoteFlutter = vec3(
      sin(p.y.mul(4.0).add(params.elapsedTime.mul(2.0))),
      cos(p.x.mul(4.0).add(params.elapsedTime.mul(2.0))),
      sin(p.z.mul(4.0))
    ).mul(params.codaMotePulse.mul(0.45));
    flowField3D.assign(mix(flowField3D, silenceMoteFlutter, params.codaSilence.mul(0.95)));

    // 8. TURBULENCIA CURL 3D (Divergence-free = Mantiene volumen amplio y no colapsa)
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

    // 9. CONFINAMIENTO DENTRO DE LA GRAN ESFERA 3D ----------------------------
    const sphereRadius = params.sphereRadius;
    const outsideDist = rSph.sub(sphereRadius);
    const sphereNormal = normalize(p);
    const sphereContainmentForce = sphereNormal.mul(outsideDist.max(0.0).mul(-15.0));

    // 10. STEERING BEHAVIORS (CRAIG REYNOLDS) EN 3D --------------------------
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
    // Rayitas cortas de celuloide, pelos o limaduras de hierro orientadas según velocidad
    const len = params.lineLength.mul(spdView.clamp(0.15, 2.5));
    return vec2(len, params.lineWidth);
  })();

  // COLOR ESPECTRAL Y ESTÉTICA DE PELÍCULA ANTIGUA (CELULOIDE Y GRABADO VIVO):
  // Tonos añil, gris pizarra, celuloide y blanco cálido marfil con grano de 24 FPS y parpadeo de proyector
  material.colorNode = Fn(() => {
    const pAttr = positionBuffer.toAttribute();
    const rDist = length(pAttr).mul(0.12);
    const ang = atan(vView.y, vView.x).div(6.2831853).add(0.5);

    const t = ang.add(rDist).add(params.chromaShift);

    // Función constructora de paletas espectrales
    const samplePalette = (idNode, tVal) => {
      // Paleta 0: Película de Celuloide Antiguo (Añil cianótipo, gris pizarra y blanco cálido marfil)
      const c0 = vec3(
        cos(tVal.mul(4.0).add(0.4)).mul(0.24).add(0.66), // R marfil
        cos(tVal.mul(4.0).add(0.8)).mul(0.26).add(0.68), // G plata
        cos(tVal.mul(4.0).add(1.8)).mul(0.36).add(0.62)  // B añil celuloide
      );

      // Paleta 1: Seda Ópalo y Amatista (Turquesa intenso, magenta vivo, violeta y rosa)
      const c1 = cos(tVal.mul(6.2831853).add(vec3(0.8, 0.1, 0.9))).mul(0.5).add(0.5);

      // Paleta 2: Fuego Dorado y Ámbar (Rojo rubí, naranja fuego, oro cálido de madera)
      const c2 = vec3(
        cos(tVal.mul(4.0)).mul(0.48).add(0.52),
        cos(tVal.mul(4.0).add(1.2)).mul(0.38).add(0.42),
        cos(tVal.mul(4.0).add(2.4)).mul(0.15)
      );

      // Paleta 3: Neón Lavanda / Mariposa (Azul cobalto profundo, violeta eléctrico, rosa neón)
      const c3 = vec3(
        cos(tVal.mul(5.0).add(0.2)).mul(0.48).add(0.52),
        cos(tVal.mul(5.0).add(2.0)).mul(0.15).add(0.1),
        cos(tVal.mul(5.0).add(4.0)).mul(0.5).add(0.5)
      );

      // Paleta 4: Azul Cian y Océano Profundo (Azul marino puro, cian eléctrico, esmeralda)
      const c4 = vec3(
        cos(tVal.mul(6.0).add(3.0)).mul(0.1),
        cos(tVal.mul(6.0).add(1.0)).mul(0.45).add(0.55),
        cos(tVal.mul(6.0)).mul(0.45).add(0.55)
      );

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

    // Interpolación no lineal ultrasuave (smoothstep) entre Paleta A y Paleta B
    const waveOffset = rDist.mul(0.35);
    const localMix = params.paletteMix.mul(1.35).sub(waveOffset).clamp(0.0, 1.0);
    const easeMix = smoothstep(float(0.0), float(1.0), localMix);
    const finalCol = mix(colA, colB, easeMix);

    // Grano de película de 35mm a 24 cuadros por segundo
    const filmFrame = floor(params.elapsedTime.mul(24.0));
    const grain = hash(instanceIndex.add(uint(filmFrame.mul(1031)))).sub(0.5).mul(params.filmGrain);

    // Parpadeo leve de proyector (Flicker)
    const flicker = sin(params.elapsedTime.mul(19.0)).mul(0.04)
      .add(cos(params.elapsedTime.mul(29.0)).mul(0.03))
      .mul(params.filmFlicker);

    // Resplandor angelical en el ascenso celestial
    const celestialGlow = params.celestialActive.mul(0.25);
    const filmTone = finalCol.add(vec3(grain.add(flicker))).add(vec3(celestialGlow)).clamp(0.0, 1.0);

    return vec4(filmTone, 1.0);
  })();

  // OPACIDAD DE SEDA TRANSLÚCIDA CON DESVANECIMIENTO DE CRÉDITOS Y SILENCIO
  material.opacityNode = Fn(() => {
    const pAttr = positionBuffer.toAttribute();
    const coords = uv().sub(0.5);
    const ellipseDist = coords.x.mul(coords.x).mul(1.3).add(coords.y.mul(coords.y).mul(4.0));
    const lineFalloff = float(1.0).sub(ellipseDist.mul(1.6)).clamp(0.0, 1.0).pow(1.5);

    // Desvanecimiento progresivo al subir por los créditos
    const creditsFade = float(1.0).sub(pAttr.y.sub(3.6).max(0.0).mul(0.5)).clamp(0.0, 1.0);

    // En el silencio: pantalla vacía salvo si se tocan teclas (motas tenues)
    const silenceFade = float(1.0).sub(params.codaSilence.mul(float(1.0).sub(params.codaMotePulse.mul(0.4))));

    return lineFalloff.mul(params.filamentAlpha).mul(creditsFade).mul(silenceFade);
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
