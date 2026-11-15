import * as THREE from 'three';

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

/** Tiles the grain texture repeats over. */
const GRAIN_TILES = 3;

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
    positions.push(cx, 0, cy);
    colours.push(corners[i]!, corners[i + 1]!, corners[i + 2]!);
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

/** A tiling texture of fine grit and a few hairline cracks, around white so it only shades the ground's colours. */
function grainTexture(strength: number): THREE.DataTexture {
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const shade = new Float32Array(size * size).map(() => 1 - random() * 0.35 * strength);
  // A few cracks: short random walks that wrap around the edges, so the texture still tiles.
  for (let crack = 0; crack < 6; crack++) {
    let x = random() * size;
    let y = random() * size;
    let angle = random() * Math.PI * 2;
    for (let step = 0; step < 40; step++) {
      angle += (random() - 0.5) * 0.8;
      x = (x + Math.cos(angle) + size) % size;
      y = (y + Math.sin(angle) + size) % size;
      shade[Math.floor(y) * size + Math.floor(x)] = 1 - 0.55 * strength;
    }
  }
  for (let i = 0; i < size * size; i++) {
    const v = Math.round(255 * shade[i]!);
    data.set([v, v, v, 255], i * 4);
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}
