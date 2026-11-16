import type { Vec2 } from '../core/math';
import type { Rng } from '../core/rng';
import type { Level } from '../world/level';
import type { Camp, CampRespawns, EnemyType, HeroRules, NpcType, QuestStep, Readable } from './content';
import type { Walker } from './walking';

export interface Actor extends Walker {
  id: number;
  kind: string;
  /** Position before the latest step, so drawing can smooth between steps. */
  prevX: number;
  prevY: number;
}

/** Progress through a swing from 0 to 1, or -1 when not swinging. */
export type Swing = number;

export interface Hero extends Actor {
  speed: number;
  hp: number;
  maxHp: number;
  resource: number;
  maxResource: number;
  level: number;
  xp: number;
  xpNext: number;
  gold: number;
  healingItems: number;
  damage: [number, number];
  /** Extra melee damage, for example from upgrades bought from a vendor. */
  bonusDamage: number;
  attackCooldown: number;
  /** Seconds until each skill, by slot, can be used again. */
  skillCooldowns: number[];
  swing: Swing;
  /** Whether the current swing has already struck. */
  struck: boolean;
  /** The continuous melee attack under way, if the hero is cutting into their target. */
  cut: Cut | null;
  lastHurtAt: number;
  dead: boolean;
  targetId: number | null;
  repathTimer: number;
  /** Who or what the hero is walking up to, to talk or open once close enough. */
  interact: { type: 'npc'; npcId: number } | { type: 'container' | 'readable'; index: number } | null;
  /** Melee upgrades bought so far; each one costs more than the last. */
  meleeUpgrades: number;
}

export interface Cut {
  targetId: number;
  /** Seconds until the next tick of damage. */
  untilTick: number;
  /** Damage dealt since it was last reported, and whether any of it was a critical hit. */
  unreported: number;
  crit: boolean;
  /** Seconds until the damage dealt so far is reported. */
  untilReport: number;
}

export interface Npc extends Actor {
  name: string;
}

export type EnemyMode = 'idle' | 'chase' | 'return';

export interface Enemy extends Actor {
  homeX: number;
  homeY: number;
  hp: number;
  maxHp: number;
  mode: EnemyMode;
  attackCooldown: number;
  /** Progress through the wind-up of an attack from 0 to 1, or -1 when not attacking. */
  windUp: number;
  swing: Swing;
  wanderTimer: number;
  wanderX: number;
  wanderY: number;
  repathTimer: number;
  dead: boolean;
  deadFor: number;
  slamTimer: number;
  summoned: boolean;
  /** Whether a calm enemy has seen the hero yet, so it recognises them only once. */
  recognised: boolean;
  /** Whether a calm enemy has been hit, called by one hit nearby or seen the hero during an alarm: it no longer takes the hero for one of its own. */
  provoked: boolean;
  /** Progress through looking the hero over on recognising them, from 0 to 1, or -1 when not scanning. */
  scan: number;
  /** How fast it's sliding from a knock-back, in tiles a second. */
  slideX: number;
  slideY: number;
}

export interface Projectile {
  /** `skill` is one of the hero's, cast from slot `slot`; `shot` is an enemy's ranged attack. */
  kind: 'skill' | 'shot';
  slot: number;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  life: number;
  damage: number;
}

/** A marked circle that lands after a delay, hurting the hero if they're still inside. */
export interface Telegraph {
  x: number;
  y: number;
  radius: number;
  elapsed: number;
  delay: number;
  damage: [number, number];
}

/** Gold or a healing item on the ground. Height and fall speed are in tiles. */
export interface GroundItem {
  kind: 'gold' | 'healingItem';
  amount: number;
  x: number;
  y: number;
  z: number;
  vz: number;
}

export interface ContainerState {
  tx: number;
  ty: number;
  gold: number;
  healingItems: number;
  opened: boolean;
}

export interface LevelState {
  level: Level;
  enemies: Enemy[];
  npcs: Npc[];
  items: GroundItem[];
  containers: ContainerState[];
  readables: Readable[];
  /** Whether the level's alarm is sounding: from the first fight with its calm enemies until the story calms everything. */
  alarmed: boolean;
  camps: Camp[];
  campRespawns?: CampRespawns;
  campTimer: number;
}

