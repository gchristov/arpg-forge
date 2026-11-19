import type { GameContent } from '../../../engine/sim/content';
import { buildInterior, INTERIOR_IDS } from '../levels/interiors';
import { generateVillage } from '../levels/village';
import { ENEMIES } from './enemies';
import { HERO } from './hero';
import { NPCS, QUEST } from './story';

/** Ashen Hollow as the rules see it: the village and its four interiors. */
export function ashenHollowContent(): GameContent {
  const village = generateVillage();
  const interiors = INTERIOR_IDS.map(buildInterior);
  return {
    levels: [
      {
        level: village.level, spawns: village.spawns, camps: village.camps, npcs: village.npcs,
        campRespawns: { everySeconds: 30, maxAlive: 12, minHeroDistance: 12, kinds: ['goblin', 'skeleton'] },
      },
      ...interiors,
    ],
    startLevel: 'town',
    hero: HERO,
    enemies: ENEMIES,
    npcRadius: 0.32,
    npcs: NPCS,
    quest: QUEST.map(({ text: _text, ...step }) => step),
  };
}
