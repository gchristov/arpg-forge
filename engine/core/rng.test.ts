import { describe, expect, it } from 'vitest';
import { chance, createRng, int, next, pick, range } from './rng';

describe('rng', () => {
  it('gives the same sequence for the same seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = Array.from({ length: 20 }, () => next(a));
    const seqB = Array.from({ length: 20 }, () => next(b));
    expect(seqA).toEqual(seqB);
  });

  it('gives different sequences for different seeds', () => {
    expect(next(createRng(1))).not.toBe(next(createRng(2)));
  });

  it('resumes exactly from a copied state, so it saves and replays', () => {
    const rng = createRng(7);
    next(rng);
    const saved = { ...rng };
    const expected = [next(rng), next(rng)];
    expect([next(saved), next(saved)]).toEqual(expected);
  });

  it('keeps floats in [0, 1) and in the requested range', () => {
    const rng = createRng(3);
    for (let i = 0; i < 10_000; i++) {
      const f = next(rng);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      const r = range(rng, -2, 5);
      expect(r).toBeGreaterThanOrEqual(-2);
      expect(r).toBeLessThan(5);
    }
  });

  it('hits both ends of an integer range and nothing outside it', () => {
    const rng = createRng(11);
    const seen = new Set<number>();
    for (let i = 0; i < 5_000; i++) seen.add(int(rng, 4, 7));
    expect([...seen].sort()).toEqual([4, 5, 6, 7]);
  });

  it('matches a probability over many rolls', () => {
    const rng = createRng(5);
    let hits = 0;
    for (let i = 0; i < 100_000; i++) if (chance(rng, 0.12)) hits++;
    expect(hits / 100_000).toBeCloseTo(0.12, 2);
  });

  it('picks from a list and refuses an empty one', () => {
    const rng = createRng(9);
    expect(['a', 'b', 'c']).toContain(pick(rng, ['a', 'b', 'c']));
    expect(() => pick(rng, [])).toThrow();
  });
});
