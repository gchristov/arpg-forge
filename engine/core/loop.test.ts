import { describe, expect, it } from 'vitest';
import { advance, createFixedLoop } from './loop';

describe('fixed loop', () => {
  it('runs one step per 1/60 s whatever the frame rate', () => {
    for (const fps of [30, 60, 144]) {
      const loop = createFixedLoop(1 / 60);
      let steps = 0;
      for (let frame = 0; frame < fps; frame++) advance(loop, 1 / fps, () => steps++);
      expect(steps).toBeGreaterThanOrEqual(59);
      expect(steps).toBeLessThanOrEqual(60);
    }
  });

  it('always passes the fixed step length', () => {
    const loop = createFixedLoop(1 / 60);
    const dts: number[] = [];
    advance(loop, 0.05, (dt) => dts.push(dt));
    expect(dts).toEqual([1 / 60, 1 / 60, 1 / 60]);
  });

  it('returns how far it is into the next step', () => {
    const loop = createFixedLoop(0.1);
    expect(advance(loop, 0.25, () => {})).toBeCloseTo(0.5);
  });

  it('caps a long stall instead of running a burst of steps', () => {
    const loop = createFixedLoop(1 / 60, 0.25);
    let steps = 0;
    advance(loop, 5, () => steps++);
    expect(steps).toBe(15);
  });

  it('ignores negative frame times', () => {
    const loop = createFixedLoop(1 / 60);
    let steps = 0;
    advance(loop, -1, () => steps++);
    expect(steps).toBe(0);
  });
});
