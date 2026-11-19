import type { EnemyType, GameContent } from './content';
import type { Enemy, GameState, LevelState, SimEvent } from './state';

/** What an ability gets whenever it's asked about one enemy that has it. */
export interface AbilityContext<Settings> {
  state: GameState;
  level: LevelState;
  enemy: Enemy;
  type: EnemyType;
  events: SimEvent[];
  /** This enemy kind's settings for the ability, from its `abilities`. */
  settings: Settings;
  /** What the ability keeps on this one enemy between steps, starting empty. */
  memory: Record<string, number>;
}

/** What an ability gets each step an enemy that has it is idle or fighting the hero. */
export interface AbilityTurn<Settings> extends AbilityContext<Settings> {
  /** How far the enemy is from the hero. */
  distance: number;
  /** Whether the enemy can see the hero, close enough to notice them. */
  sees: boolean;
  dt: number;
}

/**
 * How an idle enemy goes on this step, as an ability decides: as usual (coming for the hero if it sees them, wandering
 * if not), `unseeing` (wandering, paying the hero no mind), or `busy` (the ability has it doing something else).
 */
export type IdleChoice = 'asUsual' | 'unseeing' | 'busy';

/**
 * Something an enemy can do or be beyond chasing and attacking, such as a boss's slam, or machines that take the hero
 * for one of their own. The engine runs each ability an enemy kind lists, by name, without knowing what it does; a
 * game that wants one defines it in its extensions and hands it over in its content's `abilities`.
 */
export interface EnemyAbility<Settings = never> {
  /** Each step the enemy is fighting the hero. */
  fight?(turn: AbilityTurn<Settings>): void;
  /** Each step the enemy is idle: how it goes on. The busiest choice of its abilities wins. */
  idle?(turn: AbilityTurn<Settings>): IdleChoice;
  /** Each time the enemy is hurt. */
  hurt?(hit: AbilityContext<Settings>): void;
  /** Once a step, after every enemy on the hero's level has moved, if any enemy kind in the game has the ability. */
  afterEnemies?(state: GameState, level: LevelState, events: SimEvent[]): void;
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

function eachAbility(type: EnemyType, run: (ability: EnemyAbility<unknown>, settings: unknown) => void): void {
  if (!type.abilities) return;
  for (const [name, settings] of Object.entries(type.abilities)) {
    const ability = abilities.get(name);
    if (ability) run(ability, settings);
  }
}

/** Runs each of the enemy's abilities for one step of its fight. */
export function fightWithAbilities(state: GameState, level: LevelState, enemy: Enemy, type: EnemyType, distance: number, sees: boolean, dt: number, events: SimEvent[]): void {
  eachAbility(type, (a, settings) => a.fight?.({ state, level, enemy, type, distance, sees, dt, events, settings, memory: enemy.memory }));
}

const BUSYNESS: Record<IdleChoice, number> = { asUsual: 0, unseeing: 1, busy: 2 };

/** How an idle enemy goes on this step, by the busiest choice of its abilities. */
export function idleWithAbilities(state: GameState, level: LevelState, enemy: Enemy, type: EnemyType, distance: number, sees: boolean, dt: number, events: SimEvent[]): IdleChoice {
  let choice: IdleChoice = 'asUsual';
  eachAbility(type, (a, settings) => {
    const own = a.idle?.({ state, level, enemy, type, distance, sees, dt, events, settings, memory: enemy.memory }) ?? 'asUsual';
    if (BUSYNESS[own] > BUSYNESS[choice]) choice = own;
  });
  return choice;
}

/** Tells each of the enemy's abilities it was hurt. */
export function hurtWithAbilities(state: GameState, level: LevelState, enemy: Enemy, type: EnemyType, events: SimEvent[]): void {
  eachAbility(type, (a, settings) => a.hurt?.({ state, level, enemy, type, events, settings, memory: enemy.memory }));
}

/** Runs, once, each ability some enemy kind in the game has that acts after every enemy has moved. */
export function afterEnemiesWithAbilities(state: GameState, level: LevelState, events: SimEvent[]): void {
  let names = namesInUse.get(state.rules.enemies);
  if (!names) {
    names = [...new Set(Object.values(state.rules.enemies).flatMap((t) => Object.keys(t.abilities ?? {})))];
    namesInUse.set(state.rules.enemies, names);
  }
  for (const name of names) abilities.get(name)?.afterEnemies?.(state, level, events);
}

/** The ability names a game's enemy kinds list, worked out once a game rather than every step. */
const namesInUse = new WeakMap<object, string[]>();

/** The ability with this name, if a game has made it available. */
export const abilityNamed = (name: string): EnemyAbility<unknown> | undefined => abilities.get(name);
