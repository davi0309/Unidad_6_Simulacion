/**
 * uiOverlay.ts
 * Interfaz y HUD Minimalista para HEAL:
 * - Título sutil, tiempo transcurrido y botón de play/pausa.
 * - Guía de teclas semitransparente que se atenúa durante la interpretación.
 * - Indicador de acción musical activa al pulsar teclas.
 * - Botones discretos de Pantalla Completa y Reinicio.
 * - Pantalla final contemplativa Kintsugi al concluir la canción.
 */

import { AudioController } from '../engine/audioController';
import { getMusicSection } from '../engine/flowField';
import { KeyboardController } from '../engine/keyboardController';

export class UIOverlay {
  private container: HTMLDivElement;
  private keyFeedbackEl: HTMLDivElement;
  private timeEl: HTMLSpanElement;
  private playBtn: HTMLButtonElement;
  private audioController: AudioController;
  private keyboardController: KeyboardController;
  private finalBannerEl: HTMLDivElement;
  public isUIHidden: boolean = false;

  private onRestartCallback: () => void;

  constructor(
    audioController: AudioController,
    keyboardController: KeyboardController,
    onRestart: () => void
  ) {
    this.audioController = audioController;
    this.keyboardController = keyboardController;
    this.onRestartCallback = onRestart;

    this.container = document.createElement('div');
    this.container.className = 'heal-ui-container';

    this.render();
    document.body.appendChild(this.container);

    this.keyFeedbackEl = this.container.querySelector('.key-feedback') as HTMLDivElement;
    this.timeEl = this.container.querySelector('.audio-time') as HTMLSpanElement;
    this.playBtn = this.container.querySelector('.btn-play') as HTMLButtonElement;
    this.finalBannerEl = this.container.querySelector('.final-contemplation') as HTMLDivElement;

    this.setupEvents();
  }

  private render() {
    this.container.innerHTML = `
      <!-- Cabecera Superior Minimalista -->
      <header class="heal-topbar">
        <div class="brand">
          <span class="kintsugi-mark">金継ぎ</span>
          <h1 class="title">HEAL</h1>
          <span class="subtitle">Tom Odell · Instrumento Visual</span>
        </div>

        <div class="audio-controls">
          <button class="btn-icon btn-play" title="Reproducir / Pausar">
            <svg class="icon-play" viewBox="0 0 24 24" width="16" height="16">
              <polygon points="6,4 20,12 6,20" fill="currentColor"/>
            </svg>
            <svg class="icon-pause hidden" viewBox="0 0 24 24" width="16" height="16">
              <rect x="6" y="4" width="4" height="16" fill="currentColor"/>
              <rect x="14" y="4" width="4" height="16" fill="currentColor"/>
            </svg>
          </button>
          <span class="audio-time">0:00 / 3:50</span>
          <span class="audio-status" role="status" aria-live="polite"></span>
          <span class="song-section">Apertura · Corriente ascendente</span>
        </div>

        <div class="actions">
          <button class="btn-action btn-fullscreen" title="Pantalla Completa y Ocultar UI (Tecla F)">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
            </svg>
            <span>F</span>
          </button>
          <button class="btn-action btn-restart" title="Reiniciar Interpretación (Escape)">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="1 4 1 10 7 10"/>
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
            </svg>
            <span>Esc</span>
          </button>
        </div>
      </header>

      <!-- Feedback de Tecla Activa en el centro-inferior -->
      <div class="key-feedback hidden">
        <span class="badge">Q</span>
        <span class="desc">Herida creada</span>
      </div>

      <!-- Barra Inferior de Teclas (Guía de Interpretación) -->
      <footer class="heal-keyboard-bar">
        <div class="key-item" data-key="Q"><span class="k">Q</span><span class="l">Herida</span></div>
        <div class="key-item" data-key="W"><span class="k">W</span><span class="l">Desvío</span></div>
        <div class="key-item" data-key="E"><span class="k">E</span><span class="l">Lentitud</span></div>
        <div class="key-item" data-key="R"><span class="k">R</span><span class="l">Turbulencia</span></div>
        <div class="key-item" data-key="T"><span class="k">T</span><span class="l">Concentración</span></div>
        <div class="key-item" data-key="Y"><span class="k">Y</span><span class="l">Apertura</span></div>
        <div class="key-item" data-key="U"><span class="k">U</span><span class="l">Reparación</span></div>
        <div class="key-item" data-key="I"><span class="k">I</span><span class="l">Resonancia</span></div>
        <div class="key-item" data-key="O"><span class="k">O</span><span class="l">Integración</span></div>
      </footer>

      <!-- Pantalla Final Contemplativa (Aparece suavemente al finalizar la canción) -->
      <div class="final-contemplation hidden">
        <div class="final-card">
          <div class="kanji">金継ぎ</div>
          <h2>La herida se ha transformado en oro</h2>
          <p>La cicatriz no se oculta; permanece luminosa como memoria de resiliencia.</p>
          <div class="final-actions">
            <button class="btn-primary btn-final-restart">Comenzar Nueva Interpretación</button>
          </div>
        </div>
      </div>
    `;
  }

