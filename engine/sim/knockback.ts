import { moveBody } from '../world/collision';
import type { TileMap } from '../world/tile-map';
import type { Enemy } from './state';

/** A knocked-back enemy's slide dies away at this rate a second, so most of it is over in about a fifth of a second. */
const SLIDE_DECAY = 12;
/** Slower than this, in tiles a second, the slide has stopped. */
const STOPPED = 0.02;

/** Knocks an enemy `distance` tiles along `dx`, `dy` (a unit vector), as a quick slide rather than a jump. */
export function knockBack(e: Enemy, dx: number, dy: number, distance: number): void {
  e.slideX += dx * distance * SLIDE_DECAY;
  e.slideY += dy * distance * SLIDE_DECAY;
}

/** Carries a knocked-back enemy on along its slide for `dt` seconds, stopped by walls like any move. */
export function slide(map: TileMap, e: Enemy, dt: number): void {
  if (e.slideX === 0 && e.slideY === 0) return;
  // How far the dying-away speed carries it over `dt`, exactly, so the whole slide adds up to the knock's distance.
  const keep = Math.exp(-SLIDE_DECAY * dt);
  const carried = (1 - keep) / SLIDE_DECAY;
  moveBody(map, e, e.slideX * carried, e.slideY * carried);
  e.slideX *= keep;
  e.slideY *= keep;
  if (Math.hypot(e.slideX, e.slideY) < STOPPED) e.slideX = e.slideY = 0;
}
