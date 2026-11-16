import type { LevelContent } from '../../../engine/sim/content';
import { roomFromRows, type RoomKey } from '../../../engine/sim/rooms';
import { POWER_ON_STEP } from '../content/story';
import { Ground, Prop } from '../content/tiles';

/**
 * Rustbelt's buildings, inside, drawn on the wall kit's 3-tile grid so their walls come out whole, with walls a cell
 * thick round them. Each ground floor's door (V) leads back out to the town; stairs (U, N) join floors.
 */
const INTERIORS = {
  workshop: {
    name: 'Pell’s Workshop', subtitle: 'Smells of solder and old oil',
    rows: [
      '##################',
      '##################',
      '#####L#####L######',
      '###hh..k..dd...###',
      '###............###',
      '###............###',
      '###c.......3...###',
      '##Lc...........L##',
      '###............###',
      '###b........h..###',
      '###............###',
      '###............###',
      '#######V##########',
      '##################',
      '##################',
    ],
  },
  // The old depot: the shop floor, a storeroom with the stairs up to the office and the loading door into the Foundry
  // (G), dead until the power's back on, and a back room, divided by partitions (%) with a doorway between each.
  tradingPost: {
    name: 'Mags’s Trading Post', subtitle: 'Everything here was somebody’s once',
    rows: [
      '##############################',
      '##############################',
      '#####L#####L#######L##G#######',
      '###hh.dd..k......cc......U.###',
      '###........................###',
      '###...2....................###',
      '###............%...........###',
      '###............%.........b.###',
      '###c...........%...........###',
      '##L............%%%%%%...%%%###',
      '###............%...........###',
      '###............%...........###',
      '###.b....b.......h......hh.###',
      '###.........c............S.###',
      '###........................###',
      '#######V######################',
      '##############################',
      '##############################',
    ],
  },
  depotOffice: {
    name: 'The Depot Office', subtitle: 'Where the Foundry’s deliveries were signed for',
    rows: [
      '###############',
      '###############',
      '#####L###L#####',
      '###hh.k..dd.###',
      '###.........###',
      '###c........###',
      '###.......S.###',
      '###.........###',
      '###.........###',
      '#######N#######',
      '###############',
      '###############',
    ],
  },
  pumphouse: {
    name: 'The Old Pumphouse', subtitle: 'Nobody has run the pumps since the flood',
    rows: [
      '###############',
      '###############',
      '###############',
      '###F...k..b.###',
      '###.........###',
      '###.........###',
      '###.c....S..###',
      '###.........###',
      '###.........###',
      '#######V#######',
      '###############',
      '###############',
    ],
  },
};

export type InteriorId = keyof typeof INTERIORS;
export const INTERIOR_IDS = Object.keys(INTERIORS) as InteriorId[];

const solid = (prop: number): RoomKey => ({ prop, solid: true });

const KEY: Record<string, RoomKey> = {
  '.': {},
  '#': { prop: Prop.Wall, frontProp: Prop.WallLow, solid: true },
  '%': { prop: Prop.Partition, solid: true },
  L: { prop: Prop.WallLight, solid: true, light: { radius: 3.4, intensity: 0.9, colour: 'amber', flicker: 0.5, lean: 0.7 } },
  V: {
    portal: { to: 'rustbelt', stepOut: { x: 0, y: -0.9 }, start: { x: 0, y: -0.9 } },
    light: { radius: 1.8, intensity: 0.5, colour: 'cyan', flicker: 0, offset: { x: 0, y: -0.7 } },
  },
  F: { ...solid(Prop.Furnace), light: { radius: 2.4, intensity: 0.5, colour: 'molten', flicker: 0.3 } },
  c: solid(Prop.Crate),
  b: solid(Prop.Barrel),
  h: solid(Prop.Shelves),
  d: solid(Prop.Desk),
  k: { ...solid(Prop.Computer), light: { radius: 2.2, intensity: 0.6, colour: 'cyan', flicker: 0.6 } },
  S: { ...solid(Prop.Cache), container: { gold: 35, healingItems: 1 } },
  G: {
    portal: { to: 'intake', stepOut: { x: 0, y: 0.9 }, start: { x: 0, y: 0.9 }, lockedUntilStep: POWER_ON_STEP },
    light: { radius: 2.2, intensity: 0.8, colour: 'amber', flicker: 0.2, offset: { x: 0, y: 0.7 } },
  },
  U: { prop: Prop.Stairs, portal: { to: 'depotOffice', stepOut: { x: 0, y: 0.9 }, start: { x: 0, y: 0.9 } } },
  N: {
    portal: { to: 'tradingPost', stepOut: { x: 0, y: -0.9 }, start: { x: 0, y: -0.9 } },
    light: { radius: 1.8, intensity: 0.5, colour: 'amber', flicker: 0, offset: { x: 0, y: -0.7 } },
  },
  '2': { npc: { kind: 'trader', name: 'Mags' } },
  '3': { npc: { kind: 'tinker', name: 'Pell' } },
};

/** What each room's terminal holds: the pump log from the night of the flood, and the depot's delivery ledger. */
const READABLE_BY_ROOM: Partial<Record<InteriorId, string>> = { pumphouse: 'pump-log', depotOffice: 'depot-ledger' };

export function buildInterior(id: InteriorId): LevelContent {
  const { name, subtitle, rows } = INTERIORS[id];
  const readable = READABLE_BY_ROOM[id];
  const key = readable ? { ...KEY, k: { ...KEY.k!, readable } } : KEY;
  return roomFromRows({ id, name, subtitle, floor: Ground.Plate, rows, key });
}
