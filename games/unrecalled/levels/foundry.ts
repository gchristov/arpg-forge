import type { LevelContent } from '../../../engine/sim/content';
import { roomFromRows, type RoomKey } from '../../../engine/sim/rooms';
import { Ground, Prop } from '../content/tiles';

/**
 * The Foundry, floor by floor: rooms and corridors cut out of solid rock, going deeper through a door in a back wall
 * (U) and back through a gap in a front wall (V). Each floor has its own shape, threat and discovery to read:
 * Intake's loading bay, receiving hall and storage aisles, with the recall notice (T) in a side office off its offices;
 * the Sorting Line's three belt halls joined in a loop by service corridors, a tagged crate (R) on the first; the
 * Control Gallery's walkway round a shaft, with control rooms off it and a locker (Y) in one; and the Assembly Hall,
 * reached through two furnace rooms and an antechamber, with an empty cradle in its back wall (Z). Salvage caches (S)
 * wait in dead ends and side rooms.
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
      '##################################################',
      '##################################################',
      '##################################################',
      '##########################################L###L###',
      '########################################........##',
      '#####B###L##############################.k..k..k##',
      '##S.........############################...oo...##',
      '##..........######L###B##U###L###L#####A...oo...##',
      '##.hhh.hhhh.####..................######.dd.dd..##',
      '##..........####..cc..........b...######........##',
      '#A...oo...........cc........oo....###B##.....xx.##',
      '##...oo.....................oo..................##',
      '##.hhh.hhhh.####.....oo.................####..####',
      '##..........####.....oo.......cc..##########..####',
      '##......oo..####..................##########..####',
      '#A......oo..############..###############......S##',
      '##.hhh.hhhh.############..###############...oo..##',
      '##..o.......############..###############...oo..##',
      '##.ooo......############..##############A...T...##',
      '##.hhh.hhhh.###########A..###############.dd....##',
      '#A..........############..########################',
      '##..........############..########################',
      '########################..########################',
      '####################L###..###L####################',
      '##################..............##################',
      '########B#########............cc##################',
      '#####S....########.=u=u=====....##################',
      '#####.....###L####...........oo.##################',
      '#####..oo....................oo.##################',
      '#####..oo.......................##################',
      '####A.....########.b..=====u=u=.##################',
      '##################..............##################',
      '#########################V########################',
      '##################################################',
    ],
  },
  sorting: {
    name: 'The Sorting Line', subtitle: 'Everything here is stock', lamps: { L: 'hazard', A: 'amber' },
    rows: [
      '########################################################',
      '###########L###L###B###L###L############################',
      '########S.....................##########################',
      '########.===u===========q====.######B###################',
      '########......oo.........xx......oo..###################',
      '########......oo.................oo..###################',
      '#######A.=========w==========.#####..###################',
      '########......................#####..###L###L###U###B###',
      '############..#####################..................###',
      '############..#####################.===u============.###',
      '############..####################A.....xx......xx...###',
      '#####L###L##..###B###L###L#########..................###',
      '###..........................######.=========w======.###',
      '###.=R===q===========u======.###B##..................###',
      '###.......xx.......o..xx............======u======q==.###',
      '##A...............ooo................................###',
      '###.===========w=========q==.###############..##########',
      '###..........................###############..##########',
      '#######..###################################..##########',
      '#######..#################################L#..###L######',
      '#######..###############################..........S#####',
      '#####B#..###L###########################...........#####',
      '###..........###########################...oo.dd...#####',
      '###........b.##########################A...oo...xx.#####',
      '###..........###########################.cc........#####',
      '##A..........###########################...........#####',
      '###.cc.......###########################################',
      '###..........###########################################',
      '#######V################################################',
      '########################################################',
    ],
  },
  gallery: {
    name: 'Control Gallery', subtitle: 'Something is watching the line', sealed: true, lamps: { L: 'alarm', A: 'alarm' },
    rows: [
      '################################################',
      '#####################L##U###L###################',
      '###################..........###################',
      '###################.hh....hh.###################',
      '###################..........###################',
      '#######################..#######################',
      '##############B###L####..###L###B###############',
      '############........................############',
      '#####L###L##.k......ss......ss....k.####B###L###',
      '##S.......##.xx.....................##........##',
      '##.k..k..k#A........................##.k..k..k##',
      '##........##....################....##........##',
      '##...ss.........################..........ss..##',
      '#A..............################..............##',
      '##.dd.....##....################....##....dd..##',
      '##........##....###############A....##........##',
      '##........##.ss.################....##........##',
      '############....################....############',
      '###########A....################..ss############',
      '######L#####....################....####B#######',
      '###Y......##....###############A....##......S###',
      '###.......##....################....##.......###',
      '###..oo.........###L###L###B####........oo...###',
      '###..oo..........................xx.....oo...###',
      '##A.......##.....ss...........ss....##.......###',
      '###.....l.##.dd..................dd.##ll.....###',
      '############........................############',
      '####################........####################',
      '####################........####################',
      '####################........####################',
      '########################V#######################',
      '################################################',
      '################################################',
      '################################################',
    ],
  },
  assembly: {
    name: 'Assembly Hall', subtitle: 'Where the order is kept', lamps: { L: 'amber', A: 'molten' },
    rows: [
      '##################################################',
      '##########L###L###B###L##Z###L###B###L###L########',
      '########..................................########',
      '########.FFF..........................FFF.########',
      '########....C.....C.............C.....C...########',
      '#######A..................................########',
      '########..................................########',
      '########....C.....C......E......C.....C...########',
      '########..................................########',
      '########..................................########',
      '#######A....C.....C.............C.....C...########',
      '########.......xx.........................########',
      '########..................................########',
      '#################################..###############',
      '##############################........############',
      '############B###L###L#########.......S############',
      '##########..............######........############',
      '##########.FFF...oo.....###B##...xx...############',
      '##########.......oo...................############',
      '#########A....xx......................############',
      '##########..........FFF.######.cc.....############',
      '##########..............######........############',
      '###################..#############################',
      '###################..#############################',
      '###################..#############################',
      '###################..#############################',
      '##################A..#############################',
      '###################..#############################',
      '###################..###L#########################',
      '#######L########..........########################',
      '####S.....######.......oo.########################',
      '####......###B##.FFF...oo.############L###L#######',
      '####...oo.................###B###L##..........####',
      '####...oo...........xx........................####',
      '###A......######......FFF.....................####',
      '################..........##########.cc.....b.####',
      '################..........##########..........####',
      '########################################V#########',
      '##################################################',
      '##################################################',
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
