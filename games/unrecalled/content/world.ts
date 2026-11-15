import type { GameContent } from '../../../engine/sim/content';
import { buildFloor, FLOOR_ORDER } from '../levels/foundry';
import { ENEMIES } from './enemies';
import { HERO } from './hero';

/** Unrecalled as the rules see it. For now, the Foundry's four floors down to the Order Engine. */
export function unrecalledContent(): GameContent {
  return {
    levels: FLOOR_ORDER.map(buildFloor),
    startLevel: 'intake',
    hero: HERO,
    enemies: ENEMIES,
    npcRadius: 0.32,
    npcs: {},
    quest: [
      {},
      { reachedBy: { type: 'enter', levelId: 'sorting' } },
      { reachedBy: { type: 'enter', levelId: 'gallery' } },
      { reachedBy: { type: 'enter', levelId: 'assembly' } },
      { reachedBy: { type: 'kill', enemyKind: 'orderEngine' } },
    ],
  };
}
