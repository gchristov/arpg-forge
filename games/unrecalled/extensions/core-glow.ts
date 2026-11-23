import * as THREE from 'three';
import { heroLightLevel } from '../../../engine/render/hero-light';
import { addTwin, partsIn } from './part-twins';

/**
 * Drawn after see-through parts such as glass, which are drawn in the usual order, 0, so a glow added on top of them
 * isn't dimmed by the glass over it.
 */
const AFTER_GLASS = 1;
const HALO_SIZE = 64;

/** A soft round spot of light, brightest in the middle and fading to nothing at its edge. */
function haloMap(): THREE.DataTexture {
  const data = new Uint8Array(HALO_SIZE * HALO_SIZE * 4);
  for (let y = 0; y < HALO_SIZE; y++) {
    for (let x = 0; x < HALO_SIZE; x++) {
      const out = Math.hypot((x + 0.5) / HALO_SIZE * 2 - 1, (y + 0.5) / HALO_SIZE * 2 - 1);
      const light = Math.max(0, 1 - out) ** 2.2;
      data.set([255, 255, 255, light * 255], (y * HALO_SIZE + x) * 4);
    }
  }
  const texture = new THREE.DataTexture(data, HALO_SIZE, HALO_SIZE);
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

let halo: THREE.DataTexture | null = null;

/**
 * Makes the parts of a model in the named `materials` glow through whatever see-through part covers them: a twin of
 * each adds `colour` at `strength` over everything drawn before it, after the glass, though still hidden by anything
 * solid in front. Round the part in `spill.material`, a soft halo `spill.size` across, always facing the camera, adds
 * the light spilling out round it at `spill.strength`.
 *
 * `dress` adds the glow to a model; `draw` each frame fades every glow it added out while the one wearing it is dead,
 * and back in when they get up, as the light they carry does.
 */
export function coreGlow({ materials, colour, strength, spill }: {
  materials: string[];
  colour: number;
  strength: number;
  spill?: { material: string; size: number; strength: number };
}) {
  const glows: { material: THREE.MeshBasicMaterial | THREE.SpriteMaterial; full: THREE.Color }[] = [];
  let lit = 1;
  const glowing = <M extends THREE.MeshBasicMaterial | THREE.SpriteMaterial>(material: M): M => {
    glows.push({ material, full: material.color.clone() });
    material.color.multiplyScalar(lit);
    return material;
  };
  const draw = (dead: boolean, frameSeconds: number): void => {
    const level = heroLightLevel(lit, dead, frameSeconds);
    if (level === lit) return;
    lit = level;
    for (const { material, full } of glows) material.color.copy(full).multiplyScalar(lit);
  };
  const dress = (model: THREE.Object3D, keep: (material: THREE.Material) => void): void => {
    const meshes = materials.flatMap((name) => partsIn(model, name));
    if (meshes.length === 0) return;
    const glow = glowing(new THREE.MeshBasicMaterial({
      color: new THREE.Color(colour).multiplyScalar(strength),
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }));
    keep(glow);
    for (const mesh of meshes) {
      const twin = addTwin(mesh, glow);
      twin.castShadow = false;
      twin.renderOrder = AFTER_GLASS;
    }
    if (!spill) return;
    halo ??= haloMap();
    const light = glowing(new THREE.SpriteMaterial({
      map: halo, color: new THREE.Color(colour).multiplyScalar(spill.strength),
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }));
    keep(light);
    model.updateMatrixWorld(true);
    const modelScale = model.getWorldScale(new THREE.Vector3()).x;
    for (const mesh of partsIn(model, spill.material)) {
      mesh.geometry.computeBoundingBox();
      const sprite = new THREE.Sprite(light);
      mesh.geometry.boundingBox!.getCenter(sprite.position);
      // Sized in the model's own metres, whatever scale the bones carry.
      sprite.scale.setScalar((spill.size * modelScale) / mesh.getWorldScale(new THREE.Vector3()).x);
      sprite.renderOrder = AFTER_GLASS;
      mesh.add(sprite);
    }
  };
  return { dress, draw };
}
