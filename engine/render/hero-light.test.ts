import { describe, expect, it } from 'vitest';
import { HERO_LIGHT_FADE_SECONDS, heroLightLevel, heroLightOf, LANTERN } from './hero-light';
import type { Mood } from './look';

describe('heroLightOf', () => {
  const mood: Mood = { background: 0, ambient: 0, ambientIntensity: 0, heroLightRadius: 5 };

  it('carries a warm lantern at head height that stays lit, when the mood names no light of its own', () => {
    expect(heroLightOf(mood)).toEqual({ ...LANTERN, distance: 8, outWhenDead: false });
  });

  it("carries the mood's own light, such as one glowing from a machine's chest that goes out when it dies", () => {
    const glow = { colour: 0x3ac8ff, height: 0.8, intensity: 2, outWhenDead: true };
    expect(heroLightOf({ ...mood, heroLight: glow, heroLightRadius: 2 })).toEqual({ ...glow, distance: 3.2 });
  });
});

describe('heroLightLevel', () => {
  it('fades out over the fade time once the hero is dead, and stays out', () => {
    expect(heroLightLevel(1, true, HERO_LIGHT_FADE_SECONDS / 2)).toBeCloseTo(0.5);
    expect(heroLightLevel(0.5, true, HERO_LIGHT_FADE_SECONDS)).toBe(0);
  });

  it('comes back to full when the hero gets up, and no brighter', () => {
    expect(heroLightLevel(0, false, HERO_LIGHT_FADE_SECONDS / 4)).toBeCloseTo(0.25);
    expect(heroLightLevel(0.9, false, 1)).toBe(1);
  });
});
