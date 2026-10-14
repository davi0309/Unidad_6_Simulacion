/**
 * tissuePhysarum.ts
 * Especie 1: Agentes de tejido vivo (Physarum de Jeff Jones).
 *
 * - 1.000.000 agentes invisibles (o fallback).
 * - Depositan en tissueTrail con blending aditivo.
 * - 3 sensores (L, F, R) que leen tissueTrail - 2.0 * dentroDeHerida.
 * - El tejido contornea la herida.
 * - Las zonas sanadas con oro dejan de repeler al tejido.
 * - Difusión 3x3 y decaimiento por frame mediante ping-pong libre de colisiones.
 * - Compatible con WebGPU (r16float, StorageBufferAttribute, QuadMesh).
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
  uv,
  instanceIndex,
  vertexIndex,
  storage
} from 'three/tsl';
import { HealParameters } from './parameters';
import { WoundSystem } from './woundSDF';

export class TissuePhysarumSystem {
  public count: number;
  public domainWidth: number;
  public domainHeight: number;
  public simWidth: number;
  public simHeight: number;

  // Buffer de agentes en GPU
  public agentBuffer: THREE.StorageBufferAttribute;
  public agentStorage: any;
  public computeNodeA: any;
  public computeNodeB: any;

  // Render Targets ping-pong para el rastro del tejido (HalfFloatType = r16float)
  public trailRT_A: THREE.RenderTarget;
  public trailRT_B: THREE.RenderTarget;
  public latestTrail: THREE.RenderTarget;
  private pingPongIndex: number = 0;

  // Material y puntos para deposición aditiva
  private depositPoints: THREE.Points;
  private depositScene: THREE.Scene;
  private depositCamera: THREE.OrthographicCamera;

  // Enjambre de partículas visibles (tecla V)
  private swarmPoints: THREE.Points;
  private swarmScene: THREE.Scene;

  // Materiales y QuadMesh para difusión 3x3 y decaimiento
  private diffuseMaterialA: any;
  private diffuseMaterialB: any;
  private diffuseQuad: any;

  // Uniforms TSL
  public uSensorAngle = uniform(35.0 * (Math.PI / 180.0));
  public uSensorDist = uniform(18.0);
  public uTurnAngle = uniform(40.0 * (Math.PI / 180.0));
  public uStep = uniform(1.0);
  public uDeposit = uniform(0.6);
  public uDecay = uniform(0.92);
  public uDomainSize: any;
  public uTexelSize: any;

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
    this.latestTrail = this.trailRT_A;

    // Buffer de agentes: vec4(posX, posY, heading, randomSeed)
    this.agentBuffer = new THREE.StorageBufferAttribute(new Float32Array(count * 4), 4);
    this.agentStorage = storage(this.agentBuffer, 'vec4', count);
    this.initAgentPositions(woundSystem);

    this.setupDepositPass();
    this.setupDiffusePass();
    this.setupComputePasses(woundSystem);
  }

  private initAgentPositions(woundSystem: WoundSystem) {
    const arr = this.agentBuffer.array as Float32Array;
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
    this.agentBuffer.needsUpdate = true;
  }

  private setupComputePasses(woundSystem: WoundSystem) {
    const uDom = this.uDomainSize;
    const uSDF = woundSystem.woundSDFTexture;

    // Generador de Compute Node para una textura de rastro dada
    const buildCompute = (inputTrailTex: THREE.Texture) => {
      return Fn(() => {
        const idx = instanceIndex;
        const agent = this.agentStorage.element(idx);
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

        const trailF = texture(inputTrailTex, uvF).r;
        const trailL = texture(inputTrailTex, uvL).r;
        const trailR = texture(inputTrailTex, uvR).r;

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
      })().compute(this.count);
    };

    this.computeNodeA = buildCompute(this.trailRT_A.texture);
    this.computeNodeB = buildCompute(this.trailRT_B.texture);
  }

  private setupDepositPass() {
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
    const dummyPositions = new Float32Array(this.count * 3);
    geometry.setAttribute('position', new THREE.BufferAttribute(dummyPositions, 3));

    const mat = new THREE.PointsNodeMaterial({
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false
    });

    // Cada punto consulta su propio agente en el storage buffer mediante vertexIndex
    mat.positionNode = Fn(() => {
      const p = this.agentStorage.element(vertexIndex);
      return vec4(p.x, p.y, 0.0, 1.0);
    })();

    mat.colorNode = Fn(() => {
      return vec4(this.uDeposit.mul(0.015), 0.0, 0.0, 1.0);
    })();

    this.depositPoints = new THREE.Points(geometry, mat);
    this.depositPoints.frustumCulled = false;
    this.depositScene.add(this.depositPoints);

    // Escena para visualizar el enjambre de partículas vivas directamente (tecla V)
    this.swarmScene = new THREE.Scene();
    const swarmMat = new THREE.PointsNodeMaterial({
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false
    });
    swarmMat.positionNode = Fn(() => {
      const p = this.agentStorage.element(vertexIndex);
      return vec4(p.x, p.y, 0.0, 1.0);
    })();
    swarmMat.colorNode = Fn(() => {
      return vec4(0.20, 0.38, 0.65, 0.45);
    })();
    this.swarmPoints = new THREE.Points(geometry, swarmMat);
    this.swarmPoints.frustumCulled = false;
    this.swarmScene.add(this.swarmPoints);
  }

  public renderSwarm(renderer: any, target: THREE.RenderTarget) {
    renderer.setRenderTarget(target);
    renderer.render(this.swarmScene, this.depositCamera);
  }

  private setupDiffusePass() {
    this.diffuseQuad = new THREE.QuadMesh();

    const texel = this.uTexelSize;
    const decay = this.uDecay;

    const buildDiffuseMaterial = (inputTrailTex: THREE.Texture) => {
      const mat = new THREE.MeshBasicNodeMaterial({
        depthWrite: false,
        depthTest: false
      });

      mat.colorNode = Fn(() => {
        const uvCoord = uv();
        const dx = texel.x;
        const dy = texel.y;

        let sum = float(0.0);
        for (let y = -1; y <= 1; y++) {
          for (let x = -1; x <= 1; x++) {
            const offset = vec2(float(x).mul(dx), float(y).mul(dy));
            const sampleVal = texture(inputTrailTex, uvCoord.add(offset)).r;
            sum = sum.add(sampleVal);
          }
        }

        const blurred = sum.div(9.0);
        const decayed = blurred.mul(decay);
        return vec4(decayed, 0.0, 0.0, 1.0);
      })();

      return mat;
    };

    this.diffuseMaterialA = buildDiffuseMaterial(this.trailRT_A.texture);
    this.diffuseMaterialB = buildDiffuseMaterial(this.trailRT_B.texture);
  }

  public updateUniforms(params: HealParameters) {
    this.uSensorAngle.value = params.tissueSensorAngle;
    this.uSensorDist.value = params.tissueSensorDist;
    this.uTurnAngle.value = params.tissueTurnAngle;
    this.uStep.value = params.tissueStep;
    this.uDeposit.value = params.tissueDeposit;
    this.uDecay.value = params.tissueDecay;
  }

  public step(renderer: any) {
    if (this.pingPongIndex === 0) {
      // 1. Compute agents leyendo rastro A
      renderer.compute(this.computeNodeA);

      // 2. Deposición aditiva en rastro A
      renderer.setRenderTarget(this.trailRT_A);
      renderer.render(this.depositScene, this.depositCamera);

      // 3. Difusión 3x3 y decaimiento: lee rastro A -> escribe en rastro B
      this.diffuseQuad.material = this.diffuseMaterialA;
      renderer.setRenderTarget(this.trailRT_B);
      this.diffuseQuad.render(renderer);
      renderer.setRenderTarget(null);

      this.latestTrail = this.trailRT_B;
      this.pingPongIndex = 1;
    } else {
      // 1. Compute agents leyendo rastro B
      renderer.compute(this.computeNodeB);

      // 2. Deposición aditiva en rastro B
      renderer.setRenderTarget(this.trailRT_B);
      renderer.render(this.depositScene, this.depositCamera);

      // 3. Difusión 3x3 y decaimiento: lee rastro B -> escribe en rastro A
      this.diffuseQuad.material = this.diffuseMaterialB;
      renderer.setRenderTarget(this.trailRT_A);
      this.diffuseQuad.render(renderer);
      renderer.setRenderTarget(null);

      this.latestTrail = this.trailRT_A;
      this.pingPongIndex = 0;
    }
  }

  public reset(woundSystem: WoundSystem) {
    this.initAgentPositions(woundSystem);
  }
}
