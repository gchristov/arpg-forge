import type { Vec2 } from '../core/math';
import type { Rng } from '../core/rng';
import type { Level } from '../world/level';
import type { Walker } from './walking';

export interface Actor extends Walker {
  id: number;
  kind: string;
  /** Position before the latest step, so drawing can smooth between steps. */
  prevX: number;
  prevY: number;
}

export interface Hero extends Actor {
  speed: number;
}

export interface Npc extends Actor {
  name: string;
}

export interface Enemy extends Actor {
  homeX: number;
  homeY: number;
}

export interface LevelState {
  level: Level;
  enemies: Enemy[];
  npcs: Npc[];
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
  levels: Record<string, LevelState>;
  levelId: string;
  hero: Hero;
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
  | { type: 'walkInto'; tx: number; ty: number };

export interface StepInput {
  commands: Command[];
  /** The ground point under a held pointer that started a walk, or null. */
  held: Vec2 | null;
}

export type SimEvent =
  | { type: 'WalkTargetSet'; x: number; y: number }
  | { type: 'TransitionStarted'; to: string }
  | { type: 'EnteredLevel'; levelId: string };
