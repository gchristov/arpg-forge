import { describe, expect, it } from 'vitest';
import { currentLevel } from './state';
import { arena, ofType, OPEN_ROOM, run } from './testing';
import { useWeaponAttacks, type WeaponAttackTurn } from './weapon-attacks';
import { meleeOf } from './weapons';

describe('weapons', () => {
  it("fights bare-handed until a weapon is in hand, then with its numbers in place of bare hands' own", () => {
    const state = arena(OPEN_ROOM, { x: 5.5, y: 5.5 });
    state.rules.hero = { ...state.rules.hero, weapons: { club: { reach: 2 } } };
    expect(meleeOf(state)).toBe(state.rules.hero.melee);
    state.hero.weapon = 'club';
    expect(meleeOf(state)).toEqual({ ...state.rules.hero.melee, reach: 2 });
  });

  it("attacks with a weapon's own attack rather than swinging, keeping it up on the target until the hero walks off", () => {
    const turns: Array<{ target: number; setting: number; turn: number }> = [];
    let stops = 0;
    useWeaponAttacks({
      press: {
        attack: ({ target, settings, memory }: WeaponAttackTurn<{ setting: number }>) => {
          memory.turn = (memory.turn ?? 0) + 1;
          turns.push({ target: target.id, setting: settings.setting, turn: memory.turn });
        },
        stop: () => void stops++,
      },
    });
    const state = arena(OPEN_ROOM, { x: 5.5, y: 5.5 }, [{ kind: 'dummy', x: 6.3, y: 5.5 }]);
    state.rules.hero = { ...state.rules.hero, weapons: { press: { attack: { press: { setting: 3 } } } } };
    const dummy = currentLevel(state).enemies[0]!;
    const swung = run(state, 1, [{ type: 'attack', enemyId: dummy.id }]);
    expect(ofType(swung, 'Swung').some((s) => s.actorId === state.hero.id)).toBe(true);
    expect(turns).toHaveLength(0);
    state.hero.weapon = 'press';
    const pressed = run(state, 1);
    expect(ofType(pressed, 'Swung').some((s) => s.actorId === state.hero.id)).toBe(false);
    expect(turns[0]).toEqual({ target: dummy.id, setting: 3, turn: 1 });
    expect(state.hero.engagedId).toBe(dummy.id);
    run(state, 0.5, [{ type: 'walk', x: 1.5, y: 1.5 }]);
    expect([state.hero.engagedId, state.hero.attackMemory, stops]).toEqual([null, {}, 1]);
  });

  it('puts a weapon found in a container in hand, says so, and moves the quest on', () => {
    const state = arena(OPEN_ROOM, { x: 5.5, y: 5.5 });
    state.rules.hero = { ...state.rules.hero, weapons: { saw: { knockback: 0 } } };
    state.rules.quest = [{}, { reachedBy: { type: 'arm', weapon: 'saw' } }];
    currentLevel(state).containers.push({ tx: 5, ty: 3, gold: 0, healingItems: 0, weapon: 'saw', opened: false });
    const events = run(state, 4, [{ type: 'open', index: 0 }]);
    expect(state.hero.weapon).toBe('saw');
    expect(ofType(events, 'Armed')).toHaveLength(1);
    expect(state.quest).toBe(1);
  });

  it('moves the quest on when something is used', () => {
    const state = arena(OPEN_ROOM, { x: 5.5, y: 5.5 });
    state.rules.quest = [{}, { reachedBy: { type: 'use', id: 'breaker' } }];
    currentLevel(state).readables.push({ tx: 5, ty: 3, id: 'breaker' });
    const events = run(state, 4, [{ type: 'read', index: 0 }]);
    expect(ofType(events, 'Read')).toHaveLength(1);
    expect(state.quest).toBe(1);
  });
});
