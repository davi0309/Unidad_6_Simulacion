/**
 * particleSystem.ts
 * Sistema de Agentes de Flujo de Filamentos Sedosos (Fiel a la Imagen de Referencia):
 * - BORDES SIN PAREDES (TORO CONTINUO): Los agentes que salen por cualquier borde emergen
 *   por el opuesto sin interrupción ni paredes.
 * - ESTÉTICA DE LA IMAGEN: Miles de hebras sedosas finas que se trenzan en ríos luminosos.
 * - PALETA CROMÁTICA EXACTA: Espectro armónico de verde neón, esmeralda, cian eléctrico,
 *   azul cobalto, índigo, púrpura y toques de ámbar según el ángulo del flujo.
 * - ACUMULACIÓN Y PERSISTENCIA SUAVE: Estelas que se acumulan sobre fondo negro puro
 *   formando la intrincada red dendrítica de la imagen de referencia.
 * - RENDIMIENTO 60 FPS: Agrupación por lotes de color para renderizar 3500 agentes a máxima velocidad.
 */

import { FlowFieldEngine } from './flowField';
import { HealParameters } from './parameters';

export interface FlowAgent {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  speed: number;
  life: number;
  maxLife: number;
  bin: number;
}

export class FlowParticleSystem {
  public width: number;
  public height: number;
  public count: number;

  public agents: FlowAgent[] = [];
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;

  // 16 colores armónicos exactos de la imagen de referencia (Verde Neón -> Cian -> Azul -> Púrpura -> Ámbar -> Chartreuse)
  private readonly palette = [
    'rgba(57, 255, 20, 0.68)',   // 0: Verde neón eléctrico
    'rgba(34, 197, 94, 0.68)',   // 1: Verde esmeralda vivo
    'rgba(16, 185, 129, 0.68)',  // 2: Turquesa esmeralda
    'rgba(20, 184, 166, 0.68)',  // 3: Aguamarina
    'rgba(6, 182, 212, 0.70)',   // 4: Cian eléctrico intenso
    'rgba(0, 240, 255, 0.72)',   // 5: Cian radiante
    'rgba(56, 189, 248, 0.70)',  // 6: Azul cerúleo luminoso
    'rgba(37, 99, 235, 0.68)',   // 7: Azul cobalto profundo
    'rgba(79, 70, 229, 0.68)',   // 8: Azul índigo
    'rgba(99, 102, 241, 0.70)',  // 9: Índigo eléctrico
    'rgba(139, 92, 246, 0.70)',  // 10: Violeta / púrpura radiante
    'rgba(168, 85, 247, 0.70)',  // 11: Púrpura orquídea
    'rgba(217, 70, 239, 0.68)',  // 12: Magenta sutil
    'rgba(245, 158, 11, 0.68)',  // 13: Ámbar dorado cálido
    'rgba(234, 179, 8, 0.68)',   // 14: Oro / amarillo sol
    'rgba(132, 204, 22, 0.68)'   // 15: Verde lima chartreuse
  ];

