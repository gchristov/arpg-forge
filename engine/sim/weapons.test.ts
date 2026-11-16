import { describe, expect, it } from 'vitest';
import { useService } from './interaction';
import { currentLevel } from './state';
import { arena, ofType, OPEN_ROOM, run } from './testing';
import { meleeOf } from './weapons';

describe('weapons', () => {
  it("fights bare-handed until a weapon is in hand, then with the weapon's attack", () => {
    const state = arena(OPEN_ROOM, { x: 5.5, y: 5.5 }, [{ kind: 'brute', x: 6.3, y: 5.5 }]);
    state.rules.hero = { ...state.rules.hero, weapons: { saw: { continuous: { tickSeconds: 0.1, power: 2 } } } };
    const brute = currentLevel(state).enemies[0]!;
    brute.hp = brute.maxHp = 1000;
    expect(meleeOf(state).continuous).toBeUndefined();
    const swung = run(state, 2, [{ type: 'attack', enemyId: brute.id }]);
    expect(ofType(swung, 'Swung').some((s) => s.actorId === state.hero.id)).toBe(true);
    state.hero.weapon = 'saw';
    expect(meleeOf(state).continuous).toEqual({ tickSeconds: 0.1, power: 2 });
    expect(meleeOf(state).reach).toBe(state.rules.hero.melee.reach);
    run(state, 1);
    expect(state.hero.cut).not.toBeNull();
  });

  it('sells a weapon once, for its price, and puts it in hand', () => {
    const state = arena(OPEN_ROOM, { x: 5.5, y: 5.5 });
    state.rules.hero = { ...state.rules.hero, weapons: { saw: { knockback: 0 } } };
    state.rules.npcs = { smith: { services: [{ type: 'sellWeapon', weapon: 'saw', price: 60 }] } };
    const ls = currentLevel(state);
    ls.npcs.push({ id: 99, kind: 'smith', name: 'Smith', x: 6, y: 5.5, prevX: 6, prevY: 5.5, r: 0.3, facingX: 0, facingY: 1, moving: false, path: null });
    state.hero.gold = 50;
    useService(state, 99, 0, []);
    expect(state.hero.weapon).toBeNull();
    state.hero.gold = 100;
    const events: Parameters<typeof useService>[3] = [];
    useService(state, 99, 0, events);
    expect([state.hero.weapon, state.hero.gold]).toEqual(['saw', 40]);
    useService(state, 99, 0, events);
    expect(state.hero.gold).toBe(40);
    expect(ofType(events, 'ServiceUsed')).toHaveLength(1);
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
