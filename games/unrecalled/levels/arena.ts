import type { LevelContent } from '../../../engine/sim/content';
import { roomFromRows, type RoomKey } from '../../../engine/sim/rooms';
import { Ground, Prop } from '../content/tiles';

/**
 * A practice arena for trying combat out, reached only at `#arena`: an open hall on the wall kit's grid, U-7 in the
 * middle on its fists, with the chainsaw in a crate (W), a cache of patch kits (S), and a camp of each kind of machine
 * (C) that refills while U-7 keeps its distance. No story runs here, and the machines fight from the start.
 */
const ROWS = [
  '#################################',
  '#################################',
  '#####L#####L#####L#####L#####L###',
  '###...........................###',
  '###...C...........C.......C...###',
  '###...........................###',
  '##L...........................L##',
  '###...........................###',
  '###.........W......S..........###',
  '###.............@.............###',
  '###...........................###',
  '###...........................###',
  '##L...........................L##',
  '###...........................###',
  '###...C...................C...###',
  '###...........................###',
  '###...........................###',
  '#################################',
  '#################################',
  '#################################',
];

const KEY: Record<string, RoomKey> = {
  '.': {},
  C: {},
  '@': { heroStart: true },
  S: { prop: Prop.Cache, solid: true, container: { gold: 0, healingItems: 3 } },
  W: { prop: Prop.Crate, solid: true, container: { gold: 0, healingItems: 0, weapon: 'chainsaw' } },
  '#': { prop: Prop.Wall, frontProp: Prop.WallLow, solid: true },
  L: { prop: Prop.WallLight, solid: true, light: { radius: 3.6, intensity: 0.9, colour: 'cyan', flicker: 0.3, lean: 0.7 } },
};

export const ARENA = 'arena';

const KINDS = ['crawler', 'loader', 'sentry'];

export function buildArena(): LevelContent {
  const arena = roomFromRows({ id: ARENA, name: 'Practice Arena', subtitle: 'Machines keep coming', floor: Ground.Plate, rows: ROWS, key: KEY });
  const camps = ROWS.flatMap((row, ty) => [...row].flatMap((ch, tx) => (ch === 'C' ? [{ tx, ty }] : [])));
  arena.camps = camps.map((c, i) => ({ ...c, kind: KINDS[i % KINDS.length]! }));
  arena.campRespawns = { everySeconds: 2, maxAlive: 10, minHeroDistance: 5, kinds: KINDS };
  arena.practice = true;
  return arena;
}
