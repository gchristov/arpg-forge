import { describe, expect, it } from 'vitest';
import { cornerColours } from './ground-blend';

describe('cornerColours', () => {
  it('averages the tiles that meet at each corner, so neighbours fade into each other', () => {
    // A red tile beside a blue one, and a missing tile below each.
    const corners = cornerColours(2, 2, (tx, ty) => (ty > 0 ? null : tx === 0 ? [1, 0, 0] : [0, 0, 1]));
    const at = (cx: number, cy: number) => [...corners.slice((cy * 3 + cx) * 3, (cy * 3 + cx) * 3 + 3)];
    expect(at(0, 0)).toEqual([1, 0, 0]);
    expect(at(1, 0)).toEqual([0.5, 0, 0.5]);
    expect(at(2, 1)).toEqual([0, 0, 1]);
    expect(at(1, 2)).toEqual([0, 0, 0]);
  });
});
