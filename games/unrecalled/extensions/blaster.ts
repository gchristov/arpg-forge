import { dist } from '../../../engine/core/math';
import { chance, range } from '../../../engine/core/rng';
import { damageEnemy, findEnemy, hurtEnemy } from '../../../engine/sim/combat';
import { currentLevel, type Enemy, type GameState, type SimEvent } from '../../../engine/sim/state';
import type { WeaponAttack } from '../../../engine/sim/weapon-attacks';
import { meleeOf } from '../../../engine/sim/weapons';
import { steerTowards } from '../../../engine/sim/walking';
import { hasLineOfSight } from '../../../engine/world/line-of-sight';

/**
 * U-7's hand blaster. Within `range` of a machine it holds a beam on it, which burns `power` times a swing's damage a
 * second and siphons `charge` charge a second out of it into U-7, reported every `reportSeconds`: it's the way to
 * charge up faster than the slow trickle. A machine that's down (stunned) is open: U-7 dashes in at `strike.dash`
 * times its speed and keeps tearing at its core with a combo of powered strikes until it dies or gets up, each blow
 * `power` times a swing, knocking it back `knockback` tiles, with `seconds` before the next. The weapon's
 * `engageRange` should reach past `range`, so U-7 walks into range itself and can dash from further out.
 */
export interface BlastSettings {
  range: number;
  power: number;
  charge: number;
  reportSeconds: number;
  strike: { reach: number; dash: number; combo: Blow[] };
}

export interface Blow {
  power: number;
  seconds: number;
  knockback?: number;
}

/** The signals sent for each blow of a combo in turn, for the game to draw and sound. */
export const BLOW_SIGNALS = ['poweredJab', 'poweredCross', 'poweredFinish'];

export function isBlow(signal: string): boolean {
  return BLOW_SIGNALS.includes(signal);
}

/** How far round U-7 it looks for the next machine that's down, once it has finished one. */
const NEXT_DOWNED_RANGE = 6;
/** After a strike U-7 holds still this long, so the blow is seen before it moves on. */
const HOLD_AFTER_STRIKE = 0.25;

/**
 * Keeps in its memory `beaming` (1 while the beam is on the target, for the look), `untilStrike`, the seconds until it
 * can strike again, `blow`, the combo's next blow, and `comboOn`, the machine it's on, so a new one starts afresh, and like the chainsaw's cut, the beam's damage since it was last reported (`unreported`, `crit`)
 * and the seconds until it's next reported (`untilReport`). It holds U-7 still after a strike with the hero's
 * `attackCooldown`, which outlasts a change of target. See EXTENSIONS.md.
 */
export const BLAST: WeaponAttack<BlastSettings> = {
  attack({ state, target, dt, events, settings, memory }) {
    const { hero } = state;
    const { map } = currentLevel(state).level;
    memory.beaming = 0;
    memory.untilStrike = (memory.untilStrike ?? 0) - dt;
    if (hero.attackCooldown > 0) return;
    const d = dist(hero.x, hero.y, target.x, target.y);
    const closeIn = (speed: number): void => {
      steerTowards(map, hero, target.x, target.y, speed, dt);
      hero.moving = true;
    };

    if (target.stunnedFor > 0) {
      const { strike } = settings;
      report(memory, target, events);
      if (d > strike.reach + target.r + hero.r) return closeIn(hero.speed * strike.dash);
      if (memory.untilStrike > 0) return;
      if (memory.comboOn !== target.id) [memory.comboOn, memory.blow] = [target.id, 0];
      const index = (memory.blow ?? 0) % strike.combo.length;
      const blow = strike.combo[index]!;
      memory.blow = index + 1;
      memory.untilStrike = blow.seconds;
      hero.attackCooldown = Math.min(HOLD_AFTER_STRIKE, blow.seconds);
      events.push({ type: 'Signal', name: BLOW_SIGNALS[index % BLOW_SIGNALS.length]!, x: target.x, y: target.y, enemyId: target.id });
      const { amount, crit } = roll(state, blow.power);
      const k = d || 1;
      damageEnemy(state, target, Math.max(1, Math.round(amount)), crit, (target.x - hero.x) / k, (target.y - hero.y) / k, blow.knockback ?? 0, events);
      if (target.dead) goForNextDowned(state);
      return;
    }
    memory.comboOn = -1;
    if (d > settings.range + target.r || !hasLineOfSight(map, hero.x, hero.y, target.x, target.y)) {
      report(memory, target, events);
      return closeIn(hero.speed);
    }
    hero.resource = Math.min(hero.maxResource, hero.resource + settings.charge * dt);
    memory.beaming = 1;
    const { amount, crit } = roll(state, settings.power * dt);
    memory.unreported = (memory.unreported ?? 0) + amount;
    if (crit) memory.crit = 1;
    memory.untilReport = (memory.untilReport ?? settings.reportSeconds) - dt;
    // The killing burn is reported first, so its number shows before the machine falls.
    if (target.hp <= amount || memory.untilReport <= 0) {
      report(memory, target, events);
      memory.untilReport = settings.reportSeconds;
    }
    hurtEnemy(state, target, amount, 0, 0, 0, events);
  },

  // Reports what the beam dealt since last time.
  stop({ state, events, memory }) {
    const target = findEnemy(state, state.hero.engagedId);
    if (target) report(memory, target, events);
  },
};

/** `power` times a swing's damage, maybe a critical hit. */
function roll(state: GameState, power: number): { amount: number; crit: boolean } {
  const { hero } = state;
  const melee = meleeOf(state);
  const crit = chance(state.rng, melee.critChance);
  const swing = range(state.rng, hero.damage[0], hero.damage[1]) + hero.bonusDamage;
  return { amount: swing * power * (crit ? melee.critMultiplier : 1), crit };
}

function report(memory: Record<string, number>, e: Enemy, events: SimEvent[]): void {
  if (!memory.unreported || memory.unreported <= 0) return;
  events.push({ type: 'EnemyDamaged', enemyId: e.id, amount: Math.max(1, Math.round(memory.unreported)), crit: Boolean(memory.crit), x: e.x, y: e.y });
  memory.unreported = 0;
  memory.crit = 0;
}

/** Moves straight on to the nearest machine that's still down, if there is one. */
function goForNextDowned(state: GameState): void {
  const { hero } = state;
  let best: Enemy | null = null;
  let bestDistance = NEXT_DOWNED_RANGE;
  for (const e of currentLevel(state).enemies) {
    if (e.dead || e.stunnedFor <= 0) continue;
    const d = dist(hero.x, hero.y, e.x, e.y);
    if (d < bestDistance) [best, bestDistance] = [e, d];
  }
  if (best) hero.targetId = best.id;
}
