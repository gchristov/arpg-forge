import { describe, expect, it } from 'vitest';
import { gainXp } from './combat';
import type { AreaSkill, ProjectileSkill, Skill } from './content';
import { currentLevel, type GameState, type SimEvent } from './state';
import { arena, ofType, OPEN_ROOM, run, TEST_HERO } from './testing';

const enemiesOf = (state: ReturnType<typeof arena>) => currentLevel(state).enemies;

/** The test hero's projectile skill, to base others on. */
const BOLT = TEST_HERO.skills[0] as ProjectileSkill;

/** Gives the hero another skill, without touching the shared test rules. */
function withExtraSkill(state: GameState, skill: Skill): void {
  const { hero } = state.rules;
  state.rules.hero = { ...hero, skills: [...hero.skills, skill] };
  state.hero.skillCooldowns.push(0);
}

describe('hero melee', () => {
  it('chases and kills a targeted enemy, with damage in range, and gains its XP', () => {
    const state = arena(OPEN_ROOM, { x: 5.5, y: 5.5 }, [{ kind: 'dummy', x: 9.5, y: 5.5 }]);
    const dummy = enemiesOf(state)[0]!;
    dummy.hp = dummy.maxHp = 40;
    const events = run(state, 6, [{ type: 'attack', enemyId: dummy.id }]);
    const hits = ofType(events, 'EnemyDamaged');
    expect(hits.length).toBeGreaterThanOrEqual(2);
    for (const h of hits) {
      if (h.crit) expect(h.amount).toBeLessThanOrEqual(Math.round(13 * 1.8));
      else expect(h.amount).toBeGreaterThanOrEqual(8), expect(h.amount).toBeLessThanOrEqual(13);
    }
    expect(ofType(events, 'EnemyKilled')).toHaveLength(1);
    expect(dummy.dead).toBe(true);
  });

  it('swings no more often than its cooldown', () => {
    const state = arena(OPEN_ROOM, { x: 5.5, y: 5.5 }, [{ kind: 'dummy', x: 6.3, y: 5.5 }]);
    const events = run(state, 5.5, [{ type: 'attack', enemyId: enemiesOf(state)[0]!.id }]);
    expect(ofType(events, 'Swung').length).toBeLessThanOrEqual(Math.ceil(5.5 / 0.55) + 1);
    expect(ofType(events, 'Swung').length).toBeGreaterThanOrEqual(9);
  });

  it('attacks the nearest visible enemy on the attack command', () => {
    const state = arena(OPEN_ROOM, { x: 5.5, y: 5.5 }, [
      { kind: 'dummy', x: 9.5, y: 5.5 },
      { kind: 'dummy', x: 7.5, y: 5.5 },
    ]);
    run(state, 0.1, [{ type: 'attackNearest' }]);
    expect(state.hero.targetId).toBe(enemiesOf(state)[1]!.id);
  });

  it('swings at nothing when no enemy is near', () => {
    const state = arena(OPEN_ROOM, { x: 5.5, y: 5.5 });
    expect(ofType(run(state, 0.1, [{ type: 'attackNearest' }]), 'Swung')).toHaveLength(1);
  });
});

