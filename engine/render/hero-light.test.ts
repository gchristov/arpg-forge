import { describe, expect, it } from 'vitest';
import { heroLightOf, LANTERN } from './hero-light';
import type { Mood } from './look';

describe('heroLightOf', () => {
  const mood: Mood = { background: 0, ambient: 0, ambientIntensity: 0, heroLightRadius: 5 };

  it('carries a warm lantern at head height when the mood names no light of its own', () => {
    expect(heroLightOf(mood)).toEqual({ ...LANTERN, pool: 0, distance: 8 });
  });

  it("carries the mood's own light, such as one glowing from a machine's chest", () => {
    const glow = { colour: 0x3ac8ff, height: 0.8, intensity: 2, pool: 0.3 };
    expect(heroLightOf({ ...mood, heroLight: glow, heroLightRadius: 2 })).toEqual({ ...glow, distance: 3.2 });
  });
});
