import { describe, expect, it } from 'vitest';
import { drawingQuality } from './drawing-quality';

describe('drawingQuality', () => {
  it('draws a plain screen at its own density, smoothing edges', () => {
    expect(drawingQuality(1)).toEqual({ pixelRatio: 1, antialias: true });
  });

  it('caps a high-density phone or tablet at one and a half pixels a point, without smoothing', () => {
    expect(drawingQuality(2)).toEqual({ pixelRatio: 1.5, antialias: false });
    expect(drawingQuality(3)).toEqual({ pixelRatio: 1.5, antialias: false });
  });
});
