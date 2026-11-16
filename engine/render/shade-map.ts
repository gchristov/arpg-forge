import { tileIndex, type TileMap } from '../world/tile-map';

/** Ground this close to where the hero can walk, in tiles, is fully lit. */
const LIT_REACH = 1.5;
/** Past that, the world fades into darkness over this many tiles, unless told otherwise. */
const FADE_TILES = 10;

/** The tiles of a level and a margin round it, as one grid: `x0`, `y0` is its top-left corner, in the level's tiles. */
export interface ShadeArea {
  x0: number;
  y0: number;
  width: number;
  depth: number;
}

export function shadeArea(map: TileMap, margin: number): ShadeArea {
  return { x0: -margin, y0: -margin, width: map.width + margin * 2, depth: map.height + margin * 2 };
}

/**
 * How far each tile of `area` lies from the playable world, in tiles: 0 on ground the hero can walk on or a tile
 * `inside` says belongs to it (such as a building's footprint), and growing with distance in eight directions.
 */
export function playDistances(map: TileMap, area: ShadeArea, inside: (tx: number, ty: number) => boolean): Float32Array {
  const { width, depth } = area;
  const d = new Float32Array(width * depth).fill(Infinity);
  for (let y = 0; y < depth; y++) {
    for (let x = 0; x < width; x++) {
      const tx = x + area.x0;
      const ty = y + area.y0;
      const onMap = tx >= 0 && ty >= 0 && tx < map.width && ty < map.height;
      if (onMap && (!map.solid[tileIndex(map, tx, ty)] || inside(tx, ty))) d[y * width + x] = 0;
    }
  }
  // Two sweeps of a chamfer distance: down and right, then up and left.
  const diagonal = Math.SQRT2;
  const relax = (x: number, y: number, dx: number, dy: number, cost: number) => {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= width || ny >= depth) return;
    const i = y * width + x;
    const through = d[ny * width + nx]! + cost;
    if (through < d[i]!) d[i] = through;
  };
  for (let y = 0; y < depth; y++) {
    for (let x = 0; x < width; x++) {
      relax(x, y, -1, 0, 1);
      relax(x, y, 0, -1, 1);
      relax(x, y, -1, -1, diagonal);
      relax(x, y, 1, -1, diagonal);
    }
  }
  for (let y = depth - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      relax(x, y, 1, 0, 1);
      relax(x, y, 0, 1, 1);
      relax(x, y, 1, 1, diagonal);
      relax(x, y, -1, 1, diagonal);
    }
  }
  return d;
}

/**
 * How lit a spot `distance` tiles from the playable world is, from 1 down to 0 over `fade` tiles, easing off rather
 * than stopping.
 */
export function shadeAt(distance: number, fade = FADE_TILES): number {
  if (distance <= LIT_REACH) return 1;
  const left = Math.max(0, 1 - (distance - LIT_REACH) / fade);
  return left * Math.sqrt(left);
}
