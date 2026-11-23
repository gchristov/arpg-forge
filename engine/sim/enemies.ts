import { dist, lerp } from '../core/math';
import { int, pick, range } from '../core/rng';
import { isBlocked } from '../world/collision';
import { hasLineOfSight } from '../world/line-of-sight';
import { planRoute } from '../world/pathfinding';
import { afterEnemiesWithAbilities, fightWithAbilities, idleWithAbilities } from './abilities';
import type { EnemyType } from './content';
import { hurtHero } from './combat';
import { enemyDamage } from './enemy-strength';
import { slide } from './knockback';
import { spawnCamp } from './spawning';
import { currentLevel, type Enemy, type GameState, type LevelState, type SimEvent } from './state';
import { followPath, steerTowards } from './walking';

const WANDER_RADIUS = 2.5;
const WANDER_SPEED_SHARE = 0.35;
/** Chasers give up beyond this multiple of their aggro range. */
const GIVE_UP_AGGRO_MULTIPLE = 2.4;
/** Non-boss enemies give up when lured this far from home. */
const LEASH = 16;
/** Returning enemies heal this share of their health a second, and chase again if they see the hero this close. */
const RETURN_HEAL_SHARE = 0.25;
const RETURN_REAGGRO_SHARE = 0.7;
const RETURN_REPATH_SECONDS = 1.5;
const CHASE_REPATH_SECONDS = 0.6;
/** Ranged enemies back away when the hero is closer than this. */
const KITE_DISTANCE = 2.4;
const KITE_SPEED_SHARE = 0.8;
/** A melee strike still lands if the hero moved this little out of range during the wind-up. */
const MELEE_GRACE = 0.35;
const SHOT_SPEED = 8;
const SHOT_LIFETIME = 1.2;
const SHOT_OFFSET = 0.3;
const SWING_SECONDS = 0.22;
const COOLDOWN_VARIATION = 0.15;
/** The dead are removed once their fade is over. */
const CORPSE_SECONDS = 1;

export function updateEnemies(state: GameState, dt: number, events: SimEvent[]): void {
  const ls = currentLevel(state);
  for (const e of ls.enemies) updateEnemy(state, ls, e, dt, events);
  afterEnemiesWithAbilities(state, ls, events);
  for (let k = ls.enemies.length - 1; k >= 0; k--) {
    const e = ls.enemies[k]!;
    if (e.dead && e.deadFor > CORPSE_SECONDS) ls.enemies.splice(k, 1);
  }
}

