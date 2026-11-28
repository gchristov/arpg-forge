import type { Vec2 } from '../core/math';
import type { Rng } from '../core/rng';
import type { Level } from '../world/level';
import type {
  Camp, CampRespawns, Container, EnemySpawn, EnemyType, HeroRules, NpcPlacement, NpcType, QuestStep, Readable, Watch,
} from './content';
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
  /**
   * The enemy the hero is keeping up an attack on with their weapon's own attack, such as cutting into it, or null:
   * the hero is drawn channelling.
   */
  engagedId: number | null;
  /** What the weapon's own attack keeps between steps, emptied when the hero stops attacking. */
  attackMemory: Record<string, number>;
  /** The weapon in hand, by its id in the hero's rules, or null for bare hands. */
  weapon: string | null;
  /** Every weapon the hero carries, by its id, in the order they came; the hero swaps between them. */
  weapons: string[];
  lastHurtAt: number;
  dead: boolean;
  targetId: number | null;
  repathTimer: number;
  /** Who or what the hero is walking up to, to talk or open once close enough. */
  interact: { type: 'npc'; npcId: number } | { type: 'container' | 'readable'; index: number } | null;
  /** Melee upgrades bought so far; each one costs more than the last. */
  meleeUpgrades: number;
}

export interface Npc extends Actor {
  name: string;
  /** Which of its level's placements put it there. */
  placement: number;
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
  /** What its abilities keep between steps, by name. */
  memory: Record<string, number>;
  /** Seconds it can't move of its own accord, such as held by a weapon cutting into it; 0 when free. */
  rootedFor: number;
  /** Seconds it can't move or attack at all, knocked down or stunned; 0 when up. */
  stunnedFor: number;
  /** How fast it's sliding from a knock-back, in tiles a second. */
  slideX: number;
  slideY: number;
  /** How much tougher than its kind it is, from where it stands; see `enemy-strength.ts`. */
  strength: number;
  /** Names this one enemy, for a quest step reached by defeating it. */
  tag?: string;
  /** Hunts the hero down wherever it is on the level and never gives up the chase, once a game sets it to. */
  hunting?: boolean;
  /** A weapon of the hero's it drops when defeated. */
  carries?: string;
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
  kind: 'gold' | 'healingItem' | 'weapon';
  amount: number;
  /** For a weapon, which of the hero's it is. */
  weapon?: string;
  x: number;
  y: number;
  z: number;
  vz: number;
}

export interface ContainerState extends Container {
  opened: boolean;
}

export interface LevelState {
  level: Level;
  enemies: Enemy[];
  /** The townspeople here at the story's current step, from `npcPlacements`. */
  npcs: Npc[];
  npcPlacements: NpcPlacement[];
  items: GroundItem[];
  containers: ContainerState[];
  /** What there is to read or use here at the story's current step, from `readablePlacements`. */
  readables: Readable[];
  readablePlacements: Readable[];
  /** Enemies the story hasn't brought in yet, each turning up once the quest reaches its `fromStep`. */
  storySpawns: EnemySpawn[];
  /** What a game's extensions keep on the level, such as whether its alarm is sounding, starting empty. */
  memory: Record<string, number>;
  camps: Camp[];
  campRespawns?: CampRespawns;
  campTimer: number;
  /** The strength of enemies that turn up here later, such as a boss's summons or a camp refilling. */
  enemyStrength: number;
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
    enemyGrowthPerHeroLevel?: number;
    watch: Watch[];
  };
  /** Index of the current quest step. */
  quest: number;
  /** The story's flags that are set, by name: what the story remembers that isn't a step, such as "has gone down". */
  flags: Record<string, true>;
  /** The watched things the hero is within reach of, as `level:id:within`, so each approach is told once. */
  near: string[];
  /** The locked doorway the hero is standing in, as `level:tx:ty`, so walking into it is told once. */
  inLockedDoor: string | null;
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
  /** Takes the next weapon the hero carries in hand. */
  | { type: 'swapWeapon' }
  | { type: 'respawn' }
  | { type: 'talk'; npcId: number }
  | { type: 'open'; index: number }
  | { type: 'read'; index: number }
  | { type: 'useService'; npcId: number; service: number }
  /** The player chose a reply, by its id, in a conversation with this NPC. */
  | { type: 'reply'; npcId: number; id: string }
  /** Sets or clears one of the story's flags. */
  | { type: 'setFlag'; flag: string; on: boolean };

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
  /** Something a game's extensions report, by name, for its story, sounds and labels, such as an alarm sounding. */
  | { type: 'Signal'; name: string; x: number; y: number; enemyId?: number }
  /** The last enemy on the level fell. */
  | { type: 'LevelCleared'; levelId: string }
  | { type: 'PortalSealed'; x: number; y: number }
  /** The hero stepped onto a door the story hasn't opened yet. */
  /** The hero walked into a doorway the story keeps locked; told once each time. */
  | { type: 'PortalLocked'; to: string; x: number; y: number }
  /** The hero came within `within` tiles of a watched thing to read or use. */
  | { type: 'Approached'; id: string; within: number }
  /** A weapon came into the hero's hand, bought or found. */
  | { type: 'Armed'; weapon: string; x: number; y: number }
  /** The hero swapped to another weapon they carry. */
  | { type: 'WeaponSwapped'; weapon: string; x: number; y: number }
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
  | { type: 'PickedUp'; kind: GroundItem['kind']; amount: number; x: number; y: number; weapon?: string }
  | { type: 'QuestAdvanced'; step: number };
