import type { QuestStep } from './content';
import type { GameState, SimEvent } from './state';

/** Something a game's rules do on reaching a quest step that names it in its `does`, such as sounding an alarm everywhere. */
export type StepAction = (state: GameState, events: SimEvent[]) => void;

// The rules state is plain data, so the actions' code is kept here, by name, rather than in it.
const actions = new Map<string, StepAction>();

/** Makes a game's step actions available to its quest steps, by name. */
export function useStepActions(named: Record<string, StepAction> | undefined): void {
  for (const [name, action] of Object.entries(named ?? {})) actions.set(name, action);
}

/** Does what a quest step just reached names in its `does`. */
export function doStepActions(state: GameState, step: QuestStep, events: SimEvent[]): void {
  for (const name of step.does ?? []) actions.get(name)?.(state, events);
}
