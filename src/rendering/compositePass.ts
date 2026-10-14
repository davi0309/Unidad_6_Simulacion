/**
 * compositePass.ts
 * Shader de composición final para "Heal":
 * - Renderiza el flujo sedoso de partículas (filamentos blancos y río carmesí de Imagen 4).
 * - Superpone las vetas de oro metálico Kintsugi (Imagen 5).
 * - Efectos ópticos: destello de latidos, grano de película analógico, viñeta cinematográfica y zoom final de 8s.
 * - Ejecutado mediante WebGPURenderer y QuadMesh a pantalla completa sin recorte.
 */

import * as THREE from 'three/webgpu';
import {
  Fn,
  vec3,
  vec4,
  float,
  texture,
  uniform,
  uv,
  sin,
  fract
} from 'three/tsl';
import { HealParameters } from '../simulation/parameters';

export class CompositePass {
  public compositeQuad: any;
  public material: any;

  // Uniforms de estado
  public uHealingProgress = uniform(0.0);
  public uHeartbeatFlash = uniform(0.0);
  public uZoom = uniform(1.0);
  public uTime = uniform(0.0);
  public uFilmGrain = uniform(0.035);
  public uVignette = uniform(0.38);

  // Texturas de entrada desde los lienzos de alta velocidad
  public flowCanvasTexture: THREE.CanvasTexture;
  public kintsugiCanvasTexture: THREE.CanvasTexture;

  private flowTextureNode: any;
  private kintsugiTextureNode: any;

  constructor(
    particleCanvas: HTMLCanvasElement,
    kintsugiCanvas: HTMLCanvasElement
  ) {
    this.flowCanvasTexture = new THREE.CanvasTexture(particleCanvas);
    this.flowCanvasTexture.minFilter = THREE.LinearFilter;
    this.flowCanvasTexture.magFilter = THREE.LinearFilter;

    this.kintsugiCanvasTexture = new THREE.CanvasTexture(kintsugiCanvas);
    this.kintsugiCanvasTexture.minFilter = THREE.LinearFilter;
    this.kintsugiCanvasTexture.magFilter = THREE.LinearFilter;

    this.flowTextureNode = texture(this.flowCanvasTexture);
    this.kintsugiTextureNode = texture(this.kintsugiCanvasTexture);

    this.setupMaterial();
    this.compositeQuad = new THREE.QuadMesh(this.material);
  }

  private setupMaterial() {
    this.material = new THREE.MeshBasicNodeMaterial({
      depthWrite: false,
      depthTest: false
    });

    const uFlash = this.uHeartbeatFlash;
    const uZ = this.uZoom;
    const uT = this.uTime;
    const uGrain = this.uFilmGrain;
    const uVig = this.uVignette;

    // Fondo profundo de porcelana obsidiana
    const colBackground = vec3(5.0 / 255.0, 7.0 / 255.0, 10.0 / 255.0); // #05070a

    this.material.colorNode = Fn(() => {
      const screenUV = uv();

      // Mapeo de zoom desde el centro (1.0 = viewport central, 0.35 = revelación exterior)
      const centeredUV = screenUV.sub(0.5);
      const domainUV = centeredUV.mul(float(1.0).div(uZ)).add(0.5);

      const inBounds = domainUV.x.greaterThanEqual(0.0).and(domainUV.x.lessThanEqual(1.0))
        .and(domainUV.y.greaterThanEqual(0.0)).and(domainUV.y.lessThanEqual(1.0));

      // 1. Muestrear filamentos del flujo (partículas blancas y río carmesí)
      const flowCol = this.flowTextureNode.sample(domainUV).rgb;

      // 2. Muestrear vetas doradas Kintsugi metálicas
      const kintsugiSample = this.kintsugiTextureNode.sample(domainUV);
      const goldCol = kintsugiSample.rgb;
      const goldAlpha = kintsugiSample.a;

      // Combinar fondo con flujo de filamentos
      let col = colBackground.add(flowCol).toVar();

      // Superponer oro Kintsugi puro encima con presencia metálica
      col.addAssign(goldCol.mul(goldAlpha.mul(1.5)));

      // Destello global de latidos Z X C V B N M (+6% a +12%)
      col.addAssign(col.mul(uFlash));

      // Viñeta cinematográfica suave (0.38)
      const distFromCenter = centeredUV.length();
      const vignetteFactor = float(1.0).sub(distFromCenter.mul(distFromCenter).mul(uVig.mul(2.4))).clamp(0.0, 1.0);
      col.mulAssign(vignetteFactor);

      // Grano analógico sutil de película (0.035)
      const grainRand = fract(sin(screenUV.x.mul(12.9898).add(screenUV.y.mul(78.233)).add(uT.mul(20.0))).mul(43758.5453));
      const grain = grainRand.sub(0.5).mul(uGrain);
      col.addAssign(vec3(grain));

      // Tonemapping cinematográfico suave (Reinhard)
      const toneMapped = col.div(col.add(1.0)).mul(1.15);

      // Si queda fuera de los límites por el zoom final de Enter, mostrar fondo oscuro
      const finalColor = inBounds.select(toneMapped, colBackground);

      return vec4(finalColor, 1.0);
    })();
  }

  public update(params: HealParameters, timeSeconds: number) {
    this.uHealingProgress.value = params.healingProgress;
    this.uHeartbeatFlash.value = params.heartbeatFlash;
    this.uZoom.value = params.zoom;
    this.uTime.value = timeSeconds;
    this.uFilmGrain.value = params.filmGrain;
    this.uVignette.value = params.vignette;

    // Actualizar texturas desde los lienzos de simulación
    this.flowCanvasTexture.needsUpdate = true;
    this.kintsugiCanvasTexture.needsUpdate = true;
  }

  public render(renderer: any) {
    renderer.setRenderTarget(null);
    this.compositeQuad.render(renderer);
  }
}
