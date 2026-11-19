import { describe, expect, it } from 'vitest';
import { arena, OPEN_ROOM } from '../sim/testing';
import type { Command, GameState, SimEvent } from '../sim/state';
import type { ConversationView } from './conversation-view';
import { StoryRunner, watchFor, NEAR, type Rule } from './story-runner';
import type { Talk } from './talk';

/** A runner over a small story, recording what it says, shows and sends. */
function setUp(rules: Rule[]) {
  const state: GameState = arena(OPEN_ROOM, { x: 2.5, y: 2.5 });
  state.rules.quest = [{ id: 'start' }, { id: 'asked' }, { id: 'done' }];
  state.levels.arena!.readables.push({ tx: 4, ty: 4, id: 'sign' });
  state.levels.arena!.npcs.push({ ...state.hero, id: 77, kind: 'elder', name: 'Elder', placement: 0 } as never);
  const said: string[] = [];
  const shown: Array<{ talk: Talk; then?: () => void }> = [];
  const sent: Command[] = [];
  const conversation = { show: (talk: Talk, _npc: number | null, then?: () => void) => shown.push({ talk, then }) } as unknown as ConversationView;
  const runner = new StoryRunner(rules, {
    state,
    send: (c) => sent.push(c),
    conversation,
    people: { elder: { title: 'Elder', says: [{ text: 'Hello.' }] } },
    things: { sign: { title: 'Sign', says: [{ at: 'start', text: 'Inn.' }, { text: 'Closed.' }] } },
    voices: { crier: { name: 'Crier', voice: 'person' } },
    say: (text, from) => said.push(from ? `${from.name}: ${text}` : text),
    quiet: () => true,
    banner: (title) => said.push(`[${title}]`),
    sound: (name) => said.push(`(${name})`),
    actions: { cheer: () => said.push('hooray') },
  });
  return { state, runner, said, shown, sent };
}

describe('story runner', () => {
  it('does a rule\'s actions in order when its event comes and its condition holds', () => {
    const { state, runner, said } = setUp([
      { on: { reached: 'asked' }, do: [{ think: 'Off I go.' }, { say: 'Hear ye!', by: 'crier' }, { sound: 'bell' }, { run: 'cheer' }] },
      { on: { reached: 'asked' }, when: { flag: 'mute' }, do: [{ think: 'Never said.' }] },
    ]);
    state.quest = 1;
    runner.react([{ type: 'QuestAdvanced', step: 1 }]);
    expect(said).toEqual(['Off I go.', 'Crier: Hear ye!', '(bell)', 'hooray']);
  });

  it('does a `once` rule only the first time', () => {
    const { runner, said } = setUp([{ on: { enter: 'arena' }, once: true, do: [{ think: 'New place.' }] }]);
    runner.react([{ type: 'EnteredLevel', levelId: 'arena' }]);
    runner.react([{ type: 'EnteredLevel', levelId: 'arena' }]);
    expect(said).toEqual(['New place.']);
  });

  it('doesn\'t count getting back up in a level as walking into it', () => {
    const { runner, said } = setUp([{ on: { enter: 'arena' }, do: [{ think: 'New place.' }] }]);
    runner.react([{ type: 'HeroRespawned', goldLost: 0 } as SimEvent, { type: 'EnteredLevel', levelId: 'arena' }]);
    expect(said).toEqual([]);
  });

  it('listens for coming near at the reach the rule asks for, and tells the rules what to watch', () => {
    const rules: Rule[] = [{ on: { near: 'sign' }, do: [{ think: 'A sign.' }] }, { on: { near: 'sign', within: 9 }, do: [{ think: 'Something ahead.' }] }];
    const { runner, said } = setUp(rules);
    expect(watchFor(rules)).toEqual([{ id: 'sign', within: NEAR }, { id: 'sign', within: 9 }]);
    runner.react([{ type: 'Approached', id: 'sign', within: 9 }]);
    expect(said).toEqual(['Something ahead.']);
  });

  it('shows what a thing says when it\'s used, as it was before using it moved the story on', () => {
    const { state, runner, shown } = setUp([]);
    state.quest = 1;
    runner.react([{ type: 'Read', id: 'sign' } as SimEvent, { type: 'QuestAdvanced', step: 1 }]);
    expect(shown.map((s) => s.talk.pages[0]!.text)).toEqual(['Inn.']);
  });

  it('shows a page a rule opens instead of what the thing says, and runs what comes after once it\'s closed', () => {
    const page: Talk = { title: 'Note', pages: [{ text: 'Read me.', options: [{ label: 'Close' }] }] };
    const { state, runner, shown, sent } = setUp([{ on: { reached: 'asked' }, do: [{ show: page, then: [{ use: 'sign' }, { talk: 'elder' }] }] }]);
    state.quest = 1;
    runner.react([{ type: 'Read', id: 'sign' } as SimEvent, { type: 'QuestAdvanced', step: 1 }]);
    expect(shown.map((s) => s.talk.title)).toEqual(['Note']);
    shown[0]!.then!();
    expect(sent).toEqual([{ type: 'read', index: 0 }]);
    expect(shown.map((s) => s.talk.title)).toEqual(['Note', 'Elder']);
  });

  it('opens what someone says when they\'re talked to, and sets and clears flags through commands', () => {
    const { runner, shown, sent } = setUp([
      { on: { fell: true }, do: [{ flag: 'hurt' }] },
      { on: { bought: { from: 'elder', service: 0 } }, do: [{ unflag: 'hurt' }] },
    ]);
    runner.react([{ type: 'Talked', npcId: 77, kind: 'elder', questBefore: 0 } as SimEvent]);
    expect(shown[0]!.talk.pages[0]!.text).toBe('Hello.');
    runner.react([{ type: 'HeroDied' } as SimEvent, { type: 'ServiceUsed', npcId: 77, service: 0, x: 0, y: 0 } as SimEvent]);
    expect(sent).toEqual([{ type: 'setFlag', flag: 'hurt', on: true }, { type: 'setFlag', flag: 'hurt', on: false }]);
  });
});
