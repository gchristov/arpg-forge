import { describe, expect, it } from 'vitest';
import type { Level, Portal } from '../world/level';
import { mapFromRows } from '../world/testing';
import type { GameContent, LevelContent, QuestStep } from './content';
import { questGoal } from './quest-goal';
import { createGameState } from './setup';
import { TEST_ENEMIES, TEST_HERO } from './testing';

const ROWS = ['......', '......', '......', '......'];

function place(id: string, portals: Portal[], extra: Partial<LevelContent> = {}): LevelContent {
  const level: Level = {
    id, name: id, subtitle: '', outdoor: false, map: mapFromRows(ROWS), start: { x: 2.5, y: 2.5 }, portals, lights: [], structures: [],
  };
  return { level, spawns: [], camps: [], npcs: [], ...extra };
}

const way = (tx: number, to: string): Portal => ({ tx, ty: 0, to, stepOut: { x: 0, y: 1 } });

/** A town with a hall and a long way round, a cellar under the hall and a crypt past the cellar. */
function game(quest: QuestStep[]) {
  const content: GameContent = {
    levels: [
      place('town', [way(1, 'shed'), way(4, 'hall')], { npcs: [{ kind: 'elder', name: 'Elder', x: 3.5, y: 3.5 }] }),
      place('shed', [way(1, 'town'), way(3, 'yard')]),
      place('yard', [way(1, 'shed'), way(3, 'moor')]),
      place('moor', [way(1, 'yard'), way(3, 'crypt')]),
      place('hall', [way(1, 'town'), way(3, 'cellar')], { npcs: [{ kind: 'smith', name: 'Smith', x: 1.5, y: 2.5 }] }),
      place('cellar', [way(1, 'hall'), way(3, 'crypt')]),
      place('crypt', [way(1, 'cellar')], { spawns: [{ kind: 'lord', x: 4.5, y: 2.5 }] }),
    ],
    startLevel: 'town', hero: TEST_HERO, enemies: TEST_ENEMIES, npcRadius: 0.32, npcs: {}, quest,
  };
  return createGameState(content, 1);
}

describe('questGoal', () => {
  it('points at the townsperson to talk to when they are here', () => {
    const state = game([{}, { reachedBy: { type: 'talk', npcKind: 'elder' } }]);
    const elder = state.levels.town!.npcs[0]!;
    expect(questGoal(state)).toEqual({ x: 3.5, y: 3.5, actorId: elder.id });
  });

  it('points at the doorway towards someone elsewhere', () => {
    const state = game([{}, { reachedBy: { type: 'talk', npcKind: 'smith' } }]);
    expect(questGoal(state)).toEqual({ x: 4.5, y: 0.5 });
  });

  it('leads to a place to reach through the fewest doorways, one level at a time', () => {
    const state = game([{}, { reachedBy: { type: 'enter', levelId: 'crypt' } }]);
    expect(questGoal(state)).toEqual({ x: 4.5, y: 0.5 });
    state.levelId = 'hall';
    expect(questGoal(state)).toEqual({ x: 3.5, y: 0.5 });
    state.levelId = 'moor';
    expect(questGoal(state)).toEqual({ x: 3.5, y: 0.5 });
  });

  it('leads through a level\'s first doorway', () => {
    const state = game([{}, { reachedBy: { type: 'enter', levelId: 'shed' } }]);
    expect(questGoal(state)).toEqual({ x: 1.5, y: 0.5 });
  });

  it('points at the enemy to defeat once on its level, and nowhere once it has fallen', () => {
    const state = game([{}, { reachedBy: { type: 'kill', enemyKind: 'lord' } }]);
    state.levelId = 'crypt';
    const lord = state.levels.crypt!.enemies[0]!;
    expect(questGoal(state)).toMatchObject({ actorId: lord.id });
    lord.dead = true;
    expect(questGoal(state)).toBeNull();
  });

  it('has no goal once the story is done, or when the next step has no trigger', () => {
    const state = game([{}, { reachedBy: { type: 'talk', npcKind: 'elder' } }]);
    state.quest = 1;
    expect(questGoal(state)).toBeNull();
    expect(questGoal(game([{}, {}]))).toBeNull();
  });
});
