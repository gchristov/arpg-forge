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

/** Puts one of the hero's weapons in their hand, at `x`, `y`, however it came, which can move the quest on. */
export function arm(state: GameState, weapon: string, x: number, y: number, events: SimEvent[]): void {
  stopWeaponAttack(state, events);
  state.hero.weapon = weapon;
  events.push({ type: 'Armed', weapon, x, y });
  advanceQuest(state, { type: 'arm', weapon }, events);
}
