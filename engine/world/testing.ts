import { createTileMap, setSolid, type TileMap } from './tile-map';

/** A map from text rows for tests: `#` is solid, anything else is open. */
export function mapFromRows(rows: readonly string[]): TileMap {
  const map = createTileMap(rows[0]!.length, rows.length);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) setSolid(map, x, y, row[x] === '#');
  });
  return map;
}
