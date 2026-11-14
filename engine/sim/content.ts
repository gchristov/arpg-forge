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

/** Camps that refill over time while the hero is far enough away. */
export interface CampRespawns {
  everySeconds: number;
  /** No new group while at least this many enemies are alive on the level. */
  maxAlive: number;
  minHeroDistance: number;
  /** One of these kinds is picked at random for each new group. */
  kinds: string[];
}

export interface LevelContent {
  level: Level;
  spawns: SpawnPoint[];
  camps: Camp[];
  campRespawns?: CampRespawns;
  npcs: Array<SpawnPoint & { name: string }>;
}

export type Range = [min: number, max: number];

export interface EnemyType {
  hp: number;
  damage: Range;
  /** Tiles a second. */
  speed: number;
  /** Attack reach in tiles, on top of both bodies' radii. */
  range: number;
  /** Attacks with projectiles from a distance, and backs away when the hero gets close. */
  ranged?: boolean;
  /** Seconds between attacks, varied by ±15%. */
  cooldown: number;
  /** Seconds from starting an attack to it landing. */
  windUp: number;
  /** Distance at which it notices the hero. */
  aggro: number;
  xp: number;
  radius: number;
  /** Bosses aren't knocked back and never give up a chase for being far from home. */
  boss?: boolean;
  /** How many spawn together at a camp. */
  groupSize: number;
  /** Marks a circle under the hero that lands after a delay. */
  slam?: { everySeconds: Range; reach: number; radius: number; delay: number; damage: Range };
  /** Once, below a share of its health, calls others to its side. */
  summon?: { belowHealthShare: number; kind: string; count: number; distance: number };
}

/** The hero's numbers. Neutral names: "resource" is what skills cost, "healing items" are drunk or used to heal. */
export interface HeroRules {
  radius: number;
  speed: number;
  facingX: number;
  facingY: number;
  health: number;
  resource: number;
  damage: Range;
  xpForLevel2: number;
  healingItems: number;
  /** Resource regained a second. */
  resourceRegen: number;
  /** Health regained a second, once `healthRegenDelay` seconds have passed without being hurt. */
  healthRegen: number;
  healthRegenDelay: number;
  levelUp: { xpGrowth: number; health: number; resource: number; damage: Range };
  melee: {
    cooldown: number;
    swingSeconds: number;
    /** Reach when the swing lands, on top of the target's radius. */
    reach: number;
    /** Distance at which the hero stops chasing and starts swinging, on top of the target's radius. */
    engageRange: number;
    critChance: number;
    critMultiplier: number;
    knockback: number;
  };
  /** A projectile that explodes on impact, hurting every enemy in a radius. */
  blast: {
    cost: number;
    cooldown: number;
    speed: number;
    lifetime: number;
    radius: number;
    damage: Range;
    damagePerLevel: number;
    critChance: number;
    critMultiplier: number;
    autoAimRange: number;
  };
  heal: { amount: number; maxItems: number };
  /** The attack command picks the nearest visible enemy within this distance. */
  attackAssistRange: number;
  /** Share of gold lost on death. */
  deathGoldLoss: number;
}

/** What a game hands the rules: its levels, where play starts, and the numbers the rules need. */
export interface GameContent {
  levels: LevelContent[];
  startLevel: string;
  hero: HeroRules;
  enemies: Record<string, EnemyType>;
  npcRadius: number;
}
