import { hash2, type Vec2 } from '../core/math';
import type { BuildingPart, Structure } from '../world/level';

/**
 * One piece along a building's outside: centred at `x`, `y` on an edge of its outline, `length` tiles long, facing out
 * along `facing`, on storey `storey` (0 at the ground). `seen` pieces face the camera (towards +x or +y).
 */
export interface WallSlot {
  part: 'wall' | 'window' | 'door';
  x: number;
  y: number;
  length: number;
  facing: Vec2;
  storey: number;
  seen: boolean;
}

/** A column where the outline turns, through storey `storey`; `top` columns also run up past the band above it. */
export interface Corner {
  x: number;
  y: number;
  storey: number;
  top: boolean;
}

/** A plate of roof over a block `floors` storeys tall, `width` by `depth` tiles, centred at `x`, `y`. */
export interface RoofPlate {
  x: number;
  y: number;
  width: number;
  depth: number;
  floors: number;
}

export interface BuildingLayout {
  walls: WallSlot[];
  /** Where the band runs along the top of a block's walls, on the storey below it. */
  bands: WallSlot[];
  corners: Corner[];
  roof: RoofPlate[];
  /** Railings round the roofs of blocks lower than the tallest, as galleries looking out over the town. */
  rails: WallSlot[];
  /** Where things stand on the roofs, such as vents, with which of the kit's roof props stands there. */
  roofProps: Array<{ x: number; y: number; floors: number; variant: number }>;
}

/** The four sides of a tile, by the way they face, the camera's two first. */
const SIDES: readonly Vec2[] = [{ x: 0, y: 1 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: -1, y: 0 }];

/**
 * Lays out a building from a kit of pieces `span` tiles long. The building is its blocks (`parts`, or the whole lot
 * as one storey), each its own number of storeys tall. Walls follow the outline of each storey: a one-tile door
 * where the door is, windows in every other whole piece on the ground and in every one above it on the sides the camera
 * sees, columns where the outline turns, a band along the top of each block, a roof over each and railings round the
 * lower roofs. Pieces are laid from each run's start; a shorter one finishes a run that isn't a whole number of spans.
 * Placement comes from the shape alone, so a building looks the same every time.
 */
export function buildingLayout(s: Structure, span: number, roofPropKinds: number): BuildingLayout {
  const parts = buildingParts(s);
  const floorsAt = (tx: number, ty: number): number => {
    for (const p of parts) if (tx >= p.x && tx < p.x + p.width && ty >= p.y && ty < p.y + p.depth) return p.floors;
    return 0;
  };
  const tallest = Math.max(...parts.map((p) => p.floors));
  const door = doorEdge(s, floorsAt);

  const walls: WallSlot[] = [];
  const bands: WallSlot[] = [];
  for (let storey = 0; storey < tallest; storey++) {
    for (const run of edgeRuns(s, (tx, ty) => floorsAt(tx, ty) > storey)) {
      const seen = run.facing.x > 0 || run.facing.y > 0;
      let whole = 0;
      const lay = (start: number, end: number) => {
        for (let t = start; t < end; t += span) {
          const length = Math.min(span, end - t);
          const window = seen && length === span && (storey > 0 || whole++ % 2 === 0);
          walls.push({ part: window ? 'window' : 'wall', ...run.at(t + length / 2), length, facing: run.facing, storey, seen });
        }
      };
      const doorAt = storey === 0 && door && sameLine(run, door) ? door.along - run.start : -1;
      if (doorAt < 0 || doorAt >= run.end - run.start) lay(run.start, run.end);
      else {
        lay(run.start, run.start + doorAt);
        walls.push({ part: 'door', ...run.at(run.start + doorAt + 0.5), length: 1, facing: run.facing, storey, seen });
        lay(run.start + doorAt + 1, run.end);
      }
    }
    // The band tops the walls of each block's last storey, over the door too, so the top edge is unbroken.
    for (const run of edgeRuns(s, (tx, ty) => floorsAt(tx, ty) === storey + 1)) {
      for (let t = run.start; t < run.end; t += span) {
        const length = Math.min(span, run.end - t);
        bands.push({ part: 'wall', ...run.at(t + length / 2), length, facing: run.facing, storey, seen: false });
      }
    }
  }

  const corners: Corner[] = [];
  for (let storey = 0; storey < tallest; storey++) {
    for (let y = s.y; y <= s.y + s.depth; y++) {
      for (let x = s.x; x <= s.x + s.width; x++) {
        const around = [floorsAt(x - 1, y - 1), floorsAt(x, y - 1), floorsAt(x - 1, y), floorsAt(x, y)];
        const inside = around.map((f) => f > storey);
        const count = inside.filter(Boolean).length;
        // The outline turns here if one or three of the tiles round the point are inside, or two diagonally.
        const turns = count === 1 || count === 3 || (count === 2 && inside[0] === inside[3]);
        if (turns) corners.push({ x, y, storey, top: Math.max(...around) === storey + 1 });
      }
    }
  }

  const roof: RoofPlate[] = [];
  for (const p of parts) {
    for (let y = 0; y < p.depth; y += span) {
      for (let x = 0; x < p.width; x += span) {
        const width = Math.min(span, p.width - x);
        const depth = Math.min(span, p.depth - y);
        roof.push({ x: p.x + x + width / 2, y: p.y + y + depth / 2, width, depth, floors: p.floors });
      }
    }
  }

  const rails: WallSlot[] = [];
  for (const p of parts) {
    if (p.floors >= tallest) continue;
    const roofOf = (tx: number, ty: number) => tx >= p.x && tx < p.x + p.width && ty >= p.y && ty < p.y + p.depth;
    // Round the roof's edges that drop away, not where it meets a taller block's wall.
    for (const run of edgeRuns(s, roofOf, (tx, ty) => floorsAt(tx, ty) < p.floors)) {
      for (let t = run.start; t < run.end; t += span) {
        const length = Math.min(span, run.end - t);
        rails.push({ part: 'wall', ...run.at(t + length / 2), length, facing: run.facing, storey: p.floors, seen: false });
      }
    }
  }

  const roofProps = roofPropKinds > 0
    ? roof.filter((p, i) => hash2(p.x * 2, p.y * 2, 41) < 0.45 || i === 0).map((p) => ({
      x: p.x, y: p.y, floors: p.floors, variant: Math.floor(hash2(p.x * 2, p.y * 2, 43) * roofPropKinds),
    }))
    : [];
  return { walls, bands, corners, roof, rails, roofProps };
}

