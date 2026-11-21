// Downloads and unpacks the animation library the people are animated with, from the pinned zip in the game's manifest.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';

const CACHE = 'tools/assets/cache';
const { packs } = JSON.parse(await readFile('games/unrecalled/art/models.json', 'utf8'));
const pack = packs.animations;
const zip = `${CACHE}/animations.zip`;
if (!existsSync(zip)) {
  const response = await fetch(pack.zip);
  if (!response.ok) throw new Error(`${response.status} for ${pack.zip}`);
  await writeFile(zip, Buffer.from(await response.arrayBuffer()));
}
const sha256 = createHash('sha256').update(await readFile(zip)).digest('hex');
if (sha256 !== pack.sha256) throw new Error(`${zip} has sha256 ${sha256}, not the pinned ${pack.sha256}`);
if (!existsSync(`${CACHE}/animations`)) execFileSync('unzip', ['-q', '-o', zip, '-d', `${CACHE}/animations`]);
