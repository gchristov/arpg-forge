import { describe, expect, it } from 'vitest';
import { arena } from '../sim/testing';
import { currentLevel, type GameState } from '../sim/state';
import { EnemySight } from './enemy-sight';
import { Exploration } from './exploration';

/** The hero on the left of a wall with a doorway at the bottom, open ground stretching far right. */
const ROWS = [
  '......#.........................',
  '......#.........................',
  '................................',
];

/** Every solid tile blocks sight in these maps, which have nothing but walls. */
const solid = (state: GameState) => (tx: number, ty: number) => {
  const { map } = currentLevel(state).level;
  return tx < 0 || ty < 0 || tx >= map.width || ty >= map.height || map.solid[ty * map.width + tx] === 1;
};

describe('EnemySight', () => {
  it('shows every enemy on a level the hero doesn\'t explore', () => {
    const state = arena(ROWS, { x: 1.5, y: 0.5 }, [{ kind: 'dummy', x: 8.5, y: 0.5 }, { kind: 'dummy', x: 30.5, y: 2.5 }]);
    const sight = new EnemySight();
    sight.update(state, 1 / 60, null);
    expect(currentLevel(state).enemies.map((e) => sight.of(e.id))).toEqual([1, 1]);
  });

  it('shows enemies on ground the hero has found, and hides those behind a wall or too far away', () => {
    const state = arena(ROWS, { x: 1.5, y: 0.5 }, [
      { kind: 'dummy', x: 4.5, y: 0.5 }, { kind: 'dummy', x: 8.5, y: 0.5 }, { kind: 'dummy', x: 30.5, y: 2.5 },
    ]);
    const [near, behindWall, farAway] = currentLevel(state).enemies;
    const exploration = new Exploration();
    exploration.update(state, 1, 9, solid(state));
    const sight = new EnemySight();
    sight.update(state, 1, exploration);
    expect([sight.of(near!.id), sight.of(behindWall!.id), sight.of(farAway!.id)]).toEqual([1, 0, 0]);
  });

  it('keeps a found enemy in view once the hero looks away, and fades out one that wanders into the unknown', () => {
    const state = arena(ROWS, { x: 1.5, y: 2.5 }, [{ kind: 'dummy', x: 7.5, y: 2.5 }]);
    const enemy = currentLevel(state).enemies[0]!;
    const exploration = new Exploration();
    const sight = new EnemySight();
    exploration.update(state, 1, 9, solid(state));
    sight.update(state, 1, exploration);
    state.hero.x = state.hero.prevX = 1.5;
    state.hero.y = state.hero.prevY = 0.5;
    exploration.update(state, 1, 9, solid(state));
    sight.update(state, 1, exploration);
    expect(sight.of(enemy.id)).toBe(1);
    enemy.x = enemy.prevX = 25.5;
    sight.update(state, 0.1, exploration);
    expect(sight.of(enemy.id)).toBeGreaterThan(0);
    expect(sight.of(enemy.id)).toBeLessThan(1);
    sight.update(state, 1, exploration);
    expect(sight.of(enemy.id)).toBe(0);
  });
});
