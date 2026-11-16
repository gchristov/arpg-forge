import type { Synth } from '../../../engine/audio/synth';

/** Unrecalled's sound recipes: metal, servos, sparks and sirens, all made by the synth rather than recorded. */
export function unrecalledSounds(s: Synth) {
  return {
    swing: () => s.noise(0.12, 0.14, 2200, 0.9),
    /** The wrench, or a bolt, on a machine's casing. */
    clank: () => {
      s.tone(880, 0.08, 'square', 0.035, 0.7);
      s.noise(0.07, 0.2, 3400, 4);
    },
    hurt: () => {
      s.tone(160, 0.2, 'sawtooth', 0.07, 0.6);
      s.noise(0.1, 0.14, 600, 1);
    },
    zap: () => {
      s.tone(300, 0.18, 'sawtooth', 0.05, 3);
      s.noise(0.15, 0.1, 5000, 2);
    },
    emp: () => {
      s.tone(70, 0.5, 'sine', 0.25, 0.6);
      s.tone(200, 0.45, 'sawtooth', 0.05, 6);
      s.noise(0.5, 0.18, 4200, 1.5, 0.05);
    },
    /** Sparks where the EMP goes off. */
    crackle: () => {
      s.noise(0.3, 0.2, 3000, 1.2);
      s.tone(110, 0.25, 'square', 0.04, 0.5);
    },
    scrap: () => {
      s.tone(1560, 0.06, 'triangle', 0.05);
      s.tone(2080, 0.1, 'triangle', 0.04, 1, 0.05);
    },
    patch: () => [0, 0.06, 0.12].forEach((d) => s.noise(0.04, 0.12, 2600, 6, d)),
    level: () => [392, 523, 659, 784, 1046].forEach((f, i) => s.tone(f, 0.22, 'square', 0.05, 1, i * 0.08)),
    door: () => {
      s.noise(0.4, 0.12, 900, 0.8);
      s.tone(90, 0.2, 'square', 0.06, 0.8, 0.3);
    },
    powerDown: () => s.tone(440, 1.4, 'sawtooth', 0.08, 0.15),
    /** A sentry's shot. */
    pew: () => s.tone(1400, 0.16, 'square', 0.035, 0.35),
    scan: () => s.tone(600, 0.6, 'sine', 0.04, 2.5),
    beep: () => s.tone(990, 0.08, 'square', 0.025),
    siren: () => [0, 0.45, 0.9].forEach((d) => {
      s.tone(620, 0.22, 'sawtooth', 0.05, 1, d);
      s.tone(460, 0.22, 'sawtooth', 0.05, 1, d + 0.22);
    }),
    slam: () => {
      s.noise(0.6, 0.35, 180, 0.6);
      s.tone(55, 0.55, 'sine', 0.28, 0.5);
    },
    cache: () => {
      s.noise(0.15, 0.12, 1400, 3);
      [1046, 1318, 1568].forEach((f, i) => s.tone(f, 0.14, 'triangle', 0.05, 1, 0.1 + i * 0.06));
    },
    read: () => [1200, 1500, 1200].forEach((f, i) => s.tone(f, 0.05, 'square', 0.025, 1, i * 0.07)),
    sealed: () => s.tone(110, 0.3, 'sawtooth', 0.06, 0.9),
    unsealed: () => [523, 784, 1046].forEach((f, i) => s.tone(f, 0.3, 'triangle', 0.07, 1, i * 0.12)),
    deny: () => s.tone(150, 0.14, 'square', 0.05),
  };
}

export type Sounds = ReturnType<typeof unrecalledSounds>;
