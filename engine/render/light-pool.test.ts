import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { GROUND_MARK_ORDER } from './effects';
import { LightPool } from './light-pool';

const poolIn = (scene: THREE.Scene) => scene.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;

describe('LightPool', () => {
  it('lies over the marks on the ground, as strong as it\'s set and dimmed with its light', () => {
    const scene = new THREE.Scene();
    const pool = new LightPool(scene);
    pool.set(0x3ac8ff, 1.6, 0.4);
    pool.place(5, 7);
    const mesh = poolIn(scene);
    expect(mesh.renderOrder).toBeGreaterThan(GROUND_MARK_ORDER);
    expect(mesh.position.toArray()).toEqual([5, expect.any(Number), 7]);
    expect(mesh.material.opacity).toBeCloseTo(0.4);
    pool.dim(0.5);
    expect(mesh.material.opacity).toBeCloseTo(0.2);
    pool.dim(0);
    expect(mesh.visible).toBe(false);
  });

  it('shows nothing when the light has no pool', () => {
    const scene = new THREE.Scene();
    new LightPool(scene).set(0xffffff, 2, 0);
    expect(poolIn(scene).visible).toBe(false);
  });
});
