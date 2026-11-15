import { dist, lerp } from '../core/math';
import { chance, int } from '../core/rng';
import { hasLineOfSight } from '../world/line-of-sight';
import { planRoute } from '../world/pathfinding';
import { tileIndex } from '../world/tile-map';
import { damageEnemy, findEnemy, nearestEnemy } from './combat';
import { updateInteraction, useService, walkToContainer, walkToNpc, walkToReadable } from './interaction';
import { placeAt } from './setup';
import type { ProjectileSkill } from './content';
import { currentLevel, type Command, type GameState, type SimEvent } from './state';
import { followPath, steerTowards, walkTo } from './walking';

/** While the ground is held, the hero re-targets this often. */
const HOLD_RETARGET_SECONDS = 0.14;
/** While chasing a target out of sight, the route is re-planned this often. */
const CHASE_REPATH_SECONDS = 0.3;
/** How far into a swing it strikes. */
const SWING_STRIKE_POINT = 0.5;
/** A projectile leaves from a little in front of the hero. */
const PROJECTILE_OFFSET = 0.3;
/** The look of a cast, as a short swing that doesn't strike. */
const CAST_SWING = 0.2;

export function applyCommand(state: GameState, command: Command, events: SimEvent[]): void {
  const { hero } = state;
  if (command.type === 'respawn') {
    if (hero.dead) respawn(state, events);
    return;
  }
  if (hero.dead) return;
  const { level } = currentLevel(state);
  if (command.type !== 'useSkill' && command.type !== 'heal' && command.type !== 'useService') hero.interact = null;
  switch (command.type) {
    case 'walk': {
      hero.targetId = null;
      const spot = walkTo(level.map, hero, command, (i) => isPortalTile(state, i));
      if (spot) events.push({ type: 'WalkTargetSet', x: spot.x, y: spot.y });
      state.holdTimer = 0;
      break;
    }
    case 'enterStructure': {
      const s = level.structures[command.index];
      if (!s) break;
      hero.targetId = null;
      const route = planRoute(level.map, hero, { x: s.door.tx + 0.5, y: s.door.ty + 0.3 });
      if (route) hero.path = route;
      events.push({ type: 'WalkTargetSet', x: s.door.tx + 0.5, y: s.door.ty + 1 });
      break;
    }
    case 'walkInto': {
      hero.targetId = null;
      const route = planRoute(level.map, hero, { x: command.tx + 0.5, y: command.ty + 0.6 });
      if (route) hero.path = route;
      break;
    }
    case 'attack': {
      const e = findEnemy(state, command.enemyId);
      if (!e) break;
      target(state, e.id);
      events.push({ type: 'TargetSet', enemyId: e.id, x: e.x, y: e.y });
      break;
    }
    case 'attackNearest': {
      const e = findEnemy(state, hero.targetId) ?? nearestEnemy(state, state.rules.hero.attackAssistRange);
      if (e) target(state, e.id);
      else if (hero.attackCooldown <= 0 && hero.swing < 0) {
        hero.targetId = null;
        startSwing(state, events);
        hero.struck = true;
      }
      break;
    }
    case 'useSkill':
      useSkill(state, command.slot, events);
      break;
    case 'heal':
      heal(state, events);
      break;
    case 'talk':
      walkToNpc(state, command.npcId);
      break;
    case 'open':
      walkToContainer(state, command.index);
      break;
    case 'read':
      walkToReadable(state, command.index);
      break;
    case 'useService':
      useService(state, command.npcId, command.service, events);
      break;
  }
}

function target(state: GameState, enemyId: number): void {
  const { hero } = state;
  hero.targetId = enemyId;
  hero.path = null;
  hero.repathTimer = 0;
}

function isPortalTile(state: GameState, index: number): boolean {
  const { level } = currentLevel(state);
  return level.portals.some((p) => tileIndex(level.map, p.tx, p.ty) === index);
}

function startSwing(state: GameState, events: SimEvent[]): void {
  const { hero } = state;
  hero.swing = 0;
  hero.struck = false;
  hero.attackCooldown = state.rules.hero.melee.cooldown;
  events.push({ type: 'Swung', actorId: hero.id });
}

function strike(state: GameState, events: SimEvent[]): void {
  const { hero } = state;
  const melee = state.rules.hero.melee;
  const e = findEnemy(state, hero.targetId);
  if (!e) return;
  const d = dist(hero.x, hero.y, e.x, e.y);
  if (d > melee.reach + e.r) return;
  const crit = chance(state.rng, melee.critChance);
  let damage = int(state.rng, hero.damage[0], hero.damage[1]) + hero.bonusDamage;
  if (crit) damage = Math.round(damage * melee.critMultiplier);
  const k = d || 1;
  damageEnemy(state, e, damage, crit, (e.x - hero.x) / k, (e.y - hero.y) / k, melee.knockback, events);
}

/** Uses the skill in a slot, if it's off cooldown and affordable. */
function useSkill(state: GameState, slot: number, events: SimEvent[]): void {
  const { hero } = state;
  const skill = state.rules.hero.skills[slot];
  if (!skill || (hero.skillCooldowns[slot] ?? 0) > 0) return;
  if (hero.resource < skill.cost) {
    events.push({ type: 'Refused', reason: 'noResource', x: hero.x, y: hero.y });
    return;
  }
  hero.resource -= skill.cost;
  hero.skillCooldowns[slot] = skill.cooldown;
  switch (skill.type) {
    case 'projectile':
      castProjectile(state, slot, skill);
      break;
  }
  events.push({ type: 'SkillUsed', slot, skill: skill.id });
}

