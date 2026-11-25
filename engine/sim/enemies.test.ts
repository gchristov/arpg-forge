import { type AbilityTurn, type IdleChoice, useAbilities } from './abilities';
import { describe, expect, it } from 'vitest';
import { dist } from '../core/math';
import { currentLevel } from './state';
import { arena, ofType, OPEN_ROOM, run } from './testing';

const enemiesOf = (state: ReturnType<typeof arena>) => currentLevel(state).enemies;

describe('enemy behaviour', () => {
  it('wanders near home while it cannot see the hero', () => {
    const state = arena(OPEN_ROOM, { x: 1.5, y: 1.5 }, [{ kind: 'brute', x: 15.5, y: 15.5 }]);
    run(state, 20);
    const brute = enemiesOf(state)[0]!;
    expect(brute.mode).toBe('idle');
    expect(dist(brute.x, brute.y, 15.5, 15.5)).toBeLessThan(2.5 * Math.SQRT2 + 0.5);
  });

  it('notices the hero within aggro range, chases and hits for its damage', () => {
    const state = arena(OPEN_ROOM, { x: 5.5, y: 5.5 }, [{ kind: 'brute', x: 10.5, y: 5.5 }]);
    const events = run(state, 4);
    expect(ofType(events, 'EnemyAlerted')).toHaveLength(1);
    const hurts = ofType(events, 'HeroHurt');
    expect(hurts.length).toBeGreaterThan(0);
    for (const h of hurts) expect(h.amount).toBeGreaterThanOrEqual(4), expect(h.amount).toBeLessThanOrEqual(7);
  });

  it('gives up when the hero gets far away, walks home and heals', () => {
    const state = arena(Array.from({ length: 6 }, () => '.'.repeat(40)), { x: 5.5, y: 2.5 }, [{ kind: 'brute', x: 9.5, y: 2.5 }]);
    const brute = enemiesOf(state)[0]!;
    run(state, 0.5);
    expect(brute.mode).toBe('chase');
    brute.hp = 10;
    state.hero.x = state.hero.prevX = 38.5;
    const events = run(state, 0.1);
    expect(ofType(events, 'EnemyGaveUp')).toHaveLength(1);
    const before = brute.hp;
    for (let i = 0; i < 600 && brute.mode !== 'idle'; i++) run(state, 1 / 60);
    expect(brute.mode).toBe('idle');
    expect(brute.hp).toBeGreaterThan(before);
    expect(dist(brute.x, brute.y, 9.5, 2.5)).toBeLessThan(0.5);
  });

  it('hunts the hero down from out of sight when set to, and never gives up', () => {
    const state = arena(Array.from({ length: 6 }, () => '.'.repeat(40)), { x: 2.5, y: 2.5 }, [{ kind: 'brute', x: 37.5, y: 2.5 }]);
    state.hero.hp = state.hero.maxHp = 1e9;
    const brute = enemiesOf(state)[0]!;
    brute.hunting = true;
    const events = run(state, 15);
    expect(ofType(events, 'EnemyGaveUp')).toEqual([]);
    expect(ofType(events, 'HeroHurt').length).toBeGreaterThan(0);
  });

  it('wakes up and chases when hit', () => {
    const state = arena(OPEN_ROOM, { x: 2.5, y: 5.5 }, [{ kind: 'brute', x: 12.5, y: 5.5 }]);
    run(state, 1.5, [{ type: 'useSkill', slot: 0 }]);
    expect(enemiesOf(state)[0]!.mode).toBe('chase');
  });

  it('shoots from range when it can see the hero, and the shot hurts', () => {
    const state = arena(OPEN_ROOM, { x: 5.5, y: 5.5 }, [{ kind: 'shooter', x: 10.5, y: 5.5 }]);
    const events = run(state, 4);
    expect(ofType(events, 'ShotFired').length).toBeGreaterThan(0);
    const hurts = ofType(events, 'HeroHurt');
    expect(hurts.length).toBeGreaterThan(0);
    for (const h of hurts) expect(h.amount).toBeGreaterThanOrEqual(5), expect(h.amount).toBeLessThanOrEqual(9);
  });

  it('backs away from a hero who gets close, if it is a shooter', () => {
    const state = arena(OPEN_ROOM, { x: 9.5, y: 5.5 }, [{ kind: 'shooter', x: 10.5, y: 5.5 }]);
    run(state, 1);
    expect(enemiesOf(state)[0]!.x).toBeGreaterThan(10.6);
  });
});

