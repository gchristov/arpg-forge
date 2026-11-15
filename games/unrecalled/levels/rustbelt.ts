import type { LevelContent } from '../../../engine/sim/content';
import { roomFromRows, type RoomKey } from '../../../engine/sim/rooms';
import { Ground, Prop } from '../content/tiles';

/**
 * Rustbelt, the salvage camp under a dead pylon, out in the open between the Foundry's outer wall (with its gate, G)
 * and the river. The camp stands on an old concrete pad (_) among weeds and pebbles, and fades into dead trees and
 * rocks at its edges. The foreman (1) waits by the fire, the trader (2) behind her stall and the tinker (3) at his
 * bench. A post on the bank (m) marks where the flood left the salvager.
 */
const ROWS = [
  'TwrTr.T#L###B###G###B###L#wrTr',
  'Trw.w..v.cc.._______..cc.wv.rT',
  'rr..v.......__________......Tw',
  'T.w...hh..__________________.r',
  'rT....dd2.____________kd.w..rw',
  'T..v......____________3dd....r',
  'Tr..w....____P_________..v..rw',
  'Tr.......___X1_________....w.T',
  'r..c..v..______________..b..rw',
  'T.w.......____c______c__.v...r',
  'Tr...m..v.....@.......w...c.rw',
  'T.v...p......w......p.....v..r',
  'rT..w.....v.....p.......w..wrT',
  ',,,,,,,,,,,,,,,,,,,,,,,,,,,,,,',
  '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
  '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
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
  _: { ground: Ground.Pad },
  T: solid(Prop.DeadTree),
  r: solid(Prop.Rock),
  w: { prop: Prop.GrassTall },
  v: { prop: Prop.GrassShort },
  p: { prop: Prop.Pebbles },
  P: solid(Prop.Pylon),
  X: { ...solid(Prop.FireBarrel), light: { radius: 4.2, intensity: 1.3, colour: 'molten', flicker: 1.6 } },
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
