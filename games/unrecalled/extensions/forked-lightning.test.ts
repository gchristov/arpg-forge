import { describe, expect, it } from 'vitest';
import { ForkedLightning, type Point } from './forked-lightning';

/** Every stroke drawn, by its ends and width. */
function recorder(): { lightning: ForkedLightning; strokes: Array<{ from: Point; to: Point; width: number }> } {
  const strokes: Array<{ from: Point; to: Point; width: number }> = [];
  const lightning = new ForkedLightning((fx, fy, fh, tx, ty, th, _c, _s, _d, width = 1) => {
    strokes.push({ from: { x: fx, y: fy, h: fh }, to: { x: tx, y: ty, h: th }, width });
  });
  return { lightning, strokes };
}

const same = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y, a.h - b.h) < 1e-9;

describe('ForkedLightning', () => {
  it('runs a bolt unbroken from end to end, in short strokes, with thinner forks that start on it', () => {
    const { lightning, strokes } = recorder();
    const from = { x: 0, y: 0, h: 0.75 };
    const to = { x: 4, y: 0, h: 0.5 };
    for (let n = 0; n < 20; n++) lightning.bolt(from, to, 0xffffff, 0.1);
    const main = strokes.filter((s) => s.width === 1);
    const forks = strokes.filter((s) => s.width < 1);
    expect(forks.length).toBeGreaterThan(0);
    // Twenty bolts, each a chain from `from` to `to`.
    expect(main.filter((s) => same(s.from, from))).toHaveLength(20);
    expect(main.filter((s) => same(s.to, to))).toHaveLength(20);
    for (const s of main) expect(Math.hypot(s.to.x - s.from.x, s.to.y - s.from.y)).toBeLessThan(1.2);
    // Forks off the bolt itself (not forks of forks) start on one of its joints.
    const joints = main.map((s) => s.to);
    for (const f of forks.filter((s) => s.width > 0.5)) expect(joints.some((p) => same(p, f.from))).toBe(true);
  });

  it('never sends a fork below the ground', () => {
    const { lightning, strokes } = recorder();
    for (let n = 0; n < 50; n++) lightning.burst({ x: 0, y: 0, h: 0.1 }, 0xffffff, 0.2, 6);
    for (const s of strokes) expect(s.to.h).toBeGreaterThan(0);
  });
});
