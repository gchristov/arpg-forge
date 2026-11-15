import { describe, expect, it } from 'vitest';
import { checkContent } from '../../engine/sim/content-checks';
import { MODEL_URLS, unrecalledLook } from './art/look';
import { QUEST_TEXT, READINGS } from './content/story';
import { unrecalledContent } from './content/world';

const content = unrecalledContent();

describe('Unrecalled content', () => {
  it('passes the engine content checks', () => {
    expect(checkContent(content)).toEqual([]);
  });

  it('words every quest step and everything there is to read', () => {
    expect(QUEST_TEXT).toHaveLength(content.quest.length);
    const ids = content.levels.flatMap((l) => (l.readables ?? []).map((r) => r.id));
    expect(ids.filter((id) => !READINGS[id])).toEqual([]);
    expect(Object.keys(READINGS).filter((id) => !ids.includes(id))).toEqual([]);
  });

  it('gives every actor kind a model that was built', () => {
    const kinds = ['hero', ...Object.keys(content.enemies)];
    expect(kinds.filter((kind) => !MODEL_URLS[unrecalledLook.actor(kind).model?.name ?? ''])).toEqual([]);
  });
});
