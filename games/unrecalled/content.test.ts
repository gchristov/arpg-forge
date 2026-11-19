import { describe, expect, it } from 'vitest';
import { checkContent } from '../../engine/sim/content-checks';
import { checkStory } from '../../engine/story/story-checks';
import { GAME_ACTIONS } from './extensions/actions';
import { MODEL_URLS, unrecalledLook } from './art/look';
import { PEOPLE } from './story/people';
import { RULES } from './story/rules';
import { THINGS } from './story/things';
import { unrecalledContent } from './content/world';

const content = unrecalledContent();

describe('Unrecalled content', () => {
  it('passes the engine content checks', () => {
    expect(checkContent(content)).toEqual([]);
  });

  // Odell's crate shows nothing: opening it lets him out, and he speaks.
  const story = { people: PEOPLE, things: THINGS, rules: RULES, actions: GAME_ACTIONS, showsNothing: ['crate'] };

  it('passes the story checks: every name it uses exists, every reply waited for is offered, every entry can be said', () => {
    expect(checkStory(content, story)).toEqual([]);
  });



  it('puts a panel beside every door the story keeps locked, saying what opens it', () => {
    const unexplained = content.levels.flatMap((l) => l.level.portals
      .filter((p) => p.lockedUntilStep !== undefined)
      .filter((p) => !(l.readables ?? []).some((r) => Math.abs(r.tx - p.tx) <= 2 && Math.abs(r.ty - p.ty) <= 2))
      .map((p) => `${l.level.id} → ${p.to}`));
    expect(unexplained).toEqual([]);
  });

  it('gives every actor kind a model that was built', () => {
    const kinds = ['hero', ...Object.keys(content.enemies)];
    const missing = kinds.filter((kind) => {
      const model = unrecalledLook.actor(kind).model;
      const weapon = typeof model?.weapon === 'string' ? model.weapon : model?.weapon?.name;
      return !model || !MODEL_URLS[model.name] || (weapon !== undefined && !MODEL_URLS[weapon]);
    });
    expect(missing).toEqual([]);
  });

  it('draws U-7 holding every weapon it can come to hold, with a model that was built', () => {
    const armed = unrecalledLook.actor('hero').model?.armed ?? {};
    const missing = Object.keys(content.hero.weapons ?? {}).filter((id) => {
      const held = armed[id]?.weapon;
      const name = typeof held === 'string' ? held : held?.name;
      return !name || !MODEL_URLS[name];
    });
    expect(missing).toEqual([]);
  });
});
