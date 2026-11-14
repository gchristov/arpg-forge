import type { Level } from '../world/level';

export interface SpawnPoint {
  kind: string;
  x: number;
  y: number;
}

/** A spot where a group of enemies spawns around a tile. */
export interface Camp {
  tx: number;
  ty: number;
  kind: string;
}

export interface LevelContent {
  level: Level;
  spawns: SpawnPoint[];
  camps: Camp[];
  npcs: Array<SpawnPoint & { name: string }>;
}

export interface EnemyBody {
  radius: number;
  groupSize: number;
}

/** What a game hands the rules: its levels, where play starts, and the numbers the rules need. */
export interface GameContent {
  levels: LevelContent[];
  startLevel: string;
  hero: { radius: number; speed: number; facingX: number; facingY: number };
  enemies: Record<string, EnemyBody>;
  npcRadius: number;
}
