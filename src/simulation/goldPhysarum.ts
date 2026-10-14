/**
 * goldPhysarum.ts
 * Especie 2: Agentes dorados (Physarum de Jeff Jones).
 *
 * - Pool máximo de 200.000 agentes invisibles.
 * - Solo nacen de células sanadoras que llegan a la herida (SDF < 0).
 * - Confinados estrictamente a la herida + borde de 3 px (si salen, giran 180°).
 * - Atracción positiva a goldTrail: forman hilos que cruzan la grieta y unen los bordes (Kintsugi).
 * - Vida: 8 s normal, 20 s con sustain.
 * - goldTrail decay: 0.995 normal, 0.9995 con sustain.
 * - Consolidación: donde goldTrail > 0.6 durante 1 s, se copia a permanentScar (no decae nunca).
 * - Cicatrices antiguas (6 a 10) precargadas al 25% de brillo.
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

export class GoldPhysarumSystem {
  public maxPool: number;
  public activeCount: number = 0;
  public domainWidth: number;
  public domainHeight: number;
  public simWidth: number;
  public simHeight: number;

  private nextSpawnIdx: number = 0;

  // Buffer de agentes en GPU
  public agentBuffer: THREE.StorageBufferAttribute;
  public agentStorage: any;
  public computeNodeA: any;
  public computeNodeB: any;

  // Render Targets ping-pong para goldTrail
  public goldTrailRT_A: THREE.RenderTarget;
  public goldTrailRT_B: THREE.RenderTarget;
  public latestGold: THREE.RenderTarget;
  private goldPingPongIndex: number = 0;

  // Render Targets ping-pong para la cicatriz permanente (permanentScar)
  public scarRT_A: THREE.RenderTarget;
  public scarRT_B: THREE.RenderTarget;
  public latestScar: THREE.RenderTarget;
  private scarPingPongIndex: number = 0;

  // Material y puntos para deposición aditiva
  private depositPoints: THREE.Points;
  private depositScene: THREE.Scene;
  private depositCamera: THREE.OrthographicCamera;

  // Enjambre de partículas doradas visibles (tecla V)
  private swarmPoints: THREE.Points;
  private swarmScene: THREE.Scene;

  // QuadMesh y materiales para difusión
  private diffuseMaterialA: any;
  private diffuseMaterialB: any;
  private diffuseQuad: any;

  // QuadMesh y materiales para consolidación
  private consolidateMaterialA: any;
  private consolidateMaterialB: any;
  private consolidateQuad: any;

  // Uniforms TSL
  public uSensorAngle = uniform(30.0 * (Math.PI / 180.0));
  public uSensorDist = uniform(10.0);
  public uTurnAngle = uniform(30.0 * (Math.PI / 180.0));
  public uStep = uniform(1.1);
  public uDeposit = uniform(0.25);
  public uDecay = uniform(0.995);
  public uDomainSize: any;
  public uTexelSize: any;
  public uDeltaTime = uniform(1.0 / 60.0);

  constructor(
    domainW: number,
    domainH: number,
    simW: number,
    simH: number,
    maxPool: number,
    woundSystem: WoundSystem
  ) {
    this.maxPool = maxPool;
    this.domainWidth = domainW;
    this.domainHeight = domainH;
    this.simWidth = simW;
    this.simHeight = simH;

    this.uDomainSize = uniform(new THREE.Vector2(domainW, domainH));
    this.uTexelSize = uniform(new THREE.Vector2(1.0 / simW, 1.0 / simH));

    const rtOptions = {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RedFormat
    };

    this.goldTrailRT_A = new THREE.RenderTarget(simW, simH, rtOptions);
    this.goldTrailRT_B = new THREE.RenderTarget(simW, simH, rtOptions);
    this.latestGold = this.goldTrailRT_A;

    this.scarRT_A = new THREE.RenderTarget(simW, simH, rtOptions);
    this.scarRT_B = new THREE.RenderTarget(simW, simH, rtOptions);
    this.latestScar = this.scarRT_A;

    this.agentBuffer = new THREE.StorageBufferAttribute(new Float32Array(maxPool * 4), 4);
    this.agentStorage = storage(this.agentBuffer, 'vec4', maxPool);

    this.setupDepositPass();
    this.setupDiffusePass();
    this.setupConsolidatePass();
    this.setupComputePasses(woundSystem);
    this.initAncientScars(woundSystem);
  }

  /**
   * Pinta al inicio las 6 a 10 cicatrices antiguas en permanentScar al 25% de brillo.
   */
  public initAncientScars(woundSystem: WoundSystem) {
    const sw = this.simWidth;
    const sh = this.simHeight;
    const scaleX = this.domainWidth / sw;
    const scaleY = this.domainHeight / sh;
    const scarHalf = new Uint16Array(sw * sh);

    for (let j = 0; j < sh; j++) {
      const wy = (j + 0.5) * scaleY;
      const row = j * sw;

      for (let i = 0; i < sw; i++) {
        const wx = (i + 0.5) * scaleX;
        let minDistSq = 1e9;

        for (const scar of woundSystem.ancientScars) {
          for (const seg of scar.segments) {
            const dx = seg.p1.x - seg.p0.x;
            const dy = seg.p1.y - seg.p0.y;
            const lenSq = dx * dx + dy * dy;
            let t = lenSq > 1e-6 ? ((wx - seg.p0.x) * dx + (wy - seg.p0.y) * dy) / lenSq : 0;
            t = Math.max(0, Math.min(1, t));
            const px = seg.p0.x + t * dx;
            const py = seg.p0.y + t * dy;
            const rx = wx - px;
            const ry = wy - py;
            const dSq = rx * rx + ry * ry;
            if (dSq < minDistSq) minDistSq = dSq;
          }
        }

        const dist = Math.sqrt(minDistSq);
        if (dist < 4.0) {
          const intensity = (1.0 - dist / 4.0) * 0.25; // 25% de brillo
          scarHalf[row + i] = THREE.DataUtils.toHalfFloat(intensity);
        } else {
          scarHalf[row + i] = 0;
        }
      }
    }

    const initTex = new THREE.DataTexture(scarHalf, sw, sh, THREE.RedFormat, THREE.HalfFloatType);
    initTex.minFilter = THREE.LinearFilter;
    initTex.magFilter = THREE.LinearFilter;
    initTex.needsUpdate = true;

    // Guardar referencia para inicializar los render targets en el primer render
    this.initialScarTexture = initTex;
  }

  public initialScarTexture: THREE.DataTexture | null = null;
  private hasInitializedScarTargets: boolean = false;

  private ensureScarTargetsInitialized(renderer: any) {
    if (this.hasInitializedScarTargets || !this.initialScarTexture) return;
    this.hasInitializedScarTargets = true;

    const copyMat = new THREE.MeshBasicNodeMaterial({ depthWrite: false, depthTest: false });
    copyMat.colorNode = Fn(() => vec4(texture(this.initialScarTexture, uv()).r, 0.0, 0.0, 1.0))();
    const copyQuad = new THREE.QuadMesh(copyMat);

    renderer.setRenderTarget(this.scarRT_A);
    copyQuad.render(renderer);
    renderer.setRenderTarget(this.scarRT_B);
    copyQuad.render(renderer);
    renderer.setRenderTarget(null);
  }

  public spawnAgent(worldX: number, worldY: number, lifeSeconds: number) {
    const idx = this.nextSpawnIdx % this.maxPool;
    this.nextSpawnIdx++;
    if (this.activeCount < this.maxPool) this.activeCount++;

    const angle = Math.random() * Math.PI * 2.0;
    const base = idx * 4;
    const arr = this.agentBuffer.array as Float32Array;
    arr[base] = worldX;
    arr[base + 1] = worldY;
    arr[base + 2] = angle;
    arr[base + 3] = lifeSeconds;
    this.agentBuffer.needsUpdate = true;
  }

  private setupComputePasses(woundSystem: WoundSystem) {
    const uDom = this.uDomainSize;
    const uSDF = woundSystem.woundSDFTexture;

    const buildCompute = (inputGoldTex: THREE.Texture, inputScarTex: THREE.Texture) => {
      return Fn(() => {
        const idx = instanceIndex;
        const agent = this.agentStorage.element(idx);
        const pos = agent.xy;
        const angle = agent.z;
        const life = agent.w;

        If(life.lessThanEqual(0.0), () => {
          // Inactivo
        }).Else(() => {
          const phi = this.uSensorAngle;
          const ds = this.uSensorDist;

          const pF = pos.add(vec2(cos(angle), sin(angle)).mul(ds));
          const pL = pos.add(vec2(cos(angle.add(phi)), sin(angle.add(phi))).mul(ds));
          const pR = pos.add(vec2(cos(angle.sub(phi)), sin(angle.sub(phi))).mul(ds));

          const uvF = pF.div(uDom);
          const uvL = pL.div(uDom);
          const uvR = pR.div(uDom);

          // Sensar rastro dorado + cicatriz permanente con atracción positiva
          const goldF = texture(inputGoldTex, uvF).r.add(texture(inputScarTex, uvF).r);
          const goldL = texture(inputGoldTex, uvL).r.add(texture(inputScarTex, uvL).r);
          const goldR = texture(inputGoldTex, uvR).r.add(texture(inputScarTex, uvR).r);

          const turn = this.uTurnAngle;
          const newAngle = angle.toVar();

          If(goldF.greaterThan(goldL).and(goldF.greaterThan(goldR)), () => {
            // Seguir de frente
          }).ElseIf(goldL.greaterThan(goldR), () => {
            newAngle.assign(angle.add(turn));
          }).ElseIf(goldR.greaterThan(goldL), () => {
            newAngle.assign(angle.sub(turn));
          });

          // Avanzar posición
          const step = this.uStep;
          const nextPos = pos.add(vec2(cos(newAngle), sin(newAngle)).mul(step)).toVar();

          // Confinamiento a la herida + 3 px: si sale (SDF >= 3.0), girar 180°
          const uvNext = nextPos.div(uDom);
          const nextSDF = texture(uSDF, uvNext).r;

          If(nextSDF.greaterThanEqual(3.0), () => {
            newAngle.assign(newAngle.add(3.14159265));
          }).Else(() => {
            pos.assign(nextPos);
          });

          // Decrementar vida del agente
          const newLife = life.sub(this.uDeltaTime);
          agent.assign(vec4(pos, newAngle, newLife));
        });
      })().compute(this.maxPool);
    };

    this.computeNodeA = buildCompute(this.goldTrailRT_A.texture, this.scarRT_A.texture);
    this.computeNodeB = buildCompute(this.goldTrailRT_B.texture, this.scarRT_B.texture);
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
    const dummyPositions = new Float32Array(this.maxPool * 3);
    geometry.setAttribute('position', new THREE.BufferAttribute(dummyPositions, 3));

    const mat = new THREE.PointsNodeMaterial({
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false
    });

    mat.positionNode = Fn(() => {
      const p = this.agentStorage.element(vertexIndex);
      return vec4(p.x, p.y, 0.0, 1.0);
    })();

    mat.colorNode = Fn(() => {
      const p = this.agentStorage.element(vertexIndex);
      const isAlive = p.w.greaterThan(0.0).select(float(1.0), float(0.0));
      return vec4(this.uDeposit.mul(0.02).mul(isAlive), 0.0, 0.0, 1.0);
    })();

    this.depositPoints = new THREE.Points(geometry, mat);
    this.depositPoints.frustumCulled = false;
    this.depositScene.add(this.depositPoints);

    // Escena para visualizar los agentes dorados vivos en pantalla
    this.swarmScene = new THREE.Scene();
    const goldSwarmMat = new THREE.PointsNodeMaterial({
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false
    });
    goldSwarmMat.positionNode = Fn(() => {
      const p = this.agentStorage.element(vertexIndex);
      return vec4(p.x, p.y, 0.0, 1.0);
    })();
    goldSwarmMat.colorNode = Fn(() => {
      const p = this.agentStorage.element(vertexIndex);
      const isAlive = p.w.greaterThan(0.0).select(float(1.0), float(0.0));
      return vec4(1.0, 0.86, 0.40, 0.85).mul(isAlive);
    })();
    this.swarmPoints = new THREE.Points(geometry, goldSwarmMat);
    this.swarmPoints.frustumCulled = false;
    this.swarmScene.add(this.swarmPoints);
  }

  public renderSwarm(renderer: any, target: THREE.RenderTarget) {
    if (this.activeCount === 0) return;
    renderer.setRenderTarget(target);
    renderer.render(this.swarmScene, this.depositCamera);
  }

  private setupDiffusePass() {
    this.diffuseQuad = new THREE.QuadMesh();

    const texel = this.uTexelSize;
    const decay = this.uDecay;

    const buildDiffuseMaterial = (inputGoldTex: THREE.Texture) => {
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
            const sampleVal = texture(inputGoldTex, uvCoord.add(offset)).r;
            sum = sum.add(sampleVal);
          }
        }

        const blurred = sum.div(9.0);
        const decayed = blurred.mul(decay);
        return vec4(decayed, 0.0, 0.0, 1.0);
      })();

      return mat;
    };

    this.diffuseMaterialA = buildDiffuseMaterial(this.goldTrailRT_A.texture);
    this.diffuseMaterialB = buildDiffuseMaterial(this.goldTrailRT_B.texture);
  }

  private setupConsolidatePass() {
    this.consolidateQuad = new THREE.QuadMesh();

    const buildConsolidateMaterial = (inputGoldTex: THREE.Texture, inputScarTex: THREE.Texture) => {
      const mat = new THREE.MeshBasicNodeMaterial({
        depthWrite: false,
        depthTest: false
      });

      mat.colorNode = Fn(() => {
        const uvCoord = uv();
        const goldVal = texture(inputGoldTex, uvCoord).r;
        const prevScar = texture(inputScarTex, uvCoord).r;

        // Donde el oro supera 0.6, se consolida permanentemente a permanentScar
        const isConsolidating = goldVal.greaterThan(0.6);
        const consolidated = isConsolidating.select(goldVal.mul(0.8), float(0.0));
        const finalScar = prevScar.max(consolidated);

        return vec4(finalScar, 0.0, 0.0, 1.0);
      })();

      return mat;
    };

    this.consolidateMaterialA = buildConsolidateMaterial(this.goldTrailRT_B.texture, this.scarRT_A.texture);
    this.consolidateMaterialB = buildConsolidateMaterial(this.goldTrailRT_A.texture, this.scarRT_B.texture);
  }

  public updateUniforms(params: HealParameters, dt: number) {
    this.uSensorAngle.value = params.goldSensorAngle;
    this.uSensorDist.value = params.goldSensorDist;
    this.uTurnAngle.value = params.goldTurnAngle;
    this.uStep.value = params.goldStep;
    this.uDeposit.value = params.goldDeposit;
    this.uDecay.value = params.goldDecay;
    this.uDeltaTime.value = dt;
  }

  public step(renderer: any) {
    this.ensureScarTargetsInitialized(renderer);

    if (this.activeCount === 0) return;

    if (this.goldPingPongIndex === 0) {
      // 1. Compute agents leyendo oro A y cicatriz A
      renderer.compute(this.computeNodeA);

      // 2. Deposición aditiva en oro A
      renderer.setRenderTarget(this.goldTrailRT_A);
      renderer.render(this.depositScene, this.depositCamera);

      // 3. Difusión y decaimiento: lee oro A -> escribe en oro B
      this.diffuseQuad.material = this.diffuseMaterialA;
      renderer.setRenderTarget(this.goldTrailRT_B);
      this.diffuseQuad.render(renderer);

      // 4. Consolidación: lee oro B + cicatriz A -> escribe en cicatriz B
      this.consolidateQuad.material = this.consolidateMaterialA;
      renderer.setRenderTarget(this.scarRT_B);
      this.consolidateQuad.render(renderer);
      renderer.setRenderTarget(null);

      this.latestGold = this.goldTrailRT_B;
      this.latestScar = this.scarRT_B;
      this.goldPingPongIndex = 1;
      this.scarPingPongIndex = 1;
    } else {
      // 1. Compute agents leyendo oro B y cicatriz B
      renderer.compute(this.computeNodeB);

      // 2. Deposición aditiva en oro B
      renderer.setRenderTarget(this.goldTrailRT_B);
      renderer.render(this.depositScene, this.depositCamera);

      // 3. Difusión y decaimiento: lee oro B -> escribe en oro A
      this.diffuseQuad.material = this.diffuseMaterialB;
      renderer.setRenderTarget(this.goldTrailRT_A);
      this.diffuseQuad.render(renderer);

      // 4. Consolidación: lee oro A + cicatriz B -> escribe en cicatriz A
      this.consolidateQuad.material = this.consolidateMaterialB;
      renderer.setRenderTarget(this.scarRT_A);
      this.consolidateQuad.render(renderer);
      renderer.setRenderTarget(null);

      this.latestGold = this.goldTrailRT_A;
      this.latestScar = this.scarRT_A;
      this.goldPingPongIndex = 0;
      this.scarPingPongIndex = 0;
    }
  }

  public reset(woundSystem: WoundSystem) {
    this.activeCount = 0;
    this.nextSpawnIdx = 0;
    (this.agentBuffer.array as Float32Array).fill(0);
    this.agentBuffer.needsUpdate = true;
    this.hasInitializedScarTargets = false;
    this.initAncientScars(woundSystem);
  }
}
