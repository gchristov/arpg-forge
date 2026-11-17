import { describe, expect, it } from 'vitest';
import { advanceQuest } from './interaction';
import { dropItem } from './loot';
import { currentLevel, type GameState, type SimEvent } from './state';
import { arena, ofType, OPEN_ROOM, run } from './testing';

function withNpc(state: GameState, kind: string, x: number, y: number): number {
  const ls = currentLevel(state);
  const id = state.nextId++;
  ls.npcs.push({ id, kind, name: kind, x, y, prevX: x, prevY: y, r: 0.32, facingX: 0, facingY: 1, moving: false, path: null, placement: 0 });
  return id;
}

describe('talking', () => {
  it('walks up to an NPC and talks once close, turning them to face the hero', () => {
    const state = arena(OPEN_ROOM, { x: 2.5, y: 2.5 });
    const id = withNpc(state, 'elder', 8.5, 8.5);
    const events = run(state, 4, [{ type: 'talk', npcId: id }]);
    const talked = ofType(events, 'Talked');
    expect(talked).toHaveLength(1);
    expect(talked[0]).toMatchObject({ npcId: id, kind: 'elder', questBefore: 0 });
    expect(Math.hypot(state.hero.x - 8.5, state.hero.y - 8.5)).toBeLessThan(1.45);
  });

  it('forgets the errand when the hero walks somewhere else', () => {
    const state = arena(OPEN_ROOM, { x: 2.5, y: 2.5 });
    const id = withNpc(state, 'elder', 15.5, 15.5);
    run(state, 0.2, [{ type: 'talk', npcId: id }]);
    const events = run(state, 6, [{ type: 'walk', x: 2.5, y: 10.5 }]);
    expect(ofType(events, 'Talked')).toHaveLength(0);
  });
});

describe('vendors', () => {
  function shop(gold: number) {
    const state = arena(OPEN_ROOM, { x: 2.5, y: 2.5 });
    state.rules.npcs = {
      innkeeper: { services: [{ type: 'restore' }, { type: 'sellHealingItem', price: 25 }] },
      smith: { services: [{ type: 'upgradeMelee', basePrice: 40, priceStep: 30, bonus: 3 }] },
    };
    state.hero.gold = gold;
    return { state, inn: withNpc(state, 'innkeeper', 4.5, 2.5), smith: withNpc(state, 'smith', 6.5, 2.5) };
  }

  it('restores health and resource for free', () => {
    const { state, inn } = shop(0);
    state.hero.hp = 10;
    state.hero.resource = 0;
    run(state, 1 / 60, [{ type: 'useService', npcId: inn, service: 0 }]);
    expect(state.hero).toMatchObject({ hp: 100, resource: 50, gold: 0 });
  });

  it('sells healing items for their price, and not without the gold', () => {
    const { state, inn } = shop(30);
    run(state, 1 / 60, [{ type: 'useService', npcId: inn, service: 1 }]);
    expect(state.hero).toMatchObject({ gold: 5, healingItems: 4 });
    const events = run(state, 1 / 60, [{ type: 'useService', npcId: inn, service: 1 }]);
    expect(ofType(events, 'ServiceUsed')).toHaveLength(0);
    expect(state.hero.healingItems).toBe(4);
  });

  it('upgrades melee, each time for 30 more than the last', () => {
    const { state, smith } = shop(40 + 70);
    run(state, 1 / 60, [{ type: 'useService', npcId: smith, service: 0 }]);
    run(state, 1 / 60, [{ type: 'useService', npcId: smith, service: 0 }]);
    expect(state.hero).toMatchObject({ gold: 0, bonusDamage: 6, meleeUpgrades: 2 });
  });
});

describe('readables', () => {
  it('walks up to something to read, then says what was read', () => {
    const state = arena(OPEN_ROOM, { x: 2.5, y: 2.5 });
    currentLevel(state).readables.push({ tx: 8, ty: 8, id: 'notice' });
    const events = run(state, 5, [{ type: 'read', index: 0 }]);
    expect(ofType(events, 'Read')).toEqual([{ type: 'Read', id: 'notice', x: 8.5, y: 8.5 }]);
  });
});

