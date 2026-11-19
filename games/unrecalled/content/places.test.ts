import { describe, expect, it } from 'vitest';
import { createGameState } from '../../../engine/sim/setup';
import { TOWN_WIDTH } from '../levels/rustbelt';
import { placeOf, WOODS } from './places';
import { unrecalledContent } from './world';

const state = createGameState(unrecalledContent(), 1);
const at = (x: number) => {
  state.hero.x = x;
  return state;
};

describe('places', () => {
  it('names the town, and the woods once U-7 is well into the trees', () => {
    expect(placeOf(at(22), null).name).toBe('Rustbelt');
    expect(placeOf(at(TOWN_WIDTH + 0.5), null).name).toBe('Rustbelt');
    expect(placeOf(at(TOWN_WIDTH + 3), null)).toBe(WOODS);
  });

  it('keeps the place U-7 was in while it stands about on the treeline', () => {
    const town = placeOf(at(22), null);
    expect(placeOf(at(TOWN_WIDTH + 1), town).name).toBe('Rustbelt');
    expect(placeOf(at(TOWN_WIDTH - 1), WOODS)).toBe(WOODS);
    expect(placeOf(at(TOWN_WIDTH - 3), WOODS).name).toBe('Rustbelt');
  });
});
