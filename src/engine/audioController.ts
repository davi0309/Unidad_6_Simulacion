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

  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'auto';

    // Rutas con fallback seguro
    this.audio.src = './audio/heal.mp3';
    this.audio.addEventListener('error', () => {
      if (!this.audio.src.includes('Tom%20Odell')) {
        this.audio.src = './Tom Odell - Heal (Official Audio).mp3';
      }
    });

    this.audio.addEventListener('loadedmetadata', () => {
      if (this.audio.duration && !isNaN(this.audio.duration)) {
        this.duration = this.audio.duration;
      }
    });

    this.audio.addEventListener('ended', () => {
      this.isPlaying = false;
      this.isFinished = true;
    });
  }

  public play() {
    this.audio.play().then(() => {
      this.isPlaying = true;
    }).catch(() => {
      // Si el navegador bloquea la reproducción automática hasta interacción del usuario
      this.isPlaying = false;
    });
  }

  public pause() {
    this.audio.pause();
    this.isPlaying = false;
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
}
