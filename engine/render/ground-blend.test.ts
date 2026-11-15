import { describe, expect, it } from 'vitest';
import { cornerColours } from './ground-blend';

describe('cornerColours', () => {
  // A strip of red tiles on the left and blue on the right, with no ground in the last row.
  const corners = cornerColours(8, 3, (tx, ty) => (ty > 1 ? null : tx < 4 ? [1, 0, 0] : [0, 0, 1]));
  const at = (cx: number, cy: number) => [...corners.slice((cy * 9 + cx) * 3, (cy * 9 + cx) * 3 + 3)];

  it('fades between patches across a few tiles rather than at a hard edge', () => {
    const [red, , blue] = at(4, 1);
    expect(red).toBeCloseTo(0.5);
    expect(blue).toBeCloseTo(0.5);
    expect(at(3, 1)[0]).toBeGreaterThan(0.5);
    expect(at(3, 1)[0]).toBeLessThan(1);
    expect(at(0, 1)[0]).toBeCloseTo(1);
  });

  it('colours corners at the ground\'s edge from the ground nearby, and leaves ones with none near black', () => {
    expect(at(4, 3).some((v) => v > 0)).toBe(true);
    expect(cornerColours(1, 1, () => null).every((v) => v === 0)).toBe(true);
  });
});
