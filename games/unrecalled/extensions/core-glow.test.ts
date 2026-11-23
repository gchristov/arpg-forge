import { describe, expect, it } from 'vitest';
import { FADE_SECONDS, glowAfter } from './core-glow';

describe('glowAfter', () => {
  it('fades out over the fade time once its wearer is dead, and stays out', () => {
    expect(glowAfter(1, true, FADE_SECONDS / 2)).toBeCloseTo(0.5);
    expect(glowAfter(0.5, true, FADE_SECONDS)).toBe(0);
  });

  it('comes back to full when its wearer gets up, and no brighter', () => {
    expect(glowAfter(0, false, FADE_SECONDS / 4)).toBeCloseTo(0.25);
    expect(glowAfter(0.9, false, 1)).toBe(1);
  });
});