function castProjectile(state: GameState, slot: number, skill: ProjectileSkill): void {
  const { hero } = state;
  const t = findEnemy(state, hero.targetId) ?? nearestEnemy(state, skill.autoAimRange);
  let dx = t ? t.x - hero.x : hero.facingX;
  let dy = t ? t.y - hero.y : hero.facingY;
  const d = Math.hypot(dx, dy) || 1;
  dx /= d;
  dy /= d;
  hero.facingX = dx;
  hero.facingY = dy;
  hero.swing = CAST_SWING;
  hero.struck = true;
  const x = hero.x + dx * PROJECTILE_OFFSET;
  const y = hero.y + dy * PROJECTILE_OFFSET;
  state.projectiles.push({
    kind: 'skill', slot, x, y, prevX: x, prevY: y, vx: dx * skill.speed, vy: dy * skill.speed, life: skill.lifetime, damage: 0,
  });
}

function heal(state: GameState, events: SimEvent[]): void {
  const { hero } = state;
  if (hero.healingItems <= 0) {
    events.push({ type: 'Refused', reason: 'noHealingItems', x: hero.x, y: hero.y });
    return;
  }
  if (hero.hp >= hero.maxHp) {
    events.push({ type: 'Refused', reason: 'fullHealth', x: hero.x, y: hero.y });
    return;
  }
  hero.healingItems--;
  const amount = Math.min(hero.maxHp - hero.hp, state.rules.hero.heal.amount);
  hero.hp += amount;
  events.push({ type: 'Healed', amount, x: hero.x, y: hero.y });
}

/**
 * Back to the start level with full health and resource, minus a share of gold. Enemies on the level where the
 * hero fell go home healed.
 */
function respawn(state: GameState, events: SimEvent[]): void {
  const { hero } = state;
  for (const e of currentLevel(state).enemies) {
    if (e.dead) continue;
    e.mode = 'return';
    e.hp = e.maxHp;
  }
  hero.dead = false;
  hero.hp = hero.maxHp;
  hero.resource = hero.maxResource;
  const goldLost = Math.floor(hero.gold * state.rules.hero.deathGoldLoss);
  hero.gold -= goldLost;
  state.levelId = state.startLevelId;
  const start = currentLevel(state).level.start;
  placeAt(hero, start.x, start.y);
  hero.path = null;
  hero.targetId = null;
  hero.interact = null;
  hero.moving = false;
  state.projectiles.length = 0;
  state.telegraphs.length = 0;
  state.portalCooldown = 0.7;
  events.push({ type: 'EnteredLevel', levelId: state.levelId });
  events.push({ type: 'HeroRespawned', goldLost });
}

/** Cooldowns, regeneration and the swing, which run whatever the hero is doing. */
export function updateHeroTimers(state: GameState, dt: number, events: SimEvent[]): void {
  const { hero } = state;
  const rules = state.rules.hero;
  hero.attackCooldown -= dt;
  for (let slot = 0; slot < hero.skillCooldowns.length; slot++) {
    hero.skillCooldowns[slot] = Math.max(0, hero.skillCooldowns[slot]! - dt);
  }
  if (!hero.dead) {
    hero.resource = Math.min(hero.maxResource, hero.resource + dt * rules.resourceRegen);
    if (state.time - hero.lastHurtAt > rules.healthRegenDelay) hero.hp = Math.min(hero.maxHp, hero.hp + dt * rules.healthRegen);
  }
  if (hero.swing >= 0) {
    hero.swing += dt / rules.melee.swingSeconds;
    if (!hero.struck && hero.swing >= SWING_STRIKE_POINT) {
      hero.struck = true;
      strike(state, events);
    }
    if (hero.swing >= 1) hero.swing = -1;
  }
}

/** Walking, or chasing and swinging at the target. */
export function updateHeroMovement(state: GameState, held: { x: number; y: number } | null, dt: number, events: SimEvent[]): void {
  const { hero } = state;
  if (hero.dead) return;
  const { map } = currentLevel(state).level;
  if (held && hero.targetId === null) {
    state.holdTimer -= dt;
    if (state.holdTimer <= 0) {
      state.holdTimer = HOLD_RETARGET_SECONDS;
      walkTo(map, hero, held, (i) => isPortalTile(state, i));
    }
  }
  if (hero.targetId === null) {
    followPath(map, hero, hero.speed, dt);
    updateInteraction(state, events);
    return;
  }
  const e = findEnemy(state, hero.targetId);
  if (!e) {
    hero.targetId = null;
    hero.moving = false;
    return;
  }
  const d = dist(hero.x, hero.y, e.x, e.y);
  if (d <= state.rules.hero.melee.engageRange + e.r) {
    hero.path = null;
    hero.moving = false;
    hero.facingX = lerp(hero.facingX, (e.x - hero.x) / d, 0.4);
    hero.facingY = lerp(hero.facingY, (e.y - hero.y) / d, 0.4);
    if (hero.attackCooldown <= 0 && hero.swing < 0) startSwing(state, events);
  } else if (hasLineOfSight(map, hero.x, hero.y, e.x, e.y, hero.r)) {
    hero.path = null;
    steerTowards(map, hero, e.x, e.y, hero.speed, dt);
  } else {
    hero.repathTimer -= dt;
    if (!hero.path || hero.repathTimer <= 0) {
      hero.path = planRoute(map, hero, e);
      hero.repathTimer = CHASE_REPATH_SECONDS;
    }
    followPath(map, hero, hero.speed, dt);
  }
}
