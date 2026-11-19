import { describe, expect, it } from 'vitest';
import type { QuestStep } from './content';
import { jumpToStep, removeEnemies } from './shortcuts';
import { useStepActions } from './step-actions';
import { arena, OPEN_ROOM } from './testing';

function withQuest(quest: QuestStep[]) {
  const state = arena(OPEN_ROOM, { x: 2, y: 2 }, [{ kind: 'brute', x: 8, y: 8 }]);
  state.rules.quest = quest;
  return state;
}

describe('shortcuts', () => {
  it('jumps the story to a step with the weapon an earlier step was reached by in hand', () => {
    const state = withQuest([{}, { reachedBy: { type: 'arm', weapon: 'saw' } }, { reachedBy: { type: 'talk', npcKind: 'smith' } }]);
    jumpToStep(state, 2);
    expect([state.quest, state.hero.weapon]).toEqual([2, 'saw']);
  });

  it('takes away an enemy defeated on the way, whether it has turned up yet or not, with what it carried in hand', () => {
    const state = withQuest([{}, { id: 'guardDown', reachedBy: { type: 'defeat', tag: 'guard' } }, { reachedBy: { type: 'defeat', tag: 'thief' } }]);
    const ls = state.levels.arena!;
    ls.enemies[0]!.tag = 'guard';
    ls.storySpawns.push({ kind: 'brute', x: 4, y: 4, tag: 'thief', fromStep: 'guardDown', carries: 'saw' });
    jumpToStep(state, 2);
    expect([ls.enemies.length, ls.storySpawns.length, ls.items.length, state.hero.weapon]).toEqual([0, 0, 0, 'saw']);
  });

  it('takes a weapon off the ground when a step on the way was reached by picking it up', () => {
    const state = withQuest([{}, { reachedBy: { type: 'arm', weapon: 'saw' } }]);
    state.levels.arena!.items.push({ kind: 'weapon', amount: 1, weapon: 'saw', x: 4, y: 4, z: 0, vz: 0 });
    jumpToStep(state, 1);
    expect([state.levels.arena!.items.length, state.hero.weapon]).toEqual([0, 'saw']);
  });

  it('takes away the enemy whose kill reached a step on the way', () => {
    const state = withQuest([{}, { reachedBy: { type: 'kill', enemyKind: 'brute' } }]);
    jumpToStep(state, 1);
    expect(state.levels.arena!.enemies).toEqual([]);
  });

  it('keeps a jump within the story', () => {
    const state = withQuest([{}, { reachedBy: { type: 'talk', npcKind: 'smith' } }]);
    jumpToStep(state, 9);
    expect(state.quest).toBe(1);
  });

  it('does what each step on the way does', () => {
    const done: string[] = [];
    useStepActions({ ring: () => void done.push('ring') });
    const state = withQuest([{}, { reachedBy: { type: 'kill', enemyKind: 'lord' }, does: ['ring'] }, { reachedBy: { type: 'talk', npcKind: 'smith' } }]);
    jumpToStep(state, 2);
    expect(done).toEqual(['ring']);
  });

  it('takes every enemy out and stops camps refilling', () => {
    const state = withQuest([{}]);
    state.levels.arena!.campRespawns = { everySeconds: 1, maxAlive: 3, minHeroDistance: 0, kinds: ['brute'] };
    removeEnemies(state);
    expect(Object.values(state.levels).every((ls) => ls.enemies.length === 0 && !ls.campRespawns)).toBe(true);
  });
});
