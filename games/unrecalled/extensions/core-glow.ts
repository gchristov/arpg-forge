import * as THREE from 'three';
import { addTwin, partsIn } from './part-twins';

/**
 * Drawn after see-through parts such as glass, which are drawn in the usual order, 0, so a glow added on top of them
 * isn't dimmed by the glass over it.
 */
const AFTER_GLASS = 1;

/**
 * Makes the parts of a model in the named `materials` glow through whatever see-through part covers them: a twin of
 * each adds `colour` at `strength` over everything drawn before it, after the glass, though still hidden by anything
 * solid in front.
 */
export function coreGlow({ materials, colour, strength }: { materials: string[]; colour: number; strength: number }) {
  return (model: THREE.Object3D, keep: (material: THREE.Material) => void): void => {
    const meshes = materials.flatMap((name) => partsIn(model, name));
    if (meshes.length === 0) return;
    const glow = new THREE.MeshBasicMaterial({
      color: new THREE.Color(colour).multiplyScalar(strength),
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    });
    keep(glow);
    for (const mesh of meshes) {
      const twin = addTwin(mesh, glow);
      twin.castShadow = false;
      twin.renderOrder = AFTER_GLASS;
    }
  };
}
