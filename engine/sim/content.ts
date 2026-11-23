import type { EnemyAbility } from './abilities';
import type { StepAction } from './step-actions';
import type { WeaponAttack } from './weapon-attacks';
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
  /** The quest step it turns up at, by name; there from the start if not given. */
  fromStep?: string;
  /** One of the hero's weapons, dropped on the ground when it's defeated, for the hero to pick up. */
  carries?: string;
}

/**
 * The quest steps something is in the world for, by name: from `fromStep` until just before `untilStep`. Always there
 * if neither is given.
 */
export interface StorySpan {
  fromStep?: string;
  untilStep?: string;
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
  | { type: 'upgradeMelee'; basePrice: number; priceStep: number; bonus: number };
;

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
  /** Its name, for the content that refers to it; only steps something refers to need one. */
  id?: string;
  reachedBy?: QuestTrigger;
  /** The game's own step actions done on reaching it, by name, such as sounding an alarm everywhere. */
  does?: readonly string[];
  /**
   * Reached only from the step just before it, never skipped to, for a trigger the hero can meet early, such as
   * entering the town they keep coming back to.
   */
  inOrder?: boolean;
  /** Reaching this step takes the hero straight to a place, such as home once the story there is done. */
  takesHeroTo?: { levelId: string; x: number; y: number };
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
  /**
   * What it can do on top of chasing and attacking, by ability name, each with its settings: abilities a game defines
   * in its extensions and hands over in its content's `abilities`.
   */
  abilities?: Record<string, unknown>;
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
  /** Seconds each enemy hit can't move or attack, knocked down or stunned. Bosses shrug it off. None if not given. */
  stun?: number;
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
  /**
   * Only enemies within this many degrees either side of where the hero aims are hit, for a blast in front of them:
   * aimed at their target, else the nearest enemy in reach, else straight ahead. All round them if not given.
   */
  arc?: number;
}

/** A skill the hero can use, by engine type. Games pick and tune these; new types are added here as games need them. */
/** A skill the hero only has from a quest step on, by name, such as one the story gives them; from the start if not given. */
export type Skill = (ProjectileSkill | AreaSkill) & { fromStep?: string };

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
}

/** A weapon the hero can hold: changes to parts of the bare-handed melee attack, and maybe its own way of attacking. */
export interface Weapon extends Partial<MeleeRules> {
  /**
   * Its own way of attacking, in place of swinging, by name with its settings: an attack a game defines in its
   * extensions and hands over in its content's `weaponAttacks`.
   */
  attack?: Record<string, unknown>;
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
  /** The weapon in the hero's hand from the start, by its id in `weapons`; bare hands if not given. */
  startingWeapon?: string;
  /** Weapons the hero can come to hold, by id, each changing parts of the bare-handed melee attack. */
  weapons?: Record<string, Weapon>;
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
  /** Things to read or use whose approach the story listens for, and how near, in tiles, counts as approaching. */
  watch?: Watch[];
  /** The game's own enemy abilities, by the names its enemies list them under. */
  abilities?: Record<string, EnemyAbility<never>>;
  /** The game's own step actions, by the names its quest steps list them under in `does`. */
  stepActions?: Record<string, StepAction>;
  /** The game's own weapon attacks, by the names its weapons list them under in `attack`. */
  weaponAttacks?: Record<string, WeaponAttack<never>>;
}

/** A thing to read or use, by id, that emits `Approached` when the hero comes within `within` tiles of it. */
export interface Watch {
  id: string;
  within: number;
}
