import { describe, expect, it } from 'vitest';
import { holds, reached, stepIndex, stepNumbers } from './story-steps';
import { arena, OPEN_ROOM } from './testing';

const QUEST = [{ id: 'start' }, { id: 'asked' }, {}, { id: 'done' }];

function at(step: number, weapon: string | null = null) {
  const state = arena(OPEN_ROOM, { x: 2, y: 2 });
  state.rules.quest = QUEST;
  state.quest = step;
  state.hero.weapon = weapon;
  return state;
}

describe('story steps', () => {
  it('finds a step by its name, and refuses a name no step has', () => {
    expect(stepIndex(QUEST, 'done')).toBe(3);
    expect(() => stepIndex(QUEST, 'missing')).toThrow('No quest step is named "missing"');
  });

  it('numbers the named steps, so inserting one moves the numbers but never the names', () => {
    expect(stepNumbers([{ id: 'start' }, { id: 'asked' }, {}, { id: 'done' }])).toEqual({ start: 0, asked: 1, done: 3 });
  });

  it('knows when a step has been reached', () => {
    expect([reached(at(1), 'asked'), reached(at(2), 'asked'), reached(at(2), 'done')]).toEqual([true, true, false]);
  });

  it('holds a condition only when every part of it holds', () => {
    expect(holds(at(0), {})).toBe(true);
    expect([holds(at(0), { from: 'asked' }), holds(at(1), { from: 'asked' })]).toEqual([false, true]);
    expect([holds(at(2), { until: 'done' }), holds(at(3), { until: 'done' })]).toEqual([true, false]);
    expect([holds(at(1), { at: 'asked' }), holds(at(2), { at: 'asked' })]).toEqual([true, false]);
    expect([holds(at(1, 'saw'), { holding: 'saw' }), holds(at(1), { holding: 'saw' }), holds(at(1), { holding: null })]).toEqual([true, false, true]);
    expect(holds(at(2), { from: 'asked', until: 'done', not: { holding: 'saw' } })).toBe(true);
    expect(holds(at(2, 'saw'), { from: 'asked', until: 'done', not: { holding: 'saw' } })).toBe(false);
  });

  it('checks the story\'s flags, and can be asked about another step than the current one', () => {
    const state = at(2);
    expect(holds(state, { flag: 'wentDown' })).toBe(false);
    state.flags.wentDown = true;
    expect(holds(state, { flag: 'wentDown' })).toBe(true);
    expect([holds(state, { at: 'asked' }), holds(state, { at: 'asked' }, 1)]).toEqual([false, true]);
  });
});