describe('area skill', () => {
  const PULSE: AreaSkill = {
    type: 'area', id: 'pulse', cost: 20, cooldown: 5, radius: 2.5, damage: [20, 20], damagePerLevel: 0,
    critChance: 0, critMultiplier: 1, knockback: 0.6,
  };

  it('bursts around the hero, hurting and throwing back everything in reach and nothing beyond', () => {
    const state = arena(OPEN_ROOM, { x: 8.5, y: 8.5 }, [
      { kind: 'dummy', x: 10, y: 8.5 },
      { kind: 'dummy', x: 7.5, y: 9.5 },
      { kind: 'dummy', x: 14.5, y: 8.5 },
    ]);
    withExtraSkill(state, PULSE);
    const [right, left, far] = enemiesOf(state);
    const events = run(state, 1 / 60, [{ type: 'useSkill', slot: 1 }]);
    expect(ofType(events, 'Exploded')).toEqual([{ type: 'Exploded', x: 8.5, y: 8.5, radius: 2.5 }]);
    expect(new Set(ofType(events, 'EnemyDamaged').map((h) => h.enemyId))).toEqual(new Set([right!.id, left!.id]));
    expect(right!.x).toBeGreaterThan(10);
    expect(left!.x).toBeLessThan(7.5);
    expect(far!.hp).toBe(far!.maxHp);
    expect(state.hero.resource).toBe(30);
    expect(state.hero.skillCooldowns[1]).toBe(5);
  });

  it('with an arc, hits only what is in front of the hero, aimed at the nearest enemy, and reports no explosion', () => {
    const state = arena(OPEN_ROOM, { x: 8.5, y: 8.5 }, [
      { kind: 'dummy', x: 10, y: 8.5 },
      { kind: 'dummy', x: 7, y: 8.5 },
    ]);
    withExtraSkill(state, { ...PULSE, arc: 45 });
    const [ahead, behind] = enemiesOf(state);
    const events = run(state, 1 / 60, [{ type: 'useSkill', slot: 1 }]);
    expect(ofType(events, 'Exploded')).toEqual([]);
    expect(ofType(events, 'EnemyDamaged').map((h) => h.enemyId)).toEqual([ahead!.id]);
    expect(behind!.hp).toBe(behind!.maxHp);
    expect(state.hero.facingX).toBeCloseTo(1);
  });

  it('stuns what it hits for its stun, which then neither moves nor attacks until it wears off', () => {
    const state = arena(OPEN_ROOM, { x: 8.5, y: 8.5 }, [{ kind: 'brute', x: 9.6, y: 8.5 }]);
    withExtraSkill(state, { ...PULSE, knockback: 0, damage: [1, 1], stun: 1 });
    const brute = enemiesOf(state)[0]!;
    run(state, 1 / 60, [{ type: 'useSkill', slot: 1 }]);
    const at = brute.x;
    expect(ofType(run(state, 0.95), 'HeroHurt')).toEqual([]);
    expect(brute.x).toBe(at);
    expect(ofType(run(state, 3), 'HeroHurt').length).toBeGreaterThan(0);
  });

  it('never stuns a boss', () => {
    const state = arena(OPEN_ROOM, { x: 8.5, y: 8.5 }, [{ kind: 'lord', x: 10, y: 8.5 }]);
    withExtraSkill(state, { ...PULSE, stun: 1 });
    run(state, 1 / 60, [{ type: 'useSkill', slot: 1 }]);
    expect(enemiesOf(state)[0]!.stunnedFor).toBe(0);
  });
});

describe('starting weapon', () => {
  it('puts the weapon in the hero\'s hand from the start', () => {
    expect(arena(OPEN_ROOM, { x: 5.5, y: 5.5 }).hero.weapon).toBeNull();
    const hero = { ...TEST_HERO, startingWeapon: 'stick', weapons: { stick: { reach: 2 } } };
    expect(arena(OPEN_ROOM, { x: 5.5, y: 5.5 }, [], 1, hero).hero.weapon).toBe('stick');
  });
});

describe('projectile skill', () => {
  it('costs resource, flies, explodes and hurts every enemy in the radius', () => {
    const state = arena(OPEN_ROOM, { x: 3.5, y: 5.5 }, [
      { kind: 'dummy', x: 8.5, y: 5.5 },
      { kind: 'dummy', x: 8.5, y: 6.6 },
      { kind: 'dummy', x: 14.5, y: 5.5 },
    ]);
    const events = run(state, 1.5, [{ type: 'useSkill', slot: 0 }]);
    expect(state.hero.resource).toBeLessThan(50);
    expect(ofType(events, 'Exploded')).toHaveLength(1);
    const hurt = new Set(ofType(events, 'EnemyDamaged').map((h) => h.enemyId));
    const [a, b, far] = enemiesOf(state);
    expect(hurt).toEqual(new Set([a!.id, b!.id]));
    expect(far!.hp).toBe(far!.maxHp);
    for (const h of ofType(events, 'EnemyDamaged')) expect(h.amount).toBeGreaterThanOrEqual(25);
  });

  it('explodes with its own numbers when the hero has several', () => {
    const state = arena(OPEN_ROOM, { x: 3.5, y: 5.5 }, [{ kind: 'dummy', x: 8.5, y: 5.5 }, { kind: 'dummy', x: 8.5, y: 8 }]);
    withExtraSkill(state, { ...BOLT, id: 'wide', radius: 3.2 });
    const events = run(state, 1.5, [{ type: 'useSkill', slot: 1 }]);
    expect(ofType(events, 'SkillUsed')).toEqual([{ type: 'SkillUsed', slot: 1, skill: 'wide' }]);
    expect(ofType(events, 'Exploded')[0]?.radius).toBe(3.2);
    expect(new Set(ofType(events, 'EnemyDamaged').map((h) => h.enemyId)).size).toBe(2);
  });

  it('keeps a cooldown per skill', () => {
    const state = arena(OPEN_ROOM, { x: 3.5, y: 5.5 });
    withExtraSkill(state, { ...BOLT, id: 'other' });
    const events = run(state, 0.1, [{ type: 'useSkill', slot: 0 }, { type: 'useSkill', slot: 0 }, { type: 'useSkill', slot: 1 }]);
    expect(ofType(events, 'SkillUsed').map((e) => e.slot)).toEqual([0, 1]);
    expect(state.hero.skillCooldowns[0]).toBeGreaterThan(0);
  });

  it('ignores a slot with no skill', () => {
    const state = arena(OPEN_ROOM, { x: 3.5, y: 5.5 });
    const events = run(state, 0.1, [{ type: 'useSkill', slot: 4 }]);
    expect(events).toEqual([]);
    expect(state.hero.resource).toBe(50);
  });

  it('is refused without enough resource', () => {
    const state = arena(OPEN_ROOM, { x: 3.5, y: 5.5 });
    state.hero.resource = 5;
    const events = run(state, 0.1, [{ type: 'useSkill', slot: 0 }]);
    expect(ofType(events, 'Refused')[0]?.reason).toBe('noResource');
    expect(state.projectiles).toHaveLength(0);
  });
});

