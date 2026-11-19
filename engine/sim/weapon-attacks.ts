import type { Enemy, GameState, SimEvent } from './state';

/** What a weapon's own attack gets each step the hero is in reach of their target with it in hand. */
export interface WeaponAttackTurn<Settings> {
  state: GameState;
  target: Enemy;
  dt: number;
  events: SimEvent[];
  /** The weapon's settings for its attack, from its `attack`. */
  settings: Settings;
  /** What the attack keeps between steps, emptied whenever the hero stops attacking. */
  memory: Record<string, number>;
}

/**
 * A weapon's own way of attacking, in place of swinging, such as a chainsaw cutting for as long as it's held against
 * the target. While it attacks, the hero keeps up the attack (`Hero.engagedId`): they're drawn channelling, and the
 * target can't back away. A game that wants one defines it in its extensions and hands it over in its content's
 * `weaponAttacks`, by the name its weapons use.
 */
export interface WeaponAttack<Settings = never> {
  /** Each step the hero is in reach of their target. */
  attack(turn: WeaponAttackTurn<Settings>): void;
  /** When the hero stops attacking, by walking off, losing the target, falling or changing weapon, before the memory is emptied. */
  stop?(turn: Omit<WeaponAttackTurn<Settings>, 'target' | 'dt'>): void;
}

// The rules state is plain data, so the attacks' code is kept here, by name, rather than in it.
const attacks = new Map<string, WeaponAttack<unknown>>();

/** Makes a game's weapon attacks available to its weapons, by name. */
export function useWeaponAttacks(named: Record<string, WeaponAttack<never>> | undefined): void {
  for (const [name, attack] of Object.entries(named ?? {})) attacks.set(name, attack as WeaponAttack<unknown>);
}

/** The attack of the weapon in the hero's hand and its settings, if it has its own. */
function attackInHand(state: GameState): { attack: WeaponAttack<unknown>; settings: unknown } | null {
  const { hero } = state;
  const own = hero.weapon === null ? undefined : state.rules.hero.weapons?.[hero.weapon]?.attack;
  if (!own) return null;
  const [name, settings] = Object.entries(own)[0] ?? [];
  const attack = name === undefined ? undefined : attacks.get(name);
  return attack ? { attack, settings } : null;
}

/** Whether the weapon in the hero's hand attacks its own way rather than swinging. */
export const attacksItsOwnWay = (state: GameState): boolean => attackInHand(state) !== null;

/** Attacks `target` for one step with the weapon in hand's own attack, keeping up the attack on it. */
export function attackWithWeapon(state: GameState, target: Enemy, dt: number, events: SimEvent[]): void {
  const own = attackInHand(state);
  if (!own) return;
  const { hero } = state;
  if (hero.engagedId !== null && hero.engagedId !== target.id) stopWeaponAttack(state, events);
  hero.engagedId = target.id;
  own.attack.attack({ state, target, dt, events, settings: own.settings, memory: hero.attackMemory });
}

/** Ends the attack the hero is keeping up, if any. */
export function stopWeaponAttack(state: GameState, events: SimEvent[]): void {
  const { hero } = state;
  if (hero.engagedId === null) return;
  const own = attackInHand(state);
  own?.attack.stop?.({ state, events, settings: own.settings, memory: hero.attackMemory });
  hero.engagedId = null;
  hero.attackMemory = {};
}

/** The weapon attack with this name, if a game has made it available. */
export const weaponAttackNamed = (name: string): WeaponAttack<unknown> | undefined => attacks.get(name);
