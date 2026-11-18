import type { GameContent } from '../../../engine/sim/content';
import { buildArena } from '../levels/arena';
import { buildFloor, FLOOR_ORDER } from '../levels/foundry';
import { buildInterior, INTERIOR_IDS } from '../levels/interiors';
import { buildRustbelt } from '../levels/rustbelt';
import { buildUpriver } from '../levels/upriver';
import { ENEMIES } from './enemies';
import { HERO } from './hero';
import { NPCS, QUEST } from './story';

/**
 * Unrecalled as the rules see it: Rustbelt, its buildings and the dead woods to its east, and the Foundry's four floors
 * down to the Order Engine, the Assembly upriver where the story ends, plus a practice arena off the map.
 */
export function unrecalledContent(): GameContent {
  return {
    levels: [buildRustbelt(), ...INTERIOR_IDS.map(buildInterior), ...FLOOR_ORDER.map(buildFloor), buildUpriver(), buildArena()],
    startLevel: 'rustbelt',
    hero: HERO,
    enemies: ENEMIES,
    npcRadius: 0.32,
    npcs: NPCS,
    quest: QUEST.map(({ text: _text, ...step }) => step),
    // Machines keep pace with the salvager, so a level gained makes fights easier without making them trivial.
    enemyGrowthPerHeroLevel: 0.05,
  };
}
