import { describe, expect, it } from 'vitest';
import { drawnPixelRatio } from './pixel-ratio';

describe('drawnPixelRatio', () => {
  it('draws a plain screen at its own density', () => {
    expect(drawnPixelRatio(1)).toBe(1);
  });

  it('caps a high-density phone or tablet at one and a half pixels a point', () => {
    expect([drawnPixelRatio(2), drawnPixelRatio(3)]).toEqual([1.5, 1.5]);
  });
});
