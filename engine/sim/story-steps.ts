import type { QuestStep } from './content';
import type { GameState } from './state';

/**
 * When something in a game's story applies, by the quest's named steps and what the hero holds. Every field given must
 * hold; none given always holds.
 */
export interface When {
  /** At or after this step. */
  from?: string;
  /** Before this step. */
  until?: string;
  /** Exactly at this step. */
  at?: string;
  /** This weapon in hand, or null for bare hands. */
  holding?: string | null;
  not?: When;
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

export function holds(state: GameState, when: When): boolean {
  const steps = state.rules.quest;
  if (when.from !== undefined && state.quest < stepIndex(steps, when.from)) return false;
  if (when.until !== undefined && state.quest >= stepIndex(steps, when.until)) return false;
  if (when.at !== undefined && state.quest !== stepIndex(steps, when.at)) return false;
  if (when.holding !== undefined && state.hero.weapon !== when.holding) return false;
  return !when.not || !holds(state, when.not);
}

/**
 * Each named step's place in the quest line, by its name, for code that still compares steps by number. Inserting a
 * step moves the numbers, never the names.
 */
export function stepNumbers<const T extends readonly { id?: string }[]>(steps: T): { [K in NonNullable<T[number]['id']>]: number } {
  return Object.fromEntries(steps.flatMap((s, i) => (s.id ? [[s.id, i]] : []))) as { [K in NonNullable<T[number]['id']>]: number };
}