  public setUIVisible(visible: boolean) {
    this.isUIHidden = !visible;
    if (this.isUIHidden) {
      this.container.classList.add('ui-hidden');
    } else {
      this.container.classList.remove('ui-hidden');
    }
  }

  public toggleFullscreenAndUI() {
    if (document.fullscreenElement || this.isUIHidden) {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      this.setUIVisible(true);
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
      this.setUIVisible(false);
    }
  }

  private setupEvents() {
    this.playBtn.addEventListener('click', () => {
      this.audioController.togglePlay();
      this.updatePlayState();
    });

    // Vincular la tecla F con la alternancia de pantalla completa y ocultación de la interfaz
    this.keyboardController.onToggleFullscreenCallback = () => {
      this.toggleFullscreenAndUI();
    };

    // Restaurar UI automáticamente si se sale de pantalla completa mediante ESC o controles del navegador
    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement) {
        this.setUIVisible(true);
      } else {
        this.setUIVisible(false);
      }
    });

    const fsBtn = this.container.querySelector('.btn-fullscreen');
    if (fsBtn) {
      fsBtn.addEventListener('click', () => this.toggleFullscreenAndUI());
    }

    const restartBtn = this.container.querySelector('.btn-restart');
    if (restartBtn) {
      restartBtn.addEventListener('click', () => {
        this.setUIVisible(true);
        this.onRestartCallback();
      });
    }

    const finalRestart = this.container.querySelector('.btn-final-restart');
    if (finalRestart) {
      finalRestart.addEventListener('click', () => {
        this.finalBannerEl.classList.add('hidden');
        this.setUIVisible(true);
        this.onRestartCallback();
      });
    }

    // Permitir clic en las teclas del footer como alternativa táctil
    const keyItems = this.container.querySelectorAll('.key-item');
    keyItems.forEach(item => {
      item.addEventListener('click', () => {
        const k = item.getAttribute('data-key');
        if (k) {
          this.keyboardController.triggerKey(`Key${k}`, window.innerWidth * 0.5, window.innerHeight * 0.5);
        }
      });
    });
  }

  private updatePlayState() {
    const iconPlay = this.playBtn.querySelector('.icon-play');
    const iconPause = this.playBtn.querySelector('.icon-pause');
    if (this.audioController.isPlaying) {
      iconPlay?.classList.add('hidden');
      iconPause?.classList.remove('hidden');
    } else {
      iconPlay?.classList.remove('hidden');
      iconPause?.classList.add('hidden');
    }
  }

  public update() {
    const audioState = this.audioController.update();

    // Actualizar tiempo
    this.timeEl.textContent = `${this.audioController.formatTime(audioState.currentTime)} / ${this.audioController.formatTime(audioState.duration)}`;
    const section = getMusicSection(audioState.progress);
    const sectionEl = this.container.querySelector('.song-section');
    if (sectionEl) {
      sectionEl.textContent = `${section.name} · ${section.movement}`;
    }
    const playbackStatusEl = this.container.querySelector('.audio-status');
    if (playbackStatusEl) {
      playbackStatusEl.textContent = this.audioController.playbackMessage;
      playbackStatusEl.classList.toggle('audio-status-error', this.audioController.playbackMessage.length > 0);
    }
    this.updatePlayState();

    // Feedback de tecla
    const feedback = this.keyboardController.lastFeedback;
    if (feedback && performance.now() - feedback.time < 1800) {
      this.keyFeedbackEl.classList.remove('hidden');
      this.keyFeedbackEl.querySelector('.badge')!.textContent = feedback.key;
      this.keyFeedbackEl.querySelector('.desc')!.textContent = `${feedback.label}: ${feedback.action}`;
      // Iluminar la tecla en la barra inferior
      const activeKey = this.container.querySelector(`.key-item[data-key="${feedback.key}"]`);
      activeKey?.classList.add('active');
    } else {
      this.keyFeedbackEl.classList.add('hidden');
      this.container.querySelectorAll('.key-item.active').forEach(el => el.classList.remove('active'));
    }

    // Mostrar contemplación final si la canción ha concluido (asegurando visibilidad)
    if (audioState.isFinished) {
      if (this.isUIHidden) {
        this.setUIVisible(true);
      }
      this.finalBannerEl.classList.remove('hidden');
    }
  }
}
