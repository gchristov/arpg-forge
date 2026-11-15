import type { LevelContent } from '../../../engine/sim/content';
import { roomFromRows, type RoomKey } from '../../../engine/sim/rooms';
import { Ground, Prop } from '../content/tiles';

/**
 * The Foundry, floor by floor, going deeper through the door in each back wall (U) and back through the gap in the
 * front wall (V). Each floor has its own shape, threat and discovery to read: a wide receiving bay with the recall
 * notice (T), a long line of belts carrying the town's belongings with a tagged crate (R), a gallery around a shaft
 * with a locker (Y), and a pillared hall with an empty cradle in its back wall (Z). Walls inside a room are drawn low,
 * like railings, and a block of them reads as a shaft in the floor. Each floor is split into rooms, with salvage caches
 * (S) tucked off the main path.
 */
interface FloorSpec {
  name: string;
  subtitle: string;
  /** The way deeper stays shut until every machine on the floor is destroyed. */
  sealed?: boolean;
  /** Colour names for the main wall lamps (L) and the accents (A). */
  lamps: { L: string; A: string };
  rows: string[];
}

const FLOORS = {
  intake: {
    name: 'Intake', subtitle: 'Receiving for the Valley Order', lamps: { L: 'cyan', A: 'amber' },
    rows: [
      '###B####L####B######U#####B####L####B###',
      '#hhhh........#.............#.k..k..k..S#',
      '#S.......oo..#.........cc..#...........#',
      '#........oo..#..T......cc..#..dd...dd..#',
      '#.........oo...............#...........#',
      '#...cc....oo...............#...........#',
      '#...cc..........................oo.....#',
      'A............#.......oo.........oo.....A',
      '#......oo....#.......oo................#',
      '#......oo....#.b...........#........oo.#',
      '#bb..........#.............#........oob#',
      '#########...#######...#######...########',
      '#.................................xx...#',
      '#..=u=u==========......................#',
      '#.......................==u=====u=====.#',
      'B......oo..............................L',
      '#......oo......................oo......#',
      '#..............................oo......#',
      '#..=========u=u==.......=====u========.#',
      '#S..........cc.........................#',
      '#...........cc..............b..........#',
      '####################V###################',
    ],
  },
  sorting: {
    name: 'The Sorting Line', subtitle: 'Everything here is stock', lamps: { L: 'hazard', A: 'amber' },
    rows: [
      '###A####B#####A#####B###U###B#####A#####B###A###',
      '#S..............#.............cc#..............#',
      '#.=R==q========.#.==u=====w====.#.==q=======u=.#',
      '#...............................#..............#',
      '#.....xx..............oo........#.....xx.......#',
      '#...............#.....oo........#..............L',
      '#.========w====.#.====q========...========u===.#',
      '#...............#..............................#',
      'L..........oo...#..........xx..............oo..#',
      '#..........oo...#...............#..........oo..#',
      '#.==u=======q==...==========u==.#.====w=======.#',
      '#...............................#..............L',
      '#...........................................c..#',
      '#.cc.xx.......b.#...oo..............xx..cc....S#',
      '#...............#...oo..........#..............#',
      '########################V#######################',
    ],
  },
  gallery: {
    name: 'Control Gallery', subtitle: 'Something is watching the line', sealed: true, lamps: { L: 'alarm', A: 'alarm' },
    rows: [
      '##B###L#####B#######U#######B####L###B##',
      '#hh.....#......................#...hh..#',
      '#.......#.......ss......ss.....#.......#',
      '#.k..k..#...k..............k......k..k.#',
      '#......................................#',
      '#......................................#',
      'B............##############....#.......L',
      '#...ss..#....##############....#...ss..#',
      '#.......#....##############....#.......#',
      '#.dd....#..xx##############....#.......#',
      '#.......#....##############....#...dd..#',
      '#.......#....##############.xx.#.......#',
      '#Y......#....##############....#.......#',
      '#.......#....##############....#..ss...#',
      'L.......#....##############....#.......B',
      '#....ss........................#.l.....#',
      '#......................................#',
      '#..oo......dd.......ss.....dd.......oo.#',
      '#..oo...#...........................oo.#',
      '#S...l..#......oo..............#......S#',
      '#.......#.b....oo............b.#.......#',
      '###################V####################',
    ],
  },
  assembly: {
    name: 'Assembly Hall', subtitle: 'Where the order is kept', lamps: { L: 'amber', A: 'molten' },
    rows: [
      '##B####A#####B######Z#####B#####A####B##',
      '#S..FFF..........................FFF...#',
      '#......................................#',
      '#......................................#',
      '#.....C.....C..............C.....C.....#',
      'L......................................L',
      '#......................................#',
      '#......................................#',
      '#.....C.....C.......E......C.....C.....#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#.....C.....C..............C.....C.....#',
      'B......................................B',
      '#........xx...................xx.......#',
      '#......................................#',
      '####...###########.....##########...####',
      '#.....................................S#',
      '#.FFF..............................FFF.#',
      '#.............oo....xx.................#',
      'L.....xx......oo.................xx....L',
      '#.......cc....................cc.......#',
      '#.........................oo...........#',
      '#.b.......................oo.........b.#',
      '#......................................#',
      '####################V###################',
    ],
  },
} satisfies Record<string, FloorSpec>;

