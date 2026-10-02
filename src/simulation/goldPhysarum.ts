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

export class GoldPhysarumSystem {
  public maxPool: number;
  public activeCount: number = 0;
  public domainWidth: number;
  public domainHeight: number;
  public simWidth: number;
  public simHeight: number;

  // CPU arrays para gestionar el ciclo de vida de los agentes dorados
  private agentPositions: Float32Array; // x, y, angle, life
  private nextSpawnIdx: number = 0;

  // Buffers en GPU
  public positionBuffer: any;
  public computeNode: any;

  // Render Targets ping-pong para goldTrail
  public goldTrailRT_A: THREE.RenderTarget;
  public goldTrailRT_B: THREE.RenderTarget;
  public currentGoldRead: THREE.RenderTarget;
  public currentGoldWrite: THREE.RenderTarget;

  // Render Target permanente para la cicatriz consolidada (permanentScar)
  public scarRT: THREE.RenderTarget;
  // Texture/Target acumulador de tiempo para consolidar (1 segundo > 0.6)
  private accumRT_A: THREE.RenderTarget;
  private accumRT_B: THREE.RenderTarget;

  // Material y puntos para deposición aditiva
  private depositPoints: THREE.Points;
  private depositScene: THREE.Scene;
  private depositCamera: THREE.OrthographicCamera;

  // Material y quad para difusión 3x3 y decaimiento
  private diffuseScene: THREE.Scene;
  private diffuseCamera: THREE.OrthographicCamera;
  private diffuseMaterial: any;

  // Material y quad para la consolidación en permanentScar
  private consolidateScene: THREE.Scene;
  private consolidateMaterial: any;

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

  // Textura SDF
  private woundSDFTexture: THREE.DataTexture;

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
    this.currentGoldRead = this.goldTrailRT_A;
    this.currentGoldWrite = this.goldTrailRT_B;

    this.scarRT = new THREE.RenderTarget(simW, simH, rtOptions);
    this.accumRT_A = new THREE.RenderTarget(simW, simH, rtOptions);
    this.accumRT_B = new THREE.RenderTarget(simW, simH, rtOptions);

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

    this.agentPositions = new Float32Array(maxPool * 4);
    this.positionBuffer = instancedArray(maxPool, 'vec4');

