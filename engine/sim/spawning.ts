import { dist } from '../core/math';
import { range } from '../core/rng';
import { isSolidAt } from '../world/tile-map';
import type { Camp, EnemySpawn } from './content';
import { areaStrength, enemyMaxHp } from './enemy-strength';
import type { Enemy, GameState, LevelState } from './state';

/** Puts the enemy a level's content places into the level, with whatever marks it out for the story. */
export function spawnEnemy(state: GameState, ls: LevelState, spawn: EnemySpawn): void {
  const enemy = makeEnemy(state, spawn.kind, spawn.x, spawn.y, spawn.strength ?? ls.enemyStrength);
  if (spawn.tag) enemy.tag = spawn.tag;
  if (spawn.carries) enemy.carries = spawn.carries;
  ls.enemies.push(enemy);
}

/** A new enemy of `kind` at `x`, `y`, as tough as `strength` (see `enemy-strength.ts`) makes it there. */
export function makeEnemy(state: GameState, kind: string, x: number, y: number, strength: number): Enemy {
  const type = state.rules.enemies[kind];
  if (!type) throw new Error(`unknown enemy kind: ${kind}`);
  const own = areaStrength(state, kind, strength);
  const hp = enemyMaxHp(state, { kind, strength: own });
  return {
    id: state.nextId++, kind, x, y, prevX: x, prevY: y, r: type.radius,
    facingX: range(state.rng, -1, 1), facingY: 1, moving: false, path: null,
    homeX: x, homeY: y, hp, maxHp: hp, mode: 'idle',
    attackCooldown: range(state.rng, 0.4, 1), windUp: -1, swing: -1,
    wanderTimer: range(state.rng, 1, 4), wanderX: x, wanderY: y, repathTimer: 0,
    dead: false, deadFor: 0, memory: {}, rootedFor: 0, slideX: 0, slideY: 0,
    strength: own,
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
        ls.enemies.push(makeEnemy(state, kind, x, y, camp.strength ?? ls.enemyStrength));
        break;
      }
    }
  }
}

