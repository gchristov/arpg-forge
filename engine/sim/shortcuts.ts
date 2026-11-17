import { calmEverything } from './interaction';
import type { GameState } from './state';
import { castForStep } from './story-cast';

/**
 * Moves the story straight to `step`, as if every step before it had been reached: a weapon that reached one is in the
 * hero's hand, an enemy defeated or killed to reach one is gone (and what it carried is on the ground), and if one calmed
 * everything, everything is calm. For trying one part of a game without playing up to it.
 */
export function jumpToStep(state: GameState, step: number): void {
  const steps = state.rules.quest;
  state.quest = Math.max(0, Math.min(step, steps.length - 1));
  for (const reached of steps.slice(1, state.quest + 1)) {
    const trigger = reached.reachedBy;
    if (trigger?.type === 'arm') armedAlready(state, trigger.weapon);
    if (trigger?.type === 'defeat') defeatedAlready(state, trigger.tag);
    if (trigger?.type === 'kill') killedAlready(state, trigger.enemyKind);
    if (reached.calmsEverything) calmEverything(state);
  }
  castForStep(state);
}

/** Takes away one enemy of `kind`, the one killing which reached a step. */
function killedAlready(state: GameState, kind: string): void {
  for (const ls of Object.values(state.levels)) {
    const at = ls.enemies.findIndex((e) => e.kind === kind && !e.dead);
    if (at >= 0) {
      ls.enemies.splice(at, 1);
      return;
    }
  }
}

/** Puts the weapon in the hero's hand, and takes it off the ground if it was dropped there. */
function armedAlready(state: GameState, weapon: string): void {
  state.hero.weapon = weapon;
  for (const ls of Object.values(state.levels)) ls.items = ls.items.filter((i) => i.weapon !== weapon);
}

function defeatedAlready(state: GameState, tag: string): void {
  for (const ls of Object.values(state.levels)) {
    const tagged = [...ls.enemies, ...ls.storySpawns].filter((e) => e.tag === tag);
    for (const e of tagged) if (e.carries) ls.items.push({ kind: 'weapon', amount: 1, weapon: e.carries, x: e.x, y: e.y, z: 0, vz: 0 });
    ls.enemies = ls.enemies.filter((e) => e.tag !== tag);
    ls.storySpawns = ls.storySpawns.filter((s) => s.tag !== tag);
  }
}

/** Takes every enemy out of the game and stops camps refilling, for walking a place without being attacked. */
export function removeEnemies(state: GameState): void {
  for (const ls of Object.values(state.levels)) {
    ls.enemies.length = 0;
    delete ls.campRespawns;
  }
}
