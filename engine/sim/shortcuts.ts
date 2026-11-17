import { calmEverything } from './interaction';
import type { GameState } from './state';

/**
 * Moves the story straight to `step`, as if every step before it had been reached: a weapon that reached one is in the
 * hero's hand, and if one calmed everything, everything is calm. For trying one part of a game without playing up to it.
 */
export function jumpToStep(state: GameState, step: number): void {
  const steps = state.rules.quest;
  state.quest = Math.max(0, Math.min(step, steps.length - 1));
  for (const reached of steps.slice(1, state.quest + 1)) {
    if (reached.reachedBy?.type === 'arm') state.hero.weapon = reached.reachedBy.weapon;
    if (reached.calmsEverything) calmEverything(state);
  }
}

/** Takes every enemy out of the game and stops camps refilling, for walking a place without being attacked. */
export function removeEnemies(state: GameState): void {
  for (const ls of Object.values(state.levels)) {
    ls.enemies.length = 0;
    delete ls.campRespawns;
  }
}
