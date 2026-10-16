/**
 * agentSystem.ts
 * Sistema de Agentes Autónomos (Filamentos de Flujo) para HEAL:
 * - Cinemática de Reynolds (posición, velocidad, aceleración, fuerza máxima de giro).
 * - Percepción sensorial local de 3 sondas (Physarum 3-probe).
 * - Cero agentes inmóviles: velocidad continua y dinámica sin estancamiento.
 * - Bordes toroidales sin paredes.
 * - Paletas de alta luminosidad (Azul natural, Rojo herida, Oro Kintsugi).
 */

import { FlowField } from './flowField';

export enum AgentType {
  BLUE = 0,
  RED = 1,
  GOLD = 2
}

export class Agent {
  public x: number;
  public y: number;
  public prevX: number;
  public prevY: number;

  public vx: number;
  public vy: number;
  public ax: number;
  public ay: number;

  public heading: number;
  public maxSpeed: number;
  public maxForce: number;

  public colorIndex: number = 0; // Tono específico dentro de la paleta activa

  // Parámetros sensoriales individuales
  public sensorDist: number;
  public sensorAngle: number;
  public turnSpeed: number;

  public life: number;
  public maxLife: number;

  // Morfología de gota de lluvia / lágrima
  public dropRadius: number;
  public dropStretch: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.prevX = x;
    this.prevY = y;

    const angle = Math.random() * Math.PI * 2;
    this.heading = angle;
    this.maxSpeed = 1.05 + Math.random() * 0.70; // Velocidad base más lenta, fluida y contemplativa
    this.vx = Math.cos(angle) * this.maxSpeed;
    this.vy = Math.sin(angle) * this.maxSpeed;
    this.ax = 0;
    this.ay = 0;

    this.maxForce = 0.08 + Math.random() * 0.05;
    this.sensorDist = 18.0 + Math.random() * 14.0;
    this.sensorAngle = (22.0 + Math.random() * 18.0) * (Math.PI / 180.0);
    this.turnSpeed = 0.10 + Math.random() * 0.05;

    this.maxLife = 220 + Math.floor(Math.random() * 180);
    this.life = Math.floor(Math.random() * this.maxLife);

    this.colorIndex = Math.floor(Math.random() * 5);

    // Dimensiones de gota de lluvia / lágrima (micro-gotas a lágrimas densas con forma ahusada)
    this.dropRadius = 1.15 + Math.random() * 1.35;
    this.dropStretch = 1.25 + Math.random() * 0.35;
  }

  public reset(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.prevX = x;
    this.prevY = y;
    this.life = this.maxLife;
  }

  public applyForce(fx: number, fy: number) {
    this.ax += fx;
    this.ay += fy;
  }
}

export class AgentSystem {
  public width: number;
  public height: number;
  public count: number;

  public agents: Agent[] = [];

  // Paleta azul orgánica ultra-luminosa (5 tonos vibrantes y radiantes de celeste a cobalto brillante)
  public readonly bluePalette = [
    'rgba(240, 249, 255, 0.96)', // Destello blanco-celeste eléctrico de altísima luminosidad
    'rgba(186, 230, 253, 0.90)', // Celeste cian muy brillante
    'rgba(56, 189, 248, 0.84)',  // Cian eléctrico
    'rgba(14, 165, 233, 0.78)',  // Azul cerúleo vivo
    'rgba(37, 99, 235, 0.72)'    // Azul cobalto luminoso
  ];

  // Paleta roja intensa del núcleo (5 tonos carmesí y escarlata)
  public readonly redPalette = [
    'rgba(255, 228, 230, 0.94)', // Resplandor especular claro
    'rgba(251, 113, 133, 0.88)', // Rosa herida vivo
    'rgba(244, 63, 94, 0.82)',   // Carmesí intenso
    'rgba(225, 29, 72, 0.78)',   // Escarlata profundo
    'rgba(159, 18, 57, 0.68)'    // Borgoña / sangre oscura
  ];

  // Paleta roja suave / difuminada (tonos orquídea, magenta y violeta etéreo que se funden con el azul)
  public readonly redSoftPalette = [
    'rgba(244, 114, 182, 0.76)', // Rosa suave luminosa
    'rgba(232, 121, 249, 0.70)', // Magenta translúcido
    'rgba(192, 132, 252, 0.64)', // Violeta etéreo
    'rgba(168, 85, 247, 0.58)', // Púrpura difuminado
    'rgba(129, 140, 248, 0.50)'  // Índigo suave que se funde con el azul
  ];

  // Paleta dorada pura del núcleo (5 tonos de oro líquido resplandeciente 24K)
  public readonly goldPalette = [
    'rgba(255, 250, 220, 0.98)', // Brillo blanco-dorado especular
    'rgba(254, 240, 138, 0.92)', // Oro claro brillante
    'rgba(250, 204, 21, 0.88)',  // Oro 24K puro
    'rgba(245, 158, 11, 0.82)',  // Ámbar cálido
    'rgba(217, 119, 6, 0.72)'    // Bronce / oro antiguo
  ];

