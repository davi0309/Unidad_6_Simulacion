/**
 * kintsugiLayer.ts
 * Capa de oro Kintsugi permanente inspirada en la Imagen de Referencia 5:
 * - Fondo de porcelana negra profunda (#040608).
 * - Grietas doradas finas, luminosas y de brillo metálico puro (#ffd700, #ffec66, #ffffff specular).
 * - Nodos brillantes con destellos estelares (✦) en las intersecciones.
 * - Registro permanente: lo que se sana con paciencia no desaparece.
 * - Cicatrices antiguas precargadas al 25% de brillo en la región periférica.
 */

import { Point2D } from './flowField';

export interface GoldStroke {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  width: number;
  alpha: number;
}

export class KintsugiLayer {
  public width: number;
  public height: number;

  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;

  // Grilla de segmentos para calcular el progreso de curación real (0.0 a 1.0)
  public spineSegmentsTotal: number = 36;
  public spineHealedSegments: Uint8Array;

  // Destellos dorados brillantes en las juntas
  private nodalGlints: { x: number; y: number; size: number; alpha: number }[] = [];

  constructor(w: number, h: number) {
    this.width = w;
    this.height = h;

    this.canvas = document.createElement('canvas');
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: false })!;

    this.spineHealedSegments = new Uint8Array(this.spineSegmentsTotal);
    this.clear();
  }

  public resize(w: number, h: number) {
    this.width = w;
    this.height = h;
    this.canvas.width = w;
    this.canvas.height = h;
    this.clear();
  }

  public clear() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.spineHealedSegments.fill(0);
    this.nodalGlints = [];
  }

  /**
   * Pinta al inicio las 6 a 10 cicatrices antiguas en la región periférica al 25% de brillo
   * (reveladas al final con el zoom de la tecla Enter).
   */
  public paintAncientScars(centerX: number, centerY: number, radiusX: number, radiusY: number) {
    const ctx = this.ctx;
    const scarCount = 8;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let i = 0; i < scarCount; i++) {
      const angle = (i / scarCount) * Math.PI * 2.0 + 0.35;
      const dist = (0.78 + Math.random() * 0.40);
      const originX = centerX + Math.cos(angle) * radiusX * dist;
      const originY = centerY + Math.sin(angle) * radiusY * dist;

      ctx.beginPath();
      ctx.moveTo(originX, originY);

      let px = originX;
      let py = originY;
      const len = 35 + Math.random() * 45;
      const segs = 4;
      const baseA = angle + Math.PI + (Math.random() - 0.5) * 1.2;

      for (let s = 0; s < segs; s++) {
        const segLen = len / segs;
        const a = baseA + (Math.random() - 0.5) * 0.6;
        px += Math.cos(a) * segLen;
        py += Math.sin(a) * segLen;
        ctx.lineTo(px, py);
      }

      // 1. Halo tenue de oro antiguo
      ctx.strokeStyle = 'rgba(196, 140, 20, 0.12)';
      ctx.lineWidth = 4.0;
      ctx.stroke();

      // 2. Línea de oro consolidado al 25% de brillo
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.25)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Deposita una veta de oro Kintsugi permanente a lo largo de la grieta.
   */
  public depositGoldVein(x0: number, y0: number, x1: number, y1: number, spineT: number) {
    const ctx = this.ctx;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 1. Halo ámbar exterior suave
    ctx.strokeStyle = 'rgba(184, 134, 11, 0.22)';
    ctx.lineWidth = 5.5;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();

    // 2. Cuerpo metálico brillante de oro 24K (#ffd700)
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.85)';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();

    // 3. Pico de luz especular central (#ffffff / #fff9e6)
    ctx.strokeStyle = 'rgba(255, 250, 230, 0.95)';
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();

    ctx.restore();

    // Registrar curación en el segmento de la espina
    const segIdx = Math.max(0, Math.min(this.spineSegmentsTotal - 1, Math.floor(spineT * this.spineSegmentsTotal)));
    this.spineHealedSegments[segIdx] = 1;

    // Con cierta probabilidad, agregar un destello estelar en la veta
    if (Math.random() < 0.08 && this.nodalGlints.length < 50) {
      this.nodalGlints.push({
        x: x1,
        y: y1,
        size: 3.5 + Math.random() * 4.0,
        alpha: 1.0
      });
    }
  }

  /**
   * Dibuja los destellos estelares (✦) de los nodos de oro.
   */
  public drawGlints(targetCtx: CanvasRenderingContext2D, dt: number) {
    for (let i = this.nodalGlints.length - 1; i >= 0; i--) {
      const g = this.nodalGlints[i];
      g.alpha -= dt * 0.45;

      if (g.alpha <= 0) {
        this.nodalGlints.splice(i, 1);
        continue;
      }

      const s = g.size;
      const a = g.alpha;

      targetCtx.save();
      targetCtx.fillStyle = `rgba(255, 250, 220, ${a.toFixed(2)})`;
      targetCtx.shadowColor = '#ffd700';
      targetCtx.shadowBlur = 8;

      // Destello en cruz de 4 puntas
      targetCtx.beginPath();
      targetCtx.moveTo(g.x, g.y - s);
      targetCtx.lineTo(g.x + s * 0.25, g.y);
      targetCtx.lineTo(g.x, g.y + s);
      targetCtx.lineTo(g.x - s * 0.25, g.y);
      targetCtx.closePath();
      targetCtx.fill();

      targetCtx.beginPath();
      targetCtx.moveTo(g.x - s, g.y);
      targetCtx.lineTo(g.x, g.y + s * 0.25);
      targetCtx.lineTo(g.x + s, g.y);
      targetCtx.lineTo(g.x, g.y - s * 0.25);
      targetCtx.closePath();
      targetCtx.fill();

      targetCtx.restore();
    }
  }

  /**
   * Devuelve el progreso de curación real basado en la cobertura de oro de la herida (0.0 a 1.0).
   */
  public getHealingProgress(): number {
    let healed = 0;
    for (let i = 0; i < this.spineSegmentsTotal; i++) {
      if (this.spineHealedSegments[i] > 0) healed++;
    }
    return healed / this.spineSegmentsTotal;
  }
}
