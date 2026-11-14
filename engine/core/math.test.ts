import { describe, expect, it } from 'vitest';
import { clamp, dist, hash2, lerp, valueNoise } from './math';

describe('math', () => {
  it('clamps, interpolates and measures', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(lerp(2, 4, 0.25)).toBe(2.5);
    expect(dist(0, 0, 3, 4)).toBe(5);
  });

  it('hashes cells to stable values in [0, 1)', () => {
    expect(hash2(3, 4, 11)).toBe(hash2(3, 4, 11));
    expect(hash2(3, 4, 11)).not.toBe(hash2(4, 3, 11));
    for (let i = 0; i < 1000; i++) {
      const h = hash2(i, i * 7, 3);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(1);
    }
  });

  it('keeps the values the prototype used, so generated maps come out the same', () => {
    // Reference values computed with the prototype's hash2 and vnoise.
    expect(hash2(0, 0)).toBe(0);
    expect(hash2(16, 22, 11)).toBe(0.9700458801817149);
    expect(valueNoise(4.48, 3.52)).toBe(0.43017037434928374);
  });

  it('makes noise that varies smoothly', () => {
    const a = valueNoise(10.0, 10.0);
    const b = valueNoise(10.01, 10.0);
    expect(Math.abs(a - b)).toBeLessThan(0.02);
  });
});
