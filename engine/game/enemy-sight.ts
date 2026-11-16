import { dist } from '../core/math';
import { currentLevel, type GameState } from '../sim/state';
import { hasLineOfSight } from '../world/line-of-sight';

/** Enemies fade in and out of sight over about this long, rather than popping. */
const FADE_SECONDS = 0.25;

/**
 * Which enemies the hero can see, so the rest of a level is found as the hero goes: the layout always shows, but an
 * enemy shows only while in the hero's line of sight and within `range` tiles, fading in and out. A boss hunting the
 * hero stays in view, so a boss fight never hides its boss. Without a range, every enemy shows.
 */
export class EnemySight {
  private readonly seen = new Map<number, number>();
  private levelId = '';

  /** Moves each enemy's visibility towards whether the hero sees it, over `frameSeconds`. */
  update(state: GameState, frameSeconds: number, range: number | undefined): void {
    const ls = currentLevel(state);
    if (state.levelId !== this.levelId) {
      this.seen.clear();
      this.levelId = state.levelId;
    }
    const { hero } = state;
    const step = Math.min(1, frameSeconds / FADE_SECONDS);
    for (const e of ls.enemies) {
      const hunting = Boolean(state.rules.enemies[e.kind]?.boss) && e.mode === 'chase';
      const inSight = range === undefined || hunting || (!hero.dead && dist(e.x, e.y, hero.x, hero.y) <= range &&
        hasLineOfSight(ls.level.map, hero.x, hero.y, e.x, e.y));
      const now = this.seen.get(e.id) ?? (inSight ? 1 : 0);
      this.seen.set(e.id, inSight ? Math.min(1, now + step) : Math.max(0, now - step));
    }
  }

  /** How visible an enemy is, from 0 (unseen) to 1; enemies not yet updated are unseen. */
  of(enemyId: number): number {
    return this.seen.get(enemyId) ?? 0;
  }
}
