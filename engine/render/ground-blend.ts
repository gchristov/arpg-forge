import * as THREE from 'three';
import { hash2 } from '../core/math';

/** A tile's colour as red, green and blue from 0 to 1, or null where no ground is drawn. */
export type TileColour = (tx: number, ty: number) => readonly [number, number, number] | null;

/** How many tiles around a corner its colour is blended from. Wide enough that patches lose the grid's stair steps. */
const BLEND_REACH = 2;

/**
 * The colour at each corner of the tile grid: a weighted average of the drawn tiles within `BLEND_REACH` of it,
 * nearest weighing most. Corners are numbered row by row, (width + 1) to a row, three numbers each. Drawn with these,
 * patches of ground fade into each other in broad, soft gradients instead of meeting in edges that follow the tiles.
 */
export function cornerColours(width: number, height: number, colourOf: TileColour): Float32Array {
  const corners = new Float32Array((width + 1) * (height + 1) * 3);
  for (let cy = 0; cy <= height; cy++) {
    for (let cx = 0; cx <= width; cx++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let total = 0;
      for (let ty = cy - BLEND_REACH; ty < cy + BLEND_REACH; ty++) {
        for (let tx = cx - BLEND_REACH; tx < cx + BLEND_REACH; tx++) {
          if (tx < 0 || ty < 0 || tx >= width || ty >= height) continue;
          const c = colourOf(tx, ty);
          if (!c) continue;
          // The tile's middle is (tx + 0.5, ty + 0.5); weight falls off with its distance from the corner.
          const d2 = (tx + 0.5 - cx) ** 2 + (ty + 0.5 - cy) ** 2;
          const w = Math.exp(-d2 / 1.6);
          r += c[0] * w;
          g += c[1] * w;
          b += c[2] * w;
          total += w;
        }
      }
      if (total === 0) continue;
      const i = (cy * (width + 1) + cx) * 3;
      corners[i] = r / total;
      corners[i + 1] = g / total;
      corners[i + 2] = b / total;
    }
  }
  return corners;
}

/** Tiles the grain texture spans before it repeats: far enough apart that the eye doesn't catch the pattern. */
const GRAIN_TILES = 12;
const GRAIN_PIXELS = 512;
/** How much each tile corner's shade varies at random, so even plain ground never looks stamped. */
const CORNER_JITTER = 0.06;

/**
 * The ground as one mesh: a quad for each drawn tile, coloured at its corners so tiles blend, with a grain texture of
 * grit and hairline cracks laid over it in world space. `grain` from 0 to 1 sets how strongly the grain shows.
 */
export function blendedGround(width: number, height: number, colourOf: TileColour, grain: number): THREE.Mesh {
  const corners = cornerColours(width, height, colourOf);
  const positions: number[] = [];
  const colours: number[] = [];
  const uvs: number[] = [];
  const corner = (cx: number, cy: number): void => {
    const i = (cy * (width + 1) + cx) * 3;
    const jitter = 1 + (hash2(cx, cy, 41) - 0.5) * 2 * CORNER_JITTER;
    positions.push(cx, 0, cy);
    colours.push(corners[i]! * jitter, corners[i + 1]! * jitter, corners[i + 2]! * jitter);
    uvs.push(cx / GRAIN_TILES, cy / GRAIN_TILES);
  };
  for (let ty = 0; ty < height; ty++) {
    for (let tx = 0; tx < width; tx++) {
      if (!colourOf(tx, ty)) continue;
      // Two triangles, wound to face up.
      corner(tx, ty);
      corner(tx, ty + 1);
      corner(tx + 1, ty);
      corner(tx + 1, ty);
      corner(tx, ty + 1);
      corner(tx + 1, ty + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, map: grainTexture(grain) });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * A tiling texture around white, so it only shades the ground's colours: grit that clumps in places, broad darker
 * stains and lighter dust, and hairline cracks of every length, some branching. Everything wraps around the edges, so
 * the texture tiles without seams.
 */
function grainTexture(strength: number): THREE.DataTexture {
  // Making one takes a moment, so each strength is made once and kept for coming back to a level.
  const made = grainTextures.get(strength);
  if (made) return made;
  const size = GRAIN_PIXELS;
  const shade = new Float32Array(size * size);
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const clumps = wrappingNoise(x / 24, y / 24, size / 24, 1);
      const stains = wrappingNoise(x / 64, y / 64, size / 64, 2);
      const grit = random() * (0.15 + clumps * 0.35);
      shade[y * size + x] = 1 - (grit + Math.max(0, stains - 0.55) * 0.5 - Math.max(0, 0.35 - stains) * 0.25) * strength;
    }
  }
  const crack = (x: number, y: number, angle: number, steps: number, depth: number): void => {
    for (let step = 0; step < steps; step++) {
      angle += (random() - 0.5) * 0.7;
      x = (x + Math.cos(angle) + size) % size;
      y = (y + Math.sin(angle) + size) % size;
      const i = Math.floor(y) * size + Math.floor(x);
      shade[i] = Math.min(shade[i]!, 1 - 0.5 * strength);
      if (depth < 2 && random() < 0.02) crack(x, y, angle + (random() < 0.5 ? 1 : -1) * (0.6 + random()), steps / 2, depth + 1);
    }
  };
  for (let n = 0; n < 70; n++) crack(random() * size, random() * size, random() * Math.PI * 2, 15 + random() * 90, 0);
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const v = Math.round(255 * Math.min(1, Math.max(0, shade[i]!)));
    data.set([v, v, v, 255], i * 4);
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  grainTextures.set(strength, texture);
  return texture;
}

const grainTextures = new Map<number, THREE.DataTexture>();

/** Smooth noise from 0 to 1 that repeats every `period` units in both directions, for textures that tile. */
function wrappingNoise(x: number, y: number, period: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const at = (cx: number, cy: number) => hash2(((cx % period) + period) % period, ((cy % period) + period) % period, seed);
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const top = at(xi, yi) + (at(xi + 1, yi) - at(xi, yi)) * sx;
  const bottom = at(xi, yi + 1) + (at(xi + 1, yi + 1) - at(xi, yi + 1)) * sx;
  return top + (bottom - top) * sy;
}
