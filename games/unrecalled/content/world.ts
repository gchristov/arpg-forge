import type { GameContent } from '../../../engine/sim/content';
import { buildFoundry } from '../levels/foundry';
import { ENEMIES } from './enemies';
import { HERO } from './hero';

/** Unrecalled as the rules see it. For now, the Foundry's first floor on its own, to judge the look. */
export function unrecalledContent(): GameContent {
  return {
    levels: [buildFoundry()],
    startLevel: 'foundry',
    hero: HERO,
    enemies: ENEMIES,
    npcRadius: 0.32,
    npcs: {},
    quest: [{}],
  };
}
