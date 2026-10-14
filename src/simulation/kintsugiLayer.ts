/**
 * kintsugiLayer.ts
 * Sistema de grietas doradas Kintsugi inspirado directamente en la Imagen 1:
 * - Fondo negro puro (#000000).
 * - Red orgánica de grietas con ramificaciones principales, secundarias y fracturas finas.
 * - Grosor variable: venas principales anchas rellenas de oro (3 a 6 px) y ramificaciones finas (0.8 a 1.5 px).
 * - Sin pelotas ni círculos flotantes: la curación es oro líquido que fluye y se consolida
 *   directamente dentro de las grietas.
 * - Colores metálicos de oro puro: base ocre (#9a741e), oro 24K brillante (#ffd700, #e5be57)
 *   y destellos especulares blanco-dorados (#fff6d6, #ffffff).
 */

export interface CrackNode {
  x: number;
  y: number;
}

export interface CrackSegment {
  p0: CrackNode;
  p1: CrackNode;
  p2?: CrackNode; // punto de control para curvas cuadráticas
  width: number;
  filled: number; // 0.0 (abierta/oscura) a 1.0 (completamente sellada de oro)
  targetFill: number;
  branchLevel: number; // 0 = principal, 1 = secundaria, 2 = fina
}

export class KintsugiLayer {
  public width: number;
  public height: number;

  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;

  public segments: CrackSegment[] = [];
  public totalSegments: number = 0;