function updateEnemy(state: GameState, ls: LevelState, e: Enemy, dt: number, events: SimEvent[]): void {
  if (e.dead) {
    e.deadFor += dt;
    return;
  }
  const type = state.rules.enemies[e.kind]!;
  const { hero } = state;
  const { map } = ls.level;
  e.attackCooldown -= dt;
  slide(map, e, dt);
  if (e.swing >= 0) {
    e.swing += dt / SWING_SECONDS;
    if (e.swing >= 1) e.swing = -1;
  }
  if (e.stunnedFor > 0) {
    e.stunnedFor = Math.max(0, e.stunnedFor - dt);
    e.windUp = -1;
    e.moving = false;
    return;
  }
  // Rooted, it can't move of its own accord, though it still turns, attacks and can be knocked back.
  const rooted = e.rootedFor > 0;
  e.rootedFor = Math.max(0, e.rootedFor - dt);
  const d = dist(e.x, e.y, hero.x, hero.y);
  const sees = !hero.dead && d < type.aggro && hasLineOfSight(map, e.x, e.y, hero.x, hero.y);
  e.moving = false;

  if (e.mode === 'idle') {
    const choice = idleWithAbilities(state, ls, e, type, d, sees, dt, events);
    if (choice === 'busy') return;
    if (sees && choice === 'asUsual') {
      e.mode = 'chase';
      events.push({ type: 'EnemyAlerted', enemyId: e.id, boss: Boolean(type.boss) });
      return;
    }
    e.wanderTimer -= dt;
    if (e.wanderTimer <= 0) {
      e.wanderTimer = range(state.rng, 2.5, 6);
      const wx = e.homeX + range(state.rng, -WANDER_RADIUS, WANDER_RADIUS);
      const wy = e.homeY + range(state.rng, -WANDER_RADIUS, WANDER_RADIUS);
      if (!isBlocked(map, wx, wy, e.r) && hasLineOfSight(map, e.x, e.y, wx, wy, e.r)) {
        e.wanderX = wx;
        e.wanderY = wy;
      }
    }
    if (!rooted && dist(e.x, e.y, e.wanderX, e.wanderY) > 0.15) steerTowards(map, e, e.wanderX, e.wanderY, type.speed * WANDER_SPEED_SHARE, dt);
    return;
  }

  if (e.mode === 'return') {
    e.hp = Math.min(e.maxHp, e.hp + e.maxHp * RETURN_HEAL_SHARE * dt);
    if (sees && d < type.aggro * RETURN_REAGGRO_SHARE) {
      e.mode = 'chase';
      return;
    }
    e.repathTimer -= dt;
    if (!e.path || e.repathTimer <= 0) {
      e.path = planRoute(map, e, { x: e.homeX, y: e.homeY });
      e.repathTimer = RETURN_REPATH_SECONDS;
    }
    if ((!rooted && followPath(map, e, type.speed, dt)) || dist(e.x, e.y, e.homeX, e.homeY) < 0.4) {
      e.mode = 'idle';
      e.path = null;
      e.wanderX = e.x;
      e.wanderY = e.y;
    }
    return;
  }

  const leashed = !type.boss && dist(e.x, e.y, e.homeX, e.homeY) > LEASH;
  if (hero.dead || d > type.aggro * GIVE_UP_AGGRO_MULTIPLE || leashed) {
    e.mode = 'return';
    e.path = null;
    events.push({ type: 'EnemyGaveUp', enemyId: e.id, boss: Boolean(type.boss) });
    return;
  }
  const fx = (hero.x - e.x) / (d || 1);
  const fy = (hero.y - e.y) / (d || 1);
  fightWithAbilities(state, ls, e, type, d, sees, dt, events);

  if (e.windUp >= 0) {
    e.facingX = lerp(e.facingX, fx, 0.2);
    e.facingY = lerp(e.facingY, fy, 0.2);
    e.windUp += dt / type.windUp;
    e.swing = -1;
    if (e.windUp >= 1) attack(state, e, type, fx, fy, events);
    return;
  }
  const inRange = d <= type.range + hero.r + e.r && (!type.ranged || sees);
  if (inRange) {
    e.facingX = lerp(e.facingX, fx, 0.3);
    e.facingY = lerp(e.facingY, fy, 0.3);
    if (type.ranged && d < KITE_DISTANCE && !rooted) steerTowards(map, e, e.x - fx, e.y - fy, type.speed * KITE_SPEED_SHARE, dt);
    if (e.attackCooldown <= 0) e.windUp = 0;
    return;
  }
  if (rooted) return;
  if (hasLineOfSight(map, e.x, e.y, hero.x, hero.y, e.r)) {
    e.path = null;
    steerTowards(map, e, hero.x, hero.y, type.speed, dt);
  } else {
    e.repathTimer -= dt;
    if (!e.path || e.repathTimer <= 0) {
      e.path = planRoute(map, e, hero);
      e.repathTimer = CHASE_REPATH_SECONDS;
    }
    if (e.path) followPath(map, e, type.speed, dt);
  }
}

function attack(state: GameState, e: Enemy, type: EnemyType, fx: number, fy: number, events: SimEvent[]): void {
  const { hero } = state;
  e.windUp = -1;
  e.attackCooldown = type.cooldown * range(state.rng, 1 - COOLDOWN_VARIATION, 1 + COOLDOWN_VARIATION);
  if (type.ranged) {
    const x = e.x + fx * SHOT_OFFSET;
    const y = e.y + fy * SHOT_OFFSET;
    state.projectiles.push({
      kind: 'shot', slot: -1, x, y, prevX: x, prevY: y, vx: fx * SHOT_SPEED, vy: fy * SHOT_SPEED, life: SHOT_LIFETIME,
      damage: enemyDamage(state, e, int(state.rng, type.damage[0], type.damage[1])),
    });
    events.push({ type: 'ShotFired', enemyId: e.id });
    e.swing = 0.5;
    return;
  }
  e.swing = 0.4;
  events.push({ type: 'Swung', actorId: e.id });
  if (dist(e.x, e.y, hero.x, hero.y) <= type.range + hero.r + e.r + MELEE_GRACE) {
    hurtHero(state, enemyDamage(state, e, int(state.rng, type.damage[0], type.damage[1])), events);
  }
}

/** Refills a random camp now and then, if the level is quiet and the hero is far from it. */
export function updateCampRespawns(state: GameState, dt: number): void {
  const ls = currentLevel(state);
  const r = ls.campRespawns;
  if (!r || ls.camps.length === 0) return;
  ls.campTimer -= dt;
  if (ls.campTimer > 0) return;
  ls.campTimer = r.everySeconds;
  const alive = ls.enemies.filter((e) => !e.dead).length;
  if (alive >= r.maxAlive) return;
  const camp = pick(state.rng, ls.camps);
  if (dist(state.hero.x, state.hero.y, camp.tx, camp.ty) <= r.minHeroDistance) return;
  spawnCamp(state, ls, pick(state.rng, r.kinds), camp);
}

/** NPCs turn to look at the hero when close. */
export function updateNpcs(state: GameState): void {
  const { hero } = state;
  for (const n of currentLevel(state).npcs) {
    if (dist(n.x, n.y, hero.x, hero.y) >= 3) continue;
    n.facingX = lerp(n.facingX, hero.x - n.x, 0.05);
    n.facingY = lerp(n.facingY, hero.y - n.y, 0.05);
  }
}

