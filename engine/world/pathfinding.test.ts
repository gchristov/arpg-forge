import { describe, expect, it } from 'vitest';
import type { Vec2 } from '../core/math';
import { findPath, nearestFreePoint, planRoute } from './pathfinding';
import { mapFromRows } from './testing';
import { isSolidAt, tileIndex } from './tile-map';

const tiles = (path: Vec2[] | null) => path?.map((p) => [Math.floor(p.x), Math.floor(p.y)]);

describe('findPath', () => {
  const open = mapFromRows(['.....', '.....', '.....']);

  it('walks straight across open ground, through tile centres', () => {
    expect(findPath(open, 0.5, 1.5, 4.5, 1.5)).toEqual([
      { x: 1.5, y: 1.5 },
      { x: 2.5, y: 1.5 },
      { x: 3.5, y: 1.5 },
      { x: 4.5, y: 1.5 },
    ]);
  });

  it('returns an empty path when already on the target tile', () => {
    expect(findPath(open, 2.1, 1.1, 2.9, 1.9)).toEqual([]);
  });

  it('refuses solid or out-of-map targets', () => {
    const walled = mapFromRows(['..#..']);
    expect(findPath(walled, 0.5, 0.5, 2.5, 0.5)).toBeNull();
    expect(findPath(walled, 0.5, 0.5, 9.5, 0.5)).toBeNull();
  });

  it('goes around a wall', () => {
    const map = mapFromRows(['.....', '.###.', '.....']);
    const path = findPath(map, 0.5, 0.5, 0.5, 2.5)!;
    expect(path).not.toBeNull();
    for (const p of path) expect(isSolidAt(map, p.x, p.y)).toBe(false);
    expect(tiles(path)!.at(-1)).toEqual([0, 2]);
  });

  it('never cuts a solid corner diagonally', () => {
    const map = mapFromRows(['.#', '..']);
    expect(tiles(findPath(map, 0.5, 0.5, 1.5, 1.5))).toEqual([
      [0, 1],
      [1, 1],
    ]);
  });

  it('prefers diagonals on open ground', () => {
    expect(findPath(open, 0.5, 0.5, 2.5, 2.5)).toHaveLength(2);
  });

  it('gives up on an unreachable target', () => {
    const map = mapFromRows(['..#..', '..#..', '..#..']);
    expect(findPath(map, 0.5, 0.5, 4.5, 0.5)).toBeNull();
  });

  it('gives up when the search budget runs out', () => {
    const big = mapFromRows(Array.from({ length: 60 }, () => '.'.repeat(60)));
    expect(findPath(big, 0.5, 0.5, 59.5, 59.5, 10)).toBeNull();
    expect(findPath(big, 0.5, 0.5, 59.5, 59.5)).not.toBeNull();
  });

  it('gives the same answer when called again on another map size', () => {
    const map = mapFromRows(['.....', '.###.', '.....']);
    const first = findPath(map, 0.5, 0.5, 4.5, 2.5);
    findPath(open, 0.5, 0.5, 4.5, 2.5);
    expect(findPath(map, 0.5, 0.5, 4.5, 2.5)).toEqual(first);
  });
});

describe('planRoute', () => {
  const map = mapFromRows(['.....']);

  it('ends exactly at the target point', () => {
    expect(planRoute(map, { x: 0.5, y: 0.5 }, { x: 3.2, y: 0.7 })!.at(-1)).toEqual({ x: 3.2, y: 0.7 });
  });

  it('steps to the target point when it is on the same tile', () => {
    expect(planRoute(map, { x: 0.2, y: 0.5 }, { x: 0.8, y: 0.5 })).toEqual([{ x: 0.8, y: 0.5 }]);
  });
});

describe('nearestFreePoint', () => {
  it('keeps a point on a free tile as it is', () => {
    expect(nearestFreePoint(mapFromRows(['...']), 1.3, 0.4)).toEqual({ x: 1.3, y: 0.4 });
  });

  it('moves a point on a solid tile to the closest free tile centre', () => {
    const map = mapFromRows(['###', '#.#', '###']);
    expect(nearestFreePoint(map, 0.5, 0.5)).toEqual({ x: 1.5, y: 1.5 });
  });

  it('skips tiles the caller avoids', () => {
    const map = mapFromRows(['#..', '###']);
    const doorway = tileIndex(map, 1, 0);
    expect(nearestFreePoint(map, 0.5, 0.5, (i) => i === doorway)).toEqual({ x: 2.5, y: 0.5 });
  });

  it('gives up beyond three tiles', () => {
    const map = mapFromRows(['#########', '#########', '#########', '#########', '.########']);
    expect(nearestFreePoint(map, 8.5, 0.5)).toBeNull();
    expect(nearestFreePoint(map, 3.5, 1.5)).toEqual({ x: 0.5, y: 4.5 });
  });
});
