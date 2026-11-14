import { dist } from '../core/math';
import { chance, int } from '../core/rng';
import { moveBody } from '../world/collision';
import { hasLineOfSight } from '../world/line-of-sight';
import { isSolidAt } from '../world/tile-map';
import { currentLevel, type Enemy, type GameState, type SimEvent } from './state';

/** Projectiles hit a body within this distance of its edge. */
const PROJECTILE_HIT_RADIUS = 0.45;

export function findEnemy(state: GameState, id: number | null): Enemy | null {
  if (id === null) return null;
  return currentLevel(state).enemies.find((e) => e.id === id && !e.dead) ?? null;
}

/** The closest living enemy within `range` of the hero, optionally only ones the hero can see. */
export function nearestEnemy(state: GameState, range: number, needSight = true): Enemy | null {
  const { hero } = state;
  const ls = currentLevel(state);
  let best: Enemy | null = null;
  let bestDistance = range;
  for (const e of ls.enemies) {
    if (e.dead) continue;
    const d = dist(hero.x, hero.y, e.x, e.y);
    if (d < bestDistance && (!needSight || hasLineOfSight(ls.level.map, hero.x, hero.y, e.x, e.y))) {
      bestDistance = d;
      best = e;
    }
  }
  return best;
}

/** Damages an enemy, knocking it back along (kx, ky) unless it's a boss, and wakes it up to chase. */
export function damageEnemy(
  state: GameState,
  e: Enemy,
  amount: number,
  crit: boolean,
  kx: number,
  ky: number,
  knockback: number,
  events: SimEvent[],
): void {
  if (e.dead) return;
  e.hp -= amount;
  events.push({ type: 'EnemyDamaged', enemyId: e.id, amount, crit, x: e.x, y: e.y });
  if (e.mode === 'idle' || e.mode === 'return') e.mode = 'chase';
  const type = state.rules.enemies[e.kind]!;
  if (!type.boss) moveBody(currentLevel(state).level.map, e, kx * knockback, ky * knockback);
  if (e.hp <= 0) killEnemy(state, e, events);
}

function killEnemy(state: GameState, e: Enemy, events: SimEvent[]): void {
  e.dead = true;
  e.deadFor = 0;
  e.hp = 0;
  e.windUp = -1;
  const type = state.rules.enemies[e.kind]!;
  gainXp(state, type.xp, events);
  events.push({ type: 'EnemyKilled', enemyId: e.id, kind: e.kind, x: e.x, y: e.y, boss: Boolean(type.boss) });
}

export function gainXp(state: GameState, amount: number, events: SimEvent[]): void {
  const { hero } = state;
  const up = state.rules.hero.levelUp;
  hero.xp += amount;
  while (hero.xp >= hero.xpNext) {
    hero.xp -= hero.xpNext;
    hero.level++;
    hero.xpNext = Math.round(hero.xpNext * up.xpGrowth);
    hero.maxHp += up.health;
    hero.maxResource += up.resource;
    hero.damage = [hero.damage[0] + up.damage[0], hero.damage[1] + up.damage[1]];
    hero.hp = hero.maxHp;
    hero.resource = hero.maxResource;
    events.push({ type: 'LevelUp', level: hero.level });
  }
}

export function hurtHero(state: GameState, amount: number, events: SimEvent[]): void {
  const { hero } = state;
  if (hero.dead) return;
  const damage = Math.max(1, Math.round(amount));
  hero.hp -= damage;
  hero.lastHurtAt = state.time;
  events.push({ type: 'HeroHurt', amount: damage, x: hero.x, y: hero.y });
  if (hero.hp <= 0) {
    hero.hp = 0;
    hero.dead = true;
    hero.path = null;
    hero.targetId = null;
    events.push({ type: 'HeroDied' });
  }
}

/** The hero's blast exploding at a point: every enemy in the radius is hurt and knocked away from the centre. */
function explode(state: GameState, x: number, y: number, events: SimEvent[]): void {
  const blast = state.rules.hero.blast;
  events.push({ type: 'Exploded', x, y, radius: blast.radius });
  for (const e of currentLevel(state).enemies) {
    if (e.dead) continue;
    const d = dist(x, y, e.x, e.y);
    if (d >= blast.radius + e.r) continue;
    const crit = chance(state.rng, blast.critChance);
    let damage = int(state.rng, blast.damage[0], blast.damage[1]) + state.hero.level * blast.damagePerLevel;
    if (crit) damage = Math.round(damage * blast.critMultiplier);
    const k = d || 1;
    damageEnemy(state, e, damage, crit, (e.x - x) / k, (e.y - y) / k, state.rules.hero.melee.knockback, events);
  }
}

export function updateProjectiles(state: GameState, dt: number, events: SimEvent[]): void {
  const { map } = currentLevel(state).level;
  const { hero } = state;
  for (let k = state.projectiles.length - 1; k >= 0; k--) {
    const p = state.projectiles[k]!;
    p.prevX = p.x;
    p.prevY = p.y;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    let hit = isSolidAt(map, p.x, p.y) || p.life <= 0;
    if (p.kind === 'blast') {
      for (const e of currentLevel(state).enemies) {
        if (!e.dead && dist(p.x, p.y, e.x, e.y) < PROJECTILE_HIT_RADIUS + e.r) hit = true;
      }
      if (hit) explode(state, p.x, p.y, events);
    } else if (!hero.dead && dist(p.x, p.y, hero.x, hero.y) < PROJECTILE_HIT_RADIUS) {
      hurtHero(state, p.damage, events);
      hit = true;
    }
    if (hit) state.projectiles.splice(k, 1);
  }
}

export function updateTelegraphs(state: GameState, dt: number, events: SimEvent[]): void {
  const { hero } = state;
  for (let k = state.telegraphs.length - 1; k >= 0; k--) {
    const t = state.telegraphs[k]!;
    t.elapsed += dt;
    if (t.elapsed < t.delay) continue;
    state.telegraphs.splice(k, 1);
    events.push({ type: 'SlamLanded', x: t.x, y: t.y, radius: t.radius });
    if (!hero.dead && dist(hero.x, hero.y, t.x, t.y) < t.radius) {
      hurtHero(state, int(state.rng, t.damage[0], t.damage[1]), events);
    }
  }
}
