/**
 * startScreen.ts
 * Pantalla inicial minimalista y poética inspirada en el Kintsugi (金継ぎ),
 * junto con HUD sutil para el acompañamiento de "Heal" de Tom Odell.
 *
 * - Carga por defecto el audio "Tom Odell - Heal (Official Audio).mp3".
 * - Reproduce automáticamente al comenzar la interpretación con cualquier tecla o clic.
 * - Sin análisis de audio (respetando la regla de no-audioreactividad).
 * - HUD translúcido y no invasivo en la parte inferior durante la interpretación.
 */

export class StartScreen {
  private container: HTMLDivElement;
  private hudContainer: HTMLDivElement;
  public audioElement: HTMLAudioElement;
  private isDismissed: boolean = false;
  private isAudioPlaying: boolean = false;
  private onDismissCallback?: () => void;
  private onParticleToggleCallback?: () => void;

  constructor(
    onDismiss?: () => void,
    onParticleToggle?: () => void
  ) {
    this.onDismissCallback = onDismiss;
    this.onParticleToggleCallback = onParticleToggle;

    // 1. Inicializar elemento de audio con la canción por defecto
    this.audioElement = new Audio();
    this.audioElement.loop = true;
    this.audioElement.crossOrigin = 'anonymous';
    // Ruta por defecto en public/audio/heal.mp3 con fallback directo
    this.audioElement.src = './audio/heal.mp3';
    this.audioElement.addEventListener('error', () => {
      // Fallback a la raíz si la subcarpeta no estuviera disponible
      if (!this.audioElement.src.includes('Tom%20Odell')) {
        this.audioElement.src = './Tom Odell - Heal (Official Audio).mp3';
      }
    });

    // 2. Pantalla inicial (overlay)
    this.container = document.createElement('div');
    this.container.className = 'start-screen';
    this.renderStartScreen();
    document.body.appendChild(this.container);

    // 3. HUD durante la interpretación (en la parte inferior, sutil y minimalista)
    this.hudContainer = document.createElement('div');
    this.hudContainer.className = 'heal-hud hidden';
    this.renderHud();
    document.body.appendChild(this.hudContainer);

    // Escuchar primera tecla para iniciar experiencia
    window.addEventListener('keydown', this.handleFirstInteraction, { once: false });
  }

  private renderStartScreen() {
    this.container.innerHTML = `
      <div class="start-card">
        <div class="kintsugi-watermark">金継ぎ</div>

        <header class="start-header">
          <span class="start-kicker">KINTSUGI · ARTE DE LA RESILIENCIA</span>
          <h1 class="start-title">HEAL</h1>
          <p class="start-subtitle">Instrumento visual para la obra de Tom Odell</p>
        </header>

        <section class="start-metaphor">
          <p>
            Una herida abierta en el tejido vivo. Curarla requiere calma y escucha.<br>
            La fractura se cierra con <strong>hilos dorados</strong>: la cicatriz no se oculta, queda luminosa.<br>
            Si tocas con prisa, la herida se reabre.<br>
            <em>Sanar no se puede forzar.</em>
          </p>
        </section>

        <section class="start-controls-grid">
          <div class="control-col">
            <div class="control-item">
              <span class="key-badge">Q — P</span>
              <div class="control-text">
                <strong>10 Gestos & Oro Kintsugi</strong>
                <span>Q a P: 10 dinámicas únicas (vórtices, ondas, cometas) y vierten oro</span>
              </div>
            </div>
            <div class="control-item">
              <span class="key-badge">Z — M</span>
              <div class="control-text">
                <strong>Respiración & Latidos</strong>
                <span>Ondas radiales desde el centro que pulsan el tejido y destellan</span>
              </div>
            </div>
            <div class="control-item">
              <span class="key-badge">Ratón</span>
              <div class="control-text">
                <strong>Conducción</strong>
                <span>Proyecta la curación sobre la grieta viva</span>
              </div>
            </div>
          </div>

          <div class="control-col">
            <div class="control-item">
              <span class="key-badge">Espacio</span>
              <div class="control-text">
                <strong>Sustain (Mantener)</strong>
                <span>Extiende la persistencia del tejido y prolonga el oro a 20s</span>
              </div>
            </div>
            <div class="control-item">
              <span class="key-badge">Shift</span>
              <div class="control-text">
                <strong>Clímax (Mantener)</strong>
                <span>Flujo generoso sin estrés, turbulencia curl y bloom</span>
              </div>
            </div>
            <div class="control-item">
              <span class="key-badge">Enter</span>
              <div class="control-text">
                <strong>Coda Final</strong>
                <span>Zoom cinemático que revela las cicatrices del pasado</span>
              </div>
            </div>
          </div>
        </section>

        <footer class="start-footer">
          <!-- Reproductor de audio por defecto integrado -->
          <div class="audio-pill">
            <button class="audio-play-btn" id="start-audio-toggle" type="button" aria-label="Reproducir o pausar">
              <span id="start-audio-icon">▶</span>
            </button>
            <div class="audio-track-info">
              <span class="audio-song-name">Tom Odell — Heal</span>
              <span class="audio-song-desc" id="start-audio-status">Audio de acompañamiento cargado</span>
            </div>
            <label class="audio-change-label" title="Cargar otro archivo de audio">
              ↺ Cambiar
              <input type="file" id="custom-audio-input" accept="audio/*" class="audio-hidden-input">
            </label>
          </div>

          <button class="start-begin-btn" id="start-begin-action" type="button">
            <span class="pulse-dot"></span>
            <span>Comenzar interpretación</span>
          </button>
        </footer>
      </div>
    `;

    this.setupStartScreenEvents();
  }

