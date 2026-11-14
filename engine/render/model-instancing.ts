import * as THREE from 'three';
import type { ModelTemplate } from './models';

/**
 * How a model is sized to its spot:
 * - `height`: scaled evenly to a height, such as a tree.
 * - `width`: scaled evenly so its footprint spans a width, such as a floor tile.
 * - `box`: stretched on each axis to a box, such as a wall block.
 * - `footprint`: scaled evenly to fit inside a width and depth, such as a building on its lot.
 */
export type Fit =
  | { type: 'height'; height: number }
  | { type: 'width'; width: number }
  | { type: 'box'; width: number; height: number; depth: number }
  | { type: 'footprint'; width: number; depth: number };

const box = new THREE.Box3();
const size = new THREE.Vector3();
const centre = new THREE.Vector3();

/**
 * The transform that sizes a model as `fit` says and stands it on the ground, centred on the origin, after turning
 * it by `rotation` radians.
 */
export function fitMatrix(template: ModelTemplate, fit: Fit, rotation = 0): THREE.Matrix4 {
  const turn = new THREE.Matrix4().makeRotationY(rotation);
  const turned = template.scene.clone();
  turned.applyMatrix4(turn);
  turned.updateMatrixWorld(true);
  box.setFromObject(turned);
  box.getSize(size);
  box.getCenter(centre);
  let sx: number;
  let sy: number;
  let sz: number;
  switch (fit.type) {
    case 'height':
      sx = sy = sz = fit.height / Math.max(size.y, 1e-3);
      break;
    case 'width':
      sx = sy = sz = fit.width / Math.max(size.x, size.z, 1e-3);
      break;
    case 'box':
      sx = fit.width / Math.max(size.x, 1e-3);
      sy = fit.height / Math.max(size.y, 1e-3);
      sz = fit.depth / Math.max(size.z, 1e-3);
      break;
    case 'footprint':
      sx = sy = sz = Math.min(fit.width / Math.max(size.x, 1e-3), fit.depth / Math.max(size.z, 1e-3));
      break;
  }
  return new THREE.Matrix4()
    .makeScale(sx, sy, sz)
    .multiply(new THREE.Matrix4().makeTranslation(-centre.x, -box.min.y, -centre.z))
    .multiply(turn);
}

/**
 * Draws many copies of a model with one instanced mesh per part, so a forest costs a handful of draw calls. Each
 * copy is placed by `placements[i] × fit`, where `fit` comes from `fitMatrix`.
 */
export function instancedModel(template: ModelTemplate, fit: THREE.Matrix4, placements: THREE.Matrix4[]): THREE.InstancedMesh[] {
  template.scene.updateMatrixWorld(true);
  const meshes: THREE.InstancedMesh[] = [];
  const matrix = new THREE.Matrix4();
  template.scene.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || o instanceof THREE.SkinnedMesh) return;
    const material = Array.isArray(o.material) ? o.material.map(nonMetallic) : nonMetallic(o.material);
    const mesh = new THREE.InstancedMesh(o.geometry, material, placements.length);
    placements.forEach((placement, i) => {
      mesh.setMatrixAt(i, matrix.copy(placement).multiply(fit).multiply(o.matrixWorld));
    });
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.fromModel = true;
    meshes.push(mesh);
  });
  return meshes;
}

/** Metallic surfaces need an environment map to look right; under the scene's lamps they turn dark. */
function nonMetallic(material: THREE.Material): THREE.Material {
  if (!(material instanceof THREE.MeshStandardMaterial) || material.metalness === 0) return material;
  const own = material.clone();
  own.metalness = 0;
  own.userData.ownCopy = true;
  return own;
}
