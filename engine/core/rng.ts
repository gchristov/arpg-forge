/**
 * Seeded random generator (mulberry32). Its whole state is one number, so it saves and replays with the game
 * state. Every random choice in the rules goes through one of these, never `Math.random()`.
 */
export interface Rng {
  state: number;
}

export function createRng(seed: number): Rng {
  return { state: seed >>> 0 };
}

/** A float in [0, 1). */
export function next(rng: Rng): number {
  rng.state = (rng.state + 0x6d2b79f5) >>> 0;
  let t = rng.state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** A float in [min, max). */
export function range(rng: Rng, min: number, max: number): number {
  return min + next(rng) * (max - min);
}

/** An integer in [min, max], both ends included. */
export function int(rng: Rng, min: number, max: number): number {
  return Math.floor(min + next(rng) * (max - min + 1));
}

export function chance(rng: Rng, probability: number): boolean {
  return next(rng) < probability;
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pick from an empty list');
  return items[int(rng, 0, items.length - 1)]!;
}
