/**
 * compositePass.ts
 * Shader de composición final para "Heal" según la especificación cromática:
 * - Fondo: #07090c
 * - Interior de la herida: #050506
 * - Borde de la herida (SDF 0..6 px): resplandor #5a0f17 con intensidad (1 - healingProgress)
 * - Tejido: mix(frío, cálido, healingProgress) * intensidad del rastro
 *   Tonos medios: #3b4a5c (frío) -> #b88a74 (cálido)
 *   Luces: #8fa3b8 (frío) -> #f0d2bf (cálido)
 * - Oro (goldTrail + permanentScar) encima del tejido: base #c8902e, medio #ffd27a, picos #fff3d1
 * - Destello de latidos: +6% a +12% global
 * - Grano de película 0.04, viñeta 0.35 y bloom
 */

import * as THREE from 'three/webgpu';
import {
  Fn,
  vec2,
  vec3,
  vec4,
  float,
  mix,
  smoothstep,
  texture,
  uniform,
  uv,
  sin,
  fract
} from 'three/tsl';
import { HealParameters } from '../simulation/parameters';

export class CompositePass {
  public scene: THREE.Scene;
  public camera: THREE.OrthographicCamera;
  public material: any;

  // Uniforms de estado
  public uHealingProgress = uniform(0.0);
  public uHeartbeatFlash = uniform(0.0);
  public uZoom = uniform(1.0);
  public uTime = uniform(0.0);
  public uFilmGrain = uniform(0.04);
  public uVignette = uniform(0.35);
  public uDomainRatio = uniform(1.6); // Relación entre dominio de simulación y viewport

  // Texturas de entrada
  private tissueTexture: any;
  private goldTexture: any;
  private scarTexture: any;
  private sdfTexture: any;
  public overlayTexture: THREE.CanvasTexture;

  constructor(
    tissueRT: THREE.RenderTarget,
    goldRT: THREE.RenderTarget,
    scarRT: THREE.RenderTarget,
    sdfTex: THREE.DataTexture,
    overlayCanvas: HTMLCanvasElement
  ) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.tissueTexture = tissueRT.texture;
    this.goldTexture = goldRT.texture;
    this.scarTexture = scarRT.texture;
    this.sdfTexture = sdfTex;

    this.overlayTexture = new THREE.CanvasTexture(overlayCanvas);
    this.overlayTexture.minFilter = THREE.LinearFilter;
    this.overlayTexture.magFilter = THREE.LinearFilter;

