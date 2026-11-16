import { currentLevel, type GameState } from '../sim/state';
import type { Exploration } from './exploration';

/** Enemies fade in and out of sight over about this long, rather than popping. */
const FADE_SECONDS = 0.25;

/**
 * Which enemies show: on a level the hero explores, those standing on ground the hero has found, so a room's enemies
 * stay in view once found and one that wanders off into the unknown fades away. A boss hunting the hero always shows,
 * so a boss fight never hides its boss. Without exploration, every enemy shows.
 */
export class EnemySight {
  private readonly seen = new Map<number, number>();
  private levelId = '';

  /** Moves each enemy's visibility towards whether it shows, over `frameSeconds`. */
  update(state: GameState, frameSeconds: number, exploration: Exploration | null): void {
    const ls = currentLevel(state);
    if (state.levelId !== this.levelId) {
      this.seen.clear();
      this.levelId = state.levelId;
    }
    const { width } = ls.level.map;
    const step = Math.min(1, frameSeconds / FADE_SECONDS);
    for (const e of ls.enemies) {
      const hunting = Boolean(state.rules.enemies[e.kind]?.boss) && e.mode === 'chase';
      const shows = !exploration || hunting || exploration.found(state.levelId, Math.floor(e.x), Math.floor(e.y), width);
      const now = this.seen.get(e.id) ?? (shows ? 1 : 0);
      this.seen.set(e.id, shows ? Math.min(1, now + step) : Math.max(0, now - step));
    }
  }

  /** How visible an enemy is, from 0 (hidden) to 1; enemies not yet updated are hidden. */
  of(enemyId: number): number {
    return this.seen.get(enemyId) ?? 0;
  }
}
