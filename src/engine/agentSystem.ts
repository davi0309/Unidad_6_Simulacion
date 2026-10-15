/**
 * agentSystem.ts
 * Sistema de Agentes Autónomos con Percepción Local para HEAL:
 * - Cinemática de Reynolds (posición, velocidad, aceleración, fuerza máxima de giro).
 * - Percepción sensorial local con 3 sondas direccionales (Frontal, Izquierda, Derecha).
 * - 3 Estados de agente: AZUL (flujo base), ROJO (herida/inflamación), DORADO (reparador Kintsugi).
 * - Comportamiento emergente sin líder central.
 * - Bordes toroidales sin paredes.
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

  public heading: number; // Ángulo actual de orientación
  public maxSpeed: number;
  public maxForce: number;

  public type: AgentType = AgentType.BLUE;
  public colorIndex: number = 0; // Tono específico dentro de su paleta

  // Parámetros sensoriales individuales (variación biológica para evitar movimientos mecánicos)
  public sensorDist: number;
  public sensorAngle: number;
  public turnSpeed: number;

  public life: number;
  public maxLife: number;

  // Memoria de herida o atracción
  public woundAffinity: number = 0.0;
  public goldEnergy: number = 0.0;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.prevX = x;
    this.prevY = y;

    const angle = Math.random() * Math.PI * 2;
    this.heading = angle;
    this.maxSpeed = 1.6 + Math.random() * 1.1; // Variación controlada de velocidad
    this.vx = Math.cos(angle) * this.maxSpeed;
    this.vy = Math.sin(angle) * this.maxSpeed;
    this.ax = 0;
    this.ay = 0;

    this.maxForce = 0.12 + Math.random() * 0.08;
    this.sensorDist = 18.0 + Math.random() * 14.0;
    this.sensorAngle = (22.0 + Math.random() * 18.0) * (Math.PI / 180.0);
    this.turnSpeed = 0.14 + Math.random() * 0.08;

    this.maxLife = 200 + Math.floor(Math.random() * 180);
    this.life = Math.floor(Math.random() * this.maxLife);

    this.colorIndex = Math.floor(Math.random() * 5);
  }

  public reset(x: number, y: number, type: AgentType = AgentType.BLUE) {
    this.x = x;
    this.y = y;
    this.prevX = x;
    this.prevY = y;
    this.type = type;
    this.woundAffinity = 0.0;
    this.goldEnergy = type === AgentType.GOLD ? 1.0 : 0.0;
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

  // Paleta roja de heridas (5 tonos carmesí y escarlata)
  public readonly redPalette = [
    'rgba(255, 228, 230, 0.85)', // Resplandor especular claro
    'rgba(251, 113, 133, 0.70)', // Rosa herida vivo
    'rgba(244, 63, 94, 0.65)',   // Carmesí intenso
    'rgba(225, 29, 72, 0.60)',   // Escarlata profundo
    'rgba(159, 18, 57, 0.50)'    // Borgoña / sangre oscura
  ];

  // Paleta dorada Kintsugi (5 tonos de oro líquido resplandeciente)
  public readonly goldPalette = [
    'rgba(255, 250, 220, 0.95)', // Brillo blanco-dorado especular
    'rgba(254, 240, 138, 0.85)', // Oro claro brillante
    'rgba(250, 204, 21, 0.80)',  // Oro 24K puro
    'rgba(245, 158, 11, 0.75)',  // Ámbar cálido
    'rgba(217, 119, 6, 0.65)'    // Bronce/oro antiguo
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
   * Transforma agentes existentes situados en el camino / afluente hacia una herida en agentes dorados.
   * Estos agentes recorren la corriente natural, depositan su oro sobre la herida y la sanan.
   */
  public convertUpstreamAgentsToGold(woundTarget: { x: number; y: number }, maxToConvert: number = 40): number {
    let converted = 0;

    // 1. Buscar agentes existentes en el corredor corriente arriba (radio 360px)
    for (let i = 0; i < this.agents.length && converted < maxToConvert; i++) {
      const a = this.agents[i];
      if (a.type === AgentType.GOLD) continue;

      const dx = a.x - woundTarget.x;
      const dy = a.y - woundTarget.y;
      const dist = Math.hypot(dx, dy);

      if (dist < 360.0) {
        a.type = AgentType.GOLD;
        a.goldEnergy = 1.0;
        // Reorientar suavemente hacia la entrada de la herida
        a.heading = Math.atan2(-dy, -dx);
        a.vx = Math.cos(a.heading) * a.maxSpeed * 1.25;
        a.vy = Math.sin(a.heading) * a.maxSpeed * 1.25;
        converted++;
      }
    }

    // 2. Si hay pocos agentes en ese radio, buscar en un radio más amplio
    if (converted < 20) {
      for (let i = 0; i < this.agents.length && converted < maxToConvert; i++) {
        const a = this.agents[i];
        if (a.type === AgentType.GOLD) continue;

        const dx = a.x - woundTarget.x;
        const dy = a.y - woundTarget.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 600.0) {
          a.type = AgentType.GOLD;
          a.goldEnergy = 1.0;
          a.heading = Math.atan2(-dy, -dx);
          a.vx = Math.cos(a.heading) * a.maxSpeed * 1.2;
          a.vy = Math.sin(a.heading) * a.maxSpeed * 1.2;
          converted++;
        }
      }
    }

    return converted;
  }

  /**
   * Actualiza el estado, percepción sensorial local y cinemática de los agentes.
   */
  public update(
    dt: number,
    flowField: FlowField,
    woundField?: { getWoundAt: (x: number, y: number) => { dist: number; intensity: number; isRepaired: boolean } | null; getNearestWound: (x: number, y: number) => { x: number; y: number; intensity: number; isRepaired: boolean } | null }
  ) {
    const W = this.width;
    const H = this.height;
    const timeScale = Math.min(dt * 60.0, 2.0);
    const numAgents = this.agents.length;

    for (let i = 0; i < numAgents; i++) {
      const a = this.agents[i];
      a.prevX = a.x;
      a.prevY = a.y;

      // 1. Percepción Local de Heridas
      const woundData = woundField ? woundField.getWoundAt(a.x, a.y) : null;

      if (woundData && !woundData.isRepaired) {
        if (a.type === AgentType.GOLD) {
          // El agente dorado está dentro de la fractura depositando su oro
          a.goldEnergy -= 0.012; // consume gradualmente su oro al transferirlo a la fractura
          if (a.goldEnergy <= 0) {
            // Transfirió su oro completamente: vuelve a ser un agente azul que sigue la corriente
            a.type = AgentType.BLUE;
            a.goldEnergy = 0;
          }
        } else {
          // El agente azul entra en la fractura y se transforma temporalmente a ROJO
          a.type = AgentType.RED;
        }
      } else {
        // Fuera de la herida
        if (a.type === AgentType.RED) {
          // Al salir del corredor de la herida, el agente rojo vuelve a azul inmediatamente
          a.type = AgentType.BLUE;
        } else if (a.type === AgentType.GOLD) {
          // Si el agente dorado ya entró y salió de una herida (su energía bajó), vuelve a azul
          if (a.goldEnergy < 0.95) {
            a.type = AgentType.BLUE;
            a.goldEnergy = 0;
          }
        }
      }

      // 2. Muestreo de Sensores Locales (Physarum 3-probe perception)
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

      // Evaluar dirección deseada según tipo de agente
      let desiredAngle = a.heading;

      if (a.type === AgentType.GOLD && woundField) {
        // Los agentes dorados tienen quimiotaxis hacia las heridas no reparadas
        const nearestWound = woundField.getNearestWound(a.x, a.y);
        if (nearestWound && !nearestWound.isRepaired) {
          const dx = nearestWound.x - a.x;
          const dy = nearestWound.y - a.y;
          const distToWound = Math.hypot(dx, dy);

          // Si perciben la herida dentro de su radio sensorial extendido
          if (distToWound < 450.0) {
            const woundAngle = Math.atan2(dy, dx);
            // Mezclar suavemente la dirección del flujo con la atracción a la herida
            const flow = flowField.sampleVelocity(a.x, a.y);
            const flowAngle = Math.atan2(flow.vy, flow.vx);
            desiredAngle = flowAngle * 0.35 + woundAngle * 0.65;
          } else {
            const flow = flowField.sampleVelocity(a.x, a.y);
            desiredAngle = Math.atan2(flow.vy, flow.vx);
          }
        } else {
          const flow = flowField.sampleVelocity(a.x, a.y);
          desiredAngle = Math.atan2(flow.vy, flow.vx);
        }
      } else if (a.type === AgentType.RED) {
        // Los agentes rojos sufren perturbación y desvío caótico en la herida
        const flow = flowField.sampleVelocity(a.x, a.y);
        const flowAngle = Math.atan2(flow.vy, flow.vx);
        // Desvío angular y turbulencia local
        const jitter = Math.sin(a.x * 0.05 + a.y * 0.05) * 1.2;
        desiredAngle = flowAngle + jitter;
      } else {
        // Agentes azules estándar: combinan el sensor frontal con el campo
        const flowFront = flowField.sampleVelocity(sFrontX, sFrontY);
        const flowLeft = flowField.sampleVelocity(sLeftX, sLeftY);
        const flowRight = flowField.sampleVelocity(sRightX, sRightY);

        // Alineación suave con el vector local
        desiredAngle = Math.atan2(flowFront.vy, flowFront.vx);
      }

      // 3. Regla de Steering (Reynolds): Fuerza proporcional a la diferencia angular
      let angleDiff = desiredAngle - a.heading;
      // Normalizar entre -PI y +PI
      angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));

      const turn = Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), a.turnSpeed);
      a.heading += turn;

      // Deseada velocidad
      const targetVx = Math.cos(a.heading) * a.maxSpeed;
      const targetVy = Math.sin(a.heading) * a.maxSpeed;

      // Fuerza de gobierno
      const steerX = Math.min(Math.max(targetVx - a.vx, -a.maxForce), a.maxForce);
      const steerY = Math.min(Math.max(targetVy - a.vy, -a.maxForce), a.maxForce);

      a.applyForce(steerX, steerY);

      // Integración cinemática
      a.vx += a.ax * timeScale;
      a.vy += a.ay * timeScale;
      a.ax = 0;
      a.ay = 0;

      // Limitar a velocidad máxima
      const curSpeed = Math.hypot(a.vx, a.vy);
      if (curSpeed > a.maxSpeed) {
        a.vx = (a.vx / curSpeed) * a.maxSpeed;
        a.vy = (a.vy / curSpeed) * a.maxSpeed;
      }

      // Actualizar posición
      a.x += a.vx * timeScale;
      a.y += a.vy * timeScale;
      a.life--;

      // 4. Bordes Toroidales Continuos (Sin paredes)
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
        a.type = AgentType.BLUE;
        a.goldEnergy = 0;
        wrapped = true;
      }

      if (wrapped) {
        a.prevX = a.x;
        a.prevY = a.y;
      }
    }
  }
}
