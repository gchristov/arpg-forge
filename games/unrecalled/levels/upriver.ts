import type { LevelContent } from '../../../engine/sim/content';
import { roomFromRows, type RoomKey } from '../../../engine/sim/rooms';
import { Ground, Prop } from '../content/tiles';

/**
 * Foundry 2, upriver, coming to life after the ending: an empty hall with the board (W) waiting for instructions. The
 * story brings the salvager here at the end, arriving at @; no door leads in or out.
 */
const ROWS = [
  '#################################',
  '#################################',
  '######L###B###L###L###B###L######',
  '###...........................###',
  '##A...........................###',
  '###...........................###',
  '###.............W.............###',
  '###...........................###',
  '##A...........................###',
  '###...........................###',
  '###...........................###',
  '###...........................###',
  '##A...........................###',
  '###.............@.............###',
  '###...........................###',
  '#################################',
  '#################################',
  '#################################',
];

const KEY: Record<string, RoomKey> = {
  '.': {},
  '@': { heroStart: true },
  '#': { prop: Prop.Wall, frontProp: Prop.WallLow, solid: true },
  L: { prop: Prop.WallLight, solid: true, light: { radius: 3.6, intensity: 0.9, colour: 'cyan', flicker: 0.3, lean: 0.7 } },
  A: { prop: Prop.WallLight, solid: true, light: { radius: 3.2, intensity: 1, colour: 'amber', flicker: 0.8, lean: 0.7 } },
  B: { prop: Prop.WallAlarm, solid: true, light: { radius: 6, intensity: 2, colour: 'alarm', flicker: 0, lean: 0.7, alarm: true } },
  W: { prop: Prop.Computer, solid: true, readable: 'awaiting-board', light: { radius: 3, intensity: 1, colour: 'cyan', flicker: 0.4 } },
};

export function buildUpriver(): LevelContent {
  return roomFromRows({ id: 'upriver', name: 'Foundry 2', subtitle: 'Upriver, coming to life', floor: Ground.Plate, rows: ROWS, key: KEY });
}