describe('containers, drops and pickups', () => {
  it('opens a container once, spilling its gold and healing items to pick up', () => {
    const state = arena(OPEN_ROOM, { x: 2.5, y: 2.5 });
    currentLevel(state).containers.push({ tx: 8, ty: 8, gold: 45, healingItems: 2, opened: false });
    let events = run(state, 5, [{ type: 'open', index: 0 }]);
    expect(ofType(events, 'ContainerOpened')).toHaveLength(1);
    run(state, 0.5);
    for (const item of [...currentLevel(state).items]) run(state, 1.5, [{ type: 'walk', x: item.x, y: item.y }]);
    expect(state.hero.gold).toBe(45);
    expect(state.hero.healingItems).toBe(5);
    events = run(state, 1, [{ type: 'open', index: 0 }]);
    expect(ofType(events, 'ContainerOpened')).toHaveLength(0);
  });

  it('drops gold in the enemy type’s range on a kill', () => {
    const state = arena(OPEN_ROOM, { x: 5.5, y: 5.5 }, [{ kind: 'dummy', x: 6.3, y: 5.5 }]);
    const dummy = currentLevel(state).enemies[0]!;
    dummy.hp = 1;
    run(state, 0.5, [{ type: 'attack', enemyId: dummy.id }]);
    const gold = currentLevel(state).items.filter((i) => i.kind === 'gold');
    const picked = state.hero.gold;
    const total = picked + gold.reduce((s, i) => s + i.amount, 0);
    expect(total).toBeGreaterThanOrEqual(3);
    expect(total).toBeLessThanOrEqual(9);
  });

  it('leaves healing items on the ground when the hero carries the maximum', () => {
    const state = arena(OPEN_ROOM, { x: 5.5, y: 5.5 });
    state.hero.healingItems = 9;
    dropItem(state, currentLevel(state), 5.5, 5.5, 'healingItem', 1);
    run(state, 1);
    expect(state.hero.healingItems).toBe(9);
    expect(currentLevel(state).items).toHaveLength(1);
  });
});

describe('quest', () => {
  it('moves to a step when its trigger fires and the quest is behind it, never back', () => {
    const state = arena(OPEN_ROOM, { x: 2.5, y: 2.5 });
    state.rules.quest = [
      {},
      { reachedBy: { type: 'talk', npcKind: 'elder' } },
      { reachedBy: { type: 'enter', levelId: 'crypt' } },
      { reachedBy: { type: 'kill', enemyKind: 'lord' } },
    ];
    const events: SimEvent[] = [];
    advanceQuest(state, { type: 'enter', levelId: 'crypt' }, events);
    expect(state.quest).toBe(2);
    advanceQuest(state, { type: 'talk', npcKind: 'elder' }, events);
    expect(state.quest).toBe(2);
    advanceQuest(state, { type: 'kill', enemyKind: 'lord' }, events);
    advanceQuest(state, { type: 'enter', levelId: 'crypt' }, events);
    expect(state.quest).toBe(3);
    expect(ofType(events, 'QuestAdvanced').map((e) => e.step)).toEqual([2, 3]);
  });

  it('moves on by only one step for talking, so someone met twice never skips what lies between', () => {
    const state = arena(OPEN_ROOM, { x: 2.5, y: 2.5 });
    state.rules.quest = [
      {},
      { reachedBy: { type: 'talk', npcKind: 'elder' } },
      { reachedBy: { type: 'kill', enemyKind: 'lord' } },
      { reachedBy: { type: 'talk', npcKind: 'elder' } },
    ];
    const events: SimEvent[] = [];
    advanceQuest(state, { type: 'talk', npcKind: 'elder' }, events);
    advanceQuest(state, { type: 'talk', npcKind: 'elder' }, events);
    expect(state.quest).toBe(1);
    advanceQuest(state, { type: 'kill', enemyKind: 'lord' }, events);
    advanceQuest(state, { type: 'talk', npcKind: 'elder' }, events);
    expect(state.quest).toBe(3);
  });

  it('never skips to a step kept in order, such as coming home, however early its trigger is met', () => {
    const state = arena(OPEN_ROOM, { x: 2.5, y: 2.5 });
    state.rules.quest = [
      {},
      { reachedBy: { type: 'kill', enemyKind: 'lord' } },
      { reachedBy: { type: 'enter', levelId: 'home' }, inOrder: true },
    ];
    const events: SimEvent[] = [];
    advanceQuest(state, { type: 'enter', levelId: 'home' }, events);
    expect(state.quest).toBe(0);
    advanceQuest(state, { type: 'kill', enemyKind: 'lord' }, events);
    advanceQuest(state, { type: 'enter', levelId: 'home' }, events);
    expect(state.quest).toBe(2);
  });
});

describe('quest steps that calm everything', () => {
  it('end every alarm and send calm enemies back to work', () => {
    const state = arena(OPEN_ROOM, { x: 5.5, y: 5.5 }, [{ kind: 'worker', x: 6.5, y: 5.5 }, { kind: 'worker', x: 9.5, y: 5.5 }]);
    state.rules.quest = [{}, { reachedBy: { type: 'kill', enemyKind: 'worker' }, calmsEverything: true }];
    const [first, second] = currentLevel(state).enemies;
    first!.hp = 1;
    run(state, 1, [{ type: 'attack', enemyId: first!.id }]);
    expect(state.quest).toBe(1);
    expect(currentLevel(state).alarmed).toBe(false);
    expect(second!.mode).toBe('idle');
    const events = run(state, 3);
    expect(ofType(events, 'HeroHurt')).toHaveLength(0);
  });
});