  private renderHud() {
    this.hudContainer.innerHTML = `
      <div class="hud-capsule">
        <div class="hud-section hud-healing">
          <span class="hud-kanji">金</span>
          <span class="hud-label">CURACIÓN</span>
          <div class="hud-bar-track">
            <div class="hud-bar-fill" id="hud-fill"></div>
          </div>
          <span class="hud-val" id="hud-hp">0%</span>
        </div>

        <div class="hud-sep"></div>

        <div class="hud-section hud-stress">
          <span class="hud-dot" id="hud-stress-indicator"></span>
          <span class="hud-label" id="hud-stress-text">Calma</span>
        </div>

        <div class="hud-sep"></div>

        <button class="hud-btn" id="hud-particles-toggle" type="button" title="Presiona V para ver enjambre de partículas">
          <span class="hud-key-tag">V</span>
          <span id="hud-particles-text">Partículas</span>
        </button>

        <div class="hud-sep"></div>

        <button class="hud-btn hud-audio-btn" id="hud-audio-toggle" type="button" title="Pausar / Reproducir música">
          <span id="hud-audio-icon">♫</span>
          <span id="hud-audio-label">Pausar</span>
        </button>

        <div class="hud-sep"></div>

        <span class="hud-tip" title="H oculta el HUD · D abre ajustes">H: Ocultar · D: Ajustes</span>
      </div>
    `;

    this.setupHudEvents();
  }

