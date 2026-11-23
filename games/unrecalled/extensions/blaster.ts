import { dist } from '../../../engine/core/math';
import { chance, range } from '../../../engine/core/rng';
import { damageEnemy } from '../../../engine/sim/combat';
import { currentLevel, type Enemy, type GameState, type SimEvent } from '../../../engine/sim/state';
import type { WeaponAttack } from '../../../engine/sim/weapon-attacks';
import { meleeOf } from '../../../engine/sim/weapons';
import { steerTowards } from '../../../engine/sim/walking';
import { hasLineOfSight } from '../../../engine/world/line-of-sight';

/** One kind of hit: `power` times a swing's damage, every `seconds`, landing within `reach` of the target's edge. */
interface Blow {
  reach: number;
  power: number;
  knockback: number;
  seconds: number;
}

/**
 * U-7's hand blaster and fists. Within `range` of a machine it shoots, every `shotSeconds` for `cost` charge; once the
 * machine is within `punch.within` of it, it steps in and punches it back, at most once every `punch.cooldown`, and
 * shoots it point-blank in between (a boss, which can't be thrown back, is only ever shot). A machine that's down
 * (stunned) is open: U-7 dashes in at `dash` times its speed and keeps tearing at its core with powered strikes until
 * it dies or gets up. The weapon's `engageRange` should reach past `range`, so U-7 walks into range itself and can
 * dash from further out.
 */
export interface BlastSettings {
  range: number;
  shotSeconds: number;
  cost: number;
  power: number;
  knockback: number;
  punch: Blow & { within: number; cooldown: number };
  strike: Blow & { dash: number };
}

/** The signals the blaster sends, for the game to draw and sound: a shot landing, a punch, and a powered strike. */
export const BLAST_SIGNAL = { shot: 'blast', punch: 'punch', strike: 'poweredStrike' } as const;

/** How far round U-7 it looks for the next machine that's down, once it has finished one. */
const NEXT_DOWNED_RANGE = 6;
/** After a punch or a strike U-7 holds still this long, so the blow is seen before it moves on. */
const HOLD_AFTER_BLOW = 0.25;

/**
 * Keeps `untilHit`, the seconds until it can shoot or hit again, and `untilPunch`, until it can punch again, in its
 * memory, and holds U-7 still after a blow with the hero's `attackCooldown`, which outlasts a change of target. See
 * EXTENSIONS.md.
 */
export const BLAST: WeaponAttack<BlastSettings> = {
  attack({ state, target, dt, events, settings, memory }) {
    const { hero } = state;
    const { map } = currentLevel(state).level;
    memory.untilHit = (memory.untilHit ?? 0) - dt;
    memory.untilPunch = (memory.untilPunch ?? 0) - dt;
    if (hero.attackCooldown > 0) return;
    const d = dist(hero.x, hero.y, target.x, target.y);
    const closeIn = (speed: number): void => {
      steerTowards(map, hero, target.x, target.y, speed, dt);
      hero.moving = true;
    };
    const inReach = (blow: Blow): boolean => d <= blow.reach + target.r + hero.r;

    if (target.stunnedFor > 0) {
      const { strike } = settings;
      if (!inReach(strike)) return closeIn(hero.speed * strike.dash);
      if (memory.untilHit > 0) return;
      blow(state, target, strike, BLAST_SIGNAL.strike, memory, events);
      hero.attackCooldown = HOLD_AFTER_BLOW;
      if (target.dead) goForNextDowned(state);
      return;
    }
    const { punch } = settings;
    if (d <= punch.within + target.r + hero.r && memory.untilPunch <= 0 && !state.rules.enemies[target.kind]?.boss) {
      if (!inReach(punch)) return closeIn(hero.speed);
      if (memory.untilHit > 0) return;
      blow(state, target, punch, BLAST_SIGNAL.punch, memory, events);
      memory.untilPunch = punch.cooldown;
      hero.attackCooldown = HOLD_AFTER_BLOW;
      return;
    }
    if (d > settings.range + target.r || !hasLineOfSight(map, hero.x, hero.y, target.x, target.y)) return closeIn(hero.speed);
    if (memory.untilHit > 0 || hero.resource < settings.cost) return;
    hero.resource -= settings.cost;
    blow(state, target, { reach: settings.range, power: settings.power, knockback: settings.knockback, seconds: settings.shotSeconds }, BLAST_SIGNAL.shot, memory, events);
  },
};

function blow(state: GameState, target: Enemy, b: Blow, signal: string, memory: Record<string, number>, events: SimEvent[]): void {
  const { hero } = state;
  memory.untilHit = b.seconds;
  events.push({ type: 'Signal', name: signal, x: target.x, y: target.y, enemyId: target.id });
  const melee = meleeOf(state);
  const crit = chance(state.rng, melee.critChance);
  const amount = Math.round((range(state.rng, hero.damage[0], hero.damage[1]) + hero.bonusDamage) * b.power * (crit ? melee.critMultiplier : 1));
  const d = dist(hero.x, hero.y, target.x, target.y) || 1;
  damageEnemy(state, target, Math.max(1, amount), crit, (target.x - hero.x) / d, (target.y - hero.y) / d, b.knockback, events);
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
