import { currentLevel, type GameState } from '../../../engine/sim/state';
import { TOWN_WIDTH } from '../levels/rustbelt';

export interface Place {
  name: string;
  subtitle: string;
}

/** The dead woods east of the town: part of Rustbelt's map, with a name of its own. */
export const WOODS: Place = { name: 'The Dead Woods', subtitle: 'The logging camp is somewhere east' };

/** How far past the treeline the salvager walks before the place they're in changes, so it doesn't flicker on the line. */
const MARGIN = 1.5;

/** Where the salvager is: their level, or the part of it with a name of its own. `was` is where they were a moment ago. */
export function placeOf(state: GameState, was: Place | null): Place {
  const { level } = currentLevel(state);
  if (state.levelId === 'rustbelt') {
    const inWoods = was?.name === WOODS.name ? state.hero.x > TOWN_WIDTH - MARGIN : state.hero.x > TOWN_WIDTH + MARGIN;
    if (inWoods) return WOODS;
  }
  return { name: level.name, subtitle: level.subtitle };
}
