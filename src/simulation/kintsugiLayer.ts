/**
 * kintsugiLayer.ts
 * Sistema visual de Herida Viva y Curación Kintsugi (Imagen 1):
 * - HERIDA 100% PROCEDURAL Y ALEATORIA: Cada vez que se inicia o se reinicia con Escape,
 *   se genera una nueva herida orgánica con ángulo, trayectoria, longitud y ramificaciones
 *   completamente diferentes (¡NUNCA ES LA MISMA!).
 * - Estética fiel a la Imagen 1: Una laceración viva central con espinas y capilares dendríticos
 *   laterales en tono rosa carne / carmesí profundo (#e5506b, #ff1744, #800020) que palpita suavemente.
 * - CURACIÓN KINTSUGI DE ORO LÍQUIDO 24K: Al tocar teclas Q-P o clic, el oro fundido
 *   recorre la grieta y sus capilares, sellando el corte con destellos especulares blancos y halo áureo.
 */

export interface CrackPoint {
  x: number;
  y: number;
}

export interface FractalBranch {
  points: CrackPoint[];
  width: number;
  filledRatio: number;      // 0.0 (abierta/carmesí) a 1.0 (sellada de oro)
  targetFilledRatio: number;
  isMainTrunk: boolean;
  glowPulse: number;
}

export class KintsugiLayer {
  public width: number;
  public height: number;

  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;

  public branches: FractalBranch[] = [];

  // Ondas de destello dorado activo al presionar teclas
  public goldFlashes: { x: number; y: number; radius: number; maxRadius: number; alpha: number }[] = [];

