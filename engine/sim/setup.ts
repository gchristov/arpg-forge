import { dist } from '../core/math';
import { createRng, range } from '../core/rng';
import { isSolidAt } from '../world/tile-map';
import type { Camp, EnemyBody, GameContent } from './content';
import type { Enemy, GameState, LevelState, Npc } from './state';

/**
 * A new game from the game's content: every level populated, the hero at the start of `startLevel` (by default
 * the game's own start level).
 */
export function createGameState(content: GameContent, seed: number, startLevel = content.startLevel): GameState {
  const state: GameState = {
    rng: createRng(seed),
    time: 0,
    nextId: 1,
    levels: {},
    levelId: startLevel,
    hero: {
      id: 0, kind: 'hero', x: 0, y: 0, prevX: 0, prevY: 0, r: content.hero.radius,
      facingX: content.hero.facingX, facingY: content.hero.facingY, moving: false, path: null,
      speed: content.hero.speed,
    },
    holdTimer: 0,
    portalCooldown: 0,
    transition: null,
  };
  for (const lc of content.levels) {
    const ls: LevelState = { level: lc.level, enemies: [], npcs: [] };
    for (const s of lc.spawns) ls.enemies.push(makeEnemy(state, content.enemies, s.kind, s.x, s.y));
    for (const camp of lc.camps) spawnCamp(state, ls, content.enemies, camp);
    for (const n of lc.npcs) ls.npcs.push(makeNpc(state, content.npcRadius, n.kind, n.name, n.x, n.y));
    state.levels[lc.level.id] = ls;
  }
  const start = state.levels[startLevel]?.level.start;
  if (!start) throw new Error(`unknown level: ${startLevel}`);
  placeAt(state.hero, start.x, start.y);
  return state;
}

export function makeEnemy(
  state: GameState,
  bodies: Record<string, EnemyBody>,
  kind: string,
  x: number,
  y: number,
): Enemy {
  const body = bodies[kind];
  if (!body) throw new Error(`unknown enemy kind: ${kind}`);
  return {
    id: state.nextId++, kind, x, y, prevX: x, prevY: y, r: body.radius,
    facingX: range(state.rng, -1, 1), facingY: 1, moving: false, path: null,
    homeX: x, homeY: y,
  };
}

function makeNpc(state: GameState, radius: number, kind: string, name: string, x: number, y: number): Npc {
  return { id: state.nextId++, kind, name, x, y, prevX: x, prevY: y, r: radius, facingX: 0, facingY: 1, moving: false, path: null };
}

/** Scatters a camp's group within 2.6 tiles of its centre, on free ground and not on top of the fire. */
export function spawnCamp(state: GameState, ls: LevelState, bodies: Record<string, EnemyBody>, camp: Camp): void {
  const count = bodies[camp.kind]?.groupSize ?? 1;
  const cx = camp.tx + 0.5;
  const cy = camp.ty + 0.5;
  for (let k = 0; k < count; k++) {
    for (let tries = 0; tries < 20; tries++) {
      const x = cx + range(state.rng, -2.6, 2.6);
      const y = cy + range(state.rng, -2.6, 2.6);
      if (!isSolidAt(ls.level.map, x, y) && dist(x, y, cx, cy) > 1.1) {
        ls.enemies.push(makeEnemy(state, bodies, camp.kind, x, y));
        break;
      }
    }
  }
}

export function placeAt(actor: { x: number; y: number; prevX: number; prevY: number }, x: number, y: number): void {
  actor.x = actor.prevX = x;
  actor.y = actor.prevY = y;
}

