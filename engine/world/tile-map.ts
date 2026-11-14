/**
 * A rectangular grid of tiles. `ground` and `prop` hold kind ids that the game defines; the engine only reads
 * `solid` to decide where things can stand and see. Tile (x, y) covers the square [x, x+1) × [y, y+1).
 */
export interface TileMap {
  readonly width: number;
  readonly height: number;
  readonly ground: Uint16Array;
  readonly prop: Uint16Array;
  readonly solid: Uint8Array;
}

/** Prop kind 0 means no prop. */
export const NO_PROP = 0;

export function createTileMap(width: number, height: number): TileMap {
  const size = width * height;
  return {
    width,
    height,
    ground: new Uint16Array(size),
    prop: new Uint16Array(size),
    solid: new Uint8Array(size),
  };
}

export const inBounds = (map: TileMap, tx: number, ty: number): boolean =>
  tx >= 0 && ty >= 0 && tx < map.width && ty < map.height;

export const tileIndex = (map: TileMap, tx: number, ty: number): number => ty * map.width + tx;

/** Whether the tile under a world point is solid. Everything outside the map counts as solid. */
export function isSolidAt(map: TileMap, x: number, y: number): boolean {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  return !inBounds(map, tx, ty) || map.solid[tileIndex(map, tx, ty)] === 1;
}

export function setSolid(map: TileMap, tx: number, ty: number, solid: boolean): void {
  if (inBounds(map, tx, ty)) map.solid[tileIndex(map, tx, ty)] = solid ? 1 : 0;
}

export function setProp(map: TileMap, tx: number, ty: number, kind: number, solid: boolean): void {
  if (!inBounds(map, tx, ty)) return;
  const i = tileIndex(map, tx, ty);
  map.prop[i] = kind;
  map.solid[i] = solid ? 1 : 0;
}
