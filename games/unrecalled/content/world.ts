import type { GameContent } from '../../../engine/sim/content';
import { buildFloor, FLOOR_ORDER } from '../levels/foundry';
import { buildRustbelt } from '../levels/rustbelt';
import { ENEMIES } from './enemies';
import { HERO } from './hero';
import { NPCS, QUEST } from './story';

/** Unrecalled as the rules see it: Rustbelt, and the Foundry's four floors down to the Order Engine. */
export function unrecalledContent(): GameContent {
  return {
    levels: [buildRustbelt(), ...FLOOR_ORDER.map(buildFloor)],
    startLevel: 'rustbelt',
    hero: HERO,
    enemies: ENEMIES,
    npcRadius: 0.32,
    npcs: NPCS,
    quest: QUEST.map(({ text: _text, ...step }) => step),
  };
}
