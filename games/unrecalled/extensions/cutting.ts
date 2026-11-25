import { chance, range } from '../../../engine/core/rng';
import { findEnemy, hurtEnemy } from '../../../engine/sim/combat';
import type { Enemy, SimEvent } from '../../../engine/sim/state';
import type { WeaponAttack } from '../../../engine/sim/weapon-attacks';
import { meleeOf } from '../../../engine/sim/weapons';
import { goForNextDowned } from './downed';

/**
 * Damage from cutting is reported this often rather than on every tick, so the target shows one number, one flinch and
 * one sound at a time.
 */
export const CUT_REPORT_SECONDS = 0.4;

/**
 * Cutting rather than swinging, like Pell's chainsaw: while U-7 holds it against the target, a tick of damage lands
 * every `tickSeconds`, without knockback, and the blade holds the target where it is, so it can't back away. Over a
 * second it deals `power` times what swinging every `cooldown` would, and builds `charge` charge for the EMP. A
 * machine that's down (stunned) is torn into for `downedPower` times the damage, and once one falls, or the EMP goes
 * off, U-7 goes straight for the next machine that's down.
 */
export interface CutSettings {
  tickSeconds: number;
  power: number;
  charge: number;
  downedPower: number;
}

/**
 * The cut keeps in its memory the `targetId`, the seconds until the next tick (`untilTick`) and until the damage so
 * far is reported (`untilReport`), and the damage dealt since the last report (`unreported`) and whether any of it
 * was a critical hit (`crit`). See EXTENSIONS.md.
 */
export const CUT: WeaponAttack<CutSettings> = {
  attack({ state, target, dt, events, settings, memory }) {
    const { hero } = state;
    const melee = meleeOf(state);
    // Held for this step; the hero moves before enemies do, so it's free again the step the cut stops.
    target.rootedFor = Math.max(target.rootedFor, dt);
    if (memory.targetId === undefined) {
      Object.assign(memory, { targetId: target.id, untilTick: 0, unreported: 0, crit: 0, untilReport: CUT_REPORT_SECONDS });
    }
    hero.resource = Math.min(hero.maxResource, hero.resource + settings.charge * dt);
    memory.untilTick! -= dt;
    memory.untilReport! -= dt;
    while (memory.untilTick! <= 0 && !target.dead) {
      memory.untilTick! += settings.tickSeconds;
      const crit = chance(state.rng, melee.critChance);
      const swing = range(state.rng, hero.damage[0], hero.damage[1]) + hero.bonusDamage;
      const downed = target.stunnedFor > 0 ? settings.downedPower : 1;
      const amount = swing * (settings.tickSeconds / melee.cooldown) * settings.power * downed * (crit ? melee.critMultiplier : 1);
      memory.unreported! += amount;
      if (crit) memory.crit = 1;
      // The killing tick is reported first, so its number shows before the machine falls.
      if (target.hp <= amount) report(memory, target, events);
      hurtEnemy(state, target, amount, 0, 0, 0, events);
    }
    if (target.dead) goForNextDowned(state);
    else if (memory.untilReport! <= 0) report(memory, target, events);
  },

  skillUsed({ state }) {
    if ((findEnemy(state, state.hero.targetId)?.stunnedFor ?? 0) <= 0) goForNextDowned(state);
  },

  // Reports what it dealt since last time.
  stop({ state, events, memory }) {
    const target = memory.targetId === undefined ? null : findEnemy(state, memory.targetId);
    if (target) report(memory, target, events);
  },
};

function report(memory: Record<string, number>, e: Enemy, events: SimEvent[]): void {
  memory.untilReport = CUT_REPORT_SECONDS;
  if (!memory.unreported || memory.unreported <= 0) return;
  events.push({ type: 'EnemyDamaged', enemyId: e.id, amount: Math.max(1, Math.round(memory.unreported)), crit: Boolean(memory.crit), x: e.x, y: e.y });
  memory.unreported = 0;
  memory.crit = 0;
}
