import { describe, expect, it } from 'vitest';
import { arena } from '../sim/testing';
import { currentLevel, type GameState } from '../sim/state';
import { Exploration } from './exploration';

/** The hero on the left of a wall with a doorway at the bottom, a far room on the right. */
const ROWS = [
  '......#.........................',
  '......#.........................',
  '................................',
];

/** Every solid tile blocks sight in these maps, which have nothing but walls. */
const walls = (state: GameState) => (tx: number, ty: number) => {
  const { map } = currentLevel(state).level;
  return tx < 0 || ty < 0 || tx >= map.width || ty >= map.height || map.solid[ty * map.width + tx] === 1;
};

describe('Exploration', () => {
  it('sees past what doesn\'t block sight, such as crates, so nothing stays dark behind them', () => {
    const state = arena(['....c....'], { x: 0.5, y: 0.5 }, []);
    const { map } = currentLevel(state).level;
    map.solid[4] = 1;
    const exploration = new Exploration();
    exploration.update(state, 1, 9, (tx) => tx < 0 || tx >= 9);
    expect(exploration.found(state.levelId, 7, 0, 9)).toBe(true);
    const blind = new Exploration();
    blind.update(state, 1, 9, walls(state));
    expect(blind.found(state.levelId, 7, 0, 9)).toBe(false);
  });

  it('finds what the hero can see within range, and not what lies behind a wall or too far away', () => {
    const state = arena(ROWS, { x: 1.5, y: 0.5 }, []);
    const exploration = new Exploration();
    exploration.update(state, 1, 9, walls(state));
    const found = (tx: number, ty: number) => exploration.found(state.levelId, tx, ty, 32);
    expect([found(4, 0), found(6, 0), found(8, 0), found(20, 2)]).toEqual([true, true, false, false]);
  });

  it('keeps what was found once the hero moves on, and fades it in rather than popping', () => {
    const state = arena(ROWS, { x: 1.5, y: 0.5 }, []);
    const exploration = new Exploration();
    exploration.update(state, 0.1, 9, walls(state));
    const shown = exploration.shown(state.levelId)!;
    expect(shown[4]).toBeGreaterThan(0);
    expect(shown[4]).toBeLessThan(1);
    state.hero.x = state.hero.prevX = 20.5;
    state.hero.y = state.hero.prevY = 2.5;
    exploration.update(state, 1, 9, walls(state));
    expect(exploration.found(state.levelId, 4, 0, 32)).toBe(true);
    expect(exploration.found(state.levelId, 20, 0, 32)).toBe(true);
    expect(shown[4]).toBe(1);
  });
});
