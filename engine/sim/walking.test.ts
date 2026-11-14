import { describe, expect, it } from 'vitest';
import { mapFromRows } from '../world/testing';
import { isBlocked } from '../world/collision';
import { followPath, steerTowards, walkTo, type Walker } from './walking';

const walker = (x: number, y: number): Walker => ({ x, y, r: 0.28, facingX: 0, facingY: 1, moving: false, path: null });
const DT = 1 / 60;

function walkUntilDone(map: ReturnType<typeof mapFromRows>, w: Walker, speed: number, maxSteps = 2000): number {
  for (let steps = 1; steps <= maxSteps; steps++) if (followPath(map, w, speed, DT)) return steps;
  throw new Error('never arrived');
}

describe('steerTowards', () => {
  const open = mapFromRows(['.....', '.....']);

  it('moves at the given speed and faces the way it goes', () => {
    const w = walker(0.5, 0.5);
    steerTowards(open, w, 4.5, 0.5, 3.7, 0.1);
    expect(w.x).toBeCloseTo(0.87);
    expect(w.facingX).toBeGreaterThan(0);
    expect(w.moving).toBe(true);
  });

  it('stops exactly on the point without overshooting', () => {
    const w = walker(0.5, 0.5);
    expect(steerTowards(open, w, 0.6, 0.5, 3.7, 0.1)).toBe(true);
    expect(w.x).toBeCloseTo(0.6);
  });
});

describe('walking a route', () => {
  it('reaches a target around a wall without ever overlapping it', () => {
    const map = mapFromRows(['.......', '.#####.', '.......']);
    const w = walker(0.5, 0.5);
    expect(walkTo(map, w, { x: 3.5, y: 2.5 })).toEqual({ x: 3.5, y: 2.5 });
    for (let i = 0; i < 2000 && !followPath(map, w, 3.7, DT); i++) {
      expect(isBlocked(map, w.x, w.y, w.r)).toBe(false);
    }
    expect(w.x).toBeCloseTo(3.5);
    expect(w.y).toBeCloseTo(2.5);
    expect(w.moving).toBe(false);
  });

  it('walks straight across open ground at 3.7 tiles a second', () => {
    const map = mapFromRows(['..........']);
    const w = walker(0.5, 0.5);
    walkTo(map, w, { x: 7.9, y: 0.5 });
    const seconds = walkUntilDone(map, w, 3.7) * DT;
    expect(seconds).toBeCloseTo(7.4 / 3.7, 1);
  });

  it('sends a tap on a wall to the free tile next to it', () => {
    const map = mapFromRows(['..#']);
    const w = walker(0.5, 0.5);
    expect(walkTo(map, w, { x: 2.5, y: 0.5 })).toEqual({ x: 1.5, y: 0.5 });
  });

  it('keeps its path when the target is unreachable', () => {
    const map = mapFromRows(['..#..']);
    const w = walker(0.5, 0.5);
    walkTo(map, w, { x: 1.5, y: 0.5 });
    const before = w.path;
    expect(walkTo(map, w, { x: 4.5, y: 0.5 })).toBeNull();
    expect(w.path).toBe(before);
  });
});
