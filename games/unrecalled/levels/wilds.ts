import { dist, hash2, lerp } from '../../../engine/core/math';
import { inBounds, setProp, tileIndex, type TileMap } from '../../../engine/world/tile-map';
import { Ground, Prop } from '../content/tiles';

/** Wears a path two tiles wide between each pair of points, and reserves the tiles round it. */
export function paintPath(map: TileMap, points: Array<[number, number]>, reserve: (x: number, y: number, w: number, h: number) => void): void {
  for (let k = 0; k < points.length - 1; k++) {
    const [ax, ay] = points[k]!;
    const [bx, by] = points[k + 1]!;
    const samples = Math.ceil(dist(ax, ay, bx, by) * 4);
    for (let s = 0; s <= samples; s++) {
      const px = lerp(ax, bx, s / samples);
      const py = lerp(ay, by, s / samples);
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const x = Math.floor(px) + dx;
          const y = Math.floor(py) + dy;
          if (inBounds(map, x, y) && map.ground[tileIndex(map, x, y)] !== Ground.Pad) map.ground[tileIndex(map, x, y)] = Ground.Path;
        }
      }
      reserve(Math.floor(px) - 1, Math.floor(py) - 1, 4, 4);
    }
  }
}

/** The share of muddy banks with reeds on them. */
const REED_SHARE = 0.35;

/**
 * Dead trees where `treeChance` says, out of 1, and rocks, weeds and pebbles scattered over the rest, with reeds on
 * muddy banks. Reserved, solid and already dressed tiles are left alone.
 */
export function scatterWilds(map: TileMap, reserved: Uint8Array, treeChance: (x: number, y: number) => number): void {
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const i = tileIndex(map, x, y);
      if (reserved[i] || map.prop[i] || map.solid[i]) continue;
      if (map.ground[i] === Ground.Mud) {
        if (hash2(x, y, 29) < REED_SHARE) setProp(map, x, y, Prop.GrassTall, false);
        continue;
      }
      const h = hash2(x, y, 23);
      if (h < treeChance(x, y)) setProp(map, x, y, Prop.DeadTree, true);
      else if (h > 0.965) setProp(map, x, y, Prop.Rock, true);
      else if (h > 0.9) setProp(map, x, y, Prop.GrassTall, false);
      else if (h > 0.84) setProp(map, x, y, Prop.GrassShort, false);
      else if (h > 0.82) setProp(map, x, y, Prop.Pebbles, false);
    }
  }
}
