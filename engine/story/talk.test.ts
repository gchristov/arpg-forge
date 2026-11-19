import { describe, expect, it } from 'vitest';
import { arena, OPEN_ROOM } from '../sim/testing';
import { priceTag, read, talkTo, type Person, type Thing } from './talk';

const SMITH: Person = {
  title: 'Hilde',
  leave: 'Off you go',
  services: [
    { label: 'Toughen your fists', service: 0, tag: '{price} gold', when: { holding: null } },
    { label: 'Hone your blade', service: 0, tag: '{price} gold', when: { not: { holding: null } } },
  ],
  says: [
    { at: 'asked', pages: [{ text: 'A thief took my blade.' }, { text: 'Get it back?', options: [{ label: 'I will.', reply: 'getBlade' }] }] },
    { flag: 'hurt', text: 'Patched up again?', services: true },
    { from: 'returned', text: 'Bring gold.', services: true },
    { text: 'Hello.' },
  ],
};

function at(step: number, weapon: string | null = null) {
  const state = arena(OPEN_ROOM, { x: 2, y: 2 });
  state.rules.quest = [{ id: 'start' }, { id: 'asked' }, { id: 'returned' }];
  state.quest = step;
  state.hero.weapon = weapon;
  return state;
}

describe('talk', () => {
  it('says the first entry whose condition holds, closing it with the person\'s own leave button', () => {
    expect(talkTo(SMITH, at(0))).toEqual({ title: 'Hilde', pages: [{ text: 'Hello.', options: [{ label: 'Off you go' }] }] });
  });

  it('moves through pages, each but the last moving on, and the last with its reply and no leave button', () => {
    const talk = talkTo(SMITH, at(1))!;
    expect(talk.pages.map((p) => p.options.map((o) => o.label))).toEqual([['…'], ['I will.']]);
  });

  it('adds the services on offer for what the hero holds, then a leave button, since services keep the box open', () => {
    const options = (weapon: string | null) => talkTo(SMITH, at(2, weapon))!.pages[0]!.options.map((o) => o.label);
    expect(options(null)).toEqual(['Toughen your fists', 'Off you go']);
    expect(options('blade')).toEqual(['Hone your blade', 'Off you go']);
  });

  it('checks the story\'s flags, and can be asked what was said at another step', () => {
    const state = at(2);
    state.flags.hurt = true;
    expect(talkTo(SMITH, state)!.pages[0]!.text).toBe('Patched up again?');
    expect(talkTo(SMITH, at(2), 1)!.pages[0]!.text).toBe('A thief took my blade.');
  });

  it('shows what something says now, as a screen or as writing, or nothing if nothing applies', () => {
    const terminal: Thing = { title: 'Terminal', screen: true, says: [{ from: 'returned', text: 'OPEN.' }, { text: 'LOCKED.' }] };
    expect(read(terminal, at(0))).toEqual({ title: 'Terminal', screen: true, pages: [{ text: 'LOCKED.', options: [{ label: 'Close' }] }] });
    expect(read(terminal, at(2))!.pages[0]!.text).toBe('OPEN.');
    expect(read({ title: 'Sign', says: [{ at: 'asked', text: 'Gone.' }] }, at(0))).toBeNull();
    expect(read({ title: 'Sign', says: [{ text: 'Inn.' }] }, at(0))!.written).toBe(true);
  });

  it('fills in a price', () => {
    expect([priceTag('{price} scrap', 40), priceTag('Free', 0)]).toEqual(['40 scrap', 'Free']);
  });
});
