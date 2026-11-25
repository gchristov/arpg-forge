import type { MeleeRules } from './content';
import { advanceQuest } from './interaction';
import type { GameState, SimEvent } from './state';
import { stopWeaponAttack } from './weapon-attacks';

/** The melee attack in the hero's hand: bare hands, changed by the weapon they hold. */
export function meleeOf(state: GameState): MeleeRules {
  const { melee, weapons } = state.rules.hero;
  const weapon = state.hero.weapon === null ? undefined : weapons?.[state.hero.weapon];
  return weapon ? { ...melee, ...weapon } : melee;
}

/**
 * Puts one of the hero's weapons in their hand, at `x`, `y`, however it came, which can move the quest on; they carry
 * it from then on, with any they had before.
 */
export function arm(state: GameState, weapon: string, x: number, y: number, events: SimEvent[]): void {
  stopWeaponAttack(state, events);
  carry(state, weapon);
  events.push({ type: 'Armed', weapon, x, y });
  advanceQuest(state, { type: 'arm', weapon }, events);
}

/** Puts the weapon in the hero's hand and among those they carry, without anything coming of it. */
export function carry(state: GameState, weapon: string): void {
  const { hero } = state;
  hero.weapon = weapon;
  if (!hero.weapons.includes(weapon)) hero.weapons.push(weapon);
}

/** Takes the next weapon the hero carries in hand, round to the first after the last; nothing with only one. */
export function swapWeapon(state: GameState, events: SimEvent[]): void {
  const { hero } = state;
  const next = hero.weapons[(hero.weapons.indexOf(hero.weapon ?? '') + 1) % hero.weapons.length];
  if (next === undefined || next === hero.weapon) return;
  stopWeaponAttack(state, events);
  hero.weapon = next;
  events.push({ type: 'WeaponSwapped', weapon: next, x: hero.x, y: hero.y });
}
