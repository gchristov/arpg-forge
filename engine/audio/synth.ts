/**
 * Sounds playing at once. A crowd landing hits in the same moment would otherwise start dozens of voices, which
 * phones struggle to mix and which only add up to noise.
 */
const MAX_VOICES = 24;

/**
 * Sounds made from tones and filtered noise with the Web Audio API, so a game needs no audio files. Browsers only
 * allow audio after a user gesture, so call `unlock` from one, such as the first tap.
 */
export class Synth {
  private context: AudioContext | null = null;
  private voices = 0;
  private noiseBuffer: AudioBuffer | null = null;
  muted = false;

  unlock(): void {
    try {
      if (!this.context) {
        this.context = new AudioContext();
        // Held sounds would carry on in a background tab, where the game stops, so all sound waits for its return.
        document.addEventListener('visibilitychange', () => {
          if (document.hidden) void this.context?.suspend();
          else void this.context?.resume();
        });
      }
      if (this.context.state === 'suspended' && !document.hidden) void this.context.resume();
    } catch {
      // No audio support: the game plays silently.
    }
  }

  /**
   * A held sound, such as an engine, that keeps playing and glides to whatever it's `set` to: a buzz of `type`, an
   * octave-down undertone, and noise for grit, `roughness` of the mix, all chopped by a wobble for a putter. Silent
   * until audio is unlocked, and while muted.
   */
  drone(type: OscillatorType, roughness: number): Drone {
    let nodes: DroneNodes | null = null;
    return {
      set: (frequency, volume, wobble, seconds = 0.08) => {
        const ac = this.context;
        if (!ac) return;
        nodes ??= droneNodes(ac, type, roughness, this.whiteNoise(ac));
        const t = ac.currentTime;
        const glide = seconds / 3;
        nodes.buzz.frequency.setTargetAtTime(frequency, t, glide);
        nodes.under.frequency.setTargetAtTime(frequency / 2, t, glide);
        nodes.tone.frequency.setTargetAtTime(frequency * 6, t, glide);
        nodes.grit.frequency.setTargetAtTime(frequency * 10, t, glide);
        nodes.wobble.frequency.setTargetAtTime(wobble, t, glide);
        nodes.out.gain.setTargetAtTime(this.muted ? 0 : volume, t, glide);
      },
    };
  }

  /**
   * A tone that fades out over `seconds`. `slide` bends the pitch towards `frequency × slide` by the end, and
   * `delay` starts it later.
   */
  tone(frequency: number, seconds: number, type: OscillatorType = 'sine', volume = 0.12, slide = 0, delay = 0): void {
    const ac = this.context;
    if (!ac || this.muted || this.voices >= MAX_VOICES) return;
    const t = ac.currentTime + delay;
    const oscillator = ac.createOscillator();
    const gain = ac.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, t);
    if (slide) oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, frequency * slide), t + seconds);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + seconds);
    oscillator.connect(gain).connect(ac.destination);
    this.track(oscillator);
    oscillator.start(t);
    oscillator.stop(t + seconds + 0.02);
  }

  /** A burst of noise through a band-pass filter around `frequency`, fading out over `seconds`. */
  noise(seconds: number, volume = 0.2, frequency = 1200, q = 1, delay = 0): void {
    const ac = this.context;
    if (!ac || this.muted || this.voices >= MAX_VOICES) return;
    const t = ac.currentTime + delay;
    const source = ac.createBufferSource();
    source.buffer = this.whiteNoise(ac);
    const filter = ac.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = frequency;
    filter.Q.value = q;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + seconds);
    source.connect(filter).connect(gain).connect(ac.destination);
    this.track(source);
    source.start(t);
    source.stop(t + seconds);
  }

  /** Over half a second of white noise, made once and shared. */
  private whiteNoise(ac: AudioContext): AudioBuffer {
    if (!this.noiseBuffer) {
      this.noiseBuffer = ac.createBuffer(1, ac.sampleRate * 0.6, ac.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    return this.noiseBuffer;
  }

  private track(voice: AudioScheduledSourceNode): void {
    this.voices++;
    voice.onended = () => this.voices--;
  }
}

/** A held sound, set every so often to where it should glide to. */
export interface Drone {
  /** Glides over about `seconds` to `frequency` hertz at `volume`, its putter wobbling `wobble` times a second. */
  set(frequency: number, volume: number, wobble: number, seconds?: number): void;
}

interface DroneNodes {
  buzz: OscillatorNode;
  under: OscillatorNode;
  tone: BiquadFilterNode;
  grit: BiquadFilterNode;
  wobble: OscillatorNode;
  out: GainNode;
}

/** A drone's sound: buzz and undertone through a low-pass, noise through a band-pass, chopped by the wobble. */
function droneNodes(ac: AudioContext, type: OscillatorType, roughness: number, noise: AudioBuffer): DroneNodes {
  const buzz = ac.createOscillator();
  buzz.type = type;
  const under = ac.createOscillator();
  under.type = 'square';
  const tone = ac.createBiquadFilter();
  tone.type = 'lowpass';
  const underLevel = ac.createGain();
  underLevel.gain.value = 0.5;
  buzz.connect(tone);
  under.connect(underLevel).connect(tone);
  const hiss = ac.createBufferSource();
  hiss.buffer = noise;
  hiss.loop = true;
  const grit = ac.createBiquadFilter();
  grit.type = 'bandpass';
  grit.Q.value = 1.2;
  const gritLevel = ac.createGain();
  gritLevel.gain.value = roughness;
  hiss.connect(grit).connect(gritLevel);
  // The putter: the mix's level swings between 0.4 and 1 at the wobble's rate.
  const chopped = ac.createGain();
  chopped.gain.value = 0.7;
  const wobble = ac.createOscillator();
  const depth = ac.createGain();
  depth.gain.value = 0.3;
  wobble.connect(depth).connect(chopped.gain);
  tone.connect(chopped);
  gritLevel.connect(chopped);
  const out = ac.createGain();
  out.gain.value = 0;
  chopped.connect(out).connect(ac.destination);
  for (const source of [buzz, under, hiss, wobble]) source.start();
  return { buzz, under, tone, grit, wobble, out };
}
