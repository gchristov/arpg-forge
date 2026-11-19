import { describe, expect, it } from 'vitest';
import { checkContent } from '../../engine/sim/content-checks';
import { storyScript } from '../../engine/story/script';
import { checkStory } from '../../engine/story/story-checks';
import { ashenHollowLook, MODEL_URLS } from './art/look';
import { ashenHollowContent } from './content/world';
import { PEOPLE } from './story/people';
import { QUEST } from './story/quest';
import { RULES } from './story/rules';

const content = ashenHollowContent();

describe('Ashen Hollow content', () => {
  const story = { people: PEOPLE, things: {}, rules: RULES, actions: [] };

  it('passes the story checks', () => {
    expect(checkStory(content, story)).toEqual([]);
  });

  it('keeps the whole story written out in story/SCRIPT.md, so a change to it shows up there (update it with -u)', async () => {
    await expect(storyScript('Ashen Hollow', QUEST, story)).toMatchFileSnapshot('./story/SCRIPT.md');
  });

  it('passes the engine content checks', () => {
    expect(checkContent(content)).toEqual([]);
  });

  it('gives every actor kind a model that was built', () => {
    const kinds = ['hero', ...Object.keys(content.enemies), ...content.levels.flatMap((l) => l.npcs.map((n) => n.kind))];
    const missing = kinds.filter((kind) => {
      const model = ashenHollowLook.actor(kind).model;
      const weapon = typeof model?.weapon === 'string' ? model.weapon : model?.weapon?.name;
      return !model || !MODEL_URLS[model.name] || (weapon !== undefined && !MODEL_URLS[weapon]);
    });
    expect(missing).toEqual([]);
  });
});
