import type { EnemyType, GameContent } from './content';
import type { Enemy, GameState, LevelState, SimEvent } from './state';

/** What an ability gets each step an enemy that has it is fighting the hero. */
export interface AbilityTurn<Settings> {
  state: GameState;
  level: LevelState;
  enemy: Enemy;
  type: EnemyType;
  /** How far the enemy is from the hero. */
  distance: number;
  dt: number;
  events: SimEvent[];
  /** This enemy kind's settings for the ability, from its `abilities`. */
  settings: Settings;
  /** What the ability keeps on this one enemy between steps, starting empty. */
  memory: Record<string, number>;
}

/**
 * Something an enemy can do on top of chasing and attacking, such as a boss's slam. The engine runs each ability an
 * enemy kind lists, by name, without knowing what it does; a game that wants one defines it in its extensions and
 * hands it over in its content's `abilities`.
 */
export interface EnemyAbility<Settings = never> {
  /** Each step the enemy is fighting the hero. */
  fight(turn: AbilityTurn<Settings>): void;
  /** The kinds of enemy it can bring into the world, so content checks know they appear. */
  bringsIn?(settings: Settings): string[];
  /** Mistakes in an enemy kind's settings for it, for the content checks. */
  check?(settings: Settings, content: GameContent): string[];
}

// The rules state is plain data, so the abilities' code is kept here, by name, rather than in it.
const abilities = new Map<string, EnemyAbility<unknown>>();

/** Makes a game's abilities available to its enemies, by name. */
export function useAbilities(named: Record<string, EnemyAbility<never>> | undefined): void {
  for (const [name, ability] of Object.entries(named ?? {})) abilities.set(name, ability as EnemyAbility<unknown>);
}

/** Runs each of the enemy's abilities for one step of its fight. */
export function fightWithAbilities(
  state: GameState,
  level: LevelState,
  enemy: Enemy,
  type: EnemyType,
  distance: number,
  dt: number,
  events: SimEvent[],
): void {
  if (!type.abilities) return;
  for (const [name, settings] of Object.entries(type.abilities)) {
    abilities.get(name)?.fight({ state, level, enemy, type, distance, dt, events, settings, memory: enemy.memory });
  }
}

/** The ability with this name, if a game has made it available. */
export const abilityNamed = (name: string): EnemyAbility<unknown> | undefined => abilities.get(name);
