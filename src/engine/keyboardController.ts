/**
 * keyboardController.ts
 * Controlador de Interpretación Musical por Teclado para HEAL:
 * - 9 teclas expresivas: Q, W, E, R, T, Y, U, I, O.
 * - Prevención de repetición automática del sistema operativo (e.repeat).
 * - Q crea un espacio de fractura roja en el flujo (trigger zone).
 * - U transmuta la fractura en espacio dorado Kintsugi o crea un espacio áureo (trigger zone).
 * - Tecla F para pantalla completa y Escape para reinicio.
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
  public isDrawingWound: boolean = false;
  private activeDrawingWound: any = null;
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

      if (this.isDrawingWound && this.activeDrawingWound) {
        // Modo lápiz: añadir punto a la herida dibujada
        this.woundManager.addPointToDrawnWound(this.activeDrawingWound, e.clientX, e.clientY);

        // Perturbación sutil en la punta del cursor dibujante
        this.flowField.addPerturbation({
          type: 'slow',
          x: e.clientX,
          y: e.clientY,
          radius: 50.0,
          maxRadius: 90.0,
          strength: 2.5,
          life: 1.0,
          maxLife: 1.0
        });
      }
    });

    window.addEventListener('pointerdown', (e: PointerEvent) => {
      // Ignorar clics sobre botones o controles de la interfaz
      if ((e.target as HTMLElement)?.closest('button, input, .audio-controls, .actions')) return;

      this.isDrawingWound = true;
      this.mousePos.x = e.clientX;
      this.mousePos.y = e.clientY;

      // Iniciar el trazo de la herida con el cursor (como un lápiz)
      this.activeDrawingWound = this.woundManager.startDrawnWound(e.clientX, e.clientY);

      const now = performance.now();
      this.lastFeedback = {
        key: 'Mouse',
        label: 'Dibujando Herida',
        action: 'Trazando fractura con el cursor (cámara lenta)',
        time: now
      };
    });

    const finishDrawing = () => {
      if (this.isDrawingWound) {
        this.isDrawingWound = false;
        if (this.activeDrawingWound) {
          this.woundManager.finishDrawnWound(this.activeDrawingWound);
          this.activeDrawingWound = null;
          const now = performance.now();
          this.lastFeedback = {
            key: 'Mouse',
            label: 'Herida Trazada',
            action: 'Fractura completada en el tejido',
            time: now
          };
        }
      }
    };

    window.addEventListener('pointerup', finishDrawing);
    window.addEventListener('pointercancel', finishDrawing);
    window.addEventListener('blur', finishDrawing);

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
  }

  /**
   * Ejecuta la acción expresiva asociada a cada tecla
   */
  public triggerKey(code: string, x: number, y: number) {
    const now = performance.now();

    switch (code) {
      case 'KeyQ': {
        // Q — Herida: crea un espacio trigger de fractura roja a lo largo de las líneas de flujo
        this.woundManager.createWound(
          x,
          y,
          (fx, fy) => this.flowField.sampleVelocity(fx, fy),
          1.0
        );
        this.flowField.addPerturbation({
          type: 'turbulence',
          x,
          y,
          radius: 90.0,
          maxRadius: 160.0,
          strength: 3.6,
          life: 2.2,
          maxLife: 2.2
        });
        this.lastFeedback = { key: 'Q', label: 'Herida', action: 'Espacio de fractura roja en el flujo', time: now };
        break;
      }

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

      case 'KeyU': {
        // U — Reparación Kintsugi: activa la sanación progresiva y lenta hacia el oro
        const res = this.woundManager.transformOrCreateGoldZone(
          x,
          y,
          (fx, fy) => this.flowField.sampleVelocity(fx, fy)
        );

        // Pulso suave de sanación armónica en el punto de contacto
        this.flowField.addPerturbation({
          type: 'ripple',
          x,
          y,
          radius: 20.0,
          maxRadius: 260.0,
          strength: 2.2,
          life: 2.5,
          maxLife: 2.5
        });

        if (res.wasTransformed) {
          this.lastFeedback = {
            key: 'U',
            label: 'Kintsugi',
            action: 'Sanación progresiva: oro líquido fluyendo por la herida',
            time: now
          };
        } else {
          this.lastFeedback = {
            key: 'U',
            label: 'Kintsugi',
            action: 'Espacio áureo creado en la corriente',
            time: now
          };
        }
        break;
      }

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
        for (const p of this.flowField.perturbations) {
          p.strength *= 0.5;
        }
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
