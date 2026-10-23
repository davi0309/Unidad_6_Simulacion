/**
 * audioController.ts
 * Controlador de Audio para HEAL:
 * - Reproducción de "Heal" de Tom Odell (archivo local seguro).
 * - Cero análisis de audio (sin FFT, sin BPM, sin audioreactividad artificial).
 * - Proporciona únicamente la referencia temporal para la evolución de la interpretación.
 * - Funciona aunque el audio esté en pausa o silenciado.
 */

export class AudioController {
  public audio: HTMLAudioElement;
  public isPlaying: boolean = false;
  public duration: number = 230; // ~3:50 segundos por defecto
  public currentTime: number = 0;
  public progress: number = 0.0;
  public isFinished: boolean = false;
  public playbackMessage: string = '';
  private fallbackAttempted: boolean = false;

  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'auto';

    // Rutas con fallback seguro
    this.audio.src = './audio/heal.mp3';
    this.audio.addEventListener('error', () => {
      if (!this.fallbackAttempted && !this.audio.src.includes('Tom%20Odell')) {
        this.fallbackAttempted = true;
        this.playbackMessage = 'No se pudo cargar la pista principal; probando la ruta alternativa…';
        this.audio.src = './Tom Odell - Heal (Official Audio).mp3';
        if (this.isPlaying) {
          void this.play();
        }
        return;
      }

      this.isPlaying = false;
      this.playbackMessage = this.getMediaErrorMessage();
    });

    this.audio.addEventListener('loadedmetadata', () => {
      if (this.audio.duration && !isNaN(this.audio.duration)) {
        this.duration = this.audio.duration;
      }
      this.playbackMessage = '';
    });

    this.audio.addEventListener('playing', () => {
      this.isPlaying = true;
      this.playbackMessage = '';
    });

    this.audio.addEventListener('ended', () => {
      this.isPlaying = false;
      this.isFinished = true;
      this.playbackMessage = '';
    });
  }

  public async play() {
    this.playbackMessage = 'Cargando canción…';
    try {
      await this.audio.play();
      this.isPlaying = true;
      this.playbackMessage = '';
    } catch (error) {
      this.isPlaying = false;
      this.playbackMessage = this.getPlayErrorMessage(error);
      console.error('No se pudo reproducir la canción:', error);
    }
  }

  public pause() {
    this.audio.pause();
    this.isPlaying = false;
    this.playbackMessage = 'Canción pausada.';
  }

  public togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  public restart() {
    this.audio.currentTime = 0;
    this.isFinished = false;
    this.play();
  }

  public update(): { currentTime: number; duration: number; progress: number; isPlaying: boolean; isFinished: boolean } {
    this.currentTime = this.audio.currentTime;
    if (this.duration > 0) {
      this.progress = Math.min(1.0, this.currentTime / this.duration);
    }
    return {
      currentTime: this.currentTime,
      duration: this.duration,
      progress: this.progress,
      isPlaying: this.isPlaying,
      isFinished: this.isFinished
    };
  }

  public formatTime(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  private getPlayErrorMessage(error: unknown): string {
    if (error instanceof DOMException) {
      if (error.name === 'NotAllowedError') {
        return 'El navegador bloqueó el audio. Haz clic en reproducir y revisa que esta pestaña no esté silenciada.';
      }
      if (error.name === 'NotSupportedError') {
        return 'El navegador no puede decodificar este archivo de audio.';
      }
      if (error.name === 'AbortError') {
        return 'La reproducción se interrumpió antes de empezar. Intenta reproducir de nuevo.';
      }
    }

    return 'No se pudo iniciar el audio. Revisa la conexión y vuelve a intentarlo.';
  }

  private getMediaErrorMessage(): string {
    switch (this.audio.error?.code) {
      case MediaError.MEDIA_ERR_ABORTED:
        return 'La carga del audio fue cancelada. Intenta reproducir de nuevo.';
      case MediaError.MEDIA_ERR_NETWORK:
        return 'No se pudo descargar el audio. Revisa tu conexión e inténtalo otra vez.';
      case MediaError.MEDIA_ERR_DECODE:
        return 'El archivo llegó, pero el navegador no pudo decodificarlo.';
      case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
        return 'El formato o la dirección del audio no son compatibles.';
      default:
        return 'No se pudo cargar la canción. Revisa la conexión e inténtalo otra vez.';
    }
  }
}
