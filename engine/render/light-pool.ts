import * as THREE from 'three';

/** Texels across the pool's fall-off picture. */
const SIZE = 32;
/** Just above marks and spills on the ground, so it lies over them. */
const HEIGHT = 0.02;

/**
 * A soft pool of a carried light laid over the ground under it, added on top of whatever lies there. A real light
 * barely brightens a dark spill, so without the pool the light seems to go out wherever oil or blood lies.
 */
export class LightPool {
  private readonly mesh: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  private strength = 0;

  constructor(scene: THREE.Scene) {
    this.mesh = new THREE.Mesh(
      new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: falloff(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  /** Sets the pool's colour, its radius in tiles and its strength, from 0, none, to 1. */
  set(colour: number, radius: number, strength: number): void {
    this.mesh.material.color.set(colour);
    this.mesh.scale.setScalar(radius);
    this.strength = strength;
    this.dim(1);
  }

  /** Dims the pool with its light, to `share` (0, out, to 1) of its strength. */
  dim(share: number): void {
    this.mesh.material.opacity = this.strength * share;
    this.mesh.visible = this.mesh.material.opacity > 0;
  }

  place(x: number, y: number): void {
    this.mesh.position.set(x, HEIGHT, y);
  }
}

/** Bright in the middle, fading smoothly to nothing at the edge. */
function falloff(): THREE.DataTexture {
  const data = new Uint8Array(SIZE * SIZE * 4);
  for (let j = 0; j < SIZE; j++) {
    for (let i = 0; i < SIZE; i++) {
      const r = Math.min(1, Math.hypot(i + 0.5 - SIZE / 2, j + 0.5 - SIZE / 2) / (SIZE / 2));
      const v = Math.round(255 * (1 - r) * (1 - r));
      data.set([v, v, v, 255], (j * SIZE + i) * 4);
    }
  }
  const texture = new THREE.DataTexture(data, SIZE, SIZE);
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
