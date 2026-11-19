import type { GameContent } from '../../../engine/sim/content';
import { watchFor } from '../../../engine/story/story-runner';
import { buildArena } from '../levels/arena';
import { buildFloor, FLOOR_ORDER } from '../levels/foundry';
import { buildInterior, INTERIOR_IDS } from '../levels/interiors';
import { buildRustbelt } from '../levels/rustbelt';
import { buildUpriver } from '../levels/upriver';
import { CALM, STEP_ACTIONS } from '../extensions/calm-machines';
import { CUT } from '../extensions/cutting';
import { ENEMIES } from './enemies';
import { HERO } from './hero';
import { NPCS } from '../story/people';
import { QUEST } from '../story/quest';
import { RULES } from '../story/rules';

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
    // Machines keep pace with U-7, so a level gained makes fights easier without making them trivial.
    enemyGrowthPerHeroLevel: 0.05,
    watch: watchFor(RULES),
    abilities: { calm: CALM },
    stepActions: STEP_ACTIONS,
    weaponAttacks: { cut: CUT },
  };
}
