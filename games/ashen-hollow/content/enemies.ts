export interface EnemyType {
  name: string;
  hp: number;
  damage: [min: number, max: number];
  /** Tiles a second. */
  speed: number;
  /** Attack reach in tiles, on top of both bodies' radii. */
  range: number;
  ranged?: boolean;
  /** Seconds between attacks. */
  cooldown: number;
  /** Seconds from starting an attack to it landing. */
  windUp: number;
  /** Distance at which it notices the hero. */
  aggro: number;
  xp: number;
  gold: [min: number, max: number];
  /** Body size relative to a skeleton. */
  scale: number;
  boss?: boolean;
  /** How many spawn together at a camp. */
  groupSize: number;
}

export const ENEMIES: Record<string, EnemyType> = {
  goblin: {
    name: 'Goblin', hp: 30, damage: [4, 7], speed: 2.4, range: 0.85, cooldown: 1.0, windUp: 0.32, aggro: 6,
    xp: 12, gold: [3, 9], scale: 0.82, groupSize: 4,
  },
  skeleton: {
    name: 'Skeleton', hp: 44, damage: [6, 10], speed: 1.9, range: 0.9, cooldown: 1.2, windUp: 0.4, aggro: 7,
    xp: 18, gold: [5, 12], scale: 1, groupSize: 3,
  },
  archer: {
    name: 'Skeleton Archer', hp: 32, damage: [5, 9], speed: 1.7, range: 6.5, ranged: true, cooldown: 2.1, windUp: 0.55,
    aggro: 8, xp: 22, gold: [6, 14], scale: 1, groupSize: 3,
  },
  boss: {
    name: 'The Bone Lord', hp: 420, damage: [12, 19], speed: 1.75, range: 1.15, cooldown: 1.4, windUp: 0.5, aggro: 8,
    xp: 250, gold: [120, 160], scale: 1.55, boss: true, groupSize: 1,
  },
};

/** A skeleton's body radius; other enemies scale from it. */
export const ENEMY_BASE_RADIUS = 0.3;
