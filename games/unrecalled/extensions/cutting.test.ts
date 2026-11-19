import { describe, expect, it } from 'vitest';
import { currentLevel, type GameState } from '../../../engine/sim/state';
import { arena, ofType, OPEN_ROOM, run } from '../../../engine/sim/testing';
import { useWeaponAttacks } from '../../../engine/sim/weapon-attacks';
import { CUT, CUT_REPORT_SECONDS, type CutSettings } from './cutting';

/**
 * The test hero with a saw in hand that cuts ten times a second, and no critical hits.
 */
function holdingSaw(state: GameState, settings: CutSettings = { tickSeconds: 0.1, power: 1 }): GameState {
  useWeaponAttacks({ cut: CUT });
  const { hero } = state.rules;
  state.rules.hero = { ...hero, melee: { ...hero.melee, critChance: 0 }, weapons: { saw: { attack: { cut: settings } } } };
  state.hero.weapon = 'saw';
  return state;
}

/** The test hero cutting, beside a brute too tough to fall, which fights back rather than giving up and healing as a still dummy would. */
function cutting(settings?: CutSettings): GameState {
  const state = holdingSaw(arena(OPEN_ROOM, { x: 5.5, y: 5.5 }, [{ kind: 'brute', x: 6.3, y: 5.5 }]), settings);
  const brute = currentLevel(state).enemies[0]!;
  brute.hp = brute.maxHp = 1000;
  return state;
}

describe('cutting', () => {
  it('cuts into a target in reach as fast, a second, as swinging does, without swinging', () => {
    const state = cutting();
    const dummy = currentLevel(state).enemies[0]!;
    const events = run(state, 5.5, [{ type: 'attack', enemyId: dummy.id }]);
    // A swing deals 8 to 13 every 0.55 s: about 19 a second, 105 over 5.5 s.
    expect(dummy.maxHp - dummy.hp).toBeGreaterThan(85);
    expect(dummy.maxHp - dummy.hp).toBeLessThan(125);
    expect(ofType(events, 'Swung').filter((s) => s.actorId === state.hero.id)).toHaveLength(0);
  });

  it('deals `power` times the damage a second of swinging', () => {
    const state = cutting({ tickSeconds: 0.1, power: 2 });
    const brute = currentLevel(state).enemies[0]!;
    run(state, 5.5, [{ type: 'attack', enemyId: brute.id }]);
    expect(brute.maxHp - brute.hp).toBeGreaterThan(170);
    expect(brute.maxHp - brute.hp).toBeLessThan(250);
  });

  it('reports what it cuts a few times a second rather than every tick, adding up to all of it', () => {
    const state = cutting();
    const dummy = currentLevel(state).enemies[0]!;
    const events = run(state, 4, [{ type: 'attack', enemyId: dummy.id }]);
    const reports = ofType(events, 'EnemyDamaged');
    expect(reports.length).toBeGreaterThanOrEqual(Math.floor(4 / CUT_REPORT_SECONDS) - 1);
    expect(reports.length).toBeLessThanOrEqual(Math.ceil(4 / CUT_REPORT_SECONDS) + 1);
    const reported = reports.reduce((sum, r) => sum + r.amount, 0);
    expect(Math.abs(reported - (dummy.maxHp - dummy.hp))).toBeLessThan(reports.length);
  });

  it('stops cutting once the target is out of reach', () => {
    const state = cutting();
    const dummy = currentLevel(state).enemies[0]!;
    run(state, 1, [{ type: 'attack', enemyId: dummy.id }]);
    expect(state.hero.engagedId).not.toBeNull();
    run(state, 0.5, [{ type: 'walk', x: 1.5, y: 1.5 }]);
    expect(state.hero.engagedId).toBeNull();
    const hp = dummy.hp;
    run(state, 1);
    expect(dummy.hp).toBe(hp);
  });

  it('holds a ranged machine it\'s cutting into, so it can\'t back away', () => {
    const state = holdingSaw(arena(OPEN_ROOM, { x: 5.5, y: 5.5 }, [{ kind: 'shooter', x: 7.5, y: 5.5 }]), { tickSeconds: 0.1, power: 0.01 });
    const shooter = currentLevel(state).enemies[0]!;
    shooter.mode = 'chase';
    run(state, 2, [{ type: 'attack', enemyId: shooter.id }]);
    expect(state.hero.engagedId).toBe(shooter.id);
    const at = { x: shooter.x, y: shooter.y };
    run(state, 1);
    expect(Math.hypot(shooter.x - at.x, shooter.y - at.y)).toBeLessThan(0.05);
  });

  it('reports the killing cut before the kill', () => {
    const state = cutting();
    const dummy = currentLevel(state).enemies[0]!;
    dummy.hp = dummy.maxHp = 12;
    const events = run(state, 3, [{ type: 'attack', enemyId: dummy.id }]);
    const kill = events.findIndex((e) => e.type === 'EnemyKilled');
    expect(kill).toBeGreaterThan(0);
    expect(events[kill - 1]!.type).toBe('EnemyDamaged');
    expect(state.hero.engagedId).toBeNull();
  });
});
