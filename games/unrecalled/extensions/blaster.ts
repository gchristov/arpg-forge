import { dist } from '../../../engine/core/math';
import { chance, range } from '../../../engine/core/rng';
import { damageEnemy } from '../../../engine/sim/combat';
import { currentLevel, type Enemy, type GameState, type SimEvent } from '../../../engine/sim/state';
import type { WeaponAttack } from '../../../engine/sim/weapon-attacks';
import { meleeOf } from '../../../engine/sim/weapons';
import { steerTowards } from '../../../engine/sim/walking';
import { hasLineOfSight } from '../../../engine/world/line-of-sight';

/**
 * U-7's hand blaster: from out of the machine's reach, a shot every `shotSeconds` for `cost` charge, each `power` times
 * a swing's damage. A machine that's down (stunned) is open: U-7 closes in and tears its core out with a powered
 * strike, `strike.power` times a swing, every `strike.seconds`.
 */
export interface BlastSettings {
  shotSeconds: number;
  cost: number;
  power: number;
  knockback: number;
  strike: { reach: number; power: number; knockback: number; seconds: number };
}

/** The signals the blaster sends, for the game to draw and sound: a shot landing, and a powered strike. */
export const BLAST_SIGNAL = { shot: 'blast', strike: 'poweredStrike' } as const;

/** Keeps `untilShot`, the seconds until it can shoot or strike again, in its memory. See EXTENSIONS.md. */
export const BLAST: WeaponAttack<BlastSettings> = {
  attack({ state, target, dt, events, settings, memory }) {
    const { hero } = state;
    const { map } = currentLevel(state).level;
    memory.untilShot = (memory.untilShot ?? 0) - dt;
    const d = dist(hero.x, hero.y, target.x, target.y);
    const closeIn = (): void => {
      steerTowards(map, hero, target.x, target.y, hero.speed, dt);
      hero.moving = true;
    };
    if (target.stunnedFor > 0) {
      if (d > settings.strike.reach + target.r) return closeIn();
      if (memory.untilShot > 0) return;
      memory.untilShot = settings.strike.seconds;
      events.push({ type: 'Signal', name: BLAST_SIGNAL.strike, x: target.x, y: target.y, enemyId: target.id });
      hit(state, target, settings.strike.power, settings.strike.knockback, events);
      return;
    }
    if (!hasLineOfSight(map, hero.x, hero.y, target.x, target.y)) return closeIn();
    if (memory.untilShot > 0 || hero.resource < settings.cost) return;
    hero.resource -= settings.cost;
    memory.untilShot = settings.shotSeconds;
    events.push({ type: 'Signal', name: BLAST_SIGNAL.shot, x: target.x, y: target.y, enemyId: target.id });
    hit(state, target, settings.power, settings.knockback, events);
  },
};

function hit(state: GameState, target: Enemy, power: number, knockback: number, events: SimEvent[]): void {
  const { hero } = state;
  const melee = meleeOf(state);
  const crit = chance(state.rng, melee.critChance);
  const amount = Math.round((range(state.rng, hero.damage[0], hero.damage[1]) + hero.bonusDamage) * power * (crit ? melee.critMultiplier : 1));
  const d = dist(hero.x, hero.y, target.x, target.y) || 1;
  damageEnemy(state, target, Math.max(1, amount), crit, (target.x - hero.x) / d, (target.y - hero.y) / d, knockback, events);
}
