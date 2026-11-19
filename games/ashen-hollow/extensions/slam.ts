import { range } from '../../../engine/core/rng';
import type { EnemyAbility } from '../../../engine/sim/abilities';
import type { Range } from '../../../engine/sim/content';
import { enemyDamage } from '../../../engine/sim/enemy-strength';

export interface SlamSettings {
  /** How long between slams, chosen afresh each time. */
  everySeconds: Range;
  /** It only slams when the hero is this near. */
  reach: number;
  /** The circle it marks under the hero. */
  radius: number;
  /** How long the circle shows before it lands. */
  delay: number;
  damage: Range;
}

/** The first slam comes this long into a fight. */
const FIRST_SLAM_SECONDS = 4;

/**
 * The Bone Lord's slam: now and then it marks a circle under the hero that lands after a moment, so standing still
 * is punished. Uses the engine's telegraphed area attack.
 */
export const slam: EnemyAbility<SlamSettings> = {
  fight({ state, enemy, distance, dt, events, settings, memory }) {
    const { hero } = state;
    memory.slamIn = (memory.slamIn ?? FIRST_SLAM_SECONDS) - dt;
    if (memory.slamIn > 0 || distance >= settings.reach || enemy.windUp >= 0) return;
    memory.slamIn = range(state.rng, settings.everySeconds[0], settings.everySeconds[1]);
    const damage: Range = [enemyDamage(state, enemy, settings.damage[0]), enemyDamage(state, enemy, settings.damage[1])];
    state.telegraphs.push({ x: hero.x, y: hero.y, radius: settings.radius, elapsed: 0, delay: settings.delay, damage });
    enemy.swing = 0;
    events.push({ type: 'SlamWarned', enemyId: enemy.id, x: hero.x, y: hero.y });
  },
};
