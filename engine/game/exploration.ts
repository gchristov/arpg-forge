import { currentLevel, type GameState } from '../sim/state';
import { hasLineOfSight } from '../world/line-of-sight';
import { inBounds, tileIndex } from '../world/tile-map';

/** Newly found ground fades in over about this long. */
const REVEAL_SECONDS = 0.4;
/** How far inside a tile its nearest point to the hero is taken, so that point lies just within the tile. */
const NEAR_SIDE = 0.02;

interface LevelExploration {
  /** Whether the hero has seen each tile. */
  found: Uint8Array;
  /** How far each tile has faded in, from 0 to 1. */
  shown: Float32Array;
  /** The tile the hero last looked around from, so the search runs only when they move to another. */
  fromTile: number;
  /** Whether some tile is still fading in. */
  fading: boolean;
}

/**
 * What the hero has found of each level, so the rest stays dark until they get there: every tile within `range` tiles
 * of the hero, in their line of sight, is found and stays found, fading in. Kept for every level the hero visits.
 */
export class Exploration {
  private readonly levels = new Map<string, LevelExploration>();

  /** Looks around from the hero and fades in what they found, over `frameSeconds`; true if anything changed. */
  update(state: GameState, frameSeconds: number, range: number): boolean {
    const ls = currentLevel(state);
    const { map } = ls.level;
    let level = this.levels.get(state.levelId);
    if (!level) {
      level = { found: new Uint8Array(map.width * map.height), shown: new Float32Array(map.width * map.height), fromTile: -1, fading: false };
      this.levels.set(state.levelId, level);
    }
    const { hero } = state;
    const hx = Math.floor(hero.x);
    const hy = Math.floor(hero.y);
    const fromTile = inBounds(map, hx, hy) ? tileIndex(map, hx, hy) : -1;
    if (fromTile !== level.fromTile) {
      level.fromTile = fromTile;
      const reach = Math.ceil(range);
      for (let ty = hy - reach; ty <= hy + reach; ty++) {
        for (let tx = hx - reach; tx <= hx + reach; tx++) {
          if (!inBounds(map, tx, ty) || level.found[tileIndex(map, tx, ty)]) continue;
          if (Math.hypot(tx - hx, ty - hy) > range) continue;
          // Seen once the near side of the tile is in sight, so a wall counts as soon as its face shows.
          const nearX = Math.min(Math.max(hero.x, tx + NEAR_SIDE), tx + 1 - NEAR_SIDE);
          const nearY = Math.min(Math.max(hero.y, ty + NEAR_SIDE), ty + 1 - NEAR_SIDE);
          if (!hasLineOfSight(map, hero.x, hero.y, nearX, nearY)) continue;
          level.found[tileIndex(map, tx, ty)] = 1;
          level.fading = true;
        }
      }
    }
    if (!level.fading) return false;
    const step = frameSeconds / REVEAL_SECONDS;
    level.fading = false;
    for (let i = 0; i < level.found.length; i++) {
      if (!level.found[i] || level.shown[i] === 1) continue;
      level.shown[i] = Math.min(1, level.shown[i]! + step);
      if (level.shown[i]! < 1) level.fading = true;
    }
    return true;
  }

  /** How far each tile of a level has been revealed, from 0 to 1, by tile index; null for a level not yet visited. */
  shown(levelId: string): Float32Array | null {
    return this.levels.get(levelId)?.shown ?? null;
  }

  /** Whether the hero has found the tile `tx`, `ty` of a level. */
  found(levelId: string, tx: number, ty: number, width: number): boolean {
    return Boolean(this.levels.get(levelId)?.found[ty * width + tx]);
  }
}
