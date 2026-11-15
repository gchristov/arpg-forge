import type { EnemyType } from '../../../engine/sim/content';

export interface UnrecalledEnemy extends EnemyType {
  name: string;
}

/**
 * The Foundry's machines: crawlers in packs, slow heavy loaders, sentries that shoot from range, and its boss. They're
 * all calm: they recognise the salvager as one of their own and keep working, until something on their floor is hit.
 */
export const ENEMIES: Record<string, UnrecalledEnemy> = {
  crawler: {
    name: 'Crawler', hp: 42, damage: [4, 8], speed: 2.8, range: 0.8, cooldown: 0.9, windUp: 0.28, aggro: 6,
    xp: 10, drops: { gold: [2, 7], healingChance: 0.15 }, radius: 0.24, groupSize: 4, calm: true,
  },
  loader: {
    name: 'Loader', hp: 130, damage: [12, 18], speed: 1.5, range: 1.0, cooldown: 1.6, windUp: 0.55, aggro: 6,
    xp: 24, drops: { gold: [6, 14], healingChance: 0.25 }, radius: 0.4, groupSize: 2, calm: true,
  },
  sentry: {
    name: 'Sentry', hp: 55, damage: [7, 12], speed: 1.8, range: 6.5, ranged: true, cooldown: 2.0, windUp: 0.5,
    aggro: 8, xp: 20, drops: { gold: [5, 12], healingChance: 0.2 }, radius: 0.3, groupSize: 2, calm: true,
  },
  orderEngine: {
    name: 'The Order Engine', hp: 650, damage: [13, 21], speed: 1.4, range: 1.3, cooldown: 1.5, windUp: 0.55, aggro: 8,
    xp: 250, drops: { gold: [120, 160], healingChance: 1, extraHealingItems: 1 }, radius: 0.62, boss: true, groupSize: 1, calm: true,
    slam: { everySeconds: [5, 7], reach: 6, radius: 1.8, delay: 1.0, damage: [18, 26] },
    summon: { belowHealthShare: 0.5, kind: 'crawler', count: 4, distance: 1.8 },
  },
};