export type FloorId = keyof typeof FLOORS;

/** The floors in order, from the way in to the Order Engine. */
export const FLOOR_ORDER: FloorId[] = ['intake', 'sorting', 'gallery', 'assembly'];

const solid = (prop: number): RoomKey => ({ prop, solid: true });
const onBelt = (prop: number): RoomKey => ({ ...solid(prop), ground: Ground.Belt });

const KEY: Record<string, RoomKey> = {
  '.': {},
  '#': { prop: Prop.Wall, frontProp: Prop.WallLow, solid: true },
  B: { prop: Prop.WallAlarm, solid: true, light: { radius: 6, intensity: 2, colour: 'alarm', flicker: 0, lean: 0.7, alarm: true } },
  F: { prop: Prop.Furnace, solid: true, light: { radius: 3.8, intensity: 1.2, colour: 'molten', flicker: 1.4 } },
  C: solid(Prop.Column),
  c: solid(Prop.Crate),
  b: solid(Prop.Barrel),
  l: solid(Prop.Locker),
  Y: { ...solid(Prop.Locker), readable: 'locker' },
  h: solid(Prop.Shelves),
  d: solid(Prop.Desk),
  k: { ...solid(Prop.Computer), light: { radius: 2.2, intensity: 0.6, colour: 'cyan', flicker: 0.6 } },
  T: { ...solid(Prop.Computer), readable: 'recall-notice', light: { radius: 2.4, intensity: 0.8, colour: 'amber', flicker: 0.4 } },
  Z: { ...solid(Prop.Cradle), readable: 'cradle', light: { radius: 2.6, intensity: 0.8, colour: 'cyan', flicker: 0.2 } },
  '=': { ground: Ground.Belt },
  q: onBelt(Prop.Chair),
  w: onBelt(Prop.Desk),
  u: onBelt(Prop.Crate),
  R: { ...onBelt(Prop.Crate), readable: 'stock-tag' },
  // A salvage cache, tucked off the main path to reward looking around.
  S: { ...solid(Prop.Cache), container: { gold: 30, healingItems: 1 } },
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

/**
 * The doors on one floor: deeper through the back wall, and back the way the hero came through the front. A sealed
 * floor's way deeper stays shut until every machine on it is destroyed.
 */
function doors(id: FloorId): Record<string, RoomKey> {
  const at = FLOOR_ORDER.indexOf(id);
  const deeper = FLOOR_ORDER[at + 1];
  // Intake's front door leads back out through the loading door of Mags's depot, where deliveries came in.
  const back = FLOOR_ORDER[at - 1] ?? 'tradingPost';
  return {
    U: deeper
      ? {
        prop: Prop.Door, portal: { to: deeper, stepOut: { x: 0, y: 0.9 }, start: { x: 0, y: 0.9 }, sealed: (FLOORS[id] as FloorSpec).sealed ?? false },
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
