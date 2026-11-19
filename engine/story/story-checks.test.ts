import { describe, expect, it } from 'vitest';
import type { GameContent } from '../sim/content';
import { TEST_ENEMIES, TEST_HERO, OPEN_ROOM } from '../sim/testing';
import { mapFromRows } from '../world/testing';
import { checkStory, type Story } from './story-checks';

const content: GameContent = {
  levels: [{
    level: { id: 'village', name: 'Village', subtitle: '', outdoor: false, map: mapFromRows(OPEN_ROOM), start: { x: 2.5, y: 2.5 }, portals: [], lights: [], structures: [] },
    spawns: [], camps: [], npcs: [{ kind: 'elder', name: 'Elder', x: 4.5, y: 2.5 }], readables: [{ tx: 6, ty: 6, id: 'sign' }],
  }],
  startLevel: 'village', hero: TEST_HERO, enemies: TEST_ENEMIES, npcRadius: 0.32, npcs: { elder: { services: [] } },
  quest: [{ id: 'start' }, { id: 'asked', reachedBy: { type: 'reply', npcKind: 'elder', id: 'yes' } }],
};

const good: Story = {
  people: { elder: { title: 'Elder', says: [{ at: 'start', text: 'Help?', options: [{ label: 'Yes', reply: 'yes' }] }, { text: 'Thanks.' }] } },
  things: { sign: { title: 'Sign', says: [{ text: 'Inn.' }] } },
  rules: [{ on: { reached: 'asked' }, do: [{ think: 'Right.' }, { run: 'cheer' }] }],
  actions: ['cheer'],
};

describe('story checks', () => {
  it('finds nothing wrong with a story whose names all exist', () => {
    expect(checkStory(content, good)).toEqual([]);
  });

  it('names every mistake: missing names, a reply nobody offers, and entries that can never be said', () => {
    const bad: Story = {
      people: {
        elder: { title: 'Elder', says: [{ text: 'Hello.' }, { at: 'later', text: 'Never said.' }] },
        ghost: { title: 'Ghost', says: [{ text: 'Boo.' }] },
      },
      things: { sign: { title: 'Sign', says: [{ text: 'Inn.' }, { text: 'Never shown.' }] }, gate: { title: 'Gate', says: [{ text: 'Shut.' }] } },
      rules: [
        { on: { enter: 'cave' }, do: [{ talk: 'smith' }, { use: 'lever' }, { useSkill: 'fireball' }, { run: 'dance' }] },
        { on: { near: 'well' }, when: { until: 'gone' }, do: [{ think: 'A well.' }] },
      ],
      actions: [],
    };
    expect(checkStory(content, bad)).toEqual(expect.arrayContaining([
      'Elder: entry 2 is never said, since one before it always is',
      'Elder: no quest step is named "later"',
      'people: "ghost" says things but isn\'t in any level',
      'Sign: entry 2 is never shown, since one before it always is',
      'things: "gate" shows something but isn\'t in any level',
      'rule 1 (on {"enter":"cave"}): no level is named "cave"',
      'rule 1 (on {"enter":"cave"}): nobody of kind "smith" is in any level',
      'rule 1 (on {"enter":"cave"}): "lever" isn\'t in any level',
      'rule 1 (on {"enter":"cave"}): the hero has no skill "fireball"',
      'rule 1 (on {"enter":"cave"}): the game has no action "dance"',
      'rule 2 (on {"near":"well"}): "well" isn\'t in any level',
      'rule 2 (on {"near":"well"}): no quest step is named "gone"',
      'quest step "asked" waits for the reply "yes" to "elder", which nothing offers',
    ]));
  });

  it('finds a person or thing in a level with nothing to say', () => {
    expect(checkStory(content, { ...good, people: {}, things: {} })).toEqual([
      'people: "elder" is in a level but says nothing',
      'things: "sign" is in a level but shows nothing',
      'quest step "asked" waits for the reply "yes" to "elder", which nothing offers',
    ]);
  });
});
