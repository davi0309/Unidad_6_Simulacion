/**
 * keyboardController.ts
 * Controlador de Interpretación Musical por Teclado para HEAL:
 * - 9 teclas expresivas: Q, W, E, R, T, Y, U, I, O.
 * - Prevención de repetición automática del sistema operativo (e.repeat).
 * - Superposición de efectos simultáneos.
 * - Tecla F para pantalla completa y Escape para reinicio.
 * - Limpieza de estados en pérdida de foco (window.blur).
 */

import { FlowField } from './flowField';
import { WoundManager } from './woundManager';
import { AgentSystem } from './agentSystem';

export interface KeyFeedback {
  key: string;
  label: string;
  action: string;
  time: number;
}

export class KeyboardController {
  private flowField: FlowField;
  private woundManager: WoundManager;
  private agentSystem: AgentSystem;

  public mousePos = { x: 0, y: 0 };
  public lastFeedback: KeyFeedback | null = null;
  public onRestartCallback?: () => void;

  constructor(
    flowField: FlowField,
    woundManager: WoundManager,
    agentSystem: AgentSystem,
    onRestart?: () => void
  ) {
    this.flowField = flowField;
    this.woundManager = woundManager;
    this.agentSystem = agentSystem;
    this.onRestartCallback = onRestart;

    this.mousePos = { x: window.innerWidth * 0.5, y: window.innerHeight * 0.5 };

    this.setupListeners();
  }

  private setupListeners() {
    window.addEventListener('pointermove', (e: PointerEvent) => {
      this.mousePos.x = e.clientX;
      this.mousePos.y = e.clientY;
    });

    // Clic con el ratón como herramienta secundaria para crear/desplazar heridas
    window.addEventListener('pointerdown', (e: PointerEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'BUTTON') return;
      this.triggerKey('KeyQ', e.clientX, e.clientY);
    });

    window.addEventListener('keydown', (e: KeyboardEvent) => {
      // Evitar conflictos con campos de texto
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;

      // Pantalla Completa: tecla F
      if (e.code === 'KeyF' && !e.repeat) {
        this.toggleFullscreen();
        return;
      }

      // Reinicio: Escape
      if (e.code === 'Escape' && !e.repeat) {
        if (this.onRestartCallback) this.onRestartCallback();
        return;
      }

      // Prevenir repetición automática continua del sistema operativo
      if (e.repeat) return;

      this.triggerKey(e.code, this.mousePos.x, this.mousePos.y);
    });

    // Manejo de pérdida de foco para evitar estados residuales
    window.addEventListener('blur', () => {
      // Seguridad de foco
    });
  }

  /**
   * Ejecuta la acción expresiva asociada a cada tecla
   */
  public triggerKey(code: string, x: number, y: number) {
    const now = performance.now();

    switch (code) {
      case 'KeyQ':
        // Q — Herida: crea una nueva fractura en el cursor
        const w = this.woundManager.createWound(x, y, 140.0, 1.0);
        this.flowField.addPerturbation({
          type: 'turbulence',
          x,
          y,
          radius: 160.0,
          maxRadius: 280.0,
          strength: 4.5,
          life: 3.5,
          maxLife: 3.5
        });
        this.lastFeedback = { key: 'Q', label: 'Herida', action: 'Nueva fractura en el tejido', time: now };
        break;

      case 'KeyW':
        // W — Desvío: golpe lateral de dirección en la corriente
        const angle = Math.random() * Math.PI * 2;
        this.flowField.addPerturbation({
          type: 'deflect',
          x,
          y,
          radius: 180.0,
          maxRadius: 360.0,
          strength: 5.0,
          life: 2.5,
          maxLife: 2.5,
          direction: { x: Math.cos(angle), y: Math.sin(angle) }
        });
        this.lastFeedback = { key: 'W', label: 'Desvío', action: 'Golpe direccional del flujo', time: now };
        break;

      case 'KeyE':
        // E — Lentitud: desaceleración viscosa y densificación de estelas
        this.flowField.addPerturbation({
          type: 'slow',
          x,
          y,
          radius: 200.0,
          maxRadius: 380.0,
          strength: 4.0,
          life: 3.0,
          maxLife: 3.0
        });
        this.lastFeedback = { key: 'E', label: 'Lentitud', action: 'Densificación y freno viscoso', time: now };
        break;

      case 'KeyR':
        // R — Turbulencia: vórtice caótico y variación direccional
        this.flowField.addPerturbation({
          type: 'vortex',
          x,
          y,
          radius: 170.0,
          maxRadius: 350.0,
          strength: 5.5,
          life: 2.8,
          maxLife: 2.8
        });
        this.lastFeedback = { key: 'R', label: 'Turbulencia', action: 'Vórtice y agitación de corrientes', time: now };
        break;

      case 'KeyT':
        // T — Concentración: atracción hacia el punto de interacción
        this.flowField.addPerturbation({
          type: 'concentrate',
          x,
          y,
          radius: 220.0,
          maxRadius: 420.0,
          strength: 4.8,
          life: 3.0,
          maxLife: 3.0
        });
        this.lastFeedback = { key: 'T', label: 'Concentración', action: 'Atracción centrípeta de líneas', time: now };
        break;

      case 'KeyY':
        // Y — Apertura: dispersión y separación generando espacios vacíos
        this.flowField.addPerturbation({
          type: 'open',
          x,
          y,
          radius: 190.0,
          maxRadius: 400.0,
          strength: 5.2,
          life: 2.5,
          maxLife: 2.5
        });
        this.lastFeedback = { key: 'Y', label: 'Apertura', action: 'Separación y espacio negativo', time: now };
        break;

      case 'KeyU':
        // U — Reparación: incremento temporal de agentes dorados y vertido áureo
        this.woundManager.addHealing(x, y, 0.22);
        // Despertar un grupo de agentes dorados alrededor
        for (let i = 0; i < 45 && i < this.agentSystem.agents.length; i++) {
          const idx = Math.floor(Math.random() * this.agentSystem.agents.length);
          const r = Math.random() * 80;
          const a = Math.random() * Math.PI * 2;
          this.agentSystem.agents[idx].reset(x + Math.cos(a) * r, y + Math.sin(a) * r, 2); // AgentType.GOLD
        }
        this.lastFeedback = { key: 'U', label: 'Reparación', action: 'Vertido de oro Kintsugi', time: now };
        break;

      case 'KeyI':
        // I — Resonancia: onda expansiva ondulante concéntrica
        this.flowField.addPerturbation({
          type: 'ripple',
          x,
          y,
          radius: 20.0,
          maxRadius: 520.0,
          strength: 5.5,
          life: 3.2,
          maxLife: 3.2
        });
        this.lastFeedback = { key: 'I', label: 'Resonancia', action: 'Onda armónica expansiva', time: now };
        break;

      case 'KeyO':
        // O — Integración: estabilización y armonización de líneas
        // Reduce perturbaciones y alinea agentes hacia una calma armónica
        for (const p of this.flowField.perturbations) {
          p.strength *= 0.5;
        }
        this.woundManager.addHealing(x, y, 0.12);
        this.lastFeedback = { key: 'O', label: 'Integración', action: 'Armonización y unión de marcas', time: now };
        break;
    }
  }

  public toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }
}
