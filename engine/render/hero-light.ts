import type { Mood } from './look';

/** The light a hero carries when a mood doesn't say: a warm white lantern held at head height. */
export const LANTERN = { colour: 0xfff1dd, height: 1.2, intensity: 1.4 };

/** How far a hero's light reaches beside the mood's radius, so its fall-off ends a little past the area it lights. */
const REACH = 1.6;

/** How long a light that goes out with its hero takes to fade out, or back in when they get up, in seconds. */
export const HERO_LIGHT_FADE_SECONDS = 0.8;

/** The hero's light in `mood`: its colour, height above the ground in tiles, brightness and reach in tiles. */
export function heroLightOf(mood: Mood): {
  colour: number; height: number; intensity: number; distance: number; outWhenDead: boolean;
} {
  const { colour, height, intensity, outWhenDead = false }: NonNullable<Mood['heroLight']> = mood.heroLight ?? LANTERN;
  return { colour, height, intensity, outWhenDead, distance: mood.heroLightRadius * REACH };
}

/**
 * How bright, from 0 (out) to 1, a light that goes out with its hero is `seconds` after it was at `level`, fading
 * towards out while the hero is dead and back to full while they're alive.
 */
export function heroLightLevel(level: number, dead: boolean, seconds: number): number {
  const step = seconds / HERO_LIGHT_FADE_SECONDS;
  return dead ? Math.max(0, level - step) : Math.min(1, level + step);
}
