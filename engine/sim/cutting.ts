import { chance, range } from '../core/rng';
import { findEnemy, hurtEnemy } from './combat';
import type { Enemy, GameState, SimEvent } from './state';

/**
 * Damage from cutting is reported this often rather than on every tick, so the target shows one number, one flinch and
 * one sound at a time.
 */
export const CUT_REPORT_SECONDS = 0.4;

/** Keeps cutting into `e` for `dt` seconds, with the hero's continuous melee attack, starting the cut if needed. */
export function cut(state: GameState, e: Enemy, dt: number, events: SimEvent[]): void {
  const { hero } = state;
  const melee = state.rules.hero.melee;
  const tick = melee.continuous!.tickSeconds;
  if (hero.cut?.targetId !== e.id) {
    stopCutting(state, events);
    hero.cut = { targetId: e.id, untilTick: 0, unreported: 0, crit: false, untilReport: CUT_REPORT_SECONDS };
  }
  const c = hero.cut!;
  c.untilTick -= dt;
  c.untilReport -= dt;
  while (c.untilTick <= 0 && !e.dead) {
    c.untilTick += tick;
    const crit = chance(state.rng, melee.critChance);
    const swing = range(state.rng, hero.damage[0], hero.damage[1]) + hero.bonusDamage;
    const amount = swing * (tick / melee.cooldown) * melee.continuous!.power * (crit ? melee.critMultiplier : 1);
    c.unreported += amount;
    c.crit ||= crit;
    // The killing tick is reported first, so its number shows before the machine falls.
    if (e.hp <= amount) report(state, e, events);
    hurtEnemy(state, e, amount, 0, 0, 0, events);
  }
  if (c.untilReport <= 0) report(state, e, events);
}

/** Ends the hero's cut, reporting what it dealt since last time. */
export function stopCutting(state: GameState, events: SimEvent[]): void {
  const c = state.hero.cut;
  if (!c) return;
  const e = findEnemy(state, c.targetId);
  if (e) report(state, e, events);
  state.hero.cut = null;
}

function report(state: GameState, e: Enemy, events: SimEvent[]): void {
  const c = state.hero.cut!;
  c.untilReport = CUT_REPORT_SECONDS;
  if (c.unreported <= 0) return;
  events.push({ type: 'EnemyDamaged', enemyId: e.id, amount: Math.max(1, Math.round(c.unreported)), crit: c.crit, x: e.x, y: e.y });
  c.unreported = 0;
  c.crit = false;
}
