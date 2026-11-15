import type { LevelContent } from '../../../engine/sim/content';
import { roomFromRows, type RoomKey } from '../../../engine/sim/rooms';
import { Ground, Prop } from '../content/tiles';

/**
 * The Foundry, floor by floor, going deeper through the door in each back wall (U) and back through the gap in the
 * front wall (V). Each floor has its own shape, threat and discovery: a wide receiving bay with the recall notice (T),
 * a long line of belts carrying the town's belongings, a gallery around a shaft with a locker (Y), and a pillared hall
 * with an empty cradle in its back wall (Z). Walls inside a room are drawn low, like railings, and a block of them
 * reads as a shaft in the floor.
 */
const FLOORS = {
  intake: {
    name: 'Intake', subtitle: 'Receiving for the Valley Order', lamps: { L: 'cyan', A: 'amber' },
    rows: [
      '#####L######U######L####',
      '#hh....................#',
      '#.....ooo.........cc...#',
      '#..cc.............cc...#',
      '#..cc.......T......ooo.#',
      'A......................A',
      '#=u=u=====......=u=u===#',
      '#......................#',
      '#...ooo.......cc.......#',
      '#.............cc....b..#',
      '#..c..b................#',
      '#.........c.....o...c..#',
      '#...........@..........#',
      '########################',
    ],
  },
  sorting: {
    name: 'The Sorting Line', subtitle: 'Everything here is stock', lamps: { L: 'hazard', A: 'amber' },
    rows: [
      '###A#####A#####U####A#####A###',
      '#............................#',
      '#=u==q===w==q==u===q==w==u===#',
      '#....x.......................L',
      '#.........o.........x....o...#',
      '#=q===u==w====q==u===w==q====#',
      '#....................o.......#',
      '#..cc.....x..............cc..L',
      '#=w==u===q==w=====u==q===w===#',
      '#.......o....................#',
      '##############V###############',
    ],
  },
  gallery: {
    name: 'Control Gallery', subtitle: 'Something is watching the line', lamps: { L: 'alarm', A: 'alarm' },
    rows: [
      '####L######U#######L####',
      '#hh.....s........s...hh#',
      '#......................#',
      '#..k..k..........k..k..#',
      '#..s..##########..s....#',
      'L.....##########.......L',
      '#.....##########...x...#',
      '#..o..##########.......#',
      '#.....##########.......#',
      '#Y.....k......k......l.#',
      '#l.....dd.....s..dd....#',
      '#......................#',
      '#..b..............b....#',
      '###########V############',
    ],
  },
  assembly: {
    name: 'Assembly Hall', subtitle: 'Where the order is kept', lamps: { L: 'amber', A: 'molten' },
    rows: [
      '####A#####A#####Z#####A#####A#',
      '#....FFF.....................#',
      '#............................#',
      '#...C.....C.........C.....C..#',
      '#............................#',
      'L............................L',
      '#...C.....C....E....C.....C..#',
      '#............................#',
      '#............................#',
      '#...C.....C.........C.....C..#',
      '#.................FFF........#',
      '#.....x..............x.......#',
      '#..b......................b..#',
      '#....cc..............cc......#',
      '#............................#',
      '##############V###############',
    ],
  },
};

export type FloorId = keyof typeof FLOORS;

/** The floors in order, from the way in to the Order Engine. */
export const FLOOR_ORDER: FloorId[] = ['intake', 'sorting', 'gallery', 'assembly'];

const solid = (prop: number): RoomKey => ({ prop, solid: true });
const onBelt = (prop: number): RoomKey => ({ ...solid(prop), ground: Ground.Belt });

const KEY: Record<string, RoomKey> = {
  '.': {},
  '#': { prop: Prop.Wall, frontProp: Prop.WallLow, solid: true },
  F: { prop: Prop.Furnace, solid: true, light: { radius: 3.8, intensity: 1.2, colour: 'molten', flicker: 1.4 } },
  C: solid(Prop.Column),
  c: solid(Prop.Crate),
  b: solid(Prop.Barrel),
  l: solid(Prop.Locker),
  Y: solid(Prop.Locker),
  h: solid(Prop.Shelves),
  d: solid(Prop.Desk),
  k: { ...solid(Prop.Computer), light: { radius: 2.2, intensity: 0.6, colour: 'cyan', flicker: 0.6 } },
  T: { ...solid(Prop.Computer), light: { radius: 2.4, intensity: 0.8, colour: 'amber', flicker: 0.4 } },
  Z: { ...solid(Prop.Cradle), light: { radius: 2.6, intensity: 0.8, colour: 'cyan', flicker: 0.2 } },
  '=': { ground: Ground.Belt },
  q: onBelt(Prop.Chair),
  w: onBelt(Prop.Desk),
  u: onBelt(Prop.Crate),
  '@': { heroStart: true },
  o: { spawn: 'crawler' },
  x: { spawn: 'loader' },
  s: { spawn: 'sentry' },
  E: { spawn: 'orderEngine' },
};

/** The wall lamps, in the floor's own colours: L is the main light and A the accent. */
function lamps(id: FloorId): Record<string, RoomKey> {
  const { L, A } = FLOORS[id].lamps;
  return {
    L: { prop: Prop.WallLight, solid: true, light: { radius: 3.6, intensity: 0.9, colour: L, flicker: 0.3, lean: 0.7 } },
    A: { prop: Prop.WallLight, solid: true, light: { radius: 3.2, intensity: 1, colour: A, flicker: 0.8, lean: 0.7 } },
  };
}

/** The doors on one floor: deeper through the back wall, and back the way the hero came through the front. */
function doors(id: FloorId): Record<string, RoomKey> {
  const at = FLOOR_ORDER.indexOf(id);
  const deeper = FLOOR_ORDER[at + 1];
  const back = FLOOR_ORDER[at - 1];
  return {
    U: deeper
      ? {
        prop: Prop.Door, portal: { to: deeper, stepOut: { x: 0, y: 0.9 }, start: { x: 0, y: 0.9 } },
        light: { radius: 2.2, intensity: 0.8, colour: 'amber', flicker: 0.2, offset: { x: 0, y: 0.7 } },
      }
      : { prop: Prop.Wall, solid: true },
    V: back
      ? { portal: { to: back, stepOut: { x: 0, y: -0.9 }, start: { x: 0, y: -0.9 } }, light: { radius: 1.8, intensity: 0.5, colour: 'cyan', flicker: 0, offset: { x: 0, y: -0.7 } } }
      : { prop: Prop.Wall, frontProp: Prop.WallLow, solid: true },
  };
}

export function buildFloor(id: FloorId): LevelContent {
  const { name, subtitle, rows } = FLOORS[id];
  return roomFromRows({ id, name, subtitle, floor: Ground.Plate, rows, key: { ...KEY, ...lamps(id), ...doors(id) } });
}
