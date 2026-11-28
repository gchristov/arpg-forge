import { dist } from '../core/math';
import { planRoute } from '../world/pathfinding';
import type { QuestTrigger, Service } from './content';
import { dropItem } from './loot';
import { currentLevel, type GameState, type Hero, type SimEvent } from './state';
import { doStepActions } from './step-actions';
import { castForStep } from './story-cast';
import { travel } from './travel';

/** The hero talks or opens once this close. */
const INTERACT_REACH = 1.45;

/** Walks up to an NPC: in front of them if possible, otherwise beside them. */
export function walkToNpc(state: GameState, npcId: number): void {
  const { hero } = state;
  const { level, npcs } = currentLevel(state);
  const n = npcs.find((candidate) => candidate.id === npcId);
  if (!n) return;
  hero.targetId = null;
  hero.interact = { type: 'npc', npcId };
  hero.path = planRoute(level.map, hero, { x: n.x, y: n.y + 0.9 }) ?? planRoute(level.map, hero, { x: n.x + 0.9, y: n.y });
}

/** Walks up to a container, approaching from the tile in front of it. */
export function walkToContainer(state: GameState, index: number): void {
  const { hero } = state;
  const ls = currentLevel(state);
  const c = ls.containers[index];
  if (!c || c.opened) return;
  hero.targetId = null;
  hero.interact = { type: 'container', index };
  hero.path = planRoute(ls.level.map, hero, { x: c.tx + 0.5, y: c.ty + 1.5 });
}

/** Walks up to something to read, approaching from the tile in front of it like a container. */
export function walkToReadable(state: GameState, index: number): void {
  const { hero } = state;
  const ls = currentLevel(state);
  const r = ls.readables[index];
  if (!r) return;
  hero.targetId = null;
  hero.interact = { type: 'readable', index };
  hero.path = planRoute(ls.level.map, hero, { x: r.tx + 0.5, y: r.ty + 1.5 });
}

/** Talks, opens or reads once close enough; gives up if the way there was lost. */
export function updateInteraction(state: GameState, events: SimEvent[]): void {
  const { hero } = state;
  const it = hero.interact;
  if (!it) return;
  const ls = currentLevel(state);
  const npc = it.type === 'npc' ? ls.npcs.find((n) => n.id === it.npcId) : undefined;
  const thing = it.type === 'container' ? ls.containers[it.index] : it.type === 'readable' ? ls.readables[it.index] : undefined;
  const tx = npc ? npc.x : thing ? thing.tx + 0.5 : NaN;
  const ty = npc ? npc.y : thing ? thing.ty + 0.5 : NaN;
  if (Number.isNaN(tx)) {
    hero.interact = null;
    return;
  }
  if (dist(hero.x, hero.y, tx, ty) < INTERACT_REACH) {
    hero.path = null;
    hero.moving = false;
    hero.interact = null;
    if (npc) {
      npc.facingX = hero.x - npc.x;
      npc.facingY = hero.y - npc.y;
      const questBefore = state.quest;
      advanceQuest(state, { type: 'talk', npcKind: npc.kind }, events);
      events.push({ type: 'Talked', npcId: npc.id, kind: npc.kind, name: npc.name, questBefore });
    } else if (it.type === 'container') openContainer(state, it.index, events);
    else if (it.type === 'readable') {
      const { id } = ls.readables[it.index]!;
      advanceQuest(state, { type: 'use', id }, events);
      events.push({ type: 'Read', id, x: tx, y: ty });
    }
  } else if (!hero.path) hero.interact = null;
}

function openContainer(state: GameState, index: number, events: SimEvent[]): void {
  const ls = currentLevel(state);
  const c = ls.containers[index]!;
  if (c.opened) return;
  c.opened = true;
  const x = c.tx + 0.5;
  const y = c.ty + 0.5;
  if (c.gold) dropItem(state, ls, x, y + 0.6, 'gold', c.gold);
  for (let i = 0; i < c.healingItems; i++) dropItem(state, ls, x, y + 0.6, 'healingItem', 1);
  if (c.weapon) dropItem(state, ls, x, y + 0.6, 'weapon', 1, c.weapon);
  events.push({ type: 'ContainerOpened', index, x, y });
}

/** The price of a service right now, or 0 if it's free. */
export function servicePrice(hero: Hero, service: Service): number {
  switch (service.type) {
    case 'restore':
      return 0;
    case 'sellHealingItem':
      return service.price;
    case 'upgradeMelee':
      return service.basePrice + hero.meleeUpgrades * service.priceStep;
  }
}

export function useService(state: GameState, npcId: number, index: number, events: SimEvent[]): void {
  const { hero } = state;
  const npc = currentLevel(state).npcs.find((n) => n.id === npcId);
  const service = npc && state.rules.npcs[npc.kind]?.services[index];
  if (!service || hero.dead) return;
  const price = servicePrice(hero, service);
  if (hero.gold < price) return;
  hero.gold -= price;
  switch (service.type) {
    case 'restore':
      hero.hp = hero.maxHp;
      hero.resource = hero.maxResource;
      break;
    case 'sellHealingItem':
      hero.healingItems++;
      break;
    case 'upgradeMelee':
      hero.bonusDamage += service.bonus;
      hero.meleeUpgrades++;
      break;
  }
  events.push({ type: 'ServiceUsed', npcId, service: index, x: hero.x, y: hero.y });
}

/** A reply chosen in a conversation with an NPC on the current level, which can move the quest on. */
export function reply(state: GameState, npcId: number, id: string, events: SimEvent[]): void {
  const npc = currentLevel(state).npcs.find((n) => n.id === npcId);
  if (npc && !state.hero.dead) advanceQuest(state, { type: 'reply', npcKind: npc.kind, id }, events);
}

/** Moves the quest to the step this trigger reaches, if the quest is behind it. */
export function advanceQuest(state: GameState, trigger: QuestTrigger, events: SimEvent[]): void {
  const steps = state.rules.quest;
  for (let step = state.quest + 1; step < steps.length; step++) {
    const t = steps[step]!.reachedBy;
    // Entering a place or killing something can skip ahead, but talking and replying only move on by one step, so
    // someone met twice never skips what lies between.
    if ((t?.type === 'talk' || t?.type === 'reply' || steps[step]!.inOrder) && step > state.quest + 1) continue;
    if (t && sameTrigger(t, trigger)) {
      state.quest = step;
      const reached = steps[step]!;
      doStepActions(state, reached, events);
      castForStep(state);
      events.push({ type: 'QuestAdvanced', step });
      if (reached.takesHeroTo) travel(state, reached.takesHeroTo.levelId, reached.takesHeroTo.x, reached.takesHeroTo.y, events);
      return;
    }
  }
}

function sameTrigger(a: QuestTrigger, b: QuestTrigger): boolean {
  switch (a.type) {
    case 'talk':
      return b.type === 'talk' && a.npcKind === b.npcKind;
    case 'enter':
      return b.type === 'enter' && a.levelId === b.levelId;
    case 'kill':
      return b.type === 'kill' && a.enemyKind === b.enemyKind;
    case 'reply':
      return b.type === 'reply' && a.npcKind === b.npcKind && a.id === b.id;
    case 'defeat':
      return b.type === 'defeat' && a.tag === b.tag;
    case 'use':
      return b.type === 'use' && a.id === b.id;
    case 'arm':
      return b.type === 'arm' && a.weapon === b.weapon;
  }
}
