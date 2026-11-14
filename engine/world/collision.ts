import type { Vec2 } from '../core/math';
import { isSolidAt, type TileMap } from './tile-map';

/** Whether a body of radius `r` at (x, y) overlaps a solid tile, checked at the corners of its bounding square. */
export function isBlocked(map: TileMap, x: number, y: number, r: number): boolean {
  return (
    isSolidAt(map, x - r, y - r) ||
    isSolidAt(map, x + r, y - r) ||
    isSolidAt(map, x - r, y + r) ||
    isSolidAt(map, x + r, y + r)
  );
}

/** Moves a body by (dx, dy), one axis at a time, so it slides along walls instead of stopping dead. */
export function moveBody(map: TileMap, body: Vec2 & { r: number }, dx: number, dy: number): void {
  const nx = body.x + dx;
  if (!isBlocked(map, nx, body.y, body.r)) body.x = nx;
  const ny = body.y + dy;
  if (!isBlocked(map, body.x, ny, body.r)) body.y = ny;
}
