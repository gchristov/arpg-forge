import type { LevelContent } from '../../../engine/sim/content';
import { roomFromRows, type RoomKey } from '../../../engine/sim/rooms';
import { jumpToStep } from '../../../engine/sim/shortcuts';
import type { GameState } from '../../../engine/sim/state';
import { stepIndex } from '../../../engine/sim/story-steps';
import { Ground, Prop } from '../content/tiles';

/**
 * A practice arena for trying combat out, reached only at `#arena`: an open hall on the wall kit's grid, U-7 in the
 * middle with the chainsaw and the EMP, a cache of patch kits (S), and a camp of each kind of machine (C) that refills
 * while U-7 keeps its distance. No story runs here, and the machines fight from the start.
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
  '###................S..........###',
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

/** The story's step by which U-7 has the EMP, which the arena starts at. */
const ARMED = 'charged';

/**
 * Readies U-7 for the arena: as far on as the story gives it the EMP, unless a step was asked for, holding `weapon` if
 * given (such as the chainsaw), else the one it starts with.
 */
export function readyForPractice(state: GameState, weapon: string | null): void {
  if (state.quest < stepIndex(state.rules.quest, ARMED)) jumpToStep(state, stepIndex(state.rules.quest, ARMED));
  const asked = weapon !== null && state.rules.hero.weapons?.[weapon] ? weapon : null;
  state.hero.weapon = asked ?? state.rules.hero.startingWeapon ?? null;
}
