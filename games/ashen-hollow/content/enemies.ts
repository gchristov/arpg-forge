import type { EnemyType } from '../../../engine/sim/content';
import type { SlamSettings } from '../extensions/slam';
import type { SummonSettings } from '../extensions/summon';

export interface AshenHollowEnemy extends EnemyType {
  name: string;
  /** Body size relative to a skeleton. */
  scale: number;
}

/** A skeleton's body radius; other enemies scale from it. */
const BASE_RADIUS = 0.3;

const enemy = (e: Omit<AshenHollowEnemy, 'radius'>): AshenHollowEnemy => ({ ...e, radius: BASE_RADIUS * e.scale });

export const ENEMIES: Record<string, AshenHollowEnemy> = {
  goblin: enemy({
    name: 'Goblin', hp: 30, damage: [4, 7], speed: 2.4, range: 0.85, cooldown: 1.0, windUp: 0.32, aggro: 6,
    xp: 12, drops: { gold: [3, 9], healingChance: 0.2 }, scale: 0.82, groupSize: 4,
  }),
  skeleton: enemy({
    name: 'Skeleton', hp: 44, damage: [6, 10], speed: 1.9, range: 0.9, cooldown: 1.2, windUp: 0.4, aggro: 7,
    xp: 18, drops: { gold: [5, 12], healingChance: 0.2 }, scale: 1, groupSize: 3,
  }),
  archer: enemy({
    name: 'Skeleton Archer', hp: 32, damage: [5, 9], speed: 1.7, range: 6.5, ranged: true, cooldown: 2.1, windUp: 0.55,
    aggro: 8, xp: 22, drops: { gold: [6, 14], healingChance: 0.2 }, scale: 1, groupSize: 3,
  }),
  boss: enemy({
    name: 'The Bone Lord', hp: 420, damage: [12, 19], speed: 1.75, range: 1.15, cooldown: 1.4, windUp: 0.5, aggro: 8,
    xp: 250, drops: { gold: [120, 160], healingChance: 1, extraHealingItems: 1 }, scale: 1.55, boss: true, groupSize: 1,
    abilities: {
      slam: { everySeconds: [5, 7], reach: 6, radius: 1.7, delay: 1.0, damage: [16, 24] } satisfies SlamSettings,
      summon: { belowHealthShare: 0.5, kind: 'skeleton', count: 3, distance: 1.6 } satisfies SummonSettings,
    },
  }),
};
