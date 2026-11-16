import { describe, expect, it } from 'vitest';
import { mapFromRows } from '../world/testing';
import { gainXp } from './combat';
import type { GameContent, LevelContent } from './content';
import { createGameState } from './setup';
import { currentLevel, type GameState } from './state';
import { OPEN_ROOM, ofType, run, TEST_ENEMIES, TEST_HERO } from './testing';

function level(id: string, extra: Partial<LevelContent> = {}): LevelContent {
  return {
    level: { id, name: id, subtitle: '', outdoor: false, map: mapFromRows(OPEN_ROOM), start: { x: 2.5, y: 2.5 }, portals: [], lights: [], structures: [] },
    spawns: [], camps: [], npcs: [], ...extra,
  };
}

function game(levels: LevelContent[], growth?: number): GameState {
  const content: GameContent = {
    levels, startLevel: levels[0]!.level.id, hero: TEST_HERO, enemies: TEST_ENEMIES, npcRadius: 0.32, npcs: {}, quest: [{}],
    ...(growth === undefined ? {} : { enemyGrowthPerHeroLevel: growth }),
  };
  return createGameState(content, 1);
}

describe('enemy strength', () => {
  it('makes enemies on a deeper level tougher, a camp tougher or easier than its level, and leaves bosses as they are', () => {
    const state = game([
      level('outside', { camps: [{ tx: 10, ty: 10, kind: 'brute', strength: 0.8 }] }),
      level('deep', { enemyStrength: 1.5, spawns: [{ kind: 'brute', x: 10.5, y: 10.5 }, { kind: 'lord', x: 14.5, y: 14.5 }] }),
    ]);
    expect(state.levels.outside!.enemies.map((e) => e.maxHp)).toEqual([24, 24, 24]);
    expect(state.levels.deep!.enemies.map((e) => [e.kind, e.maxHp, e.hp])).toEqual([['brute', 45, 45], ['lord', 400, 400]]);
  });

  it('makes a tougher enemy hit harder', () => {
    const hits = (strength: number) => {
      const state = game([level('room', { enemyStrength: strength, spawns: [{ kind: 'brute', x: 3.3, y: 2.5 }] })]);
      state.hero.hp = state.hero.maxHp = 1e6;
      return ofType(run(state, 20), 'HeroHurt').map((e) => e.amount);
    };
    const weak = hits(1);
    const strong = hits(2);
    expect([weak.length > 3, strong.length > 3]).toEqual([true, true]);
    expect(Math.min(...weak)).toBeGreaterThanOrEqual(4);
    expect(Math.max(...weak)).toBeLessThanOrEqual(7);
    expect(Math.min(...strong)).toBeGreaterThanOrEqual(8);
    expect(Math.max(...strong)).toBeLessThanOrEqual(14);
  });

  it('grows every enemy still standing as the hero levels up, keeping the share of health each had left', () => {
    const state = game([level('room', { spawns: [{ kind: 'brute', x: 10.5, y: 10.5 }, { kind: 'brute', x: 14.5, y: 14.5 }] })], 0.05);
    const [hurt, fresh] = currentLevel(state).enemies;
    hurt!.hp = 15;
    gainXp(state, 60 + 90, []);
    expect(state.hero.level).toBe(3);
    expect([hurt!.maxHp, hurt!.hp, fresh!.maxHp, fresh!.hp]).toEqual([33, 17, 33, 33]);
  });

  it('leaves enemies as they are when the game doesn\'t grow them with the hero', () => {
    const state = game([level('room', { spawns: [{ kind: 'brute', x: 10.5, y: 10.5 }] })]);
    gainXp(state, 150, []);
    expect(currentLevel(state).enemies[0]!.maxHp).toBe(30);
  });
});
