/**
 * particleSystem.ts
 * Sistema de Agentes de Flujo Monocromático Blanco (Fiel a la Imagen de Referencia):
 * - TODOS BLANCOS: Tonalidades puras de blanco y plata resplandeciente sobre fondo negro puro.
 * - MÁS DELGADOS: Filamentos ultra-finos (0.8px) como hebras de seda peinada.
 * - OCUPAN TODA LA PANTALLA: 5000 agentes distribuidos uniformemente con respawn continuo
 *   que llenan el 100% del lienzo sin dejar espacios vacíos.
 * - RÍOS RESPLANDECIENTES: Los afluentes convergen en intensos cañones de luz blanca pura (#ffffff).
 * - BORDES TOROIDALES CONTINUOS: Los agentes fluyen de extremo a extremo sin paredes ni cortes.
 * - MÁXIMA OPTIMIZACIÓN (60 FPS): Renderizado en un ÚNICO lote de trazo por frame (1 stroke call).
 */

import { FlowFieldEngine } from './flowField';
import { HealParameters } from './parameters';

export class FlowAgent {
  public x: number;
  public y: number;
  public prevX: number;
  public prevY: number;
  public speed: number;
  public life: number;
  public maxLife: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.prevX = x;
    this.prevY = y;
    this.speed = 1.3 + Math.random() * 0.9;
    this.maxLife = 180 + Math.floor(Math.random() * 160);
    this.life = Math.floor(Math.random() * this.maxLife);
  }

  public reset(nx: number, ny: number) {
    this.x = nx;
    this.y = ny;
    this.prevX = nx;
    this.prevY = ny;
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

  constructor(w: number, h: number, count: number = 5000) {
    this.width = w;
    this.height = h;
    this.count = count;

    this.canvas = document.createElement('canvas');
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: false })!;

    // Fondo negro puro inicial (#000000)
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
   * Inicializa 5000 agentes distribuidos uniformemente por todo el lienzo.
   */
  public initAgents() {
    this.agents = [];
    const W = this.width;
    const H = this.height;

    for (let i = 0; i < this.count; i++) {
      const px = Math.random() * W;
      const py = Math.random() * H;
      this.agents.push(new FlowAgent(px, py));
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
    // Desvanecimiento suave a negro puro (#000000)
    // Permite que miles de trazos blancos ultrafinos se acumulen en cañones resplandecientes (#ffffff)
    // y filamentos de seda plateada que cubren el 100% de la pantalla sin manchas de color.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.024)';
    ctx.fillRect(0, 0, W, H);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 0.8; // Ultra-delgados (finos como cabellos de seda)

    const timeScale = Math.min(dt * 60.0, 2.0);
    const numAgents = this.agents.length;

    // Trazado en un ÚNICO lote optimizado para 60 FPS estables (1 solo stroke call)
    ctx.beginPath();

    for (let i = 0; i < numAgents; i++) {
      const p = this.agents[i];
      p.prevX = p.x;
      p.prevY = p.y;

      // Muestrear dirección del flujo en O(1)
      const flow = flowEngine.sampleVelocity(p.x, p.y);

      // Desplazar el agente suavemente a lo largo de la corriente
      p.x += flow.vx * p.speed * timeScale;
      p.y += flow.vy * p.speed * timeScale;
      p.life--;

      // BORDES TOROIDALES CONTINUOS (SIN PAREDES):
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

      // Respawn continuo uniforme para poblar permanentemente el 100% de la pantalla sin huecos
      if (p.life <= 0) {
        p.x = Math.random() * W;
        p.y = Math.random() * H;
        p.prevX = p.x;
        p.prevY = p.y;
        p.life = p.maxLife;
        wrapped = true;
      }

      // Si cruzó el borde toroidal, no trazar línea entre los dos extremos de la pantalla
      if (wrapped) {
        p.prevX = p.x;
        p.prevY = p.y;
        continue;
      }

      ctx.moveTo(p.prevX, p.prevY);
      ctx.lineTo(p.x, p.y);
    }

    // Todos blancos: trazo blanco translúcido que se acumula en ríos de luz blanca pura (#ffffff)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.stroke();
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
    // Inyectar filamentos de luz blanca en la posición del ratón/interacción
    const countToSpawn = 24;
    for (let i = 0; i < countToSpawn && i < this.agents.length; i++) {
      const idx = Math.floor(Math.random() * this.agents.length);
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 40;
      const nx = x + Math.cos(angle) * radius;
      const ny = y + Math.sin(angle) * radius;
      this.agents[idx].reset(nx, ny);
    }
  }

  public getHealingProgress(): number {
    return 0.0;
  }
}
