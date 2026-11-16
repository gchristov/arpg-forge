import type { Vec2 } from '../core/math';
import { inBounds, tileIndex, type TileMap } from '../world/tile-map';

/**
 * One wall panel: centred at `x`, `y` on the edge between wall and floor, `length` tiles long, facing the floor along
 * `facing`. `front` panels are drawn low: drawn full height, walls between the floor and the camera, and walls with
 * floor close behind them, would hide that floor.
 */

/** How deep the solid rock behind a back wall must be for it to stand full height without hiding floor behind it. */
const BACK_WALL_DEPTH = 3;
export interface WallPanel {
  x: number;
  y: number;
  length: number;
  facing: Vec2;
  front: boolean;
}

/** From a floor tile, the four sides a wall can be on, as the direction from the wall towards the floor. */
const SIDES: ReadonlyArray<{ wall: Vec2; facing: Vec2 }> = [
  { wall: { x: -1, y: 0 }, facing: { x: 1, y: 0 } },
  { wall: { x: 0, y: -1 }, facing: { x: 0, y: 1 } },
  { wall: { x: 1, y: 0 }, facing: { x: -1, y: 0 } },
  { wall: { x: 0, y: 1 }, facing: { x: 0, y: -1 } },
];

/**
 * Lays wall panels along every edge where a wall tile meets a floor tile. Each straight run of such edges is split
 * into panels of `span` tiles from its start; a shorter piece finishes a run that isn't a whole number of spans.
 */
export function wallPanels(map: TileMap, isWall: (tx: number, ty: number) => boolean, span: number): WallPanel[] {
  const wallAt = (tx: number, ty: number) => inBounds(map, tx, ty) && isWall(tx, ty);
  const isFront = frontTest(map, isWall);
  const panels: WallPanel[] = [];
  for (const side of SIDES) {
    const alongX = side.wall.x === 0;
    // The edge between a floor tile and its wall on this side, as the line it lies on and its start along that line.
    const hasEdge = (tx: number, ty: number) =>
      inBounds(map, tx, ty) && !wallAt(tx, ty) && wallAt(tx + side.wall.x, ty + side.wall.y);
    const lines = alongX ? map.height : map.width;
    const length = alongX ? map.width : map.height;
    for (let line = 0; line < lines; line++) {
      const across = line + 0.5 + (alongX ? side.wall.y : side.wall.x) * 0.5;
      const lay = (from: number, to: number, front: boolean) => {
        for (let at = from; at < to; at += span) {
          const piece = Math.min(span, to - at);
          const middle = at + piece / 2;
          panels.push({ x: alongX ? middle : across, y: alongX ? across : middle, length: piece, facing: side.facing, front });
        }
      };
      let start = -1;
      let runFront = false;
      for (let along = 0; along <= length; along++) {
        const [tx, ty] = alongX ? [along, line] : [line, along];
        const edge = along < length && hasEdge(tx, ty);
        const front = edge && isFront(tx + side.wall.x, ty + side.wall.y);
        if (start >= 0 && (!edge || front !== runFront)) {
          lay(start, along, runFront);
          start = -1;
        }
        if (edge && start < 0) {
          start = along;
          runFront = front;
        }
      }
    }
  }
  return panels;
}

/**
 * Whether a wall tile's faces are drawn low, as a front wall the camera sees over. A wall stands full height when it's
 * behind a room or corridor as the camera sees it (above or left of at least two tiles of floor, so a doorway's
 * opening doesn't count) with solid rock deep behind it, like the back walls of a dungeon. Every face of a tile goes
 * the same way, so the sides of a doorway match the wall around it. Walls with floor close behind them, such as thin
 * walls between rooms or walls inside a room, are low on every side, like railings: drawn full height, they would
 * hide that floor.
 */
function frontTest(map: TileMap, isWall: (tx: number, ty: number) => boolean): (tx: number, ty: number) => boolean {
  const solid = (tx: number, ty: number) => !inBounds(map, tx, ty) || isWall(tx, ty);
  const backed = (tx: number, ty: number, dx: number, dy: number) => {
    for (let k = 1; k <= BACK_WALL_DEPTH; k++) if (!solid(tx + dx * k, ty + dy * k)) return false;
    return true;
  };
  const before = (tx: number, ty: number, dx: number, dy: number) => !solid(tx + dx, ty + dy) && !solid(tx + dx * 2, ty + dy * 2);
  // The map's own top and left edges are the outer back walls of whatever lies against them.
  const outer = (tx: number, ty: number) => tx === 0 || ty === 0;
  return (tx, ty) =>
    !(outer(tx, ty) || (before(tx, ty, 0, 1) && backed(tx, ty, 0, -1)) || (before(tx, ty, 1, 0) && backed(tx, ty, -1, 0)));
}

/** The faces of one wall tile that look onto open floor, each one tile long, centred on its edge. */
export function wallFaces(map: TileMap, isWall: (tx: number, ty: number) => boolean, tx: number, ty: number): WallPanel[] {
  const front = frontTest(map, isWall)(tx, ty);
  return SIDES.flatMap((side) => {
    const floor = { x: tx - side.wall.x, y: ty - side.wall.y };
    if (!inBounds(map, floor.x, floor.y) || isWall(floor.x, floor.y)) return [];
    const x = tx + 0.5 - side.wall.x * 0.5;
    const y = ty + 0.5 - side.wall.y * 0.5;
    return [{ x, y, length: 1, facing: side.facing, front }];
  });
}

export const isWallTile = (map: TileMap, kinds: ReadonlySet<number>) => (tx: number, ty: number) =>
  map.solid[tileIndex(map, tx, ty)] === 1 && kinds.has(map.prop[tileIndex(map, tx, ty)]!);

/** A point where walls turn a corner, at a tile corner; `front` if it's on a wall facing the camera. */
export interface WallCorner {
  x: number;
  y: number;
  front: boolean;
}

/**
 * Every tile corner where wall edges turn: where the four tiles meeting there aren't a straight edge (two walls side by
 * side) nor all one kind. Straight runs of panels meet badly there, so a column stands on each.
 */
export function wallCorners(map: TileMap, isWall: (tx: number, ty: number) => boolean): WallCorner[] {
  const wallAt = (tx: number, ty: number) => inBounds(map, tx, ty) && isWall(tx, ty);
  const isFront = frontTest(map, isWall);
  const corners: WallCorner[] = [];
  for (let y = 1; y < map.height; y++) {
    for (let x = 1; x < map.width; x++) {
      const tiles = [[x - 1, y - 1], [x, y - 1], [x - 1, y], [x, y]] as const;
      const walls = tiles.filter(([tx, ty]) => wallAt(tx, ty));
      if (walls.length === 0 || walls.length === 4) continue;
      // Two walls side by side make a straight edge; two diagonal ones still turn.
      if (walls.length === 2 && (walls[0]![0] === walls[1]![0] || walls[0]![1] === walls[1]![1])) continue;
      corners.push({ x, y, front: walls.some(([tx, ty]) => isFront(tx, ty)) });
    }
  }
  return corners;
}