  constructor(w: number, h: number, count: number = 3400) {
    this.width = w;
    this.height = h;
    this.count = count;

    this.canvas = document.createElement('canvas');
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: false })!;

    // Fondo negro inicial (#000000)
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, w, h);

    this.initAgents();
  }

  public resize(w: number, h: number) {
    this.width = w;
    this.height = h;
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, w, h);
    this.initAgents();
  }

  /**
   * Inicializa los agentes distribuidos de forma homogénea en la pantalla.
   */
  public initAgents() {
    this.agents = [];
    const W = this.width;
    const H = this.height;

    for (let i = 0; i < this.count; i++) {
      const px = Math.random() * W;
      const py = Math.random() * H;
      const maxLife = 180 + Math.floor(Math.random() * 160);

      this.agents.push({
        x: px,
        y: py,
        prevX: px,
        prevY: py,
        speed: 1.8 + Math.random() * 1.2,
        life: Math.floor(Math.random() * maxLife), // Vida inicial desfasada para respawn continuo
        maxLife,
        bin: 0
      });
    }
  }

  /**
   * Actualiza el movimiento y dibuja los filamentos con la estética de la imagen de referencia.
   */
  public updateAndRender(
    dt: number,
    _time: number,
    flowEngine: FlowFieldEngine,
    _params?: HealParameters
  ) {
    const ctx = this.ctx;
    const W = this.width;
    const H = this.height;

    // Desvanecimiento suave continuo: permite que los trazos de filamentos se acumulen en ríos brillantes
    ctx.fillStyle = 'rgba(0, 0, 0, 0.026)';
    ctx.fillRect(0, 0, W, H);

    ctx.lineCap = 'round';
    ctx.lineWidth = 0.95;

    const timeScale = Math.min(dt * 60.0, 2.0);
    const numAgents = this.agents.length;
    const numBins = this.palette.length;

    // Lotes de trazo (1 por cada color de la paleta) para máximo rendimiento a 60 FPS
    const binStartsX: number[][] = Array.from({ length: numBins }, () => []);
    const binStartsY: number[][] = Array.from({ length: numBins }, () => []);
    const binEndsX: number[][] = Array.from({ length: numBins }, () => []);
    const binEndsY: number[][] = Array.from({ length: numBins }, () => []);

    for (let i = 0; i < numAgents; i++) {
      const p = this.agents[i];
      p.prevX = p.x;
      p.prevY = p.y;

      // Muestrear dirección del campo vectorial en O(1)
      const flow = flowEngine.sampleVelocity(p.x, p.y);

      // Desplazar el agente a lo largo de la corriente
      p.x += flow.vx * p.speed * timeScale;
      p.y += flow.vy * p.speed * timeScale;
      p.life--;

      // =========================================================================
      // BORDES TOROIDALES CONTINUOS (SIN PAREDES):
      // Si salen arriba, entran abajo; si salen a la derecha, entran por la izquierda.
      // =========================================================================
      let wrapped = false;
      if (p.x < 0) {
        p.x += W;
        wrapped = true;
      } else if (p.x >= W) {
        p.x -= W;
        wrapped = true;
      }

      if (p.y < 0) {
        p.y += H;
        wrapped = true;
      } else if (p.y >= H) {
        p.y -= H;
        wrapped = true;
      }

      // Respawn suave al terminar su ciclo de vida para alimentar afluentes de forma infinita
      if (p.life <= 0) {
        p.x = Math.random() * W;
        p.y = Math.random() * H;
        p.prevX = p.x;
        p.prevY = p.y;
        p.life = p.maxLife;
        wrapped = true;
      }

      // Si cruzó el borde o reapareció, no trazar línea entre los extremos
      if (wrapped) {
        p.prevX = p.x;
        p.prevY = p.y;
        continue;
      }

      // Determinar el color según el ángulo de flujo (Espectro cromático de la imagen)
      const normAngle = (((flow.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2);
      const bin = Math.floor(normAngle * numBins) % numBins;

      binStartsX[bin].push(p.prevX);
      binStartsY[bin].push(p.prevY);
      binEndsX[bin].push(p.x);
      binEndsY[bin].push(p.y);
    }

    // Dibujar los lotes por color
    for (let b = 0; b < numBins; b++) {
      const startsX = binStartsX[b];
      if (startsX.length === 0) continue;

      const startsY = binStartsY[b];
      const endsX = binEndsX[b];
      const endsY = binEndsY[b];

      ctx.beginPath();
      for (let k = 0; k < startsX.length; k++) {
        ctx.moveTo(startsX[k], startsY[k]);
        ctx.lineTo(endsX[k], endsY[k]);
      }
      ctx.strokeStyle = this.palette[b];
      ctx.stroke();
    }
  }

  public reset() {
    const ctx = this.ctx;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, this.width, this.height);
    this.initAgents();
  }

  public initUniformParticles() {
    this.initAgents();
  }

  public addHealingEnergy(x: number, y: number, _amount: number = 0.25) {
    // Inyectar un racimo sutil de agentes en la posición del mouse/curación
    const countToSpawn = 12;
    for (let i = 0; i < countToSpawn && i < this.agents.length; i++) {
      const idx = Math.floor(Math.random() * this.agents.length);
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 30;
      this.agents[idx].x = x + Math.cos(angle) * radius;
      this.agents[idx].y = y + Math.sin(angle) * radius;
      this.agents[idx].prevX = this.agents[idx].x;
      this.agents[idx].prevY = this.agents[idx].y;
      this.agents[idx].life = this.agents[idx].maxLife;
    }
  }

  public getHealingProgress(): number {
    return 0.0;
  }
}