describe('abilities', () => {
  it('run each step an enemy that lists them fights the hero, with its settings and a memory of its own', () => {
    const turns: Array<{ setting: number; turn: number }> = [];
    useAbilities({
      count: {
        fight: ({ settings, memory }: AbilityTurn<{ setting: number }>) => {
          memory.turn = (memory.turn ?? 0) + 1;
          turns.push({ setting: settings.setting, turn: memory.turn });
        },
      },
    });
    const state = arena(OPEN_ROOM, { x: 5.5, y: 5.5 }, [{ kind: 'lord', x: 7.5, y: 5.5 }]);
    state.rules.enemies.lord = { ...state.rules.enemies.lord!, abilities: { count: { setting: 7 } } };
    run(state, 3 / 60);
    expect(turns.length).toBeGreaterThan(0);
    expect(turns[0]).toEqual({ setting: 7, turn: 1 });
    expect(turns.at(-1)!.turn).toBe(turns.length);
  });

  it('can keep an idle enemy busy, where it stands, or unseeing, wandering past the hero, or let it go on as usual', () => {
    const choices: Record<string, IdleChoice> = { busy: 'busy', unseeing: 'unseeing', usual: 'asUsual' };
    useAbilities({ choose: { idle: ({ settings }: AbilityTurn<IdleChoice>) => settings } });
    const modes = Object.values(choices).map((choice) => {
      const state = arena(OPEN_ROOM, { x: 5.5, y: 5.5 }, [{ kind: 'brute', x: 7.5, y: 5.5 }]);
      state.rules.enemies = { ...state.rules.enemies, brute: { ...state.rules.enemies.brute!, abilities: { choose: choice } } };
      run(state, 3);
      const brute = enemiesOf(state)[0]!;
      return { mode: brute.mode, stayed: brute.x === 7.5 && brute.y === 5.5 };
    });
    expect(modes).toEqual([{ mode: 'idle', stayed: true }, { mode: 'idle', stayed: false }, { mode: 'chase', stayed: false }]);
  });

  it('hear when an enemy that lists them is hurt, and act once a step after every enemy has moved', () => {
    const heard = { hurt: 0, after: 0 };
    useAbilities({ listen: { hurt: () => void heard.hurt++, afterEnemies: () => void heard.after++ } });
    const state = arena(OPEN_ROOM, { x: 5.5, y: 5.5 }, [{ kind: 'dummy', x: 6.5, y: 5.5 }, { kind: 'dummy', x: 8.5, y: 5.5 }]);
    state.rules.enemies = { ...state.rules.enemies, dummy: { ...state.rules.enemies.dummy!, abilities: { listen: {} } } };
    const events = run(state, 10 / 60, [{ type: 'attack', enemyId: enemiesOf(state)[0]!.id }]);
    expect(heard.hurt).toBe(ofType(events, 'EnemyDamaged').length);
    expect(heard.hurt).toBeGreaterThan(0);
    expect(heard.after).toBe(10);
  });
});

describe('rooted enemies', () => {
  it('stay where they are, still turning and attacking, and move again once the root wears off', () => {
    const state = arena(OPEN_ROOM, { x: 5.5, y: 5.5 }, [{ kind: 'shooter', x: 7.5, y: 5.5 }]);
    const shooter = enemiesOf(state)[0]!;
    shooter.rootedFor = 3;
    const events = run(state, 2.9);
    expect([shooter.x, shooter.y]).toEqual([7.5, 5.5]);
    expect(ofType(events, 'ShotFired').length).toBeGreaterThan(0);
    run(state, 1);
    expect(shooter.x).toBeGreaterThan(7.6);
  });
});

describe('bosses', () => {
  it('is not knocked back by hits', () => {
    const state = arena(OPEN_ROOM, { x: 5.5, y: 5.5 }, [{ kind: 'lord', x: 6.5, y: 5.5 }]);
    const lord = enemiesOf(state)[0]!;
    lord.windUp = -1;
    lord.attackCooldown = 99;
    const before = lord.x;
    const events = run(state, 0.4, [{ type: 'attack', enemyId: lord.id }]);
    expect(ofType(events, 'EnemyDamaged').length).toBeGreaterThan(0);
    expect(lord.x).toBeLessThanOrEqual(before);
  });
});

describe('bodies', () => {
  it('push apart instead of overlapping', () => {
    const state = arena(OPEN_ROOM, { x: 5.5, y: 5.5 }, [{ kind: 'dummy', x: 5.6, y: 5.5 }]);
    run(state, 0.5);
    const dummy = enemiesOf(state)[0]!;
    expect(dist(state.hero.x, state.hero.y, dummy.x, dummy.y)).toBeGreaterThan(0.5);
  });
});
