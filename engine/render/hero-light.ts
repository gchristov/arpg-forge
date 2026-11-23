import type { Mood } from './look';

/** The light a hero carries when a mood doesn't say: a warm white lantern held at head height. */
export const LANTERN = { colour: 0xfff1dd, height: 1.2, intensity: 1.4 };

/** How far a hero's light reaches beside the mood's radius, so its fall-off ends a little past the area it lights. */
const REACH = 1.6;

/** The hero's light in `mood`: its colour, height above the ground in tiles, brightness and reach in tiles. */
export function heroLightOf(mood: Mood): { colour: number; height: number; intensity: number; distance: number } {
  return { ...(mood.heroLight ?? LANTERN), distance: mood.heroLightRadius * REACH };
}
