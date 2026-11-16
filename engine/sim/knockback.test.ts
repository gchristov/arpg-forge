import { describe, expect, it } from 'vitest';
import { knockBack } from './knockback';
import { currentLevel } from './state';
import { arena, OPEN_ROOM, run } from './testing';

describe('knock-back', () => {
  it('slides an enemy the whole distance over a moment rather than jumping it there', () => {
    const state = arena(OPEN_ROOM, { x: 2.5, y: 2.5 }, [{ kind: 'dummy', x: 5.5, y: 5.5 }]);
    const dummy = currentLevel(state).enemies[0]!;
    knockBack(dummy, 1, 0, 1.5);
    run(state, 1 / 60);
    expect(dummy.x - 5.5).toBeGreaterThan(0);
    expect(dummy.x - 5.5).toBeLessThan(0.5);
    run(state, 1);
    expect(dummy.x - 5.5).toBeCloseTo(1.5, 1);
    expect(dummy.slideX).toBe(0);
  });

  it('stops at a wall', () => {
    const state = arena(OPEN_ROOM, { x: 2.5, y: 2.5 }, [{ kind: 'dummy', x: 5.5, y: 5.5 }]);
    const dummy = currentLevel(state).enemies[0]!;
    knockBack(dummy, 1, 0, 40);
    run(state, 1);
    expect(dummy.x).toBeLessThan(currentLevel(state).level.map.width);
  });
});
