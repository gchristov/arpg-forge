import { describe, expect, it } from 'vitest';
import { checkContent } from '../../engine/sim/content-checks';
import { MODEL_URLS, unrecalledLook } from './art/look';
import { dialogueFor, QUEST, READINGS } from './content/story';
import { unrecalledContent } from './content/world';

const content = unrecalledContent();

describe('Unrecalled content', () => {
  it('passes the engine content checks', () => {
    expect(checkContent(content)).toEqual([]);
  });

  it('words every quest step, everything there is to read, and everyone there is to talk to', () => {
    expect(QUEST.every((step) => step.text)).toBe(true);
    const kinds = content.levels.flatMap((l) => l.npcs.map((n) => n.kind));
    expect(kinds.filter((kind) => !dialogueFor(kind, 0, 0, 0))).toEqual([]);
    const ids = content.levels.flatMap((l) => (l.readables ?? []).map((r) => r.id));
    expect(ids.filter((id) => !READINGS[id])).toEqual([]);
    expect(Object.keys(READINGS).filter((id) => !ids.includes(id))).toEqual([]);
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
});