  // Paleta dorada suave / difuminada (tonos ámbar suave, miel y verde-aurora que se funden con el azul)
  public readonly goldSoftPalette = [
    'rgba(253, 224, 71, 0.80)', // Oro claro pastel
    'rgba(251, 191, 36, 0.72)', // Ámbar suave
    'rgba(217, 119, 6, 0.62)',  // Miel translúcida
    'rgba(110, 231, 183, 0.58)', // Turquesa dorado / verde esmeralda translúcido
    'rgba(56, 189, 248, 0.50)'  // Cian que se funde naturalmente con el río azul
  ];

  constructor(w: number, h: number, count: number = 3800) {
    this.width = w;
    this.height = h;
    this.count = count;

    this.initAgents();
  }

  public resize(w: number, h: number) {
    this.width = w;
    this.height = h;
  }

  public initAgents() {
    this.agents = [];
    const W = this.width;
    const H = this.height;

    for (let i = 0; i < this.count; i++) {
      const px = Math.random() * W;
      const py = Math.random() * H;
      this.agents.push(new Agent(px, py));
    }
  }

  /**
   * Actualiza el movimiento dinámico y la cinemática fluida de los agentes a 60 FPS
   */
  public update(dt: number, flowField: FlowField) {
    const W = this.width;
    const H = this.height;
    const timeScale = Math.min(dt * 60.0, 2.0);
    const numAgents = this.agents.length;

    for (let i = 0; i < numAgents; i++) {
      const a = this.agents[i];
      a.prevX = a.x;
      a.prevY = a.y;

      // 1. Muestreo de Sensores Locales (Physarum 3-probe perception)
      const currentAngle = Math.atan2(a.vy, a.vx);
      a.heading = currentAngle;

      const fDist = a.sensorDist;
      const sAngle = a.sensorAngle;

      // Sonda frontal
      const sFrontX = a.x + Math.cos(a.heading) * fDist;
      const sFrontY = a.y + Math.sin(a.heading) * fDist;

      // Sonda izquierda
      const sLeftX = a.x + Math.cos(a.heading - sAngle) * fDist;
      const sLeftY = a.y + Math.sin(a.heading - sAngle) * fDist;

      // Sonda derecha
      const sRightX = a.x + Math.cos(a.heading + sAngle) * fDist;
      const sRightY = a.y + Math.sin(a.heading + sAngle) * fDist;

      // Muestreo del campo vectorial
      const flowFront = flowField.sampleVelocity(sFrontX, sFrontY);
      const flowLeft = flowField.sampleVelocity(sLeftX, sLeftY);
      const flowRight = flowField.sampleVelocity(sRightX, sRightY);

      // Dirección deseada determinada por el vector local
      const desiredAngle = Math.atan2(flowFront.vy, flowFront.vx);

      // 2. Regla de Steering (Reynolds): Fuerza proporcional a la diferencia angular
      let angleDiff = desiredAngle - a.heading;
      angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));

      const turn = Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), a.turnSpeed);
      a.heading += turn;

      // Velocidad objetivo
      const targetVx = Math.cos(a.heading) * a.maxSpeed;
      const targetVy = Math.sin(a.heading) * a.maxSpeed;

      // Fuerza de gobierno limitada
      const steerX = Math.min(Math.max(targetVx - a.vx, -a.maxForce), a.maxForce);
      const steerY = Math.min(Math.max(targetVy - a.vy, -a.maxForce), a.maxForce);

      a.applyForce(steerX, steerY);

      // Integración cinemática
      a.vx += a.ax * timeScale;
      a.vy += a.ay * timeScale;
      a.ax = 0;
      a.ay = 0;

      // Limitar a velocidad máxima y asegurar velocidad mínima fluida
      const curSpeed = Math.hypot(a.vx, a.vy);
      if (curSpeed > a.maxSpeed) {
        a.vx = (a.vx / curSpeed) * a.maxSpeed;
        a.vy = (a.vy / curSpeed) * a.maxSpeed;
      } else if (curSpeed < 0.60) {
        a.vx = Math.cos(a.heading) * 0.85;
        a.vy = Math.sin(a.heading) * 0.85;
      }

      // Actualizar posición
      a.x += a.vx * timeScale;
      a.y += a.vy * timeScale;
      a.life--;

      // 3. Bordes Toroidales Continuos (Sin paredes ni colisiones)
      let wrapped = false;
      if (a.x < 0) {
        a.x += W;
        wrapped = true;
      } else if (a.x >= W) {
        a.x -= W;
        wrapped = true;
      }

      if (a.y < 0) {
        a.y += H;
        wrapped = true;
      } else if (a.y >= H) {
        a.y -= H;
        wrapped = true;
      }

      // Respawn suave al terminar ciclo de vida para poblar áreas uniformemente
      if (a.life <= 0) {
        a.x = Math.random() * W;
        a.y = Math.random() * H;
        a.prevX = a.x;
        a.prevY = a.y;
        a.life = a.maxLife;
        wrapped = true;
      }

      if (wrapped) {
        a.prevX = a.x;
        a.prevY = a.y;
      }
    }
  }
}