  constructor(w: number, h: number) {
    this.width = w;
    this.height = h;

    this.canvas = document.createElement('canvas');
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: false })!;

    this.generateRandomWound();
  }

  public resize(w: number, h: number) {
    this.width = w;
    this.height = h;
    this.canvas.width = w;
    this.canvas.height = h;
    this.generateRandomWound();
  }

  /**
   * Genera una herida viva 100% aleatoria y procedural con ramificaciones fractales
   * y capilares dendríticos orgánicos (fiel a la Imagen 1).
   */
  public generateRandomWound() {
    this.branches = [];
    this.goldFlashes = [];
    const W = this.width;
    const H = this.height;

    // Subdivisión fractal orgánica con Midpoint Displacement
    const fractalize = (p0: CrackPoint, p1: CrackPoint, depth: number, roughness: number): CrackPoint[] => {
      if (depth === 0) return [p0, p1];

      const midX = (p0.x + p1.x) * 0.5;
      const midY = (p0.y + p1.y) * 0.5;
      const dx = p1.x - p0.x;
      const dy = p1.y - p0.y;
      const len = Math.hypot(dx, dy);

      // Desplazamiento perpendicular orgánico
      const perpX = -dy / (len || 1);
      const perpY = dx / (len || 1);
      const offset = (Math.random() - 0.5) * len * roughness;

      const pMid: CrackPoint = {
        x: midX + perpX * offset,
        y: midY + perpY * offset
      };

      const left = fractalize(p0, pMid, depth - 1, roughness * 0.65);
      const right = fractalize(pMid, p1, depth - 1, roughness * 0.65);
      return left.slice(0, -1).concat(right);
    };

    // =========================================================================
    // 1. TRONCO PRINCIPAL PROCEDURAL (Ángulo, centro y sinuosidad aleatorios)
    // =========================================================================
    // Centro con pequeña fluctuación aleatoria
    const centerX = W * (0.42 + Math.random() * 0.16);
    const centerY = H * (0.44 + Math.random() * 0.12);

    // Ángulo aleatorio variado: no siempre la misma diagonal
    // Seleccionar entre diagonales y ángulos orgánicos dinámicos
    const anglePresets = [
      -0.25 * Math.PI + (Math.random() - 0.5) * 0.4, // Diagonal suave abajo-izquierda a arriba-derecha
      0.25 * Math.PI + (Math.random() - 0.5) * 0.4,  // Diagonal arriba-izquierda a abajo-derecha
      0.08 * Math.PI + (Math.random() - 0.5) * 0.3,  // Transversal suave casi horizontal
      -0.42 * Math.PI + (Math.random() - 0.5) * 0.3  // Inclinación más vertical
    ];
    const angle = anglePresets[Math.floor(Math.random() * anglePresets.length)];

    // Longitud proporcional de ~55% a ~75% del ancho del viewport
    const halfLen = Math.min(W, H) * (0.40 + Math.random() * 0.20);

    const startX = centerX - Math.cos(angle) * halfLen;
    const startY = centerY - Math.sin(angle) * halfLen;
    const endX = centerX + Math.cos(angle) * halfLen;
    const endY = centerY + Math.sin(angle) * halfLen;

    const nodeCount = 5 + Math.floor(Math.random() * 4);
    const trunkNodes: CrackPoint[] = [];

    const perpX = -Math.sin(angle);
    const perpY = Math.cos(angle);

    for (let i = 0; i <= nodeCount; i++) {
      const t = i / nodeCount;
      const baseX = startX + (endX - startX) * t;
      const baseY = startY + (endY - startY) * t;
      // Fluctuación sinusoidal orgánica para que tenga curva natural
      const wobble = Math.sin(t * Math.PI) * (Math.random() - 0.5) * halfLen * 0.45;
      trunkNodes.push({
        x: baseX + perpX * wobble,
        y: baseY + perpY * wobble
      });
    }

    let fullMainPoints: CrackPoint[] = [];
    for (let i = 0; i < trunkNodes.length - 1; i++) {
      const segPts = fractalize(trunkNodes[i], trunkNodes[i + 1], 4, 0.26);
      if (i > 0) segPts.shift();
      fullMainPoints = fullMainPoints.concat(segPts);
    }

    this.branches.push({
      points: fullMainPoints,
      width: 7.0 + Math.random() * 2.5,
      filledRatio: 0.0,
      targetFilledRatio: 0.0,
      isMainTrunk: true,
      glowPulse: 0
    });

    // =========================================================================
    // 2. RAMAS SECUNDARIAS ORGÁNICAS (de 3 a 5 fracturas secundarias)
    // =========================================================================
    const numSecondary = 3 + Math.floor(Math.random() * 3);
    for (let s = 0; s < numSecondary; s++) {
      const anchorFrac = 0.18 + (s + 0.5) / (numSecondary + 0.8) * 0.65;
      const anchorIdx = Math.floor(anchorFrac * fullMainPoints.length);
      const anchor = fullMainPoints[anchorIdx] || fullMainPoints[Math.floor(fullMainPoints.length * 0.5)];

      const branchSide = s % 2 === 0 ? 1 : -1;
      const branchAngle = angle + branchSide * (0.65 + Math.random() * 0.55);
      const branchLen = halfLen * (0.35 + Math.random() * 0.35);

      const bMid: CrackPoint = {
        x: anchor.x + Math.cos(branchAngle) * branchLen * 0.5 + (Math.random() - 0.5) * 35,
        y: anchor.y + Math.sin(branchAngle) * branchLen * 0.5 + (Math.random() - 0.5) * 35
      };
      const bEnd: CrackPoint = {
        x: anchor.x + Math.cos(branchAngle) * branchLen,
        y: anchor.y + Math.sin(branchAngle) * branchLen
      };

      const seg1 = fractalize(anchor, bMid, 3, 0.26);
      const seg2 = fractalize(bMid, bEnd, 3, 0.22);
      this.branches.push({
        points: seg1.concat(seg2.slice(1)),
        width: 4.2 + Math.random() * 1.5,
        filledRatio: 0.0,
        targetFilledRatio: 0.0,
        isMainTrunk: false,
        glowPulse: 0
      });
    }

    // =========================================================================
    // 3. CAPILARES Y ESPINAS DENDRÍTICAS (Fiel a la Imagen 1 - media_1791949403282)
    // 24 a 36 pequeñas ramitas perpendiculares a lo largo del cuerpo de la herida
    // =========================================================================
    const numCapillaries = 26 + Math.floor(Math.random() * 12);
    for (let c = 0; c < numCapillaries; c++) {
      const parentBranch = this.branches[c % Math.min(3, this.branches.length)];
      const ptIdx = Math.floor(Math.random() * parentBranch.points.length);
      const root = parentBranch.points[ptIdx];

      const capSide = Math.random() < 0.5 ? 1 : -1;
      const capAngle = angle + capSide * (Math.PI * 0.5 + (Math.random() - 0.5) * 0.9);
      const capLen = 16.0 + Math.random() * 48.0;

      const capEnd: CrackPoint = {
        x: root.x + Math.cos(capAngle) * capLen,
        y: root.y + Math.sin(capAngle) * capLen
      };

      const capPts = fractalize(root, capEnd, 2, 0.28);
      this.branches.push({
        points: capPts,
        width: 2.2 + Math.random() * 1.2,
        filledRatio: 0.0,
        targetFilledRatio: 0.0,
        isMainTrunk: false,
        glowPulse: 0
      });
    }
  }

  /**
   * Deposita curación de oro líquido directamente en la herida al presionar teclas Q-P o clic.
   * La respuesta es inmediata y visible.
   */
  public addHealingEnergy(cursorX: number, cursorY: number, amount: number = 0.14) {
    // Generar un destello dorado expansivo en el punto de contacto
    this.goldFlashes.push({
      x: cursorX,
      y: cursorY,
      radius: 8,
      maxRadius: 130,
      alpha: 1.0
    });

    // Buscar la rama más cercana al cursor y llenarla con oro
    let closestBranchIdx = 0;
    let minDistSq = 1e9;

    for (let b = 0; b < this.branches.length; b++) {
      const branch = this.branches[b];
      for (const pt of branch.points) {
        const dx = cursorX - pt.x;
        const dy = cursorY - pt.y;
        const dSq = dx * dx + dy * dy;
        if (dSq < minDistSq) {
          minDistSq = dSq;
          closestBranchIdx = b;
        }
      }
    }

    // Inyectar oro líquido en la rama más cercana
    const target = this.branches[closestBranchIdx];
    target.targetFilledRatio = Math.min(1.0, target.targetFilledRatio + amount * 1.6);
    target.glowPulse = 1.0;

    // Propagar también hacia el tronco principal si no estaba seleccionado
    if (closestBranchIdx !== 0 && this.branches.length > 0) {
      this.branches[0].targetFilledRatio = Math.min(1.0, this.branches[0].targetFilledRatio + amount * 0.6);
      this.branches[0].glowPulse = 0.8;
    }

    // Llenar suavemente las ramas secundarias y capilares cercanos
    for (const b of this.branches) {
      if (b.targetFilledRatio < 0.98) {
        b.targetFilledRatio = Math.min(1.0, b.targetFilledRatio + amount * 0.35);
        b.glowPulse = 0.6;
        break;
      }
    }
  }

  /**
   * Actualiza y renderiza tanto la herida viva abierta como la curación de oro Kintsugi.
   */
  public updateAndRender(dt: number, time: number) {
    const ctx = this.ctx;

    // Fondo negro puro permanente (#000000)
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Pulsación orgánica sutil de respiración en la herida abierta
    const woundPulse = Math.sin(time * 2.8) * 0.16 + 0.84;

    // ==============================================================
    // PASO 1: RENDERIZAR LA HERIDA ABIERTA (Imagen 1: Tejido vivo carmesí/rosáceo)
    // ==============================================================
    for (const branch of this.branches) {
      const pts = branch.points;
      if (pts.length < 2) continue;

      // Actualizar llenado suave de oro
      if (branch.filledRatio < branch.targetFilledRatio) {
        branch.filledRatio = Math.min(branch.targetFilledRatio, branch.filledRatio + dt * 0.95);
      }
      if (branch.glowPulse > 0) {
        branch.glowPulse = Math.max(0, branch.glowPulse - dt * 2.2);
      }

      // Si la rama aún no está 100% sellada de oro, mostrar la herida viva abierta
      if (branch.filledRatio < 0.99) {
        const openPortionStart = Math.floor(pts.length * branch.filledRatio);

        if (openPortionStart < pts.length - 1) {
          ctx.beginPath();
          ctx.moveTo(pts[openPortionStart].x, pts[openPortionStart].y);
          for (let i = openPortionStart + 1; i < pts.length; i++) {
            ctx.lineTo(pts[i].x, pts[i].y);
          }

          // 1. Resplandor exterior de tejido vivo herido (Rosa carne / carmesí profundo)
          const glowAlpha = (0.38 * woundPulse).toFixed(2);
          ctx.strokeStyle = `rgba(230, 40, 80, ${glowAlpha})`;
          ctx.lineWidth = branch.width * 2.8;
          ctx.stroke();

          // 2. Borde carnoso intenso (rojo rubí vivo de corte fresco)
          const coreAlpha = (0.78 * woundPulse).toFixed(2);
          ctx.strokeStyle = `rgba(195, 20, 55, ${coreAlpha})`;
          ctx.lineWidth = branch.width * 1.4;
          ctx.stroke();

          // 3. Fisura interior profunda del desgarro
          ctx.strokeStyle = '#050203';
          ctx.lineWidth = Math.max(1.2, branch.width * 0.5);
          ctx.stroke();
        }
      }
    }

    // ==============================================================
    // PASO 2: RENDERIZAR LA CURACIÓN DE ORO KINTSUGI (Imagen 1 y Referencias)
    // ==============================================================
    for (const branch of this.branches) {
      if (branch.filledRatio <= 0.005) continue;

      const pts = branch.points;
      const fillCount = Math.max(2, Math.floor(pts.length * branch.filledRatio));
      const w = branch.width;
      const pulseExtra = branch.glowPulse * 1.5;

      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < fillCount; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }

      // 1. Halo áureo cálido de incrustación (#d4af37 / #b8860b)
      ctx.strokeStyle = `rgba(212, 160, 30, ${(0.42 + pulseExtra * 0.3).toFixed(2)})`;
      ctx.lineWidth = w * 1.7 + pulseExtra * 2.0;
      ctx.stroke();

      // 2. Vena de oro fundido 24K brillante (#ffd700)
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.98)';
      ctx.lineWidth = w * 1.05 + pulseExtra * 1.0;
      ctx.stroke();

      // 3. Reflejo especular blanco puro metálico reflectante (#ffffff)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.lineWidth = Math.max(1.0, w * 0.38);
      ctx.stroke();
    }

    // ==============================================================
    // PASO 3: DESTELLOS DE CURACIÓN DORADA AL TOCAR TECLAS
    // ==============================================================
    for (let i = this.goldFlashes.length - 1; i >= 0; i--) {
      const f = this.goldFlashes[i];
      f.radius += dt * 190.0;
      f.alpha -= dt * 1.6;

      if (f.alpha <= 0 || f.radius >= f.maxRadius) {
        this.goldFlashes.splice(i, 1);
        continue;
      }

      ctx.beginPath();
      ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 215, 0, ${f.alpha.toFixed(2)})`;
      ctx.lineWidth = 2.0;
      ctx.stroke();

      // Destello central
      ctx.beginPath();
      ctx.arc(f.x, f.y, Math.max(1, f.radius * 0.25), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 250, 220, ${(f.alpha * 0.8).toFixed(2)})`;
      ctx.fill();
    }
  }

  /**
   * Progreso de curación real (0.0 a 1.0) medido por la cantidad de herida sellada con oro.
   */
  public getHealingProgress(): number {
    if (this.branches.length === 0) return 0;
    let sum = 0;
    for (const b of this.branches) {
      sum += b.filledRatio;
    }
    return sum / this.branches.length;
  }

  /**
   * Reinicio completo con una NUEVA HERIDA aleatoria.
   */
  public clear() {
    this.generateRandomWound();
  }
}
