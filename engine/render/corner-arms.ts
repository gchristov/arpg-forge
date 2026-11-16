import * as THREE from 'three';
import type { ModelTemplate } from './models';

/**
 * A modular kit's corner piece split into its two arms: the one running along the model's x from its corner, and the one
 * along its z. The corner is the model's lowest x and z, and each triangle goes to the arm its middle lies nearer, so
 * the two halves meet along the diagonal through the corner. Each half stands where it did in the whole piece.
 */
export function cornerArms(template: ModelTemplate): { alongX: ModelTemplate; alongZ: ModelTemplate } {
  template.scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(template.scene);
  const arm = (alongX: boolean): ModelTemplate => {
    const scene = template.scene.clone();
    const sources: THREE.Mesh[] = [];
    template.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) sources.push(o);
    });
    let next = 0;
    scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const source = sources[next++]!;
      o.geometry = trianglesOf(source.geometry, source.matrixWorld, (x, z) => x - box.min.x > z - box.min.z === alongX);
    });
    return { scene, animations: [], height: template.height };
  };
  return { alongX: arm(true), alongZ: arm(false) };
}

/** The geometry with only the triangles whose middle, placed by `matrix`, passes `keep`, sharing its attributes. */
function trianglesOf(geometry: THREE.BufferGeometry, matrix: THREE.Matrix4, keep: (x: number, z: number) => boolean): THREE.BufferGeometry {
  const position = geometry.getAttribute('position');
  const index = geometry.getIndex();
  const count = index ? index.count : position.count;
  const vertexAt = (i: number) => (index ? index.getX(i) : i);
  const kept: number[] = [];
  const middle = new THREE.Vector3();
  const corner = new THREE.Vector3();
  for (let i = 0; i + 2 < count; i += 3) {
    middle.set(0, 0, 0);
    for (let k = 0; k < 3; k++) middle.add(corner.fromBufferAttribute(position, vertexAt(i + k)));
    middle.divideScalar(3).applyMatrix4(matrix);
    if (keep(middle.x, middle.z)) kept.push(vertexAt(i), vertexAt(i + 1), vertexAt(i + 2));
  }
  const part = geometry.clone();
  part.setIndex(kept);
  part.clearGroups();
  return part;
}
