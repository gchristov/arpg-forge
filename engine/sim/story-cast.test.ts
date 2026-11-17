import { describe, expect, it } from 'vitest';
import { mapFromRows } from '../world/testing';
import type { GameContent, LevelContent } from './content';
import { questGoal } from './quest-goal';
import { createGameState } from './setup';
import { jumpToStep } from './shortcuts';
import { currentLevel } from './state';
import { OPEN_ROOM, run, TEST_ENEMIES, TEST_HERO } from './testing';

function room(id: string, extra: Partial<LevelContent> = {}): LevelContent {
  return {
    level: { id, name: id, subtitle: '', outdoor: false, map: mapFromRows(OPEN_ROOM), start: { x: 2.5, y: 2.5 }, portals: [], lights: [], structures: [] },
    spawns: [], camps: [], npcs: [], readables: [], ...extra,
  };
}

/** The elder by the well until the bandit is beaten, then held in the cellar until freed, and back by the well after. */
function story() {
  const content: GameContent = {
    levels: [
      room('village', {
        npcs: [
          { kind: 'elder', name: 'Elder', x: 4.5, y: 2.5, untilStep: 1 },
          { kind: 'elder', name: 'Elder', x: 4.5, y: 2.5, fromStep: 2 },
        ],
        readables: [{ tx: 6, ty: 6, id: 'tracks', fromStep: 1, untilStep: 2 }],
        spawns: [{ kind: 'brute', x: 3.4, y: 2.5, tag: 'bandit', strength: 0.5 }, { kind: 'brute', x: 15.5, y: 15.5 }],
      }),
      room('cellar', { npcs: [{ kind: 'elder', name: 'Elder', x: 4.5, y: 2.5, fromStep: 1, untilStep: 2 }] }),
    ],
    startLevel: 'village', hero: TEST_HERO, enemies: TEST_ENEMIES, npcRadius: 0.32, npcs: { elder: { services: [] } },
    quest: [{}, { reachedBy: { type: 'defeat', tag: 'bandit' } }, { reachedBy: { type: 'talk', npcKind: 'elder' } }],
  };
  return createGameState(content, 1);
}

const where = (state: ReturnType<typeof story>) => ({
  village: state.levels.village!.npcs.length,
  cellar: state.levels.cellar!.npcs.length,
  tracks: state.levels.village!.readables.length,
});

describe('story cast', () => {
  it('puts people and things where the story has them at each step', () => {
    const state = story();
    expect(where(state)).toEqual({ village: 1, cellar: 0, tracks: 0 });
    jumpToStep(state, 1);
    expect(where(state)).toEqual({ village: 0, cellar: 1, tracks: 1 });
    jumpToStep(state, 2);
    expect(where(state)).toEqual({ village: 1, cellar: 0, tracks: 0 });
  });

  it('gives a tagged enemy its own strength, points the way at it, and moves the story on when it\'s defeated', () => {
    const state = story();
    const [bandit, other] = currentLevel(state).enemies;
    expect([bandit!.tag, bandit!.maxHp, other!.maxHp]).toEqual(['bandit', 15, 30]);
    expect(questGoal(state)?.actorId).toBe(bandit!.id);
    state.hero.hp = state.hero.maxHp = 1e6;
    run(state, 10, [{ type: 'attack', enemyId: bandit!.id }]);
    expect(bandit!.dead).toBe(true);
    expect(state.quest).toBe(1);
    expect(where(state)).toEqual({ village: 0, cellar: 1, tracks: 1 });
  });

  it('stops the hero walking up to someone the story has taken away', () => {
    const state = story();
    const elder = currentLevel(state).npcs[0]!;
    run(state, 1 / 60, [{ type: 'talk', npcId: elder.id }]);
    expect(state.hero.interact).not.toBeNull();
    jumpToStep(state, 1);
    expect(state.hero.interact).toBeNull();
  });
});
