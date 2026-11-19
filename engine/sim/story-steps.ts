import type { QuestStep } from './content';
import type { GameState } from './state';

/**
 * When something in a game's story applies, by the quest's named steps, the story's flags and what the hero holds.
 * Every field given must hold; none given always holds. `Step` narrows the step names to a game's own, so a misspelt
 * one is a type error.
 */
export interface When<Step extends string = string> {
  /** At or after this step. */
  from?: Step;
  /** Before this step. */
  until?: Step;
  /** Exactly at this step. */
  at?: Step;
  /** This story flag is set. */
  flag?: string;
  /** This weapon in hand, or null for bare hands. */
  holding?: string | null;
  not?: When<Step>;
}

const indexes = new WeakMap<readonly QuestStep[], Map<string, number>>();

/** Where the step named `id` falls in the quest line; an unknown name is a mistake in the content, so it throws. */
export function stepIndex(steps: readonly QuestStep[], id: string): number {
  let byId = indexes.get(steps);
  if (!byId) {
    byId = new Map(steps.flatMap((s, i) => (s.id ? [[s.id, i] as const] : [])));
    indexes.set(steps, byId);
  }
  const index = byId.get(id);
  if (index === undefined) throw new Error(`No quest step is named "${id}"`);
  return index;
}

/** Whether the quest has reached the step named `id`. */
export const reached = (state: GameState, id: string): boolean => state.quest >= stepIndex(state.rules.quest, id);

/**
 * Whether `when` holds, with the quest at `quest`: the current step, unless asked about another, such as the step
 * before something moved it on.
 */
export function holds(state: GameState, when: When, quest = state.quest): boolean {
  const steps = state.rules.quest;
  if (when.from !== undefined && quest < stepIndex(steps, when.from)) return false;
  if (when.until !== undefined && quest >= stepIndex(steps, when.until)) return false;
  if (when.at !== undefined && quest !== stepIndex(steps, when.at)) return false;
  if (when.flag !== undefined && !state.flags[when.flag]) return false;
  if (when.holding !== undefined && state.hero.weapon !== when.holding) return false;
  return !when.not || !holds(state, when.not, quest);
}

/**
 * Each named step's place in the quest line, by its name, for code that still compares steps by number. Inserting a
 * step moves the numbers, never the names.
 */
export function stepNumbers<const T extends readonly { id?: string }[]>(steps: T): { [K in NonNullable<T[number]['id']>]: number } {
  return Object.fromEntries(steps.flatMap((s, i) => (s.id ? [[s.id, i]] : []))) as { [K in NonNullable<T[number]['id']>]: number };
}
