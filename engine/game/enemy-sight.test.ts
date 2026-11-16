import { describe, expect, it } from 'vitest';
import { arena } from '../sim/testing';
import { currentLevel } from '../sim/state';
import { EnemySight } from './enemy-sight';

/** The hero on the left, a wall down the middle with a gap at the bottom, and open ground stretching far right. */
const ROWS = [
  '......#.........................',
  '......#.........................',
  '................................',
];

describe('EnemySight', () => {
  it('shows every enemy when the level sets no sight range', () => {
    const state = arena(ROWS, { x: 1.5, y: 0.5 }, [{ kind: 'dummy', x: 8.5, y: 0.5 }, { kind: 'dummy', x: 30.5, y: 2.5 }]);
    const sight = new EnemySight();
    sight.update(state, 1 / 60, undefined);
    expect(currentLevel(state).enemies.map((e) => sight.of(e.id))).toEqual([1, 1]);
  });

  it('shows enemies in the hero\'s sight, and hides those behind a wall or too far away', () => {
    const state = arena(ROWS, { x: 1.5, y: 0.5 }, [
      { kind: 'dummy', x: 4.5, y: 0.5 }, { kind: 'dummy', x: 8.5, y: 0.5 }, { kind: 'dummy', x: 30.5, y: 2.5 },
    ]);
    const [near, behindWall, farAway] = currentLevel(state).enemies;
    const sight = new EnemySight();
    sight.update(state, 1, 9);
    expect([sight.of(near!.id), sight.of(behindWall!.id), sight.of(farAway!.id)]).toEqual([1, 0, 0]);
  });

  it('fades an enemy in as it comes into sight, rather than popping', () => {
    const state = arena(ROWS, { x: 1.5, y: 0.5 }, [{ kind: 'dummy', x: 8.5, y: 0.5 }]);
    const enemy = currentLevel(state).enemies[0]!;
    const sight = new EnemySight();
    sight.update(state, 1 / 60, 9);
    enemy.y = enemy.prevY = 2.5;
    state.hero.y = state.hero.prevY = 2.5;
    sight.update(state, 0.1, 9);
    expect(sight.of(enemy.id)).toBeGreaterThan(0);
    expect(sight.of(enemy.id)).toBeLessThan(1);
    sight.update(state, 1, 9);
    expect(sight.of(enemy.id)).toBe(1);
  });
});
