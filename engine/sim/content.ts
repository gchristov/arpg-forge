import type { Level } from '../world/level';

export interface SpawnPoint {
  kind: string;
  x: number;
  y: number;
}

/** Where one enemy starts. */
export interface EnemySpawn extends SpawnPoint {
  /** Names this one enemy, for a quest step reached by defeating it. */
  tag?: string;
  /** Its own strength, in place of its level's `enemyStrength`. */
  strength?: number;
}

/**
 * The quest steps something is in the world for: from `fromStep` until just before `untilStep`. Always there if
 * neither is given.
 */
export interface StorySpan {
  fromStep?: number;
  untilStep?: number;
}

/** A townsperson, where they stand while the story has them there. */
export interface NpcPlacement extends SpawnPoint, StorySpan {
  name: string;
}

/** A spot where a group of enemies spawns around a tile. */
export interface Camp {
  tx: number;
  ty: number;
  kind: string;
  /** The camp's own strength, in place of its level's `enemyStrength`, for a part of a level tougher or easier than the rest. */
  strength?: number;
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

/** Something on a tile that opens once and spills its contents, such as a chest. */
export interface Container {
  tx: number;
  ty: number;
  gold: number;
  healingItems: number;
  /** One of the hero's weapons, put in their hand when it's opened. */
  weapon?: string;
}

/**
 * Something on a tile the hero can walk up to and read or use, such as a notice or a breaker. The game words it by its
 * `id`.
 */
export interface Readable extends StorySpan {
  tx: number;
  ty: number;
  id: string;
}

export interface LevelContent {
  level: Level;
  spawns: EnemySpawn[];
  camps: Camp[];
  campRespawns?: CampRespawns;
  npcs: NpcPlacement[];
  containers?: Container[];
  readables?: Readable[];
  /**
   * How much tougher than their kind the level's enemies are: their health and damage are multiplied by it, so the
   * way gets harder the deeper it goes. 1 if not given.
   */
  enemyStrength?: number;
  /** A level for trying mechanics out, such as a combat arena, reached only by its address, so no portal leads to it. */
  practice?: boolean;
}

/** What a vendor offers. */
export type Service =
  | { type: 'restore' }
  | { type: 'sellHealingItem'; price: number }
  /** Each purchase adds `bonus` melee damage and costs `priceStep` more than the last. */
  | { type: 'upgradeMelee'; basePrice: number; priceStep: number; bonus: number }
  /** Puts one of the hero's `weapons` in their hand, once. */
  | { type: 'sellWeapon'; weapon: string; price: number };

export interface NpcType {
  services: Service[];
}

/** What moves the quest to a step. */
export type QuestTrigger =
  | { type: 'talk'; npcKind: string }
  /** Choosing a reply, by its id, in a conversation with someone of `npcKind`. */
  | { type: 'reply'; npcKind: string; id: string }
  | { type: 'enter'; levelId: string }
  | { type: 'kill'; enemyKind: string }
  /** Defeating one particular enemy, by its spawn's tag. */
  | { type: 'defeat'; tag: string }
  /** Reading or using something in the world, by its readable id. */
  | { type: 'use'; id: string }
  /** Getting one of the hero's weapons in hand, however it came. */
  | { type: 'arm'; weapon: string };

/**
 * A step of the quest line. The quest moves to a step when its trigger fires and the quest is behind it, so a
 * step can be skipped but never undone.
 */
export interface QuestStep {
  reachedBy?: QuestTrigger;
  /** Reaching this step ends every level's alarm, and calm enemies everywhere go back to their work. */
  calmsEverything?: boolean;
  /**
   * Reached only from the step just before it, never skipped to, for a trigger the hero can meet early, such as
   * entering the town they keep coming back to.
   */
  inOrder?: boolean;
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
  /**
   * Starts calm, going about its work: it ignores the hero, however close, until it's hit or one of its kind is hit
   * nearby, in its sight. That sounds the level's alarm, and from then on it comes for the hero as soon as it sees them.
   */
  calm?: boolean;
  /** How many spawn together at a camp. */
  groupSize: number;
  /** Marks a circle under the hero that lands after a delay. */
  slam?: { everySeconds: Range; reach: number; radius: number; delay: number; damage: Range };
  /** Once, below a share of its health, calls others to its side. */
  summon?: { belowHealthShare: number; kind: string; count: number; distance: number };
  /** What it drops on death: gold, a chance of a healing item, and extra healing items for certain. */
  drops: { gold: Range; healingChance: number; extraHealingItems?: number };
}

/** What a skill's burst does to every enemy within `radius` of where it goes off. */
export interface BurstDamage {
  radius: number;
  damage: Range;
  /** Extra damage for each of the hero's levels. */
  damagePerLevel: number;
  critChance: number;
  critMultiplier: number;
}

/**
 * A projectile cast at the target, or the nearest visible enemy, that bursts on hitting an enemy or a wall or at the
 * end of its flight.
 */
export interface ProjectileSkill extends BurstDamage {
  type: 'projectile';
  /** Names the skill for the game's sounds, look and HUD. */
  id: string;
  cost: number;
  cooldown: number;
  speed: number;
  lifetime: number;
  autoAimRange: number;
}

/** A burst around the hero that hits everything near them at once and throws it back `knockback` tiles. */
export interface AreaSkill extends BurstDamage {
  type: 'area';
  id: string;
  cost: number;
  cooldown: number;
  knockback: number;
}

/** A skill the hero can use, by engine type. Games pick and tune these; new types are added here as games need them. */
export type Skill = ProjectileSkill | AreaSkill;

/** The hero's numbers. Neutral names: "resource" is what skills cost, "healing items" are drunk or used to heal. */
export interface MeleeRules {
  cooldown: number;
  swingSeconds: number;
  /** Reach when the swing lands, on top of the target's radius. */
  reach: number;
  /** Distance at which the hero stops chasing and starts swinging, on top of the target's radius. */
  engageRange: number;
  critChance: number;
  critMultiplier: number;
  knockback: number;
  /**
   * Cuts rather than swings, like a chainsaw: while the hero is engaged with the target, a tick of damage lands every
   * `tickSeconds`, without knockback. Over a second it deals `power` times what swinging every `cooldown` would.
   */
  continuous?: { tickSeconds: number; power: number };
}

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
  /** The bare-handed melee attack. */
  melee: MeleeRules;
  /** Weapons the hero can come to hold, by id, each changing parts of the bare-handed melee attack. */
  weapons?: Record<string, Partial<MeleeRules>>;
  /** Skills on top of the melee attack, by slot, each costing resource and with its own cooldown. */
  skills: Skill[];
  heal: { amount: number; maxItems: number };
  /** The attack command picks the nearest visible enemy within this distance. */
  attackAssistRange: number;
  /** Share of gold lost on death. */
  deathGoldLoss: number;
  /**
   * Where the hero gets back up: at the start level (the default), or at the start of the level they fell in, for
   * games whose levels are a long way from the start.
   */
  respawnAt?: 'startLevel' | 'sameLevel';
}

/** What a game hands the rules: its levels, where play starts, and the numbers the rules need. */
export interface GameContent {
  levels: LevelContent[];
  startLevel: string;
  hero: HeroRules;
  enemies: Record<string, EnemyType>;
  npcRadius: number;
  npcs: Record<string, NpcType>;
  quest: QuestStep[];
  /** Every enemy grows this share stronger, in health and damage, for each level the hero gains. None if not given. */
  enemyGrowthPerHeroLevel?: number;
}