/** A building's blocks: its parts, or its whole lot as one storey. */
export function buildingParts(s: Structure): readonly BuildingPart[] {
  return s.parts ?? [{ x: s.x, y: s.y, width: s.width, depth: s.depth, floors: 1 }];
}

interface EdgeRun {
  facing: Vec2;
  /** The line the run lies on (a y for runs along x, an x for runs along y), and where along it the run starts and ends. */
  line: number;
  start: number;
  end: number;
  at(along: number): Vec2;
}

/**
 * Straight runs of edge round the tiles `inside` says are in, where the tile beyond is `beyond` (by default, not in).
 * Each run is on one side, facing out.
 */
function edgeRuns(
  s: Structure,
  inside: (tx: number, ty: number) => boolean,
  beyond: (tx: number, ty: number) => boolean = (tx, ty) => !inside(tx, ty),
): EdgeRun[] {
  const runs: EdgeRun[] = [];
  for (const facing of SIDES) {
    const alongX = facing.y !== 0;
    const [lineFrom, lineTo] = alongX ? [s.y, s.y + s.depth] : [s.x, s.x + s.width];
    const [from, to] = alongX ? [s.x, s.x + s.width] : [s.y, s.y + s.depth];
    for (let row = lineFrom; row < lineTo; row++) {
      const line = row + (facing.x + facing.y > 0 ? 1 : 0);
      let start = -1;
      for (let along = from; along <= to; along++) {
        const [tx, ty] = alongX ? [along, row] : [row, along];
        const edge = along < to && inside(tx, ty) && beyond(tx + facing.x, ty + facing.y);
        if (edge && start < 0) start = along;
        if (!edge && start >= 0) {
          runs.push({
            facing, line, start, end: along,
            at: (t) => (alongX ? { x: t, y: line } : { x: line, y: t }),
          });
          start = -1;
        }
      }
    }
  }
  return runs;
}

/** The edge the door is on: the line it lies on and how far along it the door starts, facing the front if it can. */
function doorEdge(s: Structure, floorsAt: (tx: number, ty: number) => number): { facing: Vec2; line: number; along: number } | null {
  const { tx, ty } = s.door;
  for (const facing of SIDES) {
    if (floorsAt(tx + facing.x, ty + facing.y) > 0) continue;
    const alongX = facing.y !== 0;
    const line = (alongX ? ty : tx) + (facing.x + facing.y > 0 ? 1 : 0);
    return { facing, line, along: alongX ? tx : ty };
  }
  return null;
}

function sameLine(run: EdgeRun, door: { facing: Vec2; line: number }): boolean {
  return run.facing === door.facing && run.line === door.line;
}
