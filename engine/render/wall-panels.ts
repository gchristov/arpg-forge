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

/**
 * A corner piece of a modular wall kit, at a tile corner: `inner` where a room turns, outer where a wall juts into one.
 * `arms` point along the two walls it joins, away from the corner, each one kit cell long. It's `front` when both
 * those walls stand between the room and the camera.
 */
export interface KitCorner {
  x: number;
  y: number;
  inner: boolean;
  arms: { x: number; y: number };
  front: boolean;
}

/**
 * Walls laid the way a modular kit expects, on a grid of `span`-tile cells from the map's corner: a straight panel for
 * every whole cell of edge between wall and floor, and a corner piece wherever the edges turn, covering a cell of each
 * wall it joins. Rooms drawn on the grid come out with every piece whole. An opening in a wall, such as a doorway,
 * counts as wall for where it turns, but its cell gets no panel; nor does a cell only partly edged. A wall stands
 * between the room and the camera, `front`, when its face looks away from the camera: towards -x or -y.
 */
export function kitWalls(
  map: TileMap,
  isWall: (tx: number, ty: number) => boolean,
  span: number,
  isOpening: (tx: number, ty: number) => boolean = () => false,
): { panels: WallPanel[]; corners: KitCorner[]; openings: KitOpening[] } {
  const wallAt = (tx: number, ty: number) => !inBounds(map, tx, ty) || isWall(tx, ty) || isOpening(tx, ty);
  const openings: KitOpening[] = [];
  const corners: KitCorner[] = [];
  const covered = new Set<string>();
  for (let y = 1; y < map.height; y++) {
    for (let x = 1; x < map.width; x++) {
      const tiles = [[x - 1, y - 1], [x, y - 1], [x - 1, y], [x, y]] as const;
      const walls = tiles.filter(([tx, ty]) => wallAt(tx, ty));
      // A room's corner has one floor tile among the four; a wall jutting into a room has one wall tile.
      const odd = walls.length === 3 ? tiles.find(([tx, ty]) => !wallAt(tx, ty)) : walls.length === 1 ? walls[0] : undefined;
      if (!odd) continue;
      const arms = { x: odd[0] === x ? 1 : -1, y: odd[1] === y ? 1 : -1 };
      const inner = walls.length === 3;
      // An inner corner's walls face along its arms, into the room; an outer one's face the other way, out from the wall.
      const faces = inner ? arms : { x: -arms.x, y: -arms.y };
      corners.push({ x, y, inner, arms, front: faces.x < 0 && faces.y < 0 });
      covered.add(`h${y}:${arms.x > 0 ? x : x - span}`);
      covered.add(`v${x}:${arms.y > 0 ? y : y - span}`);
    }
  }
  const panels: WallPanel[] = [];
  // Horizontal edges lie between rows y - 1 and y; vertical ones between columns x - 1 and x.
  for (const horizontal of [true, false]) {
    const lines = horizontal ? map.height : map.width;
    const length = horizontal ? map.width : map.height;
    for (let line = 1; line < lines; line++) {
      for (let start = 0; start + span <= length; start += span) {
        if (covered.has(`${horizontal ? 'h' : 'v'}${line}:${start}`)) continue;
        // Which side the wall is on, the same along the whole cell, or no panel.
        let wallBefore: boolean | null = null;
        for (let at = start; at < start + span; at++) {
          const [bx, by, ax, ay] = horizontal ? [at, line - 1, at, line] : [line - 1, at, line, at];
          const before = wallAt(bx, by);
          if (before === wallAt(ax, ay) || (wallBefore !== null && before !== wallBefore)) {
            wallBefore = null;
            break;
          }
          wallBefore = before;
        }
        if (wallBefore === null) continue;
        const toFloor = wallBefore ? 1 : -1;
        const middle = start + span / 2;
        const facing = horizontal ? { x: 0, y: toFloor } : { x: toFloor, y: 0 };
        const opening = Array.from({ length: span }, (_, i) => start + i)
          .map((at) => (horizontal ? [at, wallBefore ? line - 1 : line] : [wallBefore ? line - 1 : line, at]) as [number, number])
          .find(([wx, wy]) => inBounds(map, wx, wy) && isOpening(wx, wy));
        if (opening) {
          openings.push({ x: horizontal ? middle : line, y: horizontal ? line : middle, facing, tx: opening[0], ty: opening[1] });
          continue;
        }
        panels.push({ x: horizontal ? middle : line, y: horizontal ? line : middle, length: span, facing, front: toFloor < 0 });
      }
    }
  }
  return { panels, corners, openings };
}

/** A cell of wall left open, centred on its edge and facing the floor, and the opening's own tile, such as a doorway. */
export interface KitOpening {
  x: number;
  y: number;
  facing: Vec2;
  tx: number;
  ty: number;
}
