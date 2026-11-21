import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { mergeCharacter } from './merge-character';
import { SharedTextures } from './shared-textures';

/** A loaded model, ready to be copied for each actor or prop that uses it. */
export interface ModelTemplate {
  scene: THREE.Object3D;
  animations: THREE.AnimationClip[];
  /** Height of the untransformed model, for scaling it to a target height. */
  height: number;
}

/**
 * The game's 3D models, loaded up front by name so nothing is fetched or parsed during play. Models are compressed
 * with meshopt, which the loader decodes.
 */
export class ModelLibrary {
  private readonly templates = new Map<string, ModelTemplate>();
  private readonly loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  private readonly sharedTextures = new SharedTextures();

  /** Loads every model; resolves once all have loaded or failed. Failed models fall back to simple shapes. */
  async load(urls: Record<string, string>): Promise<void> {
    await Promise.all(
      Object.entries(urls).map(async ([name, url]) => {
        try {
          const gltf = await this.loader.loadAsync(url);
          await this.sharedTextures.share(gltf);
          this.templates.set(name, toTemplate(gltf));
        } catch (error) {
          console.warn(`Model ${name} failed to load`, error);
        }
      }),
    );
  }

  /** Every texture the loaded models use, to send to the GPU before play. */
  textures(): THREE.Texture[] {
    const found = new Set<THREE.Texture>();
    for (const template of this.templates.values()) template.scene.traverse((o) => texturesOf(o, found));
    return [...found];
  }

  get(name: string): ModelTemplate | undefined {
    return this.templates.get(name);
  }

  /** A copy of a model's scene that can be posed and animated on its own. */
  instantiate(name: string): THREE.Object3D | undefined {
    const template = this.templates.get(name);
    return template && cloneSkinned(template.scene);
  }
}

/**
 * Animations swing limbs past the rest pose's bounds, so a character's culling bounds get this much room to avoid it
 * vanishing at the screen's edge mid-swing.
 */
const SWING_ROOM = 1.5;

/**
 * Characters are merged into one mesh per material as they load, so each costs one or two draw calls. Their culling
 * bounds are measured here once, since every copy inherits them; otherwise each new actor measures every vertex
 * through its bones the first frame it appears.
 */
function toTemplate(gltf: GLTF): ModelTemplate {
  mergeCharacter(gltf.scene);
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((o) => {
    if (!(o instanceof THREE.SkinnedMesh)) return;
    o.computeBoundingSphere();
    o.boundingSphere!.radius *= SWING_ROOM;
  });
  const box = new THREE.Box3().setFromObject(gltf.scene);
  return { scene: gltf.scene, animations: gltf.animations, height: Math.max(0.001, box.max.y - box.min.y) };
}

/** Adds the textures of an object's materials to `found`. */
export function texturesOf(object: THREE.Object3D, found: Set<THREE.Texture>): void {
  const materials = (object as THREE.Mesh).material;
  if (!materials) return;
  for (const material of [materials].flat()) {
    for (const value of Object.values(material)) if (value instanceof THREE.Texture) found.add(value);
  }
}
