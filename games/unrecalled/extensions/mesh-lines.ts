import * as THREE from 'three';
import { addTwin, partsIn } from './part-twins';

/**
 * Draws every part of a model in the named material as lines alone, such as the fine mesh over U-7's shell, drawn from
 * a copy of the shell raised off it. The part itself is hidden; each line twin shares its shape and skeleton, so it
 * bends with it.
 */
export function meshLines({ material: name, colour, opacity }: { material: string; colour: number; opacity: number }) {
  return (model: THREE.Object3D, keep: (material: THREE.Material) => void): void => {
    const meshes = partsIn(model, name);
    if (meshes.length === 0) return;
    const lines = new THREE.MeshBasicMaterial({ color: colour, wireframe: true, transparent: true, opacity, depthWrite: false });
    keep(lines);
    for (const mesh of meshes) {
      addTwin(mesh, lines);
      mesh.visible = false;
    }
  };
}
