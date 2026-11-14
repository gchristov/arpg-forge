import { dist } from '../core/math';
import { createRng, range } from '../core/rng';
import { isSolidAt } from '../world/tile-map';
import type { Camp, GameContent, HeroRules } from './content';
import type { Enemy, GameState, Hero, LevelState, Npc } from './state';

/**
 * A new game from the game's content: every level populated, the hero at the start of `startLevel` (by default
 * the game's own start level).
 */
export function createGameState(content: GameContent, seed: number, startLevel = content.startLevel): GameState {
  const state: GameState = {
    rng: createRng(seed),
    time: 0,
    nextId: 1,
    rules: {
      hero: content.hero, enemies: content.enemies, npcRadius: content.npcRadius, npcs: content.npcs, quest: content.quest,
    },
    quest: 0,
    levels: {},
    levelId: startLevel,
    startLevelId: content.startLevel,
    hero: newHero(content.hero),
    projectiles: [],
    telegraphs: [],
    holdTimer: 0,
    portalCooldown: 0,
    transition: null,
  };
  for (const lc of content.levels) {
    const ls: LevelState = {
      level: lc.level, enemies: [], npcs: [], camps: lc.camps, items: [],
      containers: (lc.containers ?? []).map((c) => ({ ...c, opened: false })),
      ...(lc.campRespawns ? { campRespawns: lc.campRespawns } : {}),
      campTimer: lc.campRespawns?.everySeconds ?? 0,
    };
    for (const s of lc.spawns) ls.enemies.push(makeEnemy(state, s.kind, s.x, s.y));
    for (const camp of lc.camps) spawnCamp(state, ls, camp.kind, camp);
    for (const n of lc.npcs) ls.npcs.push(makeNpc(state, n.kind, n.name, n.x, n.y));
    state.levels[lc.level.id] = ls;
  }
  const start = state.levels[startLevel]?.level.start;
  if (!start) throw new Error(`unknown level: ${startLevel}`);
  placeAt(state.hero, start.x, start.y);
  return state;
}

function newHero(rules: HeroRules): Hero {
  return {
    id: 0, kind: 'hero', x: 0, y: 0, prevX: 0, prevY: 0, r: rules.radius,
    facingX: rules.facingX, facingY: rules.facingY, moving: false, path: null,
    speed: rules.speed,
    hp: rules.health, maxHp: rules.health, resource: rules.resource, maxResource: rules.resource,
    level: 1, xp: 0, xpNext: rules.xpForLevel2, gold: 0, healingItems: rules.healingItems,
    damage: [...rules.damage], bonusDamage: 0,
    attackCooldown: 0, blastCooldown: 0, swing: -1, struck: true,
    lastHurtAt: -Infinity, dead: false, targetId: null, repathTimer: 0,
    interact: null, meleeUpgrades: 0,
  };
}

export function makeEnemy(state: GameState, kind: string, x: number, y: number): Enemy {
  const type = state.rules.enemies[kind];
  if (!type) throw new Error(`unknown enemy kind: ${kind}`);
  return {
    id: state.nextId++, kind, x, y, prevX: x, prevY: y, r: type.radius,
    facingX: range(state.rng, -1, 1), facingY: 1, moving: false, path: null,
    homeX: x, homeY: y, hp: type.hp, maxHp: type.hp, mode: 'idle',
    attackCooldown: range(state.rng, 0.4, 1), windUp: -1, swing: -1,
    wanderTimer: range(state.rng, 1, 4), wanderX: x, wanderY: y, repathTimer: 0,
    dead: false, deadFor: 0, slamTimer: 4, summoned: false,
  };
}

function makeNpc(state: GameState, kind: string, name: string, x: number, y: number): Npc {
  return {
    id: state.nextId++, kind, name, x, y, prevX: x, prevY: y, r: state.rules.npcRadius,
    facingX: 0, facingY: 1, moving: false, path: null,
  };
}

/** Scatters a group of `kind` within 2.6 tiles of the camp's centre, on free ground and not on top of the fire. */
export function spawnCamp(state: GameState, ls: LevelState, kind: string, camp: Camp): void {
  const count = state.rules.enemies[kind]?.groupSize ?? 1;
  const cx = camp.tx + 0.5;
  const cy = camp.ty + 0.5;
  for (let k = 0; k < count; k++) {
    for (let tries = 0; tries < 20; tries++) {
      const x = cx + range(state.rng, -2.6, 2.6);
      const y = cy + range(state.rng, -2.6, 2.6);
      if (!isSolidAt(ls.level.map, x, y) && dist(x, y, cx, cy) > 1.1) {
        ls.enemies.push(makeEnemy(state, kind, x, y));
        break;
      }
    }
  }
}

export function placeAt(actor: { x: number; y: number; prevX: number; prevY: number }, x: number, y: number): void {
  actor.x = actor.prevX = x;
  actor.y = actor.prevY = y;
}
