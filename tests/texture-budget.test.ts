import { existsSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { gpuBytes, picturesIn } from './texture-memory';

/**
 * Every model's textures go to the GPU before play, so a game's distinct textures together must fit a phone's
 * graphics memory, which is where a browser tab crashes first.
 */
const BUDGET_MB = 400;

/** No picture larger than this on a side; small props should use 512. */
const LARGEST_SIDE = 1024;

const MB = 1024 * 1024;
const modelFolders = readdirSync('games').map((game) => `games/${game}/art/models`).filter((dir) => existsSync(dir));

describe.each(modelFolders)('the textures in %s', (dir) => {
  const pictures = picturesIn(dir);

  it(`take at most ${BUDGET_MB} MB of graphics memory together`, () => {
    const total = pictures.reduce((sum, p) => sum + gpuBytes(p), 0) / MB;
    const largest = [...pictures].sort((a, b) => gpuBytes(b) - gpuBytes(a)).slice(0, 5)
      .map((p) => `${p.width}×${p.height} in ${p.files.slice(0, 3).join(', ')}`);
    expect(total, `${Math.round(total)} MB; the largest: ${largest.join('; ')}`).toBeLessThanOrEqual(BUDGET_MB);
  });

  it(`are each at most ${LARGEST_SIDE} px on a side`, () => {
    const tooLarge = pictures.filter((p) => Math.max(p.width, p.height) > LARGEST_SIDE)
      .map((p) => `${p.width}×${p.height} in ${p.files.join(', ')}`);
    expect(tooLarge).toEqual([]);
  });
});
