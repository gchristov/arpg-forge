import { dist, lerp } from '../core/math';
import { isSolidAt, type TileMap } from './tile-map';

const SAMPLE_SPACING = 0.2;

/**
 * Whether the straight line from a to b crosses no solid tile, sampled every 0.2 tiles. With `pad`, a body of
 * that radius must also fit along the whole line, which is what walking straight there needs.
 */
export function hasLineOfSight(map: TileMap, ax: number, ay: number, bx: number, by: number, pad = 0): boolean {
  const samples = Math.ceil(dist(ax, ay, bx, by) / SAMPLE_SPACING);
  for (let k = 1; k < samples; k++) {
    const t = k / samples;
    const x = lerp(ax, bx, t);
    const y = lerp(ay, by, t);
    if (isSolidAt(map, x, y)) return false;
    if (
      pad &&
      (isSolidAt(map, x - pad, y - pad) ||
        isSolidAt(map, x + pad, y - pad) ||
        isSolidAt(map, x - pad, y + pad) ||
        isSolidAt(map, x + pad, y + pad))
    ) {
      return false;
    }
  }
  return true;
}
