/**
 * Sounds made from tones and filtered noise with the Web Audio API, so a game needs no audio files. Browsers only
 * allow audio after a user gesture, so call `unlock` from one, such as the first tap.
 */
export class Synth {
  private context: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  muted = false;

  unlock(): void {
    try {
      this.context ??= new AudioContext();
      if (this.context.state === 'suspended') void this.context.resume();
    } catch {
      // No audio support: the game plays silently.
    }
  }

  /**
   * A tone that fades out over `seconds`. `slide` bends the pitch towards `frequency × slide` by the end, and
   * `delay` starts it later.
   */
  tone(frequency: number, seconds: number, type: OscillatorType = 'sine', volume = 0.12, slide = 0, delay = 0): void {
    const ac = this.context;
    if (!ac || this.muted) return;
    const t = ac.currentTime + delay;
    const oscillator = ac.createOscillator();
    const gain = ac.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, t);
    if (slide) oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, frequency * slide), t + seconds);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + seconds);
    oscillator.connect(gain).connect(ac.destination);
    oscillator.start(t);
    oscillator.stop(t + seconds + 0.02);
  }

  /** A burst of noise through a band-pass filter around `frequency`, fading out over `seconds`. */
  noise(seconds: number, volume = 0.2, frequency = 1200, q = 1, delay = 0): void {
    const ac = this.context;
    if (!ac || this.muted) return;
    if (!this.noiseBuffer) {
      this.noiseBuffer = ac.createBuffer(1, ac.sampleRate * 0.6, ac.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const t = ac.currentTime + delay;
    const source = ac.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = ac.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = frequency;
    filter.Q.value = q;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + seconds);
    source.connect(filter).connect(gain).connect(ac.destination);
    source.start(t);
    source.stop(t + seconds);
  }
}
