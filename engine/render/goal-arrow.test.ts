import { describe, expect, it } from 'vitest';
import { ELEVATION } from './camera-angle';
import { ringOffset } from './goal-arrow';

/** Where a ground offset shows on screen, in tiles: to the right, and up. */
function onScreen(offset: { x: number; y: number }) {
  return { right: (offset.x - offset.y) / Math.SQRT2, up: (-(offset.x + offset.y) / Math.SQRT2) * Math.sin(ELEVATION) };
}

describe('ringOffset', () => {
  it('keeps the arrow as far from the middle of the body on screen whichever way it points', () => {
    const height = 1.2;
    const middle = (height / 2) * Math.cos(ELEVATION);
    const distances = Array.from({ length: 16 }, (_, k) => {
      const screen = onScreen(ringOffset((k / 16) * Math.PI * 2, height, { x: 0, y: 0 }));
      return Math.hypot(screen.right, screen.up - middle);
    });
    for (const d of distances) expect(d).toBeCloseTo(distances[0]!, 6);
  });

  it('lies clear above the head when pointing up the screen, where the body would cover it', () => {
    const height = 1.2;
    const up = onScreen(ringOffset(-3 * Math.PI / 4, height, { x: 0, y: 0 })).up;
    expect(up).toBeGreaterThan(height * Math.cos(ELEVATION));
  });

  it('points the way it heads, as seen on screen', () => {
    const screen = onScreen(ringOffset(-Math.PI / 4, 1.2, { x: 0, y: 0 }));
    expect(screen.right).toBeGreaterThan(0.5);
  });
});
