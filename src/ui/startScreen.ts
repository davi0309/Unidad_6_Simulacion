/**
 * startScreen.ts
 * Pantalla inicial minimalista y poética para "Heal".
 *
 * - Muestra la metáfora y el mapa de teclas.
 * - Incluye un reproductor opcional para cargar un archivo de audio local
 *   (SOLO para reproducirlo de fondo, SIN análisis de audio).
 * - Desaparece suavemente con la primera pulsación de tecla.
 * - Sin interfaz visible durante la interpretación.
 */

export class StartScreen {
  private container: HTMLDivElement;
  private audioElement: HTMLAudioElement;
  private isDismissed: boolean = false;
  private onDismissCallback?: () => void;

  constructor(onDismiss?: () => void) {
    this.onDismissCallback = onDismiss;
    this.audioElement = new Audio();
    this.audioElement.loop = true;

    this.container = document.createElement('div');
    this.container.className = 'start-screen';
    this.render();
    document.body.appendChild(this.container);

    window.addEventListener('keydown', this.handleFirstKey, { once: false });
  }

  private render() {
    this.container.innerHTML = `
      <div class="start-card">
        <header class="start-header">
          <span class="start-kicker">INSTRUMENTO VISUAL</span>
          <h1 class="start-title">HEAL</h1>
          <p class="start-subtitle">Inspirado en la canción de Tom Odell · Kintsugi y Resiliencia</p>
        </header>

        <section class="start-metaphor">
          <p>
            Un tejido vivo con una herida abierta. Curarlo requiere calma y paciencia.<br>
            La herida se cierra con <strong>hilos dorados</strong>: la cicatriz nunca desaparece, queda luminosa.<br>
            Si tocas con prisa, el estrés reabrirá la herida.<br>
            <em>Sanar no se puede forzar.</em>
          </p>
        </section>

        <section class="start-controls-grid">
          <div class="control-item">
            <span class="key-badge">Q W E R T Y U I O P</span>
            <span class="control-desc">Liberan células sanadoras en el cursor (tinte cálido a frío)</span>
          </div>
          <div class="control-item">
            <span class="key-badge">Z X C V B N M</span>
            <span class="control-desc">Latidos: onda radial desde la herida y destello de brillo</span>
          </div>
          <div class="control-item">
            <span class="key-badge">Ratón</span>
            <span class="control-desc">Proyecta el objetivo de curación sobre la grieta</span>
          </div>
          <div class="control-item">
            <span class="key-badge">Espacio (mantener)</span>
            <span class="control-desc">Sustain: extiende la persistencia del tejido y la vida del oro</span>
          </div>
          <div class="control-item">
            <span class="key-badge">Shift (mantener)</span>
            <span class="control-desc">Clímax: sin estrés, flujo abundante, turbulencia curl y bloom</span>
          </div>
          <div class="control-item">
            <span class="key-badge">Enter</span>
            <span class="control-desc">Final: zoom exterior hacia las cicatrices antiguas del pasado</span>
          </div>
          <div class="control-item">
            <span class="key-badge">Escape</span>
            <span class="control-desc">Reiniciar con una herida nueva</span>
          </div>
          <div class="control-item">
            <span class="key-badge">D</span>
            <span class="control-desc">Panel de debug (lil-gui)</span>
          </div>
        </section>

        <footer class="start-footer">
          <div class="audio-loader-box">
            <label class="audio-button" for="heal-audio-input">
              🎵 Cargar canción "Heal" (audio local opcional)
            </label>
            <input type="file" id="heal-audio-input" accept="audio/*" class="audio-file-input">
            <span class="audio-status" id="heal-audio-status">Sin audio · puedes reproducir tu música de fondo</span>
          </div>

          <div class="start-prompt">
            <span class="pulse-dot"></span>
            <span>Presiona cualquier tecla para comenzar a interpretar</span>
          </div>
        </footer>
      </div>
    `;

    this.setupAudioInput();
  }

  private setupAudioInput() {
    const input = this.container.querySelector('#heal-audio-input') as HTMLInputElement;
    const status = this.container.querySelector('#heal-audio-status') as HTMLElement;

    if (!input || !status) return;

    input.addEventListener('change', (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (target.files && target.files[0]) {
        const file = target.files[0];
        const url = URL.createObjectURL(file);
        this.audioElement.src = url;
        this.audioElement.play().then(() => {
          status.textContent = `▶ Reproduciendo: ${file.name} (solo acompañamiento)`;
        }).catch(() => {
          status.textContent = `✓ Archivo listo: ${file.name} (se reproducirá al tocar)`;
        });
      }
    });
  }

  private handleFirstKey = (event: KeyboardEvent) => {
    // Evitar ocultar si el usuario está interactuando con el input de archivo
    if ((event.target as HTMLElement)?.tagName === 'INPUT') return;

    if (!this.isDismissed) {
      this.dismiss();
      // Si había audio cargado pero en pausa por interacción de navegador, reproducirlo
      if (this.audioElement.src && this.audioElement.paused) {
        this.audioElement.play().catch(() => {});
      }
    }
  };

  public dismiss() {
    if (this.isDismissed) return;
    this.isDismissed = true;
    this.container.classList.add('fade-out');

    setTimeout(() => {
      this.container.style.display = 'none';
      if (this.onDismissCallback) {
        this.onDismissCallback();
      }
    }, 800);
  }

  public show() {
    this.isDismissed = false;
    this.container.style.display = 'flex';
    this.container.classList.remove('fade-out');
  }
}