describe('healing', () => {
  it('heals up to its amount, without going over maximum, and uses an item', () => {
    const state = arena(OPEN_ROOM, { x: 3.5, y: 5.5 });
    state.hero.hp = 70;
    state.hero.lastHurtAt = 0;
    const events = run(state, 1 / 60, [{ type: 'heal' }]);
    expect(ofType(events, 'Healed')[0]?.amount).toBe(30);
    expect(state.hero.hp).toBe(100);
    expect(state.hero.healingItems).toBe(2);
  });

  it('is refused at full health or with no items', () => {
    const state = arena(OPEN_ROOM, { x: 3.5, y: 5.5 });
    expect(ofType(run(state, 1 / 60, [{ type: 'heal' }]), 'Refused')[0]?.reason).toBe('fullHealth');
    state.hero.hp = 50;
    state.hero.healingItems = 0;
    expect(ofType(run(state, 1 / 60, [{ type: 'heal' }]), 'Refused')[0]?.reason).toBe('noHealingItems');
  });
});

describe('levelling and regeneration', () => {
  it('levels up on the XP curve, possibly several times at once', () => {
    const state = arena(OPEN_ROOM, { x: 3.5, y: 5.5 });
    const events: SimEvent[] = [];
    gainXp(state, 60, events);
    expect(state.hero).toMatchObject({ level: 2, xp: 0, xpNext: 90, maxHp: 112, maxResource: 56, damage: [10, 16] });
    gainXp(state, 90 + 135 + 10, events);
    expect(state.hero.level).toBe(4);
    expect(state.hero.xp).toBe(10);
    expect(ofType(events, 'LevelUp').map((e) => e.level)).toEqual([2, 3, 4]);
  });

  it('regains resource steadily and health only after a while unhurt', () => {
    const state = arena(OPEN_ROOM, { x: 3.5, y: 5.5 });
    state.hero.resource = 0;
    state.hero.hp = 50;
    state.hero.lastHurtAt = 0;
    run(state, 4);
    expect(state.hero.resource).toBeCloseTo(4 * TEST_HERO.resourceRegen, 1);
    expect(state.hero.hp).toBe(50);
    run(state, 3);
    expect(state.hero.hp).toBeGreaterThan(50);
  });
});

describe('death and respawn', () => {
  it('dies at zero health, ignores commands, and respawns at the start with half the gold', () => {
    const state = arena(OPEN_ROOM, { x: 3.5, y: 5.5 }, [{ kind: 'brute', x: 7.5, y: 5.5 }]);
    state.hero.gold = 51;
    state.hero.hp = 1;
    const brute = enemiesOf(state)[0]!;
    const events = run(state, 6);
    expect(ofType(events, 'HeroDied')).toHaveLength(1);
    expect(state.hero.dead).toBe(true);
    run(state, 0.1, [{ type: 'walk', x: 10, y: 10 }]);
    expect(state.hero.path).toBeNull();

    const respawn = run(state, 1 / 60, [{ type: 'respawn' }]);
    expect(ofType(respawn, 'HeroRespawned')[0]?.goldLost).toBe(25);
    expect(state.hero).toMatchObject({ dead: false, hp: 100, gold: 26, x: 1.5, y: 1.5 });
    expect(state.levelId).toBe('home');
    expect(brute.mode).toBe('return');
    expect(brute.hp).toBe(brute.maxHp);
  });

  it('gets back up at the start of the level it fell in, for games that ask', () => {
    const state = arena(OPEN_ROOM, { x: 3.5, y: 5.5 }, [{ kind: 'brute', x: 7.5, y: 5.5 }]);
    state.rules = { ...state.rules, hero: { ...state.rules.hero, respawnAt: 'sameLevel' } };
    state.hero.hp = 1;
    run(state, 6);
    expect(state.hero.dead).toBe(true);
    run(state, 1 / 60, [{ type: 'respawn' }]);
    expect(state.levelId).toBe('testRoom');
    expect(state.hero).toMatchObject({ dead: false, x: 3.5, y: 5.5 });
  });
});
