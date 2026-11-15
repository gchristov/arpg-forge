import { describe, expect, it } from 'vitest';
import { checkContent } from '../../engine/sim/content-checks';
import { MODEL_URLS, unrecalledLook } from './art/look';
import { unrecalledContent } from './content/world';

const content = unrecalledContent();

describe('Unrecalled content', () => {
  it('passes the engine content checks', () => {
    expect(checkContent(content)).toEqual([]);
  });

  it('gives every actor kind a model that was built', () => {
    const kinds = ['hero', ...Object.keys(content.enemies)];
    expect(kinds.filter((kind) => !MODEL_URLS[unrecalledLook.actor(kind).model?.name ?? ''])).toEqual([]);
  });
});
