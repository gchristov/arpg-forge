import { describe, expect, it } from 'vitest';
import { currentLevel } from './state';
import { arena, ofType, OPEN_ROOM, run } from './testing';

describe('approaching things', () => {
  it('tells once each time the hero comes within reach of a watched thing, and never of one nobody watches', () => {
    const state = arena(OPEN_ROOM, { x: 1.5, y: 1.5 });
    state.rules.watch = [{ id: 'station', within: 2 }];
    currentLevel(state).readables.push({ tx: 8, ty: 1, id: 'station' }, { tx: 1, ty: 8, id: 'sign' });
    expect(ofType(run(state, 1), 'Approached')).toEqual([]);
    const arriving = run(state, 4, [{ type: 'walk', x: 7.5, y: 1.5 }]);
    expect(ofType(arriving, 'Approached')).toEqual([{ type: 'Approached', id: 'station', within: 2 }]);
    expect(ofType(run(state, 1), 'Approached')).toEqual([]);
    run(state, 4, [{ type: 'walk', x: 1.5, y: 1.5 }]);
    expect(ofType(run(state, 4, [{ type: 'walk', x: 7.5, y: 1.5 }]), 'Approached')).toHaveLength(1);
    expect(ofType(run(state, 6, [{ type: 'walk', x: 1.5, y: 7.5 }]), 'Approached')).toEqual([]);
  });
});
