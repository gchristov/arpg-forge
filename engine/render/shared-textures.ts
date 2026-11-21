import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Model files from one kit each carry their own copy of the kit's textures, so without this the same picture goes
 * to the GPU once per model that uses it, which can run to gigabytes. Textures whose pictures have the same bytes
 * and that are sampled the same way are kept once and shared by every material that uses them.
 */
export class SharedTextures {
  private readonly kept = new Map<string, THREE.Texture>();

  /** Points every material of a loaded model at the kept copy of each of its textures, keeping new ones. */
  async share(gltf: GLTF): Promise<void> {
    const keys = new Map<THREE.Texture, string>();
    for (const [texture, association] of gltf.parser.associations) {
      if (!(texture instanceof THREE.Texture) || association.textures === undefined) continue;
      const bytes = await sourceBytes(gltf, association.textures);
      if (bytes) keys.set(texture, `${textureKey(texture)}|${byteKey(bytes)}`);
    }
    gltf.scene.traverse((object) => {
      const materials = (object as THREE.Mesh).material;
      if (!materials) return;
      for (const material of [materials].flat()) this.swap(material, keys);
    });
    // The copies left over are never drawn: their decoded pictures are let go of now.
    for (const texture of keys.keys()) if (!this.isKept(texture)) (texture.image as ImageBitmap | undefined)?.close?.();
  }

  private isKept(texture: THREE.Texture): boolean {
    for (const kept of this.kept.values()) if (kept === texture) return true;
    return false;
  }

  /** Every distinct texture kept so far. */
  get count(): number {
    return this.kept.size;
  }

  swap(material: THREE.Material, keys: Map<THREE.Texture, string>): void {
    const fields = material as unknown as Record<string, unknown>;
    for (const [field, value] of Object.entries(fields)) {
      if (!(value instanceof THREE.Texture)) continue;
      const key = keys.get(value);
      if (!key) continue;
      const kept = this.kept.get(key);
      if (!kept) this.kept.set(key, value);
      else if (kept !== value) fields[field] = kept;
    }
  }
}

/** How a texture is sampled: two textures differing in any of these draw differently from the same picture. */
export function textureKey(t: THREE.Texture): string {
  return [t.colorSpace, t.flipY, t.wrapS, t.wrapT, t.magFilter, t.minFilter, t.channel,
    t.offset.x, t.offset.y, t.repeat.x, t.repeat.y, t.rotation].join();
}

/** A fingerprint of a picture's bytes: its length and two FNV-1a hashes, one over every byte and one over every 7th. */
export function byteKey(bytes: Uint8Array): string {
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < bytes.length; i++) {
    a = Math.imul(a ^ bytes[i]!, 0x01000193);
    if (i % 7 === 0) b = Math.imul(b ^ bytes[i]!, 0x811c9dc5);
  }
  return `${bytes.length}:${(a >>> 0).toString(36)}:${(b >>> 0).toString(36)}`;
}

/** The encoded picture behind a glTF texture, when it's stored in the file rather than linked. */
async function sourceBytes(gltf: GLTF, textureIndex: number): Promise<Uint8Array | undefined> {
  const json = gltf.parser.json;
  const texture = json.textures?.[textureIndex];
  if (!texture) return undefined;
  const extensionSource = Object.values(texture.extensions ?? {}).map((e) => (e as { source?: number }).source).find((s) => s !== undefined);
  const image = json.images?.[extensionSource ?? texture.source];
  if (image?.bufferView === undefined) return undefined;
  const buffer: ArrayBuffer = await gltf.parser.getDependency('bufferView', image.bufferView);
  return new Uint8Array(buffer);
}
