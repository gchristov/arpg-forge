import type { Synth } from '../../../engine/audio/synth';
import type { GameState } from '../../../engine/sim/state';

/**
 * The chainsaw's engine, running for as long as U-7 carries it: a low putter at rest, a little higher on the
 * move, revving up and grinding while it cuts, and winding off when U-7 goes down.
 */
export function chainsawEngine(s: Synth) {
  const drone = s.drone('sawtooth', 0.55);
  return {
    /** Sets the engine for this frame; `running` is false before play starts. */
    update(state: GameState, running: boolean): void {
      const { hero } = state;
      if (!running || hero.dead) drone.set(36, 0, 6, 0.6);
      else if (hero.engagedId !== null && hero.weapon === 'chainsaw') drone.set(122, 0.055, 28, 0.15);
      // The blaster's beam hums higher and thinner than the saw.
      else if (hero.attackMemory.beaming) drone.set(260, 0.03, 40, 0.08);
      else if (hero.moving) drone.set(56, 0.026, 12, 0.35);
      else drone.set(44, 0.022, 9, 0.5);
    },
  };
}