    this.setupMaterial();
  }

  private setupMaterial() {
    const quadGeom = new THREE.PlaneGeometry(2, 2);
    this.material = new THREE.MeshBasicNodeMaterial({
      depthWrite: false,
      depthTest: false
    });

    const uHP = this.uHealingProgress;
    const uFlash = this.uHeartbeatFlash;
    const uZ = this.uZoom;
    const uT = this.uTime;
    const uGrain = this.uFilmGrain;
    const uVig = this.uVignette;

    // Paleta de colores especificada en el prompt
    const colBackground = vec3(7.0 / 255.0, 9.0 / 255.0, 12.0 / 255.0); // #07090c
    const colWoundInside = vec3(5.0 / 255.0, 5.0 / 255.0, 6.0 / 255.0); // #050506
    const colWoundGlow = vec3(90.0 / 255.0, 15.0 / 255.0, 23.0 / 255.0); // #5a0f17

    // Tejido: Frío (#3b4a5c mid, #8fa3b8 light) a Cálido (#b88a74 mid, #f0d2bf light)
    const colColdMid = vec3(59.0 / 255.0, 74.0 / 255.0, 92.0 / 255.0);
    const colColdLight = vec3(143.0 / 255.0, 163.0 / 255.0, 184.0 / 255.0);
    const colWarmMid = vec3(184.0 / 255.0, 138.0 / 255.0, 116.0 / 255.0);
    const colWarmLight = vec3(240.0 / 255.0, 210.0 / 255.0, 191.0 / 255.0);

    // Oro Kintsugi: base #c8902e, medio #ffd27a, picos #fff3d1
    const colGoldBase = vec3(200.0 / 255.0, 144.0 / 255.0, 46.0 / 255.0);
    const colGoldMid = vec3(255.0 / 255.0, 210.0 / 255.0, 122.0 / 255.0);
    const colGoldPeak = vec3(255.0 / 255.0, 243.0 / 255.0, 209.0 / 255.0);

    this.material.colorNode = Fn(() => {
      const screenUV = uv();

      // Mapeo de zoom desde el centro (1.0 = viewport central, 0.35 = revelación exterior)
      const centeredUV = screenUV.sub(0.5);
      const domainUV = centeredUV.mul(float(1.0).div(uZ.mul(1.6))).add(0.5);

      // Si la UV queda fuera de los límites del dominio de simulación, mostrar fondo
      const inBounds = domainUV.x.greaterThanEqual(0.0).and(domainUV.x.lessThanEqual(1.0))
        .and(domainUV.y.greaterThanEqual(0.0)).and(domainUV.y.lessThanEqual(1.0));

      const tissueTrail = texture(this.tissueTexture, domainUV).r;
      const goldTrail = texture(this.goldTexture, domainUV).r;
      const permanentScar = texture(this.scarTexture, domainUV).r;
      const sdf = texture(this.sdfTexture, domainUV).r;
      const overlay = texture(this.overlayTexture, screenUV);

      // Color base del fondo
      let col = colBackground.toVar();

      // Dentro de la herida: color oscuro #050506
      const inWound = sdf.lessThan(0.0);
      If(inWound, () => {
        col.assign(colWoundInside);
      });

      // Borde de la herida (SDF de 0 a 6 px): resplandor #5a0f17 con intensidad (1 - healingProgress)
      const borderGlowFactor = smoothstep(float(6.0), float(0.0), sdf).mul(float(1.0).sub(uHP));
      col.addAssign(colWoundGlow.mul(borderGlowFactor.mul(1.2)));

      // Tejido: interpolar entre frío y cálido según healingProgress
      const tissueMid = mix(colColdMid, colWarmMid, uHP);
      const tissueLight = mix(colColdLight, colWarmLight, uHP);
      const tissueShade = mix(tissueMid, tissueLight, tissueTrail.mul(0.6).clamp(0.0, 1.0));
      const tissueFinal = tissueShade.mul(tissueTrail.mul(1.8));

      // Mezclar tejido sobre el fondo (sólo fuera de la herida o en cicatrices sanadas)
      const scarTotal = goldTrail.add(permanentScar);
      const allowTissue = inWound.not().or(scarTotal.greaterThan(0.35));
      If(allowTissue, () => {
        col.addAssign(tissueFinal);
      });

      // Oro (goldTrail + permanentScar), siempre encima del tejido
      const totalGold = goldTrail.add(permanentScar);
      const gold1 = mix(colGoldBase, colGoldMid, smoothstep(float(0.05), float(0.55), totalGold));
      const gold2 = mix(gold1, colGoldPeak, smoothstep(float(0.55), float(1.0), totalGold));
      const goldFinal = gold2.mul(totalGold.mul(1.6).clamp(0.0, 2.0));
      col.addAssign(goldFinal);

      // Superponer células sanadoras y fragmentos de fractura (overlay canvas)
      col.addAssign(overlay.rgb.mul(overlay.a));

      // Destello global de latidos Z X C V B N M (+6% a +12%)
      col.addAssign(col.mul(uFlash));

      // Viñeta suave (0.35)
      const distFromCenter = centeredUV.length();
      const vignetteFactor = float(1.0).sub(distFromCenter.mul(distFromCenter).mul(uVig.mul(2.2))).clamp(0.0, 1.0);
      col.mulAssign(vignetteFactor);

      // Grano de película analógico (0.04)
      const grainRand = fract(sin(screenUV.x.mul(12.9898).add(screenUV.y.mul(78.233)).add(uT.mul(15.0))).mul(43758.5453));
      const grain = grainRand.sub(0.5).mul(uGrain);
      col.addAssign(vec3(grain));

      // Tonemapping cinematográfico suave (Reinhard)
      const toneMapped = col.div(col.add(1.0));

      // Si cae fuera de los límites del dominio por el zoom de Enter, mostrar fondo oscuro
      const finalColor = inBounds.select(toneMapped, colBackground);

      return vec4(finalColor, 1.0);
    })();

    const quadMesh = new THREE.Mesh(quadGeom, this.material);
    this.scene.add(quadMesh);
  }

  public update(params: HealParameters, timeSeconds: number) {
    this.uHealingProgress.value = params.healingProgress;
    this.uHeartbeatFlash.value = params.heartbeatFlash;
    this.uZoom.value = params.zoom;
    this.uTime.value = timeSeconds;
    this.uFilmGrain.value = params.filmGrain;
    this.uVignette.value = params.vignette;
    this.overlayTexture.needsUpdate = true;
  }

  public render(renderer: any) {
    renderer.setRenderTarget(null);
    renderer.render(this.scene, this.camera);
  }
}
