import { hash2, type Vec2 } from '../core/math';
import type { Structure } from '../world/level';

/**
 * One piece of a building's outer wall: centred at `x`, `y` on the lot's edge, `length` tiles long, facing out along
 * `facing`. `seen` pieces face the camera (the front and the right side).
 */
export interface WallSlot {
  part: 'wall' | 'window' | 'door';
  x: number;
  y: number;
  length: number;
  facing: Vec2;
  seen: boolean;
}

/** A plate of the roof, `width` by `depth` tiles, centred at `x`, `y`. */
export interface RoofPlate {
  x: number;
  y: number;
  width: number;
  depth: number;
}

export interface BuildingLayout {
  walls: WallSlot[];
  corners: Vec2[];
  roof: RoofPlate[];
  /** Where things stand on the roof, such as vents, with which of the kit's roof props stands there. */
  roofProps: Array<{ x: number; y: number; variant: number }>;
}

/**
 * Lays out a building from a kit of wall pieces `span` tiles long: walls round the lot's edge with a one-tile door
 * where its door is, windows in every other full piece on the sides the camera sees, a column at each corner and a
 * roof of plates. Pieces are laid from each run's start; a shorter one finishes a run that isn't a whole number of
 * spans. Placement comes from the lot alone, so a building looks the same every time.
 */
export function buildingLayout(s: Structure, span: number, roofPropKinds: number): BuildingLayout {
  const right = s.x + s.width;
  const front = s.y + s.depth;
  const sides = [
    { from: { x: s.x, y: front }, along: { x: 1, y: 0 }, length: s.width, facing: { x: 0, y: 1 }, seen: true },
    { from: { x: right, y: s.y }, along: { x: 0, y: 1 }, length: s.depth, facing: { x: 1, y: 0 }, seen: true },
    { from: { x: s.x, y: s.y }, along: { x: 1, y: 0 }, length: s.width, facing: { x: 0, y: -1 }, seen: false },
    { from: { x: s.x, y: s.y }, along: { x: 0, y: 1 }, length: s.depth, facing: { x: -1, y: 0 }, seen: false },
  ];
  const walls: WallSlot[] = [];
  // A door on a corner tile goes in the first side it's on, the front if it can.
  const doorSide = sides.find((side) => doorAlong(s, side.facing) !== null);
  for (const side of sides) {
    const door = side === doorSide ? doorAlong(s, side.facing) : null;
    const at = (t: number) => ({ x: side.from.x + side.along.x * t, y: side.from.y + side.along.y * t });
    let full = 0;
    const lay = (start: number, end: number) => {
      for (let t = start; t < end; t += span) {
        const length = Math.min(span, end - t);
        const window = side.seen && length === span && full++ % 2 === 0;
        walls.push({ part: window ? 'window' : 'wall', ...at(t + length / 2), length, facing: side.facing, seen: side.seen });
      }
    };
    if (door === null) lay(0, side.length);
    else {
      lay(0, door);
      walls.push({ part: 'door', ...at(door + 0.5), length: 1, facing: side.facing, seen: side.seen });
      lay(door + 1, side.length);
    }
  }
  const corners = [{ x: s.x, y: s.y }, { x: right, y: s.y }, { x: s.x, y: front }, { x: right, y: front }];
  const roof: RoofPlate[] = [];
  for (let y = 0; y < s.depth; y += span) {
    for (let x = 0; x < s.width; x += span) {
      const width = Math.min(span, s.width - x);
      const depth = Math.min(span, s.depth - y);
      roof.push({ x: s.x + x + width / 2, y: s.y + y + depth / 2, width, depth });
    }
  }
  const roofProps = roofPropKinds > 0
    ? roof.filter((p, i) => hash2(p.x * 2, p.y * 2, 41) < 0.45 || i === 0).map((p) => ({
      x: p.x, y: p.y, variant: Math.floor(hash2(p.x * 2, p.y * 2, 43) * roofPropKinds),
    }))
    : [];
  return { walls, corners, roof, roofProps };
}

/** How far along a side, from its start, the door is, if it's on that side. */
function doorAlong(s: Structure, facing: Vec2): number | null {
  const { tx, ty } = s.door;
  if (facing.y === 1 && ty === s.y + s.depth - 1) return tx - s.x;
  if (facing.y === -1 && ty === s.y) return tx - s.x;
  if (facing.x === 1 && tx === s.x + s.width - 1) return ty - s.y;
  if (facing.x === -1 && tx === s.x) return ty - s.y;
  return null;
}
