import { describe, expect, it } from 'vitest';
import { arena } from '../sim/testing';
import { Exploration } from './exploration';

/** The hero on the left of a wall with a doorway at the bottom, a far room on the right. */
const ROWS = [
  '......#.........................',
  '......#.........................',
  '................................',
];

describe('Exploration', () => {
  it('finds what the hero can see within range, and not what lies behind a wall or too far away', () => {
    const state = arena(ROWS, { x: 1.5, y: 0.5 }, []);
    const exploration = new Exploration();
    exploration.update(state, 1, 9);
    const found = (tx: number, ty: number) => exploration.found(state.levelId, tx, ty, 32);
    expect([found(4, 0), found(6, 0), found(8, 0), found(20, 2)]).toEqual([true, true, false, false]);
  });

  it('keeps what was found once the hero moves on, and fades it in rather than popping', () => {
    const state = arena(ROWS, { x: 1.5, y: 0.5 }, []);
    const exploration = new Exploration();
    exploration.update(state, 0.1, 9);
    const shown = exploration.shown(state.levelId)!;
    expect(shown[4]).toBeGreaterThan(0);
    expect(shown[4]).toBeLessThan(1);
    state.hero.x = state.hero.prevX = 20.5;
    state.hero.y = state.hero.prevY = 2.5;
    exploration.update(state, 1, 9);
    expect(exploration.found(state.levelId, 4, 0, 32)).toBe(true);
    expect(exploration.found(state.levelId, 20, 0, 32)).toBe(true);
    expect(shown[4]).toBe(1);
  });
});
