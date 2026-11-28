import { dist } from '../../../engine/core/math';
import { currentLevel, type Enemy, type GameState } from '../../../engine/sim/state';

/** How far round U-7 it looks for the next machine that's down (stunned, as by the EMP). */
const NEXT_DOWNED_RANGE = 6;

/** Moves U-7 straight on to the nearest machine that's still down, if there is one; both its weapons finish them off. */
export function goForNextDowned(state: GameState): void {
  const { hero } = state;
  let best: Enemy | null = null;
  let bestDistance = NEXT_DOWNED_RANGE;
  for (const e of currentLevel(state).enemies) {
    if (e.dead || e.stunnedFor <= 0) continue;
    const d = dist(hero.x, hero.y, e.x, e.y);
    if (d < bestDistance) [best, bestDistance] = [e, d];
  }
  if (!best) return;
  hero.targetId = best.id;
  hero.path = null;
  hero.repathTimer = 0;
}
