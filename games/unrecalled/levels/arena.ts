import type { LevelContent } from '../../../engine/sim/content';
import { roomFromRows, type RoomKey } from '../../../engine/sim/rooms';
import { Ground, Prop } from '../content/tiles';

/**
 * A practice arena for trying combat out, reached only at `#arena`: an open hall on the wall kit's grid, the salvager
 * in the middle, and a camp of each kind of machine (C) that refills while the salvager keeps their distance.
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
  '###...........................###',
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
  '#': { prop: Prop.Wall, frontProp: Prop.WallLow, solid: true },
  L: { prop: Prop.WallLight, solid: true, light: { radius: 3.6, intensity: 0.9, colour: 'cyan', flicker: 0.3, lean: 0.7 } },
};

const KINDS = ['crawler', 'loader', 'sentry'];

export function buildArena(): LevelContent {
  const arena = roomFromRows({ id: 'arena', name: 'Practice Arena', subtitle: 'Machines keep coming', floor: Ground.Plate, rows: ROWS, key: KEY });
  const camps = ROWS.flatMap((row, ty) => [...row].flatMap((ch, tx) => (ch === 'C' ? [{ tx, ty }] : [])));
  arena.camps = camps.map((c, i) => ({ ...c, kind: KINDS[i % KINDS.length]! }));
  arena.campRespawns = { everySeconds: 2, maxAlive: 10, minHeroDistance: 5, kinds: KINDS };
  arena.practice = true;
  return arena;
}
