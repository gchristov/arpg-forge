import type { Synth } from '../../../engine/audio/synth';

/** Ashen Hollow's sound recipes. */
export function ashenHollowSounds(s: Synth) {
  return {
    swing: () => s.noise(0.14, 0.16, 2400, 0.8),
    hit: () => {
      s.tone(150, 0.12, 'square', 0.06, 0.5);
      s.noise(0.09, 0.22, 700, 1);
    },
    bone: () => {
      s.noise(0.08, 0.2, 2600, 3);
      s.tone(600, 0.06, 'square', 0.03, 0.6);
    },
    hurt: () => {
      s.tone(200, 0.22, 'sawtooth', 0.07, 0.5);
      s.noise(0.1, 0.15, 500, 1);
    },
    fire: () => {
      s.noise(0.35, 0.14, 700, 0.6);
      s.tone(320, 0.3, 'sawtooth', 0.04, 0.4);
    },
    boom: () => {
      s.noise(0.5, 0.3, 260, 0.7);
      s.tone(85, 0.45, 'sine', 0.22, 0.4);
    },
    coin: () => {
      s.tone(1250, 0.07, 'square', 0.04);
      s.tone(1660, 0.12, 'square', 0.04, 1, 0.06);
    },
    potion: () => {
      s.tone(420, 0.3, 'sine', 0.1, 2.2);
      s.tone(640, 0.25, 'sine', 0.06, 2, 0.08);
    },
    level: () => [523, 659, 784, 1046].forEach((f, i) => s.tone(f, 0.3, 'triangle', 0.11, 1, i * 0.1)),
    door: () => {
      s.noise(0.35, 0.1, 380, 2);
      s.tone(110, 0.25, 'sine', 0.06, 0.8);
    },
    die: () => s.tone(220, 1.2, 'sawtooth', 0.08, 0.25),
    arrow: () => s.noise(0.12, 0.1, 3200, 2),
    alert: () => s.tone(330, 0.12, 'square', 0.03, 1.4),
    slam: () => {
      s.noise(0.6, 0.35, 180, 0.6);
      s.tone(60, 0.5, 'sine', 0.25, 0.5);
    },
    chest: () => {
      s.noise(0.2, 0.1, 600, 2);
      [880, 1100, 1320].forEach((f, i) => s.tone(f, 0.15, 'triangle', 0.06, 1, 0.1 + i * 0.07));
    },
    deny: () => s.tone(140, 0.12, 'square', 0.05),
  };
}

export type Sounds = ReturnType<typeof ashenHollowSounds>;
