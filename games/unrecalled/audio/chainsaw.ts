import type { Synth } from '../../../engine/audio/synth';
import { currentLevel, type GameState } from '../../../engine/sim/state';

/**
 * The chainsaw's engine, running while it's in U-7's hand: a low putter at rest, a little higher on the move, revving
 * up and grinding while it cuts, lower and harder into a machine that's down, and winding off when U-7 goes down or
 * swaps to the blaster, whose beam hums instead.
 */
export function chainsawEngine(s: Synth) {
  const drone = s.drone('sawtooth', 0.55);
  return {
    /** Sets the engine for this frame; `running` is false before play starts. */
    update(state: GameState, running: boolean): void {
      const { hero } = state;
      const sawing = hero.weapon === 'chainsaw';
      if (!running || hero.dead) drone.set(36, 0, 6, 0.6);
      else if (sawing && hero.engagedId !== null) {
        const downed = (currentLevel(state).enemies.find((e) => e.id === hero.engagedId)?.stunnedFor ?? 0) > 0;
        if (downed) drone.set(96, 0.075, 34, 0.1);
        else drone.set(122, 0.055, 28, 0.15);
      }
      // The blaster's beam hums higher and thinner than the saw.
      else if (hero.attackMemory.beaming) drone.set(260, 0.03, 40, 0.08);
      else if (!sawing) drone.set(36, 0, 6, 0.3);
      else if (hero.moving) drone.set(56, 0.026, 12, 0.35);
      else drone.set(44, 0.022, 9, 0.5);
    },
  };
}
