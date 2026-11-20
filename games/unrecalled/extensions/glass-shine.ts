import * as THREE from 'three';
import { addTwin, partsIn } from './part-twins';

const SIZE = 64;

/**
 * A reflection seen on glass, as a matcap: how bright the glass looks for each way its surface faces the camera. The
 * edges, which face away, catch a rim of light, and a soft window of glare sits up and to the left, where a lamp
 * above would show.
 */
export function glareMap(): THREE.DataTexture {
  const data = new Uint8Array(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const [u, v] = [(x + 0.5) / SIZE * 2 - 1, (y + 0.5) / SIZE * 2 - 1];
      const out = Math.hypot(u, v);
      const rim = out > 1 ? 0 : smoothstep(0.55, 1, out) ** 2 * 0.55;
      const glare = Math.exp(-(((u + 0.38) / 0.22) ** 2 + ((v - 0.42) / 0.12) ** 2)) * 0.9;
      const spark = Math.exp(-(((u + 0.12) / 0.06) ** 2 + ((v - 0.58) / 0.06) ** 2));
      const light = Math.min(1, rim + glare + spark);
      const i = (y * SIZE + x) * 4;
      data.set([light * 235, light * 245, 255 * light, 255], i);
    }
  }
  const texture = new THREE.DataTexture(data, SIZE, SIZE);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function smoothstep(from: number, to: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - from) / (to - from)));
  return t * t * (3 - 2 * t);
}

let glare: THREE.DataTexture | null = null;

/**
 * Makes every part of a model in the named material shine like glass: a twin of it, sharing its shape and skeleton,
 * adds a glare and a bright rim over it. The glare is a matcap rather than a reflection of the scene, so it costs one
 * draw and no lights.
 */
export function glassShine({ material: name, strength }: { material: string; strength: number }) {
  return (model: THREE.Object3D, keep: (material: THREE.Material) => void): void => {
    const meshes = partsIn(model, name);
    if (meshes.length === 0) return;
    glare ??= glareMap();
    const shine = new THREE.MeshMatcapMaterial({
      matcap: glare, color: new THREE.Color(strength, strength, strength),
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    keep(shine);
    for (const mesh of meshes) addTwin(mesh, shine).castShadow = false;
  };
}
