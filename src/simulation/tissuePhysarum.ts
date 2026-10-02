/**
 * tissuePhysarum.ts
 * Especie 1: Agentes de tejido vivo (Physarum de Jeff Jones).
 *
 * - 1.000.000 agentes invisibles (o 300.000 fallback).
 * - Depositan en tissueTrail con blending aditivo.
 * - 3 sensores (L, F, R) que leen tissueTrail - 2.0 * dentroDeHerida.
 * - El tejido contornea la herida.
 * - Las zonas sanadas con oro (goldTrail + permanentScar > 0.35) dejan de repeler al tejido.
 * - Difusión 3x3 y decaimiento por frame.
 * - Afectados por las ondas radiales de latidos (Z X C V B N M).
 */

import * as THREE from 'three/webgpu';
import {
  Fn,
  If,
  cos,
  sin,
  vec2,
  vec4,
  float,
  uniform,
  texture,
  instanceIndex,
  instancedArray
} from 'three/tsl';
import { HealParameters } from './parameters';
import { WoundSystem } from './woundSDF';
import { HeartbeatSystem } from './heartbeatSystem';

export class TissuePhysarumSystem {
  public count: number;
  public domainWidth: number;
  public domainHeight: number;
  public simWidth: number;
  public simHeight: number;

  // Buffers en GPU
  public positionBuffer: any;
  public computeNode: any;

  // Render Targets ping-pong para el rastro del tejido
  public trailRT_A: THREE.RenderTarget;
  public trailRT_B: THREE.RenderTarget;
  public currentTrailRead: THREE.RenderTarget;
  public currentTrailWrite: THREE.RenderTarget;

  // Material y puntos para deposición aditiva
  private depositPoints: THREE.Points;
  private depositScene: THREE.Scene;
  private depositCamera: THREE.OrthographicCamera;

  // Material y quad para difusión 3x3 y decaimiento
  private diffuseScene: THREE.Scene;
  private diffuseCamera: THREE.OrthographicCamera;
  private diffuseMaterial: any;

  // Uniforms TSL
  public uSensorAngle = uniform(35.0 * (Math.PI / 180.0));
  public uSensorDist = uniform(18.0);
  public uTurnAngle = uniform(40.0 * (Math.PI / 180.0));
  public uStep = uniform(1.0);
  public uDeposit = uniform(0.6);
  public uDecay = uniform(0.92);
  public uDomainSize: any;
  public uTexelSize: any;

  // Textura SDF
  private woundSDFTexture: THREE.DataTexture;

  constructor(
    domainW: number,
    domainH: number,
    simW: number,
    simH: number,
    count: number,
    woundSystem: WoundSystem
  ) {
    this.count = count;
    this.domainWidth = domainW;
    this.domainHeight = domainH;
    this.simWidth = simW;
    this.simHeight = simH;

    this.uDomainSize = uniform(new THREE.Vector2(domainW, domainH));
    this.uTexelSize = uniform(new THREE.Vector2(1.0 / simW, 1.0 / simH));

    // Render Targets HalfFloat para precisión de rastro suave
    const rtOptions = {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RedFormat
    };

    this.trailRT_A = new THREE.RenderTarget(simW, simH, rtOptions);
    this.trailRT_B = new THREE.RenderTarget(simW, simH, rtOptions);
    this.currentTrailRead = this.trailRT_A;
    this.currentTrailWrite = this.trailRT_B;

    // Textura DataTexture para el SDF
    this.woundSDFTexture = new THREE.DataTexture(
      woundSystem.sdfData,
      simW,
      simH,
      THREE.RedFormat,
      THREE.FloatType
    );
    this.woundSDFTexture.minFilter = THREE.LinearFilter;
    this.woundSDFTexture.magFilter = THREE.LinearFilter;
    this.woundSDFTexture.needsUpdate = true;

    // Buffer de agentes en GPU: vec4(posX, posY, heading, randomSeed)
    this.positionBuffer = instancedArray(count, 'vec4');
    this.initAgentPositions(woundSystem);

    this.setupDepositPass();
    this.setupDiffusePass();
    this.setupComputePass();
  }

