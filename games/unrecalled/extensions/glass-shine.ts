import * as THREE from 'three';
import { addTwin, partsIn } from './part-twins';

/** How smooth the glass is: a mirror, so what it reflects stays sharp. */
const GLASS_ROUGHNESS = 0.04;

/**
 * Glass is clear where it faces the camera and turns into a mirror where it curves away. This scales a mirror's light
 * by how far the surface turns away from the camera, from none face on to all of it edge on, `sharpness` keeping the
 * shine to a thin band at the edge.
 */
export function edgeShader(sharpness: number): (shader: { fragmentShader: string }) => void {
  return (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `#include <dithering_fragment>
      float facing = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
      gl_FragColor.rgb *= pow(1.0 - facing, ${sharpness.toFixed(1)});`,
    );
  };
}

/**
 * Makes every part of a model in the named material shine like glass: a twin of it, sharing its shape and skeleton,
 * mirrors the room and the lights round it at its edges, `strength` bright, fading to nothing where it faces the
 * camera so the glass stays clear there. One extra draw.
 */
export function glassShine({ material: name, strength, sharpness }: { material: string; strength: number; sharpness: number }) {
  return (model: THREE.Object3D, keep: (material: THREE.Material) => void): void => {
    const meshes = partsIn(model, name);
    if (meshes.length === 0) return;
    const mirror = new THREE.MeshStandardMaterial({
      color: new THREE.Color(strength, strength, strength), metalness: 1, roughness: GLASS_ROUGHNESS,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    mirror.onBeforeCompile = edgeShader(sharpness);
    mirror.customProgramCacheKey = () => `glass-edge-${sharpness}`;
    keep(mirror);
    for (const mesh of meshes) addTwin(mesh, mirror).castShadow = false;
  };
}
