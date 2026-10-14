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

export class FlowAgent {
  public x: number;
  public y: number;
  public speed: number;
  public life: number;
  public maxLife: number;
  public bin: number;

  public maxHistory: number;
  public historyX: Float32Array;
  public historyY: Float32Array;
  public historyHead: number;
  public historyCount: number;

  constructor(x: number, y: number, maxHistory: number) {
    this.x = x;
    this.y = y;
    this.speed = 2.0 + Math.random() * 1.1;
    this.maxLife = 220 + Math.floor(Math.random() * 180);
    this.life = Math.floor(Math.random() * this.maxLife);
    this.bin = 0;

    this.maxHistory = maxHistory;
    this.historyX = new Float32Array(maxHistory);
    this.historyY = new Float32Array(maxHistory);
    this.historyHead = 0;
    this.historyCount = 1;
    this.historyX[0] = x;
    this.historyY[0] = y;
  }

  public pushPosition(nx: number, ny: number) {
    this.historyHead = (this.historyHead + 1) % this.maxHistory;
    this.historyX[this.historyHead] = nx;
    this.historyY[this.historyHead] = ny;
    if (this.historyCount < this.maxHistory) {
      this.historyCount++;
    }
  }

  public reset(nx: number, ny: number) {
    this.x = nx;
    this.y = ny;
    this.historyHead = 0;
    this.historyCount = 1;
    this.historyX[0] = nx;
    this.historyY[0] = ny;
    this.life = this.maxLife;
  }
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
    'rgba(57, 255, 20, 0.85)',   // 0: Verde neón eléctrico
    'rgba(34, 197, 94, 0.85)',   // 1: Verde esmeralda vivo
    'rgba(16, 185, 129, 0.85)',  // 2: Turquesa esmeralda
    'rgba(20, 184, 166, 0.85)',  // 3: Aguamarina
    'rgba(6, 182, 212, 0.88)',   // 4: Cian eléctrico intenso
    'rgba(0, 240, 255, 0.90)',   // 5: Cian radiante
    'rgba(56, 189, 248, 0.88)',  // 6: Azul cerúleo luminoso
    'rgba(37, 99, 235, 0.85)',   // 7: Azul cobalto profundo
    'rgba(79, 70, 229, 0.85)',   // 8: Azul índigo
    'rgba(99, 102, 241, 0.88)',  // 9: Índigo eléctrico
    'rgba(139, 92, 246, 0.88)',  // 10: Violeta / púrpura radiante
    'rgba(168, 85, 247, 0.88)',  // 11: Púrpura orquídea
    'rgba(217, 70, 239, 0.85)',  // 12: Magenta sutil
    'rgba(245, 158, 11, 0.85)',  // 13: Ámbar dorado cálido
    'rgba(234, 179, 8, 0.86)',   // 14: Oro / amarillo sol
    'rgba(132, 204, 22, 0.85)'   // 15: Verde lima chartreuse
  ];

  constructor(w: number, h: number, count: number = 2400) {
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
   * Inicializa los agentes distribuidos de forma homogénea con cuerpos alargados.
   */
  public initAgents() {
    this.agents = [];
    const W = this.width;
    const H = this.height;

    for (let i = 0; i < this.count; i++) {
      const px = Math.random() * W;
      const py = Math.random() * H;
      // Longitud del filamento: 26 a 40 puntos para que sean visiblemente más largos
      const filamentLen = 26 + Math.floor(Math.random() * 15);
      this.agents.push(new FlowAgent(px, py, filamentLen));
    }
  }

  /**
   * Actualiza el movimiento y renderiza los agentes alargados sobre fondo negro limpio.
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

    // =========================================================================
    // FONDO LIMPIO (CERO SUCIEDAD):
    // Limpiamos completamente el lienzo a negro puro (#000000) en cada frame.
    // No quedan estelas viejas ni manchas acumuladas en el fondo.
    // =========================================================================
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 1.35;

    const timeScale = Math.min(dt * 60.0, 2.0);
    const numAgents = this.agents.length;
    const numBins = this.palette.length;

    // Agrupación de agentes por bin de color para un renderizado ultra-rápido en 16 trazos
    const binAgents: FlowAgent[][] = Array.from({ length: numBins }, () => []);

    for (let i = 0; i < numAgents; i++) {
      const p = this.agents[i];

      // Muestrear dirección del campo vectorial en O(1)
      const flow = flowEngine.sampleVelocity(p.x, p.y);

      // Desplazar el agente en la dirección del flujo
      p.x += flow.vx * p.speed * timeScale;
      p.y += flow.vy * p.speed * timeScale;
      p.life--;

      // =========================================================================
      // BORDES TOROIDALES CONTINUOS (SIN PAREDES):
      // Si salen por un extremo, reaparecen por el opuesto sin chocar.
      // =========================================================================
      if (p.x < 0) {
        p.x += W;
      } else if (p.x >= W) {
        p.x -= W;
      }

      if (p.y < 0) {
        p.y += H;
      } else if (p.y >= H) {
        p.y -= H;
      }

      // Almacenar la nueva posición en el historial del filamento
      p.pushPosition(p.x, p.y);

      // Respawn suave al terminar su ciclo de vida para poblar áreas de forma uniforme
      if (p.life <= 0) {
        p.reset(Math.random() * W, Math.random() * H);
      }

      // Determinar el bin de color según el ángulo de flujo (Espectro cromático continuo)
      const normAngle = (((flow.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2);
      const bin = Math.floor(normAngle * numBins) % numBins;
      p.bin = bin;
      binAgents[bin].push(p);
    }

    // Dibujar los filamentos alargados agrupados por color
    const halfW = W * 0.5;
    const halfH = H * 0.5;

    for (let b = 0; b < numBins; b++) {
      const list = binAgents[b];
      if (list.length === 0) continue;

      ctx.beginPath();
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        const count = p.historyCount;
        if (count < 2) continue;

        const maxH = p.maxHistory;
        const headIdx = p.historyHead;

        // Comenzar desde la cabeza del filamento
        let prevX = p.historyX[headIdx];
        let prevY = p.historyY[headIdx];
        ctx.moveTo(prevX, prevY);

        // Trazar hacia atrás a lo largo del cuerpo alargado del filamento
        for (let j = 1; j < count; j++) {
          const idx = (headIdx - j + maxH) % maxH;
          const currX = p.historyX[idx];
          const currY = p.historyY[idx];

          // Detección de salto toroidal: si los puntos cruzan la pantalla, romper el trazo
          const dx = Math.abs(currX - prevX);
          const dy = Math.abs(currY - prevY);

          if (dx > halfW || dy > halfH) {
            // No trazar línea entre los dos extremos de la pantalla
            ctx.moveTo(currX, currY);
          } else {
            ctx.lineTo(currX, currY);
          }

          prevX = currX;
          prevY = currY;
        }
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
    // Inyectar filamentos de energía en la posición del ratón/interacción
    const countToSpawn = 16;
    for (let i = 0; i < countToSpawn && i < this.agents.length; i++) {
      const idx = Math.floor(Math.random() * this.agents.length);
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 35;
      const nx = x + Math.cos(angle) * radius;
      const ny = y + Math.sin(angle) * radius;
      this.agents[idx].reset(nx, ny);
    }
  }

  public getHealingProgress(): number {
    return 0.0;
  }
}