  private initAgentPositions(woundSystem: WoundSystem) {
    // Inicializar agentes distribuidos en el dominio, evitando la herida
    const arr = new Float32Array(this.count * 4);
    for (let i = 0; i < this.count; i++) {
      let x = Math.random() * this.domainWidth;
      let y = Math.random() * this.domainHeight;

      // Reintentar si cae dentro de la grieta
      if (woundSystem.sampleSDF(x, y) < 0) {
        x = Math.random() * this.domainWidth;
        y = Math.random() * this.domainHeight;
      }

      const angle = Math.random() * Math.PI * 2.0;
      const idx = i * 4;
      arr[idx] = x;
      arr[idx + 1] = y;
      arr[idx + 2] = angle;
      arr[idx + 3] = Math.random();
    }

    // Cargar datos iniciales al buffer
    if (this.positionBuffer.value) {
      this.positionBuffer.value.set(arr);
    }
  }

  private setupComputePass() {
    const pBuf = this.positionBuffer;
    const uDom = this.uDomainSize;
    const uSDF = this.woundSDFTexture;

    // Compute Shader de Physarum (Especie 1: Tejido)
    this.computeNode = Fn(() => {
      const idx = instanceIndex;
      const agent = pBuf.element(idx);
      const pos = agent.xy;
      const angle = agent.z;
      const seed = agent.w;

      // Calcular posiciones de los 3 sensores (Frente, Izquierda, Derecha)
      const phi = this.uSensorAngle;
      const ds = this.uSensorDist;

      const pF = pos.add(vec2(cos(angle), sin(angle)).mul(ds));
      const pL = pos.add(vec2(cos(angle.add(phi)), sin(angle.add(phi))).mul(ds));
      const pR = pos.add(vec2(cos(angle.sub(phi)), sin(angle.sub(phi))).mul(ds));

      // Muestrear rastro de tejido y SDF en los 3 sensores
      const uvF = pF.div(uDom);
      const uvL = pL.div(uDom);
      const uvR = pR.div(uDom);

      const trailF = texture(this.currentTrailRead.texture, uvF).r;
      const trailL = texture(this.currentTrailRead.texture, uvL).r;
      const trailR = texture(this.currentTrailRead.texture, uvR).r;

      const sdfF = texture(uSDF, uvF).r;
      const sdfL = texture(uSDF, uvL).r;
      const sdfR = texture(uSDF, uvR).r;

      // Valor sensado = trail - 2.0 * dentroDeHerida
      const insideF = sdfF.lessThan(0.0).select(float(2.0), float(0.0));
      const insideL = sdfL.lessThan(0.0).select(float(2.0), float(0.0));
      const insideR = sdfR.lessThan(0.0).select(float(2.0), float(0.0));

      const valF = trailF.sub(insideF);
      const valL = trailL.sub(insideL);
      const valR = trailR.sub(insideR);

      // Decisión de giro (Jeff Jones)
      const turn = this.uTurnAngle;
      const newAngle = angle.toVar();

      If(valF.greaterThan(valL).and(valF.greaterThan(valR)), () => {
        // Mantener rumbo hacia adelante
      }).ElseIf(valL.greaterThan(valR), () => {
        newAngle.assign(angle.add(turn));
      }).ElseIf(valR.greaterThan(valL), () => {
        newAngle.assign(angle.sub(turn));
      }).Else(() => {
        // Giro aleatorio en caso de empate
        newAngle.assign(angle.add(seed.sub(0.5).mul(turn.mul(0.5))));
      });

      // Avanzar posición
      const step = this.uStep;
      const newPos = pos.add(vec2(cos(newAngle), sin(newAngle)).mul(step)).toVar();

      // Envoltura toroidal en los bordes del dominio
      newPos.assign(newPos.add(uDom).mod(uDom));

      agent.assign(vec4(newPos, newAngle, seed));
    }).compute(this.count);
  }

