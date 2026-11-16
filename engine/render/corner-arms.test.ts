import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { describe, expect, it } from 'vitest';
import { cornerArms } from './corner-arms';

/** Each arm's triangles, as the x and z ranges their middles span. */
const spans = (scene: THREE.Object3D) => {
  const middles: THREE.Vector3[] = [];
  scene.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const index = o.geometry.getIndex()!;
    const position = o.geometry.getAttribute('position');
    for (let i = 0; i < index.count; i += 3) {
      const m = new THREE.Vector3();
      for (let k = 0; k < 3; k++) m.add(new THREE.Vector3().fromBufferAttribute(position, index.getX(i + k)));
      middles.push(m.divideScalar(3).applyMatrix4(o.matrixWorld));
    }
  });
  return middles;
};

describe('cornerArms', () => {
  // One mesh, an L of two walls from a corner at (-4, -4), placed by its parent the way a loaded model's parts are:
  // one wall along x at the low z, one along z at the low x.
  const geometry = mergeGeometries([
    new THREE.BoxGeometry(4, 3, 0.4).translate(2, 1.5, 0.2),
    new THREE.BoxGeometry(0.4, 3, 3.6).translate(0.2, 1.5, 2.2),
  ])!;
  const scene = new THREE.Group().add(new THREE.Mesh(geometry));
  scene.position.set(-4, 0, -4);
  const arms = cornerArms({ scene, animations: [], height: 3 });

  it('gives each wall of the L to its own arm, but for where they meet at the corner', () => {
    const alongX = spans(arms.alongX.scene);
    const alongZ = spans(arms.alongZ.scene);
    expect(alongX.length + alongZ.length).toBe(24);
    expect(alongX.every((m) => m.z < -3.5)).toBe(true);
    expect(alongZ.every((m) => m.x < -3.5)).toBe(true);
  });

  it('leaves the whole piece as it was', () => {
    expect(spans(scene)).toHaveLength(24);
  });
});
