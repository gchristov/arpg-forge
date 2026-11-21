import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { byteKey, SharedTextures, textureKey } from './shared-textures';

describe('byteKey', () => {
  it('tells pictures apart by their bytes, whatever they are called', () => {
    const a = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(byteKey(a)).toBe(byteKey(a.slice()));
    expect(byteKey(a)).not.toBe(byteKey(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 10])));
  });
});

describe('textureKey', () => {
  it('tells apart textures sampled differently from the same picture', () => {
    const plain = new THREE.Texture();
    const repeated = new THREE.Texture();
    repeated.repeat.set(2, 2);
    expect(textureKey(plain)).not.toBe(textureKey(repeated));
  });
});

describe('SharedTextures', () => {
  it('points the materials of two models at one copy of a texture both carry', () => {
    const shared = new SharedTextures();
    const first = new THREE.MeshStandardMaterial({ map: new THREE.Texture() });
    const second = new THREE.MeshStandardMaterial({ map: new THREE.Texture() });
    shared.swap(first, new Map([[first.map!, 'same picture']]));
    shared.swap(second, new Map([[second.map!, 'same picture']]));
    expect(second.map).toBe(first.map);
    expect(shared.count).toBe(1);
  });

  it('keeps different pictures apart', () => {
    const shared = new SharedTextures();
    const first = new THREE.MeshStandardMaterial({ map: new THREE.Texture() });
    const second = new THREE.MeshStandardMaterial({ map: new THREE.Texture() });
    shared.swap(first, new Map([[first.map!, 'one picture']]));
    shared.swap(second, new Map([[second.map!, 'another picture']]));
    expect(second.map).not.toBe(first.map);
  });
});
