import { describe, expect, it } from 'vitest';
import { currentLevel } from './state';
import { arena, ofType, OPEN_ROOM, run } from './testing';
import { useWeaponAttacks, type WeaponAttackTurn } from './weapon-attacks';
import { arm, meleeOf } from './weapons';

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

  it('lets the weapon in hand act in place of a swing at nothing, and tells it of each skill the hero uses', () => {
    const told: string[] = [];
    useWeaponAttacks({
      gun: {
        attack: () => {},
        nothingNear: ({ state }) => {
          told.push('nothingNear');
          return state.hero.weapon === 'gun';
        },
        skillUsed: ({ skill }) => void told.push(skill),
      },
    });
    const state = arena(OPEN_ROOM, { x: 5.5, y: 5.5 });
    state.rules.hero = { ...state.rules.hero, weapons: { gun: { attack: { gun: {} } } } };
    state.hero.weapon = 'gun';
    expect(ofType(run(state, 1 / 60, [{ type: 'attackNearest' }]), 'Swung')).toEqual([]);
    run(state, 1 / 60, [{ type: 'useSkill', slot: 0 }]);
    expect(told).toEqual(['nothingNear', state.rules.hero.skills[0]!.id]);
    state.hero.weapon = null;
    run(state, 1);
    expect(ofType(run(state, 1 / 60, [{ type: 'attackNearest' }]), 'Swung')).toHaveLength(1);
  });

  it('drops a weapon found in a container beside it, which goes in hand once picked up, says so, and moves the quest on', () => {
    const state = arena(OPEN_ROOM, { x: 5.5, y: 5.5 });
    state.rules.hero = { ...state.rules.hero, weapons: { saw: { knockback: 0 } } };
    state.rules.quest = [{}, { reachedBy: { type: 'arm', weapon: 'saw' } }];
    currentLevel(state).containers.push({ tx: 5, ty: 3, gold: 0, healingItems: 0, weapon: 'saw', opened: false });
    const opened = run(state, 4, [{ type: 'open', index: 0 }]);
    expect(ofType(opened, 'ContainerOpened')).toHaveLength(1);
    const saw = currentLevel(state).items.find((i) => i.weapon === 'saw')!;
    expect(saw).toBeDefined();
    const events = run(state, 2, [{ type: 'walk', x: saw.x, y: saw.y }]);
    expect(ofType(events, 'PickedUp').map((p) => p.weapon)).toEqual(['saw']);
    expect(state.hero.weapon).toBe('saw');
    expect(ofType(events, 'Armed')).toHaveLength(1);
    expect(state.quest).toBe(1);
  });

  it('carries every weapon it gets, starting with the first, and swaps through them in the order they came', () => {
    const state = arena(OPEN_ROOM, { x: 5.5, y: 5.5 });
    state.rules.hero = { ...state.rules.hero, weapons: { club: {}, saw: {} }, startingWeapon: 'club' };
    state.hero.weapon = 'club';
    state.hero.weapons = ['club'];
    expect(ofType(run(state, 0.1, [{ type: 'swapWeapon' }]), 'WeaponSwapped')).toHaveLength(0);
    arm(state, 'saw', 5.5, 5.5, []);
    expect([state.hero.weapon, state.hero.weapons]).toEqual(['saw', ['club', 'saw']]);
    const swapped = run(state, 0.1, [{ type: 'swapWeapon' }]);
    expect(ofType(swapped, 'WeaponSwapped').map((s) => s.weapon)).toEqual(['club']);
    run(state, 0.1, [{ type: 'swapWeapon' }]);
    expect(state.hero.weapon).toBe('saw');
    arm(state, 'club', 5.5, 5.5, []);
    expect(state.hero.weapons).toEqual(['club', 'saw']);
  });

  it("stops the weapon's own attack on a swap, and keeps at the target with the next", () => {
    let stops = 0;
    useWeaponAttacks({ press: { attack: () => {}, stop: () => void stops++ } });
    const state = arena(OPEN_ROOM, { x: 5.5, y: 5.5 }, [{ kind: 'dummy', x: 6.3, y: 5.5 }]);
    state.rules.hero = { ...state.rules.hero, weapons: { press: { attack: { press: {} } }, club: {} } };
    state.hero.weapon = 'press';
    state.hero.weapons = ['press', 'club'];
    const dummy = currentLevel(state).enemies[0]!;
    run(state, 1, [{ type: 'attack', enemyId: dummy.id }]);
    expect(state.hero.engagedId).toBe(dummy.id);
    const events = run(state, 1, [{ type: 'swapWeapon' }]);
    expect([stops, state.hero.engagedId, state.hero.targetId]).toEqual([1, null, dummy.id]);
    expect(ofType(events, 'Swung').some((s) => s.actorId === state.hero.id)).toBe(true);
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
