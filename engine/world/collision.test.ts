import { describe, expect, it } from 'vitest';
import { isBlocked, moveBody } from './collision';
import { hasLineOfSight } from './line-of-sight';
import { mapFromRows } from './testing';
import { isSolidAt } from './tile-map';

describe('isSolidAt', () => {
  it('treats everything outside the map as solid', () => {
    const map = mapFromRows(['..']);
    expect(isSolidAt(map, -0.1, 0.5)).toBe(true);
    expect(isSolidAt(map, 2.0, 0.5)).toBe(true);
    expect(isSolidAt(map, 1.9, 0.5)).toBe(false);
  });
});

describe('isBlocked', () => {
  const map = mapFromRows(['.#']);

  it('blocks a body whose edge reaches a solid tile', () => {
    expect(isBlocked(map, 0.8, 0.5, 0.28)).toBe(true);
    expect(isBlocked(map, 0.5, 0.5, 0.28)).toBe(false);
  });
});

describe('moveBody', () => {
  it('slides along a wall instead of stopping', () => {
    const map = mapFromRows(['...', '...', '###']);
    const body = { x: 1.5, y: 1.5, r: 0.3 };
    moveBody(map, body, 0.4, 0.4);
    expect(body.x).toBeCloseTo(1.9);
    expect(body.y).toBe(1.5);
  });

  it('moves freely on open ground', () => {
    const map = mapFromRows(['...', '...', '...']);
    const body = { x: 1.5, y: 1.5, r: 0.3 };
    moveBody(map, body, 0.2, -0.3);
    expect(body).toMatchObject({ x: 1.7, y: 1.2 });
  });
});

describe('hasLineOfSight', () => {
  const map = mapFromRows(['.....', '..#..', '.....']);

  it('sees across open ground', () => {
    expect(hasLineOfSight(map, 0.5, 0.5, 4.5, 0.5)).toBe(true);
  });

  it('is blocked by a solid tile on the line', () => {
    expect(hasLineOfSight(map, 0.5, 1.5, 4.5, 1.5)).toBe(false);
  });

  it('needs room for a body when padded', () => {
    expect(hasLineOfSight(map, 0.5, 0.5, 4.5, 0.5, 0.3)).toBe(true);
    expect(hasLineOfSight(map, 0.5, 0.8, 4.5, 0.8, 0.3)).toBe(false);
  });
});
