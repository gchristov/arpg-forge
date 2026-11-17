import { describe, expect, it } from 'vitest';
import type { QuestStep } from './content';
import { jumpToStep, removeEnemies } from './shortcuts';
import { arena, OPEN_ROOM } from './testing';

function withQuest(quest: QuestStep[]) {
  const state = arena(OPEN_ROOM, { x: 2, y: 2 }, [{ kind: 'worker', x: 8, y: 8 }]);
  state.rules.quest = quest;
  return state;
}

describe('shortcuts', () => {
  it('jumps the story to a step with the weapon an earlier step was reached by in hand', () => {
    const state = withQuest([{}, { reachedBy: { type: 'arm', weapon: 'saw' } }, { reachedBy: { type: 'talk', npcKind: 'smith' } }]);
    jumpToStep(state, 2);
    expect([state.quest, state.hero.weapon]).toEqual([2, 'saw']);
  });

  it('takes away an enemy defeated on the way, whether it has turned up yet or not, leaving what it carried on the ground', () => {
    const state = withQuest([
      {}, { reachedBy: { type: 'defeat', tag: 'guard' } }, { reachedBy: { type: 'defeat', tag: 'thief' } }, { reachedBy: { type: 'arm', weapon: 'saw' } },
    ]);
    const ls = state.levels.arena!;
    ls.enemies[0]!.tag = 'guard';
    ls.storySpawns.push({ kind: 'brute', x: 4, y: 4, tag: 'thief', fromStep: 1, carries: 'saw' });
    jumpToStep(state, 2);
    expect([ls.enemies.length, ls.storySpawns.length, ls.items.map((i) => i.weapon), state.hero.weapon]).toEqual([0, 0, ['saw'], null]);
    jumpToStep(state, 3);
    expect([ls.items.length, state.hero.weapon]).toEqual([0, 'saw']);
  });

  it('takes away the enemy whose kill reached a step on the way', () => {
    const state = withQuest([{}, { reachedBy: { type: 'kill', enemyKind: 'worker' } }]);
    jumpToStep(state, 1);
    expect(state.levels.arena!.enemies).toEqual([]);
  });

  it('keeps a jump within the story', () => {
    const state = withQuest([{}, { reachedBy: { type: 'talk', npcKind: 'smith' } }]);
    jumpToStep(state, 9);
    expect(state.quest).toBe(1);
  });

  it('calms everything when a step on the way did', () => {
    const state = withQuest([{}, { reachedBy: { type: 'kill', enemyKind: 'lord' }, calmsEverything: true }]);
    for (const ls of Object.values(state.levels)) ls.alarmed = true;
    jumpToStep(state, 1);
    expect(Object.values(state.levels).some((ls) => ls.alarmed)).toBe(false);
  });

  it('takes every enemy out and stops camps refilling', () => {
    const state = withQuest([{}]);
    state.levels.arena!.campRespawns = { everySeconds: 1, maxAlive: 3, minHeroDistance: 0, kinds: ['brute'] };
    removeEnemies(state);
    expect(Object.values(state.levels).every((ls) => ls.enemies.length === 0 && !ls.campRespawns)).toBe(true);
  });
});
