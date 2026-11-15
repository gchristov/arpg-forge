import type { LevelContent } from '../../../engine/sim/content';
import { roomFromRows, type RoomKey } from '../../../engine/sim/rooms';
import { Ground, Prop } from '../content/tiles';

/** Rustbelt's buildings, inside. Each one's door (V) leads back out to the town. */
const INTERIORS = {
  workshop: {
    name: 'Pell’s Workshop', subtitle: 'Smells of solder and old oil',
    rows: [
      '####L####L##',
      '#hh..k..dd.#',
      '#..........#',
      '#.c.....3..#',
      '#.c........#',
      'L..........L',
      '#.b......h.#',
      '#..........#',
      '#####V######',
    ],
  },
  tradingPost: {
    name: 'Mags’s Trading Post', subtitle: 'Everything here was somebody’s once',
    rows: [
      '###L####L###',
      '#hh.dd..hh.#',
      '#....2.....#',
      '#c........c#',
      'L..........L',
      '#..b....b..#',
      '#..........#',
      '######V#####',
    ],
  },
  pumphouse: {
    name: 'The Old Pumphouse', subtitle: 'Nobody has run the pumps since the flood',
    rows: [
      '##########',
      '#F...k..b#',
      '#........#',
      '#.c....S.#',
      '#........#',
      '####V#####',
    ],
  },
};

export type InteriorId = keyof typeof INTERIORS;
export const INTERIOR_IDS = Object.keys(INTERIORS) as InteriorId[];

const solid = (prop: number): RoomKey => ({ prop, solid: true });

const KEY: Record<string, RoomKey> = {
  '.': {},
  '#': { prop: Prop.Wall, frontProp: Prop.WallLow, solid: true },
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
  '2': { npc: { kind: 'trader', name: 'Mags' } },
  '3': { npc: { kind: 'tinker', name: 'Pell' } },
};

/** What the pumphouse's terminal holds: the pump log from the night of the flood. */
const READABLE_BY_ROOM: Partial<Record<InteriorId, string>> = { pumphouse: 'pump-log' };

export function buildInterior(id: InteriorId): LevelContent {
  const { name, subtitle, rows } = INTERIORS[id];
  const readable = READABLE_BY_ROOM[id];
  const key = readable ? { ...KEY, k: { ...KEY.k!, readable } } : KEY;
  return roomFromRows({ id, name, subtitle, floor: Ground.Plate, rows, key });
}
