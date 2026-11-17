import type { GameState, SimEvent } from './state';

/** The fade between levels. */
const TRANSITION_SECONDS = 0.3;

/** Starts the hero's move to level `to`, arriving at `x`, `y` once the screen has faded. */
export function travel(state: GameState, to: string, x: number, y: number, events: SimEvent[]): void {
  state.transition = { to, x, y, remaining: TRANSITION_SECONDS };
  events.push({ type: 'TransitionStarted', to });
}
