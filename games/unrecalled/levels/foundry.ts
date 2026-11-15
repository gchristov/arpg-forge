import type { LevelContent } from '../../../engine/sim/content';
import { roomFromRows, type RoomKey } from '../../../engine/sim/rooms';
import { Ground, Prop } from '../content/tiles';

/**
 * The Foundry, floor by floor, going deeper through the door in each back wall (U) and back through the gap in the
 * front wall (V). Each floor changes the threat and holds one discovery: the recall notice in Intake (T), the town's
 * belongings on the Sorting Line's belts, a locker in the Control Gallery (Y) and an empty cradle in the Assembly
 * Hall (Z).
 */
const FLOORS = {
  intake: {
    name: 'Intake', subtitle: 'Receiving for the Valley Order',
    rows: [
      '####L#####U######L####',
      '#hh..................#',
      '#.....ooo.....ooo....#',
      '#..cc..............cc#',
      '#..cc....c..c......cc#',
      'A....................A',
      '#.....cc......cc.....#',
      '#..o..cc......cc..o..#',
      '#....................#',
      '#.b..T.........ooo...#',
      '#....................#',
      '#..c............c..b.#',
      '#..........@.........#',
      '######################',
    ],
  },
  sorting: {
    name: 'The Sorting Line', subtitle: 'Everything here is stock',
    rows: [
      '####A######U#####A####',
      '#....................#',
      '#..x..............x..#',
      '#====u==q===w==q==u==#',
      '#....................#',
      'L.....o........o.....L',
      '#..cc....x.......cc..#',
      '#....................#',
      '#=q===u==w====q==u===#',
      '#....................#',
      '#...o....x.......o...#',
      '#..b..............b..#',
      '#....................#',
      '##########V###########',
    ],
  },
  gallery: {
    name: 'Control Gallery', subtitle: 'Something is watching the line',
    rows: [
      '####L#####U######L####',
      '#hh.....s.....s....hh#',
      '#....dd........dd....#',
      '#.k................k.#',
      '#..........x.........#',
      'L..s..............s..L',
      '#....kk........kk....#',
      '#.....o..........o...#',
      '#l...................#',
      '#Y.......s..........l#',
      '#l.....dd.....dd.....#',
      '#....................#',
      '#..b..............b..#',
      '##########V###########',
    ],
  },
  assembly: {
    name: 'Assembly Hall', subtitle: 'Where the order is kept',
    rows: [
      '####A#####A##A#####A####',
      '#...FFF.....Z.....FFF..#',
      '#......................#',
      '#..C......C...C....C...#',
      '#......................#',
      'L..........E...........L',
      '#......................#',
      '#..C...............C...#',
      '#......................#',
      '#..b...x........x...b..#',
      '#......................#',
      '#...cc............cc...#',
      '#......................#',
      '###########V############',
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
  L: { prop: Prop.WallLight, solid: true, light: { radius: 3.6, intensity: 0.9, colour: 'cyan', flicker: 0.3, lean: 0.7 } },
  A: { prop: Prop.WallLight, solid: true, light: { radius: 3.2, intensity: 1, colour: 'amber', flicker: 0.8, lean: 0.7 } },
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
  return roomFromRows({ id, name, subtitle, floor: Ground.Plate, rows, key: { ...KEY, ...doors(id) } });
}