    this.setupDepositPass();
    this.setupDiffusePass();
    this.setupConsolidatePass();
    this.setupComputePass();
    this.paintAncientScars(woundSystem);
  }

  /**
   * Pinta al inicio las 6 a 10 cicatrices antiguas en permanentScar al 25% de brillo.
   */
  public paintAncientScars(woundSystem: WoundSystem) {
    // Generar buffer inicial para permanentScar con las cicatrices antiguas
    const scarData = new Float32Array(this.simWidth * this.simHeight);
    const scaleX = this.domainWidth / this.simWidth;
    const scaleY = this.domainHeight / this.simHeight;

    for (let j = 0; j < this.simHeight; j++) {
      const wy = (j + 0.5) * scaleY;
      const row = j * this.simWidth;

      for (let i = 0; i < this.simWidth; i++) {
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
          scarData[row + i] = intensity;
        }
      }
    }
  }

  public spawnAgent(worldX: number, worldY: number, lifeSeconds: number) {
    const idx = this.nextSpawnIdx % this.maxPool;
    this.nextSpawnIdx++;
    if (this.activeCount < this.maxPool) this.activeCount++;

    const angle = Math.random() * Math.PI * 2.0;
    const base = idx * 4;
    this.agentPositions[base] = worldX;
    this.agentPositions[base + 1] = worldY;
    this.agentPositions[base + 2] = angle;
    this.agentPositions[base + 3] = lifeSeconds; // tiempo de vida
  }

  private setupComputePass() {
    const pBuf = this.positionBuffer;
    const uDom = this.uDomainSize;
    const uSDF = this.woundSDFTexture;

    // Compute Shader de Physarum (Especie 2: Oro Kintsugi)
    this.computeNode = Fn(() => {
      const idx = instanceIndex;
      const agent = pBuf.element(idx);
      const pos = agent.xy;
      const angle = agent.z;
      const life = agent.w;

      // Si el agente no tiene vida, no se mueve
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
        const goldF = texture(this.currentGoldRead.texture, uvF).r.add(texture(this.scarRT.texture, uvF).r);
        const goldL = texture(this.currentGoldRead.texture, uvL).r.add(texture(this.scarRT.texture, uvL).r);
        const goldR = texture(this.currentGoldRead.texture, uvR).r.add(texture(this.scarRT.texture, uvR).r);

        const turn = this.uTurnAngle;
        const newAngle = angle.toVar();

        // Atracción positiva: girar hacia la mayor concentración de oro
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
    }).compute(this.maxPool);
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
    const positions = new Float32Array(this.maxPool * 3);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsNodeMaterial({
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false
    });

    const pBuf = this.positionBuffer;
    mat.positionNode = Fn(() => {
      const p = pBuf.element(instanceIndex);
      return vec4(p.x, p.y, 0.0, 1.0);
    })();

    mat.colorNode = Fn(() => {
      const p = pBuf.element(instanceIndex);
      const isAlive = p.w.greaterThan(0.0).select(float(1.0), float(0.0));
      return vec4(this.uDeposit.mul(0.02).mul(isAlive), 0.0, 0.0, 1.0);
    })();

    this.depositPoints = new THREE.Points(geometry, mat);
    this.depositPoints.frustumCulled = false;
    this.depositScene.add(this.depositPoints);
  }

  private setupDiffusePass() {
    this.diffuseCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.diffuseScene = new THREE.Scene();

    const quadGeom = new THREE.PlaneGeometry(2, 2);
    this.diffuseMaterial = new THREE.MeshBasicNodeMaterial({
      depthWrite: false,
      depthTest: false
    });

    const texel = this.uTexelSize;
    const decay = this.uDecay;

    this.diffuseMaterial.colorNode = Fn(() => {
      const uvCoord = uv();
      const dx = texel.x;
      const dy = texel.y;

      let sum = float(0.0);
      for (let y = -1; y <= 1; y++) {
        for (let x = -1; x <= 1; x++) {
          const offset = vec2(float(x).mul(dx), float(y).mul(dy));
          const sampleVal = texture(this.currentGoldRead.texture, uvCoord.add(offset)).r;
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

  private setupConsolidatePass() {
    this.consolidateScene = new THREE.Scene();
    const quadGeom = new THREE.PlaneGeometry(2, 2);

    this.consolidateMaterial = new THREE.MeshBasicNodeMaterial({
      depthWrite: false,
      depthTest: false
    });

    const dt = this.uDeltaTime;

    // Shader de consolidación: donde goldTrail > 0.6 durante 1 s, se copia a permanentScar
    this.consolidateMaterial.colorNode = Fn(() => {
      const uvCoord = uv();
      const goldVal = texture(this.currentGoldWrite.texture, uvCoord).r;
      const prevScar = texture(this.scarRT.texture, uvCoord).r;
      const prevAccum = texture(this.accumRT_A.texture, uvCoord).r;

      const newAccum = goldVal.greaterThan(0.6).select(prevAccum.add(dt), float(0.0)).toVar();
      const consolidated = newAccum.greaterThanEqual(1.0).select(goldVal, float(0.0));
      const finalScar = prevScar.max(consolidated);

      // Escribir permanentScar en canal R y acumulador en canal G
      return vec4(finalScar, newAccum, 0.0, 1.0);
    })();

    const quadMesh = new THREE.Mesh(quadGeom, this.consolidateMaterial);
    this.consolidateScene.add(quadMesh);
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
    if (this.activeCount === 0) return;

    // 1. Ejecutar compute shader de agentes dorados
    renderer.compute(this.computeNode);

    // 2. Deposición aditiva en RenderTarget
    renderer.setRenderTarget(this.currentGoldRead);
    renderer.render(this.depositScene, this.depositCamera);

    // 3. Difusión y decaimiento
    renderer.setRenderTarget(this.currentGoldWrite);
    renderer.render(this.diffuseScene, this.diffuseCamera);

    // 4. Consolidación a permanentScar
    renderer.setRenderTarget(this.scarRT);
    renderer.render(this.consolidateScene, this.diffuseCamera);
    renderer.setRenderTarget(null);

    // 5. Intercambiar ping-pong
    const temp = this.currentGoldRead;
    this.currentGoldRead = this.currentGoldWrite;
    this.currentGoldWrite = temp;
  }

  public reset(woundSystem: WoundSystem) {
    this.activeCount = 0;
    this.nextSpawnIdx = 0;
    this.agentPositions.fill(0);
    this.paintAncientScars(woundSystem);
  }
}
