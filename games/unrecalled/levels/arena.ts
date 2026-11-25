import type { LevelContent } from '../../../engine/sim/content';
import { roomFromRows, type RoomKey } from '../../../engine/sim/rooms';
import { jumpToStep } from '../../../engine/sim/shortcuts';
import type { GameState } from '../../../engine/sim/state';
import { stepIndex } from '../../../engine/sim/story-steps';
import { Ground, Prop } from '../content/tiles';
import type { WaveSettings } from '../extensions/waves';

/**
 * A practice arena for trying combat out, reached only at `#arena`: an open hall on the wall kit's grid, U-7 in the
 * middle with the blaster and the EMP, and a cache of patch kits (S). Machines come in waves from the places marked C,
 * each wave bigger and tougher than the last, and hunt U-7 down. No story runs here.
 */
const ROWS = [
  '#################################',
  '#################################',
  '#####L#####L#####L#####L#####L###',
  '###...........................###',
  '###...........................###',
  '###...........................###',
  '##L......C......C......C......L##',
  '###...........................###',
  '###................S..........###',
  '###.............@.............###',
  '###...........................###',
  '###...........................###',
  '##L......C.............C......L##',
  '###...........................###',
  '###...........................###',
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

/** Where waves gather in the arena. */
const WAVE_POINTS = ROWS.flatMap((row, ty) => [...row].flatMap((ch, tx) => (ch === 'C' ? [{ tx, ty }] : [])));

/** The arena's waves (`extensions/waves.ts`): two groups first, one more each wave, each a tenth tougher. */
export const ARENA_WAVES: WaveSettings = {
  pause: 3, groups: 2, moreEachWave: 1, strengthEachWave: 0.1, kinds: KINDS, points: WAVE_POINTS, minHeroDistance: 6,
};

export function buildArena(): LevelContent {
  const arena = roomFromRows({ id: ARENA, name: 'Practice Arena', subtitle: 'Machines come in waves', floor: Ground.Plate, rows: ROWS, key: KEY });
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
