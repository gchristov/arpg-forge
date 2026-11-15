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

describe('boss abilities', () => {
  it('slams a circle under the hero that hurts if they stay in it', () => {
    const state = arena(OPEN_ROOM, { x: 5.5, y: 5.5 }, [{ kind: 'lord', x: 10.5, y: 5.5 }]);
    const lord = enemiesOf(state)[0]!;
    lord.slamTimer = 0;
    state.hero.hp = state.hero.maxHp = 1000;
    expect(ofType(run(state, 0.1), 'SlamWarned')).toHaveLength(1);
    const events = run(state, 1.0);
    const landed = events.findIndex((e) => e.type === 'SlamLanded');
    expect(landed).toBeGreaterThanOrEqual(0);
    const hurt = events[landed + 1];
    expect(hurt?.type).toBe('HeroHurt');
    if (hurt?.type === 'HeroHurt') expect(hurt.amount).toBeGreaterThanOrEqual(16), expect(hurt.amount).toBeLessThanOrEqual(24);
  });

  it('dodging the circle avoids the slam', () => {
    const state = arena(OPEN_ROOM, { x: 5.5, y: 5.5 }, [{ kind: 'lord', x: 10.5, y: 5.5 }]);
    const lord = enemiesOf(state)[0]!;
    lord.slamTimer = 0;
    lord.mode = 'chase';
    run(state, 1 / 60);
    expect(state.telegraphs).toHaveLength(1);
    state.hero.x = state.hero.prevX = 5.5;
    state.hero.y = state.hero.prevY = 12.5;
    const events = run(state, 1.1);
    expect(ofType(events, 'SlamLanded')).toHaveLength(1);
    expect(ofType(events, 'HeroHurt').filter((h) => h.amount >= 16)).toHaveLength(0);
  });

  it('summons three chasing helpers once, below half health', () => {
    const state = arena(OPEN_ROOM, { x: 5.5, y: 5.5 }, [{ kind: 'lord', x: 10.5, y: 5.5 }]);
    const lord = enemiesOf(state)[0]!;
    lord.mode = 'chase';
    lord.hp = 150;
    const events = run(state, 0.5);
    const summoned = ofType(events, 'Summoned');
    expect(summoned).toHaveLength(1);
    expect(summoned[0]!.summonedIds).toHaveLength(3);
    const helpers = enemiesOf(state).filter((e) => e.kind === 'brute');
    expect(helpers.every((h) => h.mode === 'chase')).toBe(true);
    run(state, 0.5);
    expect(enemiesOf(state).filter((e) => e.kind === 'brute')).toHaveLength(3);
  });

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

describe('calm enemies', () => {
  it('go about their work beside the hero, recognising them once', () => {
    const state = arena(OPEN_ROOM, { x: 5.5, y: 5.5 }, [{ kind: 'worker', x: 7.5, y: 5.5 }]);
    const events = run(state, 5);
    expect(ofType(events, 'EnemyRecognised')).toHaveLength(1);
    expect(ofType(events, 'HeroHurt')).toHaveLength(0);
    expect(enemiesOf(state)[0]!.mode).toBe('idle');
  });

  it('turn on the hero together once one of them is hit, near ones at once', () => {
    const state = arena(Array.from({ length: 6 }, () => '.'.repeat(40)), { x: 3.5, y: 2.5 }, [
      { kind: 'worker', x: 4.5, y: 2.5 }, { kind: 'worker', x: 9.5, y: 2.5 }, { kind: 'worker', x: 36.5, y: 2.5 },
    ]);
    const [struck, near, far] = enemiesOf(state);
    const events = run(state, 0.5, [{ type: 'attack', enemyId: struck!.id }]);
    expect(ofType(events, 'LevelAlarmed')).toHaveLength(1);
    expect(currentLevel(state).alarmed).toBe(true);
    expect([struck!.mode, near!.mode, far!.mode]).toEqual(['chase', 'chase', 'idle']);
    state.hero.x = state.hero.prevX = 33.5;
    run(state, 0.5);
    expect(far!.mode).toBe('chase');
  });

  it('leave other enemies as they were, without alarming the level', () => {
    const state = arena(OPEN_ROOM, { x: 5.5, y: 5.5 }, [{ kind: 'dummy', x: 6.5, y: 5.5 }]);
    const events = run(state, 0.5, [{ type: 'attack', enemyId: enemiesOf(state)[0]!.id }]);
    expect(ofType(events, 'EnemyDamaged').length).toBeGreaterThan(0);
    expect(ofType(events, 'LevelAlarmed')).toHaveLength(0);
  });
});
