import { describe, expect, it } from 'vitest';
import { createGameState } from '../../engine/sim/setup';
import { currentLevel, type Command, type GameState, type SimEvent } from '../../engine/sim/state';
import { step } from '../../engine/sim/step';
import { unrecalledContent } from './content/world';
import { FLOOR_ORDER } from './levels/foundry';

const DT = 1 / 60;
const content = unrecalledContent();

/** Runs the rules for a while, sending `commands` on the first step, and returns every event. */
function play(state: GameState, seconds: number, commands: Command[] = []): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    events.push(...step(state, { commands: i === 0 ? commands : [], held: null }, DT));
  }
  return events;
}

/** A hero nothing can stop, so a test can walk the Foundry without fighting its way through. */
function untouchable(state: GameState): GameState {
  state.hero.hp = state.hero.maxHp = 1e9;
  return state;
}

/** Walks onto the current floor's portal to `to`. */
function takeDoor(state: GameState, to: string): void {
  const door = currentLevel(state).level.portals.find((p) => p.to === to)!;
  play(state, 25, [{ type: 'walkInto', tx: door.tx, ty: door.ty }]);
  play(state, 1);
}

describe('Unrecalled scenarios', () => {
  it('starts at the bottom of Intake', () => {
    const state = createGameState(content, 1);
    expect(state.levelId).toBe('intake');
    expect([state.hero.x, state.hero.y]).toEqual([12.5, 12.5]);
  });

  it('goes down through every floor to the Assembly Hall, and back up to Intake', () => {
    const state = untouchable(createGameState(content, 1));
    for (const next of FLOOR_ORDER.slice(1)) {
      takeDoor(state, next);
      expect(state.levelId).toBe(next);
    }
    for (const previous of [...FLOOR_ORDER].reverse().slice(1)) {
      takeDoor(state, previous);
      expect(state.levelId).toBe(previous);
    }
  });

  it('finishes the quest when the Order Engine falls', () => {
    const state = untouchable(createGameState(content, 1));
    state.hero.damage = [1000, 1000];
    for (const next of FLOOR_ORDER.slice(1)) takeDoor(state, next);
    expect(state.quest).toBe(3);
    const engine = currentLevel(state).enemies.find((e) => e.kind === 'orderEngine')!;
    for (let i = 0; i < 20 && !engine.dead; i++) play(state, 1, [{ type: 'attack', enemyId: engine.id }]);
    expect(engine.dead).toBe(true);
    expect(state.quest).toBe(4);
  });
});
