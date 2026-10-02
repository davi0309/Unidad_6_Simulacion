/**
 * debugPanel.ts
 * Panel de depuración con lil-gui para el instrumento "Heal".
 * Se muestra / oculta con la tecla 'D'.
 */

import GUI from 'lil-gui';
import { HealParameters } from '../simulation/parameters';

export class DebugPanel {
  public gui: GUI;
  public isVisible: boolean = false;

  constructor(
    params: HealParameters,
    onResetWound: () => void,
    onAddMicrofracture: () => void
  ) {
    this.gui = new GUI({ title: 'Heal · Panel de Debug' });
    this.gui.hide();

    // 1. ESTADO DINÁMICO
    const fState = this.gui.addFolder('Estado Dinámico');
    fState.add(params, 'healingProgress', 0.0, 1.0, 0.01).name('Curación').listen().disable();
    fState.add(params, 'stress', 0.0, 3.0, 0.05).name('Estrés').listen();
    fState.add(params, 'isSustain').name('Sustain (Espacio)').listen().disable();
    fState.add(params, 'isClimax').name('Clímax (Shift)').listen().disable();
    fState.add(params, 'heartbeatFlash', 0.0, 0.2, 0.01).name('Destello Latido').listen().disable();
    fState.open();

    // 2. TEJIDO (PHYSARUM ESPECIE 1)
    const fTissue = this.gui.addFolder('Tejido (Especie 1)');
    fTissue.add(params, 'tissueSensorDist', 5.0, 30.0, 0.5).name('Distancia Sensor');
    fTissue.add(params, 'tissueStep', 0.5, 3.0, 0.1).name('Paso');
    fTissue.add(params, 'tissueDeposit', 0.1, 2.0, 0.05).name('Depósito');
    fTissue.add(params, 'tissueDecay', 0.85, 0.999, 0.001).name('Decaimiento');
    fTissue.close();

    // 3. ORO KINTSUGI (PHYSARUM ESPECIE 2)
    const fGold = this.gui.addFolder('Oro Kintsugi (Especie 2)');
    fGold.add(params, 'goldSensorDist', 4.0, 20.0, 0.5).name('Distancia Sensor');
    fGold.add(params, 'goldStep', 0.5, 2.5, 0.1).name('Paso');
    fGold.add(params, 'goldDeposit', 0.05, 1.0, 0.02).name('Depósito');
    fGold.add(params, 'goldDecay', 0.98, 0.9999, 0.0001).name('Decaimiento');
    fGold.add(params, 'goldLifeNormal', 2.0, 25.0, 0.5).name('Vida Normal (s)');
    fGold.close();

    // 4. CÉLULAS SANADORAS (STEERING REYNOLDS)
    const fCells = this.gui.addFolder('Células Sanadoras (Steering)');
    fCells.add(params, 'cellMaxSpeed', 0.5, 4.0, 0.1).name('Velocidad Máx');
    fCells.add(params, 'cellBrakeRadius', 20.0, 150.0, 5.0).name('Radio Frenado');
    fCells.add(params, 'cellWanderStrength', 0.05, 1.0, 0.05).name('Fuerza Wander');
    fCells.add(params, 'cellPainFieldStrength', 0.05, 1.5, 0.05).name('Fuerza Campo Dolor');
    fCells.close();

    // 5. POST-PROCESO Y VISTA
    const fRender = this.gui.addFolder('Visuales y Cámara');
    fRender.add(params, 'zoom', 0.25, 1.5, 0.01).name('Zoom').listen();
    fRender.add(params, 'filmGrain', 0.0, 0.15, 0.005).name('Grano Película');
    fRender.add(params, 'vignette', 0.0, 0.8, 0.02).name('Viñeta');
    fRender.close();

    // 6. ACCIONES
    const fActions = this.gui.addFolder('Acciones');
    fActions.add({ reset: onResetWound }, 'reset').name('Reiniciar Herida (Esc)');
    fActions.add({ micro: onAddMicrofracture }, 'micro').name('Agregar Microfractura');
    fActions.open();

    // Atajo de teclado: D
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.code === 'KeyD' && !e.repeat && (e.target as HTMLElement)?.tagName !== 'INPUT') {
        this.toggle();
      }
    });
  }

  public toggle() {
    this.isVisible = !this.isVisible;
    if (this.isVisible) {
      this.gui.show();
    } else {
      this.gui.hide();
    }
  }
}
