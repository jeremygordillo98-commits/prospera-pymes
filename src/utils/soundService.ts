/**
 * Servicio de Sonidos Sintetizados y Vibración Háptica para Prospera Pymes
 * Utiliza Web Audio API nativo para reproducir tonos claros sin requerir archivos de audio externos.
 */

class SoundService {
  private audioCtx: AudioContext | null = null;

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  /**
   * Reproduce un tono elegante de notificación y vibra el dispositivo móvil
   */
  public playNotification(type: 'ticket' | 'alert' | 'success' = 'ticket'): void {
    try {
      // 1. Vibración háptica en celulares Android / TWA APK
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        if (type === 'ticket') {
          navigator.vibrate([120, 60, 180]);
        } else if (type === 'alert') {
          navigator.vibrate([200, 100, 200, 100, 300]);
        } else {
          navigator.vibrate([80, 40, 80]);
        }
      }

      // 2. Síntesis de sonido Web Audio API
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      if (type === 'ticket') {
        // Tono bitonal cristalino estilo chime (D5 -> A5 -> D6)
        this.playChimeNote(ctx, 587.33, now, 0.18, 0.15);       // D5
        this.playChimeNote(ctx, 880.00, now + 0.08, 0.22, 0.2); // A5
        this.playChimeNote(ctx, 1174.66, now + 0.16, 0.35, 0.25); // D6
      } else if (type === 'alert') {
        // Tono de atención doble
        this.playChimeNote(ctx, 440.00, now, 0.15, 0.25, 'triangle');
        this.playChimeNote(ctx, 659.25, now + 0.12, 0.3, 0.3, 'triangle');
      } else {
        // Tono suave de éxito
        this.playChimeNote(ctx, 523.25, now, 0.12, 0.15); // C5
        this.playChimeNote(ctx, 659.25, now + 0.08, 0.2, 0.2); // E5
      }
    } catch (e) {
      console.warn('No se pudo reproducir el sonido de notificación:', e);
    }
  }

  private playChimeNote(
    ctx: AudioContext,
    freq: number,
    startTime: number,
    duration: number,
    gainValue: number,
    oscType: OscillatorType = 'sine'
  ) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = oscType;
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.exponentialRampToValueAtTime(gainValue, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration);
  }
}

export const soundService = new SoundService();
