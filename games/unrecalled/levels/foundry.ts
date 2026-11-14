import type { LevelContent } from '../../../engine/sim/content';
import { roomFromRows, type RoomKey } from '../../../engine/sim/rooms';
import { Ground, Prop } from '../content/tiles';

/** The Foundry's first floor: crates and lockers along the walls, machines in the middle, the Order Engine at the back. */
const ROWS = [
  '####L####A#A####L####',
  '#.....s...FFF.s.....#',
  '#.C..c.........c..lh#',
  '#.C.......E.......lh#',
  'A...b...........b...A',
  '#......cc...cc......#',
  '#..o....l...l....o..#',
  '#...................#',
  'L..x......@......x..L',
  '#...................#',
  '#.dk.............kd.#',
  '#.....o.......o.....#',
  '#####################',
];

const solid = (prop: number): RoomKey => ({ prop, solid: true });

const KEY: Record<string, RoomKey> = {
  '.': {},
  '#': { prop: Prop.Wall, frontProp: Prop.WallLow, solid: true },
  L: { prop: Prop.WallLight, solid: true, light: { radius: 3.6, intensity: 0.9, colour: 'cyan', flicker: 0.3, lean: 0.7 } },
  A: { prop: Prop.WallLight, solid: true, light: { radius: 3.2, intensity: 1, colour: 'amber', flicker: 0.8, lean: 0.7 } },
  F: { prop: Prop.Furnace, solid: true, light: { radius: 3.8, intensity: 1.2, colour: 'molten', flicker: 1.4 } },
  C: solid(Prop.Column),
  c: solid(Prop.Crate),
  b: solid(Prop.Barrel),
  l: solid(Prop.Locker),
  h: solid(Prop.Shelves),
  d: solid(Prop.Desk),
  k: { ...solid(Prop.Computer), light: { radius: 2.2, intensity: 0.6, colour: 'cyan', flicker: 0.6 } },
  '@': { heroStart: true },
  o: { spawn: 'crawler' },
  x: { spawn: 'loader' },
  s: { spawn: 'sentry' },
  E: { spawn: 'orderEngine' },
};

export function buildFoundry(): LevelContent {
  return roomFromRows({
    id: 'foundry', name: 'The Foundry', subtitle: 'The order was never cancelled', floor: Ground.Plate, rows: ROWS, key: KEY,
  });
}