  private setupStartScreenEvents() {
    const playBtn = this.container.querySelector('#start-audio-toggle') as HTMLButtonElement;
    const beginBtn = this.container.querySelector('#start-begin-action') as HTMLButtonElement;
    const customInput = this.container.querySelector('#custom-audio-input') as HTMLInputElement;

    // Toggle de audio antes de comenzar
    playBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleAudio();
    });

    // Botón comenzar
    beginBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.startPerformance();
    });

    // Cargar archivo personalizado opcional
    customInput?.addEventListener('change', (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (target.files && target.files[0]) {
        const file = target.files[0];
        this.audioElement.src = URL.createObjectURL(file);
        const nameEl = this.container.querySelector('.audio-song-name');
        if (nameEl) nameEl.textContent = file.name;
        this.playAudio();
      }
    });

    // Clic en la tarjeta exterior para comenzar
    this.container.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.start-card') && !(e.target as HTMLElement).closest('.audio-pill')) {
        this.startPerformance();
      }
    });
  }

  private setupHudEvents() {
    const particlesBtn = this.hudContainer.querySelector('#hud-particles-toggle');
    const audioBtn = this.hudContainer.querySelector('#hud-audio-toggle');

    particlesBtn?.addEventListener('click', () => {
      if (this.onParticleToggleCallback) this.onParticleToggleCallback();
    });

    audioBtn?.addEventListener('click', () => {
      this.toggleAudio();
    });
  }

  public toggleAudio() {
    if (this.isAudioPlaying) {
      this.pauseAudio();
    } else {
      this.playAudio();
    }
  }

  public playAudio() {
    this.audioElement.play().then(() => {
      this.isAudioPlaying = true;
      this.updateAudioIcons(true);
    }).catch(() => {
      // Si el navegador bloquea autoplay, se reproducirá con la siguiente interacción
    });
  }

  public pauseAudio() {
    this.audioElement.pause();
    this.isAudioPlaying = false;
    this.updateAudioIcons(false);
  }

  private updateAudioIcons(playing: boolean) {
    const startIcon = this.container.querySelector('#start-audio-icon');
    const startStatus = this.container.querySelector('#start-audio-status');
    const hudLabel = this.hudContainer.querySelector('#hud-audio-label');
    const hudIcon = this.hudContainer.querySelector('#hud-audio-icon');

    if (startIcon) startIcon.textContent = playing ? '❚❚' : '▶';
    if (startStatus) startStatus.textContent = playing ? 'Reproduciendo música' : 'Pausado';
    if (hudLabel) hudLabel.textContent = playing ? 'Pausar' : 'Reanudar';
    if (hudIcon) hudIcon.textContent = playing ? '♫' : '▷';
  }

  private handleFirstInteraction = (event: KeyboardEvent) => {
    // Si la pantalla ya desapareció o se interactúa con un input, ignorar
    if (this.isDismissed || (event.target as HTMLElement)?.tagName === 'INPUT') return;
    this.startPerformance();
  };

  public startPerformance() {
    if (this.isDismissed) return;
    this.isDismissed = true;

    // Asegurar que la canción de Tom Odell comience a sonar
    if (!this.isAudioPlaying) {
      this.playAudio();
    }

    // Desvanecimiento suave de la pantalla inicial
    this.container.classList.add('fade-out');
    setTimeout(() => {
      this.container.style.display = 'none';
      // Mostrar HUD sutil
      this.hudContainer.classList.remove('hidden');
      if (this.onDismissCallback) this.onDismissCallback();
    }, 700);
  }

  /**
   * Actualiza los datos dinámicos en el HUD minimalista
   */
  public updateHud(healingProgress: number, stress: number, showParticles: boolean) {
    if (!this.hudContainer) return;

    // 1. Barra de progreso de curación
    const fillEl = this.hudContainer.querySelector('#hud-fill') as HTMLElement;
    const hpEl = this.hudContainer.querySelector('#hud-hp') as HTMLElement;
    const pct = Math.round(healingProgress * 100);
    if (fillEl) fillEl.style.width = `${pct}%`;
    if (hpEl) hpEl.textContent = `${pct}%`;

    // 2. Indicador de estrés / serenidad
    const dot = this.hudContainer.querySelector('#hud-stress-indicator') as HTMLElement;
    const stressText = this.hudContainer.querySelector('#hud-stress-text') as HTMLElement;
    if (dot && stressText) {
      if (stress > 1.0) {
        dot.className = 'hud-dot hud-dot-danger';
        stressText.textContent = '¡Tensión!';
        stressText.style.color = '#ff8080';
      } else if (stress > 0.4) {
        dot.className = 'hud-dot hud-dot-warning';
        stressText.textContent = 'Acelerando';
        stressText.style.color = '#ffd27a';
      } else {
        dot.className = 'hud-dot hud-dot-calm';
        stressText.textContent = 'Calma';
        stressText.style.color = '#a0d2be';
      }
    }

    // 3. Estado de partículas visibles
    const partText = this.hudContainer.querySelector('#hud-particles-text') as HTMLElement;
    const partBtn = this.hudContainer.querySelector('#hud-particles-toggle') as HTMLElement;
    if (partText && partBtn) {
      if (showParticles) {
        partText.textContent = 'Partículas: ON';
        partBtn.classList.add('active');
      } else {
        partText.textContent = 'Partículas: OFF';
        partBtn.classList.remove('active');
      }
    }
  }

  public toggleHud() {
    this.hudContainer.classList.toggle('hidden');
  }
}
