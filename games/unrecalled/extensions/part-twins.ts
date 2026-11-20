import * as THREE from 'three';

/** Every part of a model drawn in the material called `name`. */
export function partsIn(model: THREE.Object3D, name: string): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  model.traverse((o) => {
    if (o instanceof THREE.Mesh && !Array.isArray(o.material) && (o.material as THREE.Material).name === name) meshes.push(o);
  });
  return meshes;
}

/** Adds a twin of `mesh` drawn in `material`, sharing its shape and skeleton, so it bends with it. */
export function addTwin(mesh: THREE.Mesh, material: THREE.Material): THREE.Mesh {
  let twin: THREE.Mesh;
  if (mesh instanceof THREE.SkinnedMesh) {
    const skinned = new THREE.SkinnedMesh(mesh.geometry, material);
    skinned.bind(mesh.skeleton, mesh.bindMatrix);
    twin = skinned;
  } else twin = new THREE.Mesh(mesh.geometry, material);
  twin.position.copy(mesh.position);
  twin.quaternion.copy(mesh.quaternion);
  twin.scale.copy(mesh.scale);
  // Skinned twins are posed by bones the culling doesn't follow.
  twin.frustumCulled = false;
  mesh.parent?.add(twin);
  return twin;
}
