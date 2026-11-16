import { describe, expect, it } from 'vitest';
import { mapFromRows } from '../world/testing';
import { playDistances, shadeArea, shadeAt } from './shade-map';

describe('playDistances', () => {
  it('measures how far each tile, and the margin round the map, lies from walkable ground', () => {
    const map = mapFromRows(['#####', '#..##', '#####']);
    const area = shadeArea(map, 2);
    const d = playDistances(map, area, () => false);
    const at = (tx: number, ty: number) => d[(ty - area.y0) * area.width + (tx - area.x0)]!;
    expect(at(1, 1)).toBe(0);
    expect(at(3, 1)).toBe(1);
    expect(at(4, 1)).toBe(2);
    expect(at(1, -1)).toBe(2);
    expect(at(-1, -1)).toBeCloseTo(Math.SQRT2 * 2);
  });

  it('counts tiles that belong to the playable world, such as a building, as part of it', () => {
    const map = mapFromRows(['.###']);
    const d = playDistances(map, shadeArea(map, 0), (tx) => tx === 2);
    expect([...d]).toEqual([0, 1, 0, 1]);
  });
});

describe('shadeAt', () => {
  it('lights the playable world fully and fades into darkness away from it, never brighter further out', () => {
    expect(shadeAt(0)).toBe(1);
    expect(shadeAt(1.5)).toBe(1);
    expect(shadeAt(5)).toBeGreaterThan(0.3);
    expect(shadeAt(5)).toBeLessThan(1);
    expect(shadeAt(20)).toBe(0);
    for (let d = 0; d < 15; d += 0.5) expect(shadeAt(d + 0.5)).toBeLessThanOrEqual(shadeAt(d));
  });

  it('fades over fewer tiles when told to, as indoors', () => {
    expect(shadeAt(4, 4)).toBeLessThan(shadeAt(4));
    expect(shadeAt(6, 4)).toBe(0);
  });
});