/** Walking through a portal: the screen fades, then the hero arrives on the other side. */
export interface Transition {
  to: string;
  x: number;
  y: number;
  remaining: number;
}

/** Everything the rules need, as plain data: it can be saved, copied and replayed. */
export interface GameState {
  rng: Rng;
  time: number;
  nextId: number;
  rules: {
    hero: HeroRules;
    enemies: Record<string, EnemyType>;
    npcRadius: number;
    npcs: Record<string, NpcType>;
    quest: QuestStep[];
  };
  /** Index of the current quest step. */
  quest: number;
  levels: Record<string, LevelState>;
  levelId: string;
  startLevelId: string;
  hero: Hero;
  projectiles: Projectile[];
  telegraphs: Telegraph[];
  /** Counts down while the ground is held; the hero re-targets when it runs out. */
  holdTimer: number;
  /** Portals don't trigger again right after arriving. */
  portalCooldown: number;
  transition: Transition | null;
}

export const currentLevel = (state: GameState): LevelState => state.levels[state.levelId]!;

/** What the player asked for, already resolved by the input layer into world terms. */
export type Command =
  | { type: 'walk'; x: number; y: number }
  | { type: 'enterStructure'; index: number }
  | { type: 'walkInto'; tx: number; ty: number }
  | { type: 'attack'; enemyId: number }
  | { type: 'attackNearest' }
  | { type: 'useSkill'; slot: number }
  | { type: 'heal' }
  | { type: 'respawn' }
  | { type: 'talk'; npcId: number }
  | { type: 'open'; index: number }
  | { type: 'read'; index: number }
  | { type: 'useService'; npcId: number; service: number };

export interface StepInput {
  commands: Command[];
  /** The ground point under a held pointer that started a walk, or null. */
  held: Vec2 | null;
}

export type RefusalReason = 'noResource' | 'noHealingItems' | 'fullHealth';

export type SimEvent =
  | { type: 'WalkTargetSet'; x: number; y: number }
  | { type: 'TargetSet'; enemyId: number; x: number; y: number }
  | { type: 'TransitionStarted'; to: string }
  | { type: 'EnteredLevel'; levelId: string }
  | { type: 'Swung'; actorId: number }
  | { type: 'EnemyDamaged'; enemyId: number; amount: number; crit: boolean; x: number; y: number }
  | { type: 'EnemyKilled'; enemyId: number; kind: string; x: number; y: number; boss: boolean }
  | { type: 'EnemyAlerted'; enemyId: number; boss: boolean }
  /** A calm enemy saw the hero and let them be. */
  | { type: 'EnemyRecognised'; enemyId: number; x: number; y: number }
  | { type: 'LevelAlarmed'; levelId: string }
  /** The last enemy on the level fell. */
  | { type: 'LevelCleared'; levelId: string }
  | { type: 'PortalSealed'; x: number; y: number }
  | { type: 'EnemyGaveUp'; enemyId: number; boss: boolean }
  | { type: 'HeroHurt'; amount: number; x: number; y: number }
  | { type: 'HeroDied' }
  | { type: 'HeroRespawned'; goldLost: number }
  | { type: 'LevelUp'; level: number }
  | { type: 'Healed'; amount: number; x: number; y: number }
  | { type: 'Refused'; reason: RefusalReason; x: number; y: number }
  | { type: 'SkillUsed'; slot: number; skill: string }
  | { type: 'Exploded'; x: number; y: number; radius: number }
  | { type: 'ShotFired'; enemyId: number }
  | { type: 'SlamWarned'; enemyId: number; x: number; y: number }
  | { type: 'SlamLanded'; x: number; y: number; radius: number }
  | { type: 'Summoned'; enemyId: number; summonedIds: number[] }
  /** `questBefore` is the quest step just before talking, so the game can tell a first meeting from a later one. */
  | { type: 'Talked'; npcId: number; kind: string; name: string; questBefore: number }
  | { type: 'ServiceUsed'; npcId: number; service: number; x: number; y: number }
  | { type: 'ContainerOpened'; index: number; x: number; y: number }
  | { type: 'Read'; id: string; x: number; y: number }
  | { type: 'PickedUp'; kind: GroundItem['kind']; amount: number; x: number; y: number }
  | { type: 'QuestAdvanced'; step: number };
