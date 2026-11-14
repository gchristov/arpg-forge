import { moveBody } from '../world/collision';
import { currentLevel, type Actor, type GameState } from './state';

/** The hero gives way less than enemies do; NPCs don't move at all. */
const HERO_WEIGHT = 0.4;

const bodies: Actor[] = [];
const weights: number[] = [];

/** Pushes overlapping bodies apart, each by its weight's share of the overlap. */
export function separateBodies(state: GameState): void {
  const ls = currentLevel(state);
  const { map } = ls.level;
  bodies.length = 0;
  weights.length = 0;
  bodies.push(state.hero);
  weights.push(HERO_WEIGHT);
  for (const n of ls.npcs) {
    bodies.push(n);
    weights.push(0);
  }
  for (const e of ls.enemies) {
    if (e.dead) continue;
    bodies.push(e);
    weights.push(1);
  }
  for (let a = 0; a < bodies.length; a++) {
    for (let b = a + 1; b < bodies.length; b++) {
      const A = bodies[a]!;
      const B = bodies[b]!;
      const dx = B.x - A.x;
      const dy = B.y - A.y;
      const d = Math.hypot(dx, dy);
      const min = A.r + B.r;
      if (d >= min || d <= 1e-4) continue;
      const push = (min - d) / 2;
      const nx = (dx / d) * push;
      const ny = (dy / d) * push;
      moveBody(map, A, -nx * weights[a]!, -ny * weights[a]!);
      moveBody(map, B, nx * weights[b]!, ny * weights[b]!);
    }
  }
}
