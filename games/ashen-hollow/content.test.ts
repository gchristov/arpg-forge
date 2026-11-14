import { describe, expect, it } from 'vitest';
import { checkContent } from '../../engine/sim/content-checks';
import { ashenHollowLook, MODEL_URLS } from './art/look';
import { ashenHollowContent } from './content/world';

const content = ashenHollowContent();

describe('Ashen Hollow content', () => {
  it('passes the engine content checks', () => {
    expect(checkContent(content)).toEqual([]);
  });

  it('gives every actor kind a model that was built', () => {
    const kinds = ['hero', ...Object.keys(content.enemies), ...content.levels.flatMap((l) => l.npcs.map((n) => n.kind))];
    const missing = kinds.filter((kind) => {
      const model = ashenHollowLook.actor(kind).model;
      return !model || !MODEL_URLS[model.name] || (model.weapon !== undefined && !MODEL_URLS[model.weapon]);
    });
    expect(missing).toEqual([]);
  });
});
