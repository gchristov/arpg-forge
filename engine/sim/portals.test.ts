import { describe, expect, it } from 'vitest';
import { currentLevel } from './state';
import { arena, ofType, OPEN_ROOM, run } from './testing';

describe('sealed portals', () => {
  function sealedRoom() {
    const state = arena(OPEN_ROOM, { x: 2.5, y: 2.5 }, [{ kind: 'dummy', x: 15.5, y: 15.5 }]);
    currentLevel(state).level.portals.push({ tx: 2, ty: 5, to: 'home', stepOut: { x: 0, y: 1 }, sealed: true });
    return state;
  }

  it('stay shut while an enemy in the room still stands, saying so now and then', () => {
    const state = sealedRoom();
    const events = run(state, 4, [{ type: 'walkInto', tx: 2, ty: 5 }]);
    expect(state.levelId).toBe('testRoom');
    expect(ofType(events, 'PortalSealed').length).toBeGreaterThanOrEqual(1);
    expect(ofType(events, 'PortalSealed').length).toBeLessThanOrEqual(3);
  });

  it('open once the last enemy falls, which clears the level', () => {
    const state = sealedRoom();
    const dummy = currentLevel(state).enemies[0]!;
    dummy.hp = 1;
    const events = run(state, 8, [{ type: 'attack', enemyId: dummy.id }]);
    expect(ofType(events, 'LevelCleared')).toEqual([{ type: 'LevelCleared', levelId: 'testRoom' }]);
    run(state, 12, [{ type: 'walkInto', tx: 2, ty: 5 }]);
    expect(state.levelId).toBe('home');
  });
});

describe('locked portals', () => {
  it('stay locked until the quest reaches their step, saying so once each time the hero walks in, then let the hero through', () => {
    const state = arena(OPEN_ROOM, { x: 2.5, y: 2.5 });
    state.rules.quest = [{}, { id: 'powered', reachedBy: { type: 'use', id: 'breaker' } }];
    currentLevel(state).level.portals.push({ tx: 2, ty: 5, to: 'home', stepOut: { x: 0, y: 1 }, lockedUntilStep: 'powered' });
    const events = run(state, 4, [{ type: 'walkInto', tx: 2, ty: 5 }]);
    expect(state.levelId).toBe('testRoom');
    expect(ofType(events, 'PortalLocked')).toEqual([{ type: 'PortalLocked', to: 'home', x: 2.5, y: 5.5 }]);
    run(state, 2, [{ type: 'walk', x: 2.5, y: 2.5 }]);
    expect(ofType(run(state, 4, [{ type: 'walkInto', tx: 2, ty: 5 }]), 'PortalLocked')).toHaveLength(1);
    state.quest = 1;
    run(state, 6, [{ type: 'walkInto', tx: 2, ty: 5 }]);
    expect(state.levelId).toBe('home');
  });
});
