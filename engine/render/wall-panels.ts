import type { Vec2 } from '../core/math';
import { inBounds, tileIndex, type TileMap } from '../world/tile-map';

/**
 * One wall panel: centred at `x`, `y` on the edge between wall and floor, `length` tiles long, facing the floor along
 * `facing`. `front` panels stand between the floor and the camera, so drawn full height they would hide the room.
 */
export interface WallPanel {
  x: number;
  y: number;
  length: number;
  facing: Vec2;
  front: boolean;
}

/** From a floor tile, the four sides a wall can be on, as the direction from the wall towards the floor. */
const SIDES: ReadonlyArray<{ wall: Vec2; facing: Vec2; front: boolean }> = [
  { wall: { x: -1, y: 0 }, facing: { x: 1, y: 0 }, front: false },
  { wall: { x: 0, y: -1 }, facing: { x: 0, y: 1 }, front: false },
  { wall: { x: 1, y: 0 }, facing: { x: -1, y: 0 }, front: true },
  { wall: { x: 0, y: 1 }, facing: { x: 0, y: -1 }, front: true },
];

/**
 * Lays wall panels along every edge where a wall tile meets a floor tile. Each straight run of such edges is split
 * into panels of `span` tiles from its start; a shorter piece finishes a run that isn't a whole number of spans.
 */
export function wallPanels(map: TileMap, isWall: (tx: number, ty: number) => boolean, span: number): WallPanel[] {
  const wallAt = (tx: number, ty: number) => inBounds(map, tx, ty) && isWall(tx, ty);
  const panels: WallPanel[] = [];
  for (const side of SIDES) {
    const alongX = side.wall.x === 0;
    // The edge between a floor tile and its wall on this side, as the line it lies on and its start along that line.
    const hasEdge = (tx: number, ty: number) =>
      inBounds(map, tx, ty) && !wallAt(tx, ty) && wallAt(tx + side.wall.x, ty + side.wall.y);
    const lines = alongX ? map.height : map.width;
    const length = alongX ? map.width : map.height;
    for (let line = 0; line < lines; line++) {
      let start = -1;
      for (let along = 0; along <= length; along++) {
        const [tx, ty] = alongX ? [along, line] : [line, along];
        const edge = along < length && hasEdge(tx, ty);
        if (edge && start < 0) start = along;
        if (edge || start < 0) continue;
        for (let from = start; from < along; from += span) {
          const piece = Math.min(span, along - from);
          const middle = from + piece / 2;
          // The edge sits on the floor tile's border with the wall.
          const across = line + 0.5 + (alongX ? side.wall.y : side.wall.x) * 0.5;
          panels.push({
            x: alongX ? middle : across,
            y: alongX ? across : middle,
            length: piece,
            facing: side.facing,
            front: side.front,
          });
        }
        start = -1;
      }
    }
  }
  return panels;
}

export const isWallTile = (map: TileMap, kinds: ReadonlySet<number>) => (tx: number, ty: number) =>
  map.solid[tileIndex(map, tx, ty)] === 1 && kinds.has(map.prop[tileIndex(map, tx, ty)]!);
