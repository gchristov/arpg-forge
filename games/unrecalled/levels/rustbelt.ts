import type { LevelContent } from '../../../engine/sim/content';
import { roomFromRows, type RoomKey } from '../../../engine/sim/rooms';
import { Ground, Prop } from '../content/tiles';

/**
 * Rustbelt, the salvage camp under a dead pylon, between the Foundry's outer wall (with its gate, G) and the river.
 * The foreman (1) waits by the fire, the trader (2) behind her stall and the tinker (3) at his bench. A post on the
 * bank (m) marks where the flood left the salvager.
 */
const ROWS = [
  '##L####B####G####B####L###',
  'f.......cc.......cc......f',
  'f..t.........,.......t...f',
  'f..t.....................f',
  'f.....hh...........kd....f',
  'f.....dd2.........3dd....f',
  'f............P...........f',
  'f...........X1...........f',
  'f..t...............b.....f',
  'f.......c.........c....t.f',
  'f...m.......@............f',
  'f........................f',
  ',,,,,,,,,,,,,,,,,,,,,,,,,,',
  '~~~~~~~~~~~~~~~~~~~~~~~~~~',
  '~~~~~~~~~~~~~~~~~~~~~~~~~~',
];

const solid = (prop: number): RoomKey => ({ prop, solid: true });

const KEY: Record<string, RoomKey> = {
  '.': {},
  ',': { ground: Ground.Mud },
  '~': { ground: Ground.Water, solid: true },
  '#': { prop: Prop.Wall, frontProp: Prop.WallLow, solid: true },
  L: { prop: Prop.WallLight, solid: true, light: { radius: 3.6, intensity: 0.9, colour: 'cyan', flicker: 0.3, lean: 0.7 } },
  B: { prop: Prop.WallAlarm, solid: true },
  G: {
    prop: Prop.Door, portal: { to: 'intake', stepOut: { x: 0, y: 0.9 }, start: { x: 0, y: 0.9 } },
    light: { radius: 2.4, intensity: 0.9, colour: 'amber', flicker: 0.2, offset: { x: 0, y: 0.7 } },
  },
  f: solid(Prop.Rail),
  P: solid(Prop.Pylon),
  X: { ...solid(Prop.FireBarrel), light: { radius: 4.2, intensity: 1.3, colour: 'molten', flicker: 1.6 } },
  t: solid(Prop.BigCrate),
  c: solid(Prop.Crate),
  b: solid(Prop.Barrel),
  h: solid(Prop.Shelves),
  d: solid(Prop.Desk),
  k: { ...solid(Prop.Computer), light: { radius: 2.2, intensity: 0.6, colour: 'cyan', flicker: 0.6 } },
  m: { ...solid(Prop.Post), readable: 'riverbank' },
  '1': { npc: { kind: 'foreman', name: 'Foreman Odell' } },
  '2': { npc: { kind: 'trader', name: 'Mags' } },
  '3': { npc: { kind: 'tinker', name: 'Pell' } },
  '@': { heroStart: true },
};

export function buildRustbelt(): LevelContent {
  return roomFromRows({
    id: 'rustbelt', name: 'Rustbelt', subtitle: 'What is left of the town', floor: Ground.Dirt, rows: ROWS, key: KEY,
  });
}
