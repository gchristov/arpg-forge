/**
 * A fixed-rate loop. The rules advance in steps of exactly `stepSeconds`, however long each frame takes, and
 * drawing uses the returned fraction to smooth between the last two states.
 */
export interface FixedLoop {
  readonly stepSeconds: number;
  /** Frames longer than this are cut short, so the game slows down after a stall instead of jumping ahead. */
  readonly maxFrameSeconds: number;
  accumulator: number;
}

export function createFixedLoop(stepSeconds = 1 / 60, maxFrameSeconds = 0.25): FixedLoop {
  return { stepSeconds, maxFrameSeconds, accumulator: 0 };
}

/**
 * Runs `step` as many times as the frame's time allows and returns how far the clock is into the next step
 * (0 to 1), for smoothing between states.
 */
export function advance(loop: FixedLoop, frameSeconds: number, step: (dt: number) => void): number {
  loop.accumulator += Math.min(Math.max(frameSeconds, 0), loop.maxFrameSeconds);
  while (loop.accumulator >= loop.stepSeconds) {
    step(loop.stepSeconds);
    loop.accumulator -= loop.stepSeconds;
  }
  return loop.accumulator / loop.stepSeconds;
}