  constructor(w: number, h: number) {
    this.width = w;
    this.height = h;

    this.canvas = document.createElement('canvas');
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: false })!;

    this.buildCrackNetwork();
    this.renderInitialCracks();
  }

  public resize(w: number, h: number) {
    this.width = w;
    this.height = h;
    this.canvas.width = w;
    this.canvas.height = h;
    this.buildCrackNetwork();
    this.renderInitialCracks();
  }

  /**
   * Construye la red de fracturas exactamente con la distribución estética de la Imagen 1:
   * - Gran grieta troncal que cruza en diagonal de abajo a la izquierda hacia arriba a la derecha.
   * - Bifurcaciones que se abren y vuelven a juntarse creando islas.
   * - Ramificaciones secundarias capilares que se extienden hacia los bordes.
   */
  public buildCrackNetwork() {
    this.segments = [];
    const W = this.width;
    const H = this.height;

    // 1. TRONCO PRINCIPAL (Diagonal inferior-izquierda a superior-derecha con ondulación)
    const mainNodes: CrackNode[] = [
      { x: W * 0.05, y: H * 0.88 },
      { x: W * 0.18, y: H * 0.82 },
      { x: W * 0.32, y: H * 0.65 },
      { x: W * 0.44, y: H * 0.54 },
      { x: W * 0.58, y: H * 0.42 },
      { x: W * 0.72, y: H * 0.28 },
      { x: W * 0.84, y: H * 0.16 },
      { x: W * 0.95, y: H * 0.06 }
    ];

    for (let i = 0; i < mainNodes.length - 1; i++) {
      const p0 = mainNodes[i];
      const p1 = mainNodes[i + 1];
      const midX = (p0.x + p1.x) * 0.5 + (Math.random() - 0.5) * (W * 0.03);
      const midY = (p0.y + p1.y) * 0.5 + (Math.random() - 0.5) * (H * 0.03);

      this.segments.push({
        p0,
        p1,
        p2: { x: midX, y: midY },
        width: 4.5 + Math.random() * 2.5,
        filled: 0.0,
        targetFill: 0.0,
        branchLevel: 0
      });
    }

    // 2. ISLAS Y BIFURCACIONES PARALELAS (como en la Imagen 1)
    const island1: CrackNode[] = [
      { x: W * 0.32, y: H * 0.65 },
      { x: W * 0.38, y: H * 0.58 },
      { x: W * 0.44, y: H * 0.54 }
    ];
    this.segments.push({
      p0: island1[0],
      p1: island1[1],
      p2: { x: W * 0.34, y: H * 0.60 },
      width: 2.8,
      filled: 0.0,
      targetFill: 0.0,
      branchLevel: 1
    });
    this.segments.push({
      p0: island1[1],
      p1: island1[2],
      p2: { x: W * 0.42, y: H * 0.56 },
      width: 2.5,
      filled: 0.0,
      targetFill: 0.0,
      branchLevel: 1
    });

    const island2: CrackNode[] = [
      { x: W * 0.44, y: H * 0.54 },
      { x: W * 0.52, y: H * 0.72 },
      { x: W * 0.62, y: H * 0.74 },
      { x: W * 0.68, y: H * 0.62 },
      { x: W * 0.58, y: H * 0.42 }
    ];
    for (let i = 0; i < island2.length - 1; i++) {
      this.segments.push({
        p0: island2[i],
        p1: island2[i + 1],
        width: 2.2,
        filled: 0.0,
        targetFill: 0.0,
        branchLevel: 1
      });
    }

    // 3. RAMAS SECUNDARIAS LATERALES (Hacia la izquierda y hacia la derecha)
    // Rama izquierda superior
    const leftBranch1: CrackNode[] = [
      { x: W * 0.32, y: H * 0.65 },
      { x: W * 0.22, y: H * 0.58 },
      { x: W * 0.14, y: H * 0.52 },
      { x: W * 0.02, y: H * 0.50 }
    ];
    for (let i = 0; i < leftBranch1.length - 1; i++) {
      this.segments.push({
        p0: leftBranch1[i],
        p1: leftBranch1[i + 1],
        width: 3.2 - i * 0.8,
        filled: 0.0,
        targetFill: 0.0,
        branchLevel: 1
      });
    }

    // Rama vertical hacia arriba (centro)
    const upBranch: CrackNode[] = [
      { x: W * 0.58, y: H * 0.42 },
      { x: W * 0.54, y: H * 0.24 },
      { x: W * 0.48, y: H * 0.12 },
      { x: W * 0.42, y: H * 0.02 }
    ];
    for (let i = 0; i < upBranch.length - 1; i++) {
      this.segments.push({
        p0: upBranch[i],
        p1: upBranch[i + 1],
        width: 3.5 - i * 0.8,
        filled: 0.0,
        targetFill: 0.0,
        branchLevel: 1
      });
    }

    // Rama capilar superior izquierda
    const topCapillary: CrackNode[] = [
      { x: W * 0.48, y: H * 0.12 },
      { x: W * 0.32, y: H * 0.14 },
      { x: W * 0.20, y: H * 0.06 },
      { x: W * 0.18, y: H * 0.01 }
    ];
    for (let i = 0; i < topCapillary.length - 1; i++) {
      this.segments.push({
        p0: topCapillary[i],
        p1: topCapillary[i + 1],
        width: 1.8 - i * 0.4,
        filled: 0.0,
        targetFill: 0.0,
        branchLevel: 2
      });
    }

    // Rama derecha inferior horizontal
    const rightBranch: CrackNode[] = [
      { x: W * 0.58, y: H * 0.42 },
      { x: W * 0.70, y: H * 0.58 },
      { x: W * 0.85, y: H * 0.62 },
      { x: W * 0.98, y: H * 0.66 }
    ];
    for (let i = 0; i < rightBranch.length - 1; i++) {
      this.segments.push({
        p0: rightBranch[i],
        p1: rightBranch[i + 1],
        width: 2.8 - i * 0.6,
        filled: 0.0,
        targetFill: 0.0,
        branchLevel: 1
      });
    }

    // Ramas capilares finas cruzadas (Imagen 1)
    const hairLines = [
      [ { x: W * 0.72, y: H * 0.28 }, { x: W * 0.88, y: H * 0.32 }, { x: W * 0.98, y: H * 0.35 } ],
      [ { x: W * 0.70, y: H * 0.58 }, { x: W * 0.74, y: H * 0.78 }, { x: W * 0.78, y: H * 0.95 } ],
      [ { x: W * 0.22, y: H * 0.58 }, { x: W * 0.16, y: H * 0.70 }, { x: W * 0.08, y: H * 0.74 } ],
      [ { x: W * 0.84, y: H * 0.16 }, { x: W * 0.92, y: H * 0.22 } ]
    ];

    for (const hPts of hairLines) {
      for (let i = 0; i < hPts.length - 1; i++) {
        this.segments.push({
          p0: hPts[i],
          p1: hPts[i + 1],
          width: 1.3,
          filled: 0.0,
          targetFill: 0.0,
          branchLevel: 2
        });
      }
    }

    this.totalSegments = this.segments.length;
  }

  /**
   * Renderiza el estado base de las grietas.
   */
  public renderInitialCracks() {
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  /**
   * Deposita curación dorada directamente a lo largo de las grietas (sin pelotas flotantes).
   * Cuando el usuario toca teclas Q a P o hace clic, el oro líquido fluye por las fracturas.
   */
  public addHealingEnergy(cursorX: number, cursorY: number, amount: number = 0.08) {
    // Buscar los segmentos de grieta más cercanos al cursor o expandir progresivamente
    let closestIdx = 0;
    let minDistSq = 1e9;

    for (let i = 0; i < this.segments.length; i++) {
      const seg = this.segments[i];
      const midX = (seg.p0.x + seg.p1.x) * 0.5;
      const midY = (seg.p0.y + seg.p1.y) * 0.5;
      const dx = cursorX - midX;
      const dy = cursorY - midY;
      const dSq = dx * dx + dy * dy;

      if (dSq < minDistSq) {
        minDistSq = dSq;
        closestIdx = i;
      }
    }

    // Aumentar el objetivo de oro en el segmento más cercano y sus adyacentes
    const radius = 3;
    for (let k = Math.max(0, closestIdx - radius); k <= Math.min(this.segments.length - 1, closestIdx + radius); k++) {
      const weight = 1.0 - Math.abs(k - closestIdx) / (radius + 1);
      this.segments[k].targetFill = Math.min(1.0, this.segments[k].targetFill + amount * weight);
    }

    // Si todo está lleno cerca, avanzar hacia adelante a lo largo de la grieta
    for (let i = 0; i < this.segments.length; i++) {
      if (this.segments[i].targetFill < 0.99) {
        this.segments[i].targetFill = Math.min(1.0, this.segments[i].targetFill + amount * 0.25);
        break;
      }
    }
  }

  /**
   * Actualiza y dibuja las venas doradas de oro Kintsugi idénticas a la Imagen 1.
   */
  public updateAndRender(dt: number) {
    const ctx = this.ctx;

    // Fondo negro puro permanente (#000000)
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let i = 0; i < this.segments.length; i++) {
      const seg = this.segments[i];

      // El oro líquido avanza suavemente hacia el targetFill
      if (seg.filled < seg.targetFill) {
        seg.filled = Math.min(seg.targetFill, seg.filled + dt * 0.85);
      }

      if (seg.filled <= 0.001) continue;

      const fill = seg.filled;
      const w = seg.width;

      // Calcular punto final interpolado según fill
      let targetX = seg.p1.x;
      let targetY = seg.p1.y;

      if (fill < 0.999) {
        if (seg.p2) {
          // Curva cuadrática parcial
          const t = fill;
          const u = 1 - t;
          targetX = u * u * seg.p0.x + 2 * u * t * seg.p2.x + t * t * seg.p1.x;
          targetY = u * u * seg.p0.y + 2 * u * t * seg.p2.y + t * t * seg.p1.y;
        } else {
          targetX = seg.p0.x + (seg.p1.x - seg.p0.x) * fill;
          targetY = seg.p0.y + (seg.p1.y - seg.p0.y) * fill;
        }
      }

      // ==============================================================
      // RENDERIZADO METÁLICO MULTICAPA DE ORO KINTSUGI (Imagen 1)
      // ==============================================================

      // 1. CAPA BASE: Ocre/Ámbar de anclaje (#8c6517)
      ctx.beginPath();
      ctx.moveTo(seg.p0.x, seg.p0.y);
      if (seg.p2 && fill > 0.5) {
        ctx.quadraticCurveTo(seg.p2.x, seg.p2.y, targetX, targetY);
      } else {
        ctx.lineTo(targetX, targetY);
      }
      ctx.strokeStyle = 'rgba(140, 101, 23, 0.45)';
      ctx.lineWidth = w * 1.5;
      ctx.stroke();

      // 2. CAPA PRINCIPAL: Oro 24K brillante metálico (#d4af37 / #ffd700)
      ctx.beginPath();
      ctx.moveTo(seg.p0.x, seg.p0.y);
      if (seg.p2 && fill > 0.5) {
        ctx.quadraticCurveTo(seg.p2.x, seg.p2.y, targetX, targetY);
      } else {
        ctx.lineTo(targetX, targetY);
      }
      ctx.strokeStyle = 'rgba(229, 190, 87, 0.92)';
      ctx.lineWidth = w;
      ctx.stroke();

      // 3. CAPA BRILLANTE: Oro claro reflectante (#f7dda4 / #fff0c2)
      ctx.beginPath();
      ctx.moveTo(seg.p0.x, seg.p0.y);
      if (seg.p2 && fill > 0.5) {
        ctx.quadraticCurveTo(seg.p2.x, seg.p2.y, targetX, targetY);
      } else {
        ctx.lineTo(targetX, targetY);
      }
      ctx.strokeStyle = 'rgba(255, 240, 194, 0.85)';
      ctx.lineWidth = Math.max(0.8, w * 0.45);
      ctx.stroke();

      // 4. PICO ESPECULAR: Hilo central blanco-dorado puro (#ffffff)
      if (w > 2.0) {
        ctx.beginPath();
        ctx.moveTo(seg.p0.x, seg.p0.y);
        if (seg.p2 && fill > 0.5) {
          ctx.quadraticCurveTo(seg.p2.x, seg.p2.y, targetX, targetY);
        } else {
          ctx.lineTo(targetX, targetY);
        }
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    }
  }

  /**
   * Calcula el progreso de curación real (0.0 a 1.0) basado en las líneas selladas con oro.
   */
  public getHealingProgress(): number {
    let sum = 0;
    for (let i = 0; i < this.segments.length; i++) {
      sum += this.segments[i].filled;
    }
    return sum / this.segments.length;
  }

  public clear() {
    for (let i = 0; i < this.segments.length; i++) {
      this.segments[i].filled = 0.0;
      this.segments[i].targetFill = 0.0;
    }
    this.renderInitialCracks();
  }
}
