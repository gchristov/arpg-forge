import type { EnemyBody, GameContent } from '../../../engine/sim/content';
import { buildInterior, INTERIOR_IDS } from '../levels/interiors';
import { generateVillage } from '../levels/village';
import { ENEMIES, ENEMY_BASE_RADIUS } from './enemies';

const ENEMY_BODIES: Record<string, EnemyBody> = Object.fromEntries(
  Object.entries(ENEMIES).map(([kind, t]) => [kind, { radius: ENEMY_BASE_RADIUS * t.scale, groupSize: t.groupSize }]),
);

/** Ashen Hollow as the rules see it: the village and its four interiors. */
export function ashenHollowContent(): GameContent {
  const village = generateVillage();
  const interiors = INTERIOR_IDS.map(buildInterior);
  return {
    levels: [
      { level: village.level, spawns: village.spawns, camps: village.camps, npcs: village.npcs },
      ...interiors.map((i) => ({ level: i.level, spawns: i.spawns, camps: [], npcs: i.npcs })),
    ],
    startLevel: 'town',
    hero: { radius: 0.28, speed: 3.7, facingX: 0.6, facingY: -0.8 },
    enemies: ENEMY_BODIES,
    npcRadius: 0.32,
  };
}
