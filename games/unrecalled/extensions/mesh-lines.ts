import * as THREE from 'three';

/**
 * Draws every part of a model in the named material as lines alone, such as the fine mesh over U-7's shell, drawn from
 * a copy of the shell raised off it. The part itself is hidden; each line twin shares its shape and skeleton, so it
 * bends with it.
 */
export function meshLines({ material: name, colour, opacity }: { material: string; colour: number; opacity: number }) {
  return (model: THREE.Object3D, keep: (material: THREE.Material) => void): void => {
    const meshes: THREE.Mesh[] = [];
    model.traverse((o) => {
      if (o instanceof THREE.Mesh && !Array.isArray(o.material) && (o.material as THREE.Material).name === name) meshes.push(o);
    });
    if (meshes.length === 0) return;
    const lines = new THREE.MeshBasicMaterial({ color: colour, wireframe: true, transparent: true, opacity, depthWrite: false });
    keep(lines);
    for (const mesh of meshes) {
      let twin: THREE.Mesh;
      if (mesh instanceof THREE.SkinnedMesh) {
        const skinned = new THREE.SkinnedMesh(mesh.geometry, lines);
        skinned.bind(mesh.skeleton, mesh.bindMatrix);
        twin = skinned;
      } else twin = new THREE.Mesh(mesh.geometry, lines);
      twin.position.copy(mesh.position);
      twin.quaternion.copy(mesh.quaternion);
      twin.scale.copy(mesh.scale);
      // Skinned twins are posed by bones the culling doesn't follow.
      twin.frustumCulled = false;
      mesh.parent?.add(twin);
      mesh.visible = false;
    }
  };
}
