/**
 * compositePass.ts
 * Shader de composición final para "Heal":
 * - Fondo negro puro (#000000) sin viñeta.
 * - Partículas gráficas estilizadas en tonos blancos y azules (Imagen 2).
 * - Grietas doradas Kintsugi metálicas puras (Imagen 1).
 * - Cero viñeta, cero grano que ensucie la imagen: visuales nítidos, limpios y elegantes.
 * - Ejecutado con WebGPURenderer y QuadMesh a pantalla completa.
 */

import * as THREE from 'three/webgpu';
import {
  Fn,
  vec3,
  vec4,
  float,
  texture,
  uniform,
  uv
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
  public uFilmGrain = uniform(0.0); // Sin grano
  public uVignette = uniform(0.0);  // Sin viñeta

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

    // Fondo negro absoluto (#000000)
    const colBackground = vec3(0.0, 0.0, 0.0);

    this.material.colorNode = Fn(() => {
      const screenUV = uv();

      // Mapeo de zoom desde el centro (1.0 = normal, 0.35 = revelación exterior en Enter)
      const centeredUV = screenUV.sub(0.5);
      const domainUV = centeredUV.mul(float(1.0).div(uZ)).add(0.5);

      const inBounds = domainUV.x.greaterThanEqual(0.0).and(domainUV.x.lessThanEqual(1.0))
        .and(domainUV.y.greaterThanEqual(0.0)).and(domainUV.y.lessThanEqual(1.0));

      // 1. Muestrear partículas estilizadas blancas y azules (Imagen 2)
      const flowCol = this.flowTextureNode.sample(domainUV).rgb;

      // 2. Muestrear grietas doradas Kintsugi metálicas puras (Imagen 1)
      const kintsugiSample = this.kintsugiTextureNode.sample(domainUV);
      const goldCol = kintsugiSample.rgb;

      // Combinar fondo negro con partículas blancas/azules
      let col = colBackground.add(flowCol).toVar();

      // Superponer las líneas de oro Kintsugi
      col.addAssign(goldCol.mul(1.4));

      // Destello suave de latidos Z X C V B N M
      col.addAssign(col.mul(uFlash));

      // Si queda fuera de los límites por el zoom final de Enter, mostrar fondo negro
      const finalColor = inBounds.select(col, colBackground);

      return vec4(finalColor, 1.0);
    })();
  }

  public update(params: HealParameters, timeSeconds: number) {
    this.uHealingProgress.value = params.healingProgress;
    this.uHeartbeatFlash.value = params.heartbeatFlash;
    this.uZoom.value = params.zoom;
    this.uTime.value = timeSeconds;
    this.uFilmGrain.value = 0.0;
    this.uVignette.value = 0.0;

    // Actualizar texturas desde los lienzos de simulación
    this.flowCanvasTexture.needsUpdate = true;
    this.kintsugiCanvasTexture.needsUpdate = true;
  }

  public render(renderer: any) {
    renderer.setRenderTarget(null);
    this.compositeQuad.render(renderer);
  }
}