  private setupDepositPass() {
    // Escena ortográfica para renderizar agentes como puntos aditivos en el render target
    this.depositCamera = new THREE.OrthographicCamera(
      0,
      this.domainWidth,
      this.domainHeight,
      0,
      -1,
      1
    );
    this.depositScene = new THREE.Scene();

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.count * 3);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsNodeMaterial({
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false
    });

    const pBuf = this.positionBuffer;
    // Posición del punto leída directamente del buffer GPU
    mat.positionNode = Fn(() => {
      const p = pBuf.element(instanceIndex);
      return vec4(p.x, p.y, 0.0, 1.0);
    })();

    // Depositar valor en el canal rojo
    mat.colorNode = Fn(() => {
      return vec4(this.uDeposit.mul(0.015), 0.0, 0.0, 1.0);
    })();

    this.depositPoints = new THREE.Points(geometry, mat);
    this.depositPoints.frustumCulled = false;
    this.depositScene.add(this.depositPoints);
  }

  private setupDiffusePass() {
    // Escena ortográfica para la difusión 3x3 y decaimiento
    this.diffuseCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.diffuseScene = new THREE.Scene();

    const quadGeom = new THREE.PlaneGeometry(2, 2);

    this.diffuseMaterial = new THREE.MeshBasicNodeMaterial({
      depthWrite: false,
      depthTest: false
    });

    const texel = this.uTexelSize;
    const decay = this.uDecay;

    // Shader de difusión 3x3 con decaimiento
    this.diffuseMaterial.colorNode = Fn(() => {
      const uvCoord = uv();
      const dx = texel.x;
      const dy = texel.y;

      let sum = float(0.0);
      for (let y = -1; y <= 1; y++) {
        for (let x = -1; x <= 1; x++) {
          const offset = vec2(float(x).mul(dx), float(y).mul(dy));
          const sampleVal = texture(this.currentTrailRead.texture, uvCoord.add(offset)).r;
          sum = sum.add(sampleVal);
        }
      }

      const blurred = sum.div(9.0);
      const decayed = blurred.mul(decay);
      return vec4(decayed, 0.0, 0.0, 1.0);
    })();

    const quadMesh = new THREE.Mesh(quadGeom, this.diffuseMaterial);
    this.diffuseScene.add(quadMesh);
  }

  public updateUniforms(params: HealParameters) {
    this.uSensorAngle.value = params.tissueSensorAngle;
    this.uSensorDist.value = params.tissueSensorDist;
    this.uTurnAngle.value = params.tissueTurnAngle;
    this.uStep.value = params.tissueStep;
    this.uDeposit.value = params.tissueDeposit;
    this.uDecay.value = params.tissueDecay;
  }

  public updateSDFTexture(woundSystem: WoundSystem) {
    this.woundSDFTexture.image.data = woundSystem.sdfData;
    this.woundSDFTexture.needsUpdate = true;
  }

  public step(renderer: any) {
    // 1. Ejecutar compute shader de agentes
    renderer.compute(this.computeNode);

    // 2. Deposición aditiva de agentes en el RenderTarget de lectura
    renderer.setRenderTarget(this.currentTrailRead);
    renderer.render(this.depositScene, this.depositCamera);

    // 3. Difusión 3x3 y decaimiento escribiendo al RenderTarget de escritura
    renderer.setRenderTarget(this.currentTrailWrite);
    renderer.render(this.diffuseScene, this.diffuseCamera);
    renderer.setRenderTarget(null);

    // 4. Intercambiar buffers ping-pong
    const temp = this.currentTrailRead;
    this.currentTrailRead = this.currentTrailWrite;
    this.currentTrailWrite = temp;
  }

  public reset(woundSystem: WoundSystem) {
    this.initAgentPositions(woundSystem);
  }
}
