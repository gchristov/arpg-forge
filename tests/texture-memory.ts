import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** A picture inside a model file: its size in pixels and the model files that carry it. */
export interface Picture {
  width: number;
  height: number;
  files: string[];
}

/** Bytes a picture takes on the GPU once decoded: four per pixel, plus a third for its smaller copies (mipmaps). */
export const gpuBytes = (p: Picture) => p.width * p.height * 4 * (4 / 3);

/**
 * Every distinct picture in the .glb files of `dir`, by its bytes: the game keeps one copy of a picture however many
 * files carry it (`SharedTextures`), so this is what reaches the GPU.
 */
export function picturesIn(dir: string): Picture[] {
  const pictures = new Map<string, Picture>();
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.glb'))) {
    const glb = readFileSync(join(dir, file));
    const jsonLength = glb.readUInt32LE(12);
    const json = JSON.parse(glb.subarray(20, 20 + jsonLength).toString()) as {
      images?: Array<{ bufferView?: number }>;
      bufferViews: Array<{ byteOffset?: number; byteLength: number }>;
    };
    const binary = glb.subarray(20 + jsonLength + 8);
    for (const image of json.images ?? []) {
      if (image.bufferView === undefined) continue;
      const view = json.bufferViews[image.bufferView]!;
      const bytes = binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
      const key = createHash('sha1').update(bytes).digest('hex');
      const picture = pictures.get(key) ?? { ...sizeOf(bytes, file), files: [] };
      picture.files.push(file);
      pictures.set(key, picture);
    }
  }
  return [...pictures.values()];
}

/** A PNG, JPEG or WebP picture's size in pixels, read from its header. */
function sizeOf(d: Buffer, file: string): { width: number; height: number } {
  if (d[0] === 0x89) return { width: d.readUInt32BE(16), height: d.readUInt32BE(20) };
  if (d.subarray(8, 12).toString() === 'WEBP') {
    const chunk = d.subarray(12, 16).toString();
    if (chunk === 'VP8X') return { width: 1 + d.readUIntLE(24, 3), height: 1 + d.readUIntLE(27, 3) };
    if (chunk === 'VP8 ') return { width: d.readUInt16LE(26) & 0x3fff, height: d.readUInt16LE(28) & 0x3fff };
    const bits = d.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (d[0] === 0xff) {
    for (let i = 2; i < d.length - 9;) {
      if (d[i] !== 0xff) { i++; continue; }
      const marker = d[i + 1]!;
      if (marker >= 0xc0 && marker <= 0xc2) return { width: d.readUInt16BE(i + 7), height: d.readUInt16BE(i + 5) };
      i += 2 + d.readUInt16BE(i + 2);
    }
  }
  throw new Error(`a picture in ${file} is in a format the texture budget can't read`);
}
