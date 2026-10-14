/**
 * kintsugiLayer.ts
 * Sistema visual de Herida Viva y Curación Kintsugi (Imagen 1):
 * - LA HERIDA ES CLARAMENTE VISIBLE: Una fractura orgánica y viva con resplandor carmesí/rubí
 *   profundo (#ff1744, #800020) que palpita suavemente en el fondo negro.
 * - LA CURACIÓN ES ORO LÍQUIDO PURO: Al tocar las teclas Q a P o hacer clic, el oro fundido
 *   fluye visiblemente por la herida, sellando el desgarro con oro metálico 24K (#ffd700, #ffea70)
 *   y destellos especulares blancos (#ffffff).
 * - Fracturas con rugosidad fractal orgánica realista (como en la Imagen 1), no líneas rectas rígidas.
 * - Progreso de curación real medible (0% a 100%).
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

    this.generateOrganicCrackSystem();
  }

  public resize(w: number, h: number) {
    this.width = w;
    this.height = h;
    this.canvas.width = w;
    this.canvas.height = h;
    this.generateOrganicCrackSystem();
  }

  /**
   * Genera una red de grietas con desplazamiento fractal orgánico (Midpoint Displacement)
   * idéntica a las fracturas naturales de mármol/porcelana de la Imagen 1.
   */
  public generateOrganicCrackSystem() {
    this.branches = [];
    const W = this.width;
    const H = this.height;

    // Subdivisión fractal orgánica de un segmento
    const fractalize = (p0: CrackPoint, p1: CrackPoint, depth: number, roughness: number): CrackPoint[] => {
      if (depth === 0) return [p0, p1];

      const midX = (p0.x + p1.x) * 0.5;
      const midY = (p0.y + p1.y) * 0.5;
      const dx = p1.x - p0.x;
      const dy = p1.y - p0.y;
      const len = Math.sqrt(dx * dx + dy * dy);

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

    // 1. TRONCO PRINCIPAL DE LA HERIDA (Diagonal sinuosa con fracturas)
    const trunkNodes: CrackPoint[] = [
      { x: W * 0.06, y: H * 0.88 },
      { x: W * 0.22, y: H * 0.78 },
      { x: W * 0.38, y: H * 0.62 },
      { x: W * 0.52, y: H * 0.48 },
      { x: W * 0.68, y: H * 0.36 },
      { x: W * 0.82, y: H * 0.22 },
      { x: W * 0.94, y: H * 0.08 }
    ];

    let fullMainPoints: CrackPoint[] = [];
    for (let i = 0; i < trunkNodes.length - 1; i++) {
      const segPts = fractalize(trunkNodes[i], trunkNodes[i + 1], 4, 0.22);
      if (i > 0) segPts.shift();
      fullMainPoints = fullMainPoints.concat(segPts);
    }

    this.branches.push({
      points: fullMainPoints,
      width: 5.5,
      filledRatio: 0.0,
      targetFilledRatio: 0.0,
      isMainTrunk: true,
      glowPulse: 0
    });

    // 2. RAMA SECUNDARIA IZQUIERDA
    const branchL1 = fractalize({ x: W * 0.38, y: H * 0.62 }, { x: W * 0.20, y: H * 0.52 }, 3, 0.25);
    const branchL2 = fractalize({ x: W * 0.20, y: H * 0.52 }, { x: W * 0.04, y: H * 0.48 }, 3, 0.22);
    this.branches.push({
      points: branchL1.concat(branchL2.slice(1)),
      width: 3.2,
      filledRatio: 0.0,
      targetFilledRatio: 0.0,
      isMainTrunk: false,
      glowPulse: 0
    });

    // 3. RAMA SECUNDARIA SUPERIOR VERTICAL
    const branchUp = fractalize({ x: W * 0.52, y: H * 0.48 }, { x: W * 0.48, y: H * 0.18 }, 4, 0.24);
    const branchUpTip = fractalize({ x: W * 0.48, y: H * 0.18 }, { x: W * 0.42, y: H * 0.02 }, 2, 0.20);
    this.branches.push({
      points: branchUp.concat(branchUpTip.slice(1)),
      width: 3.5,
      filledRatio: 0.0,
      targetFilledRatio: 0.0,
      isMainTrunk: false,
      glowPulse: 0
    });

    // 4. RAMA SECUNDARIA DERECHA INFERIOR
    const branchR1 = fractalize({ x: W * 0.52, y: H * 0.48 }, { x: W * 0.68, y: H * 0.64 }, 3, 0.24);
    const branchR2 = fractalize({ x: W * 0.68, y: H * 0.64 }, { x: W * 0.88, y: H * 0.68 }, 3, 0.20);
    this.branches.push({
      points: branchR1.concat(branchR2.slice(1)),
      width: 3.0,
      filledRatio: 0.0,
      targetFilledRatio: 0.0,
      isMainTrunk: false,
      glowPulse: 0
    });

    // 5. FRACTURAS CAPILARES FINAS (Imagen 1)
    const cap1 = fractalize({ x: W * 0.68, y: H * 0.36 }, { x: W * 0.84, y: H * 0.42 }, 3, 0.25);
    const cap2 = fractalize({ x: W * 0.82, y: H * 0.22 }, { x: W * 0.94, y: H * 0.28 }, 2, 0.22);
    const cap3 = fractalize({ x: W * 0.22, y: H * 0.78 }, { x: W * 0.14, y: H * 0.68 }, 2, 0.22);

    this.branches.push({ points: cap1, width: 1.8, filledRatio: 0.0, targetFilledRatio: 0.0, isMainTrunk: false, glowPulse: 0 });
    this.branches.push({ points: cap2, width: 1.5, filledRatio: 0.0, targetFilledRatio: 0.0, isMainTrunk: false, glowPulse: 0 });
    this.branches.push({ points: cap3, width: 1.6, filledRatio: 0.0, targetFilledRatio: 0.0, isMainTrunk: false, glowPulse: 0 });
  }

  /**
   * Deposita curación de oro líquido directamente en la herida al presionar teclas Q-P o clic.
   * La respuesta es inmediata y visible.
   */
  public addHealingEnergy(cursorX: number, cursorY: number, amount: number = 0.12) {
    // Generar un destello dorado expansivo en el punto de contacto
    this.goldFlashes.push({
      x: cursorX,
      y: cursorY,
      radius: 8,
      maxRadius: 120,
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
    target.targetFilledRatio = Math.min(1.0, target.targetFilledRatio + amount * 1.5);
    target.glowPulse = 1.0;

    // También propagar oro hacia el tronco principal si no estaba seleccionado
    if (closestBranchIdx !== 0) {
      this.branches[0].targetFilledRatio = Math.min(1.0, this.branches[0].targetFilledRatio + amount * 0.5);
      this.branches[0].glowPulse = 0.8;
    }

    // Si la rama seleccionada ya está casi llena, llenar la siguiente rama abierta
    for (const b of this.branches) {
      if (b.targetFilledRatio < 0.95) {
        b.targetFilledRatio = Math.min(1.0, b.targetFilledRatio + amount * 0.4);
        b.glowPulse = 0.7;
        break;
      }
    }
  }

  /**
   * Actualiza y renderiza tanto la herida visible como la curación de oro Kintsugi.
   */
  public updateAndRender(dt: number, time: number) {
    const ctx = this.ctx;

    // Fondo negro puro permanente (#000000)
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Pulsación sutil de respiración en la herida abierta
    const woundPulse = Math.sin(time * 3.0) * 0.15 + 0.85;

    // ==============================================================
    // PASO 1: RENDERIZAR LA HERIDA ABIERTA (Resplandor Carmesí y Abismo)
    // ==============================================================
    for (const branch of this.branches) {
      const pts = branch.points;
      if (pts.length < 2) continue;

      // Actualizar llenado suave de oro
      if (branch.filledRatio < branch.targetFilledRatio) {
        branch.filledRatio = Math.min(branch.targetFilledRatio, branch.filledRatio + dt * 0.9);
      }
      if (branch.glowPulse > 0) {
        branch.glowPulse = Math.max(0, branch.glowPulse - dt * 2.0);
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

          // 1. Resplandor carmesí/rubí profundo de la carne herida
          const glowAlpha = (0.35 * woundPulse).toFixed(2);
          ctx.strokeStyle = `rgba(255, 23, 68, ${glowAlpha})`;
          ctx.lineWidth = branch.width * 2.8;
          ctx.stroke();

          // 2. Borde de corte vivo (rojo fuego intenso)
          const coreAlpha = (0.75 * woundPulse).toFixed(2);
          ctx.strokeStyle = `rgba(213, 0, 50, ${coreAlpha})`;
          ctx.lineWidth = branch.width * 1.4;
          ctx.stroke();

          // 3. Fisura interna oscura del desgarro
          ctx.strokeStyle = '#050203';
          ctx.lineWidth = Math.max(1.0, branch.width * 0.5);
          ctx.stroke();
        }
      }
    }

    // ==============================================================
    // PASO 2: RENDERIZAR LA CURACIÓN DE ORO KINTSUGI (Imagen 1)
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

      // 1. Halo áureo cálido de anclaje (#b8860b)
      ctx.strokeStyle = `rgba(184, 134, 11, ${(0.45 + pulseExtra * 0.3).toFixed(2)})`;
      ctx.lineWidth = w * 1.6 + pulseExtra * 2.0;
      ctx.stroke();

      // 2. Vena de oro 24K puro metálico (#ffd700 / #e5be57)
      ctx.strokeStyle = 'rgba(235, 195, 80, 0.95)';
      ctx.lineWidth = w + pulseExtra * 1.0;
      ctx.stroke();

      // 3. Reflejo especular blanco-dorado reflectante (#ffffff / #fff9e6)
      ctx.strokeStyle = 'rgba(255, 252, 240, 1.0)';
      ctx.lineWidth = Math.max(0.9, w * 0.4);
      ctx.stroke();
    }

    // ==============================================================
    // PASO 3: DESTELLOS DE CURACIÓN DORADA AL TOCAR TECLAS
    // ==============================================================
    for (let i = this.goldFlashes.length - 1; i >= 0; i--) {
      const f = this.goldFlashes[i];
      f.radius += dt * 180.0;
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
    let sum = 0;
    for (const b of this.branches) {
      sum += b.filledRatio;
    }
    return sum / this.branches.length;
  }

  public clear() {
    for (const b of this.branches) {
      b.filledRatio = 0.0;
      b.targetFilledRatio = 0.0;
      b.glowPulse = 0;
    }
    this.goldFlashes = [];
  }
}
