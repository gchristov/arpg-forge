import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { glareMap, glassShine } from './glass-shine';

describe('glassShine', () => {
  const modelIn = (materialName: string) => {
    const material = new THREE.MeshStandardMaterial();
    material.name = materialName;
    const model = new THREE.Group();
    model.add(new THREE.Mesh(new THREE.BoxGeometry(), material));
    return model;
  };
  const meshesOf = (model: THREE.Object3D) => {
    const meshes: THREE.Mesh[] = [];
    model.traverse((o) => o instanceof THREE.Mesh && meshes.push(o));
    return meshes;
  };

  it('adds a glare over the glass, sharing its shape and leaving it showing', () => {
    const model = modelIn('Skin');
    const kept: THREE.Material[] = [];
    glassShine({ material: 'Skin', strength: 0.6 })(model, (m) => kept.push(m));
    const [glass, shine] = meshesOf(model);
    expect(shine!.geometry).toBe(glass!.geometry);
    expect(shine!.material).toBeInstanceOf(THREE.MeshMatcapMaterial);
    expect(kept).toEqual([shine!.material]);
    expect(glass!.visible).toBe(true);
  });

  it('adds nothing when no part is glass', () => {
    const model = modelIn('Shell');
    const kept: THREE.Material[] = [];
    glassShine({ material: 'Skin', strength: 0.6 })(model, (m) => kept.push(m));
    expect(meshesOf(model)).toHaveLength(1);
    expect(kept).toHaveLength(0);
  });

  it('is dark where the glass faces the camera and bright only at its rim, brightest along the top', () => {
    const data = glareMap().image.data as Uint8Array;
    const light = (u: number, v: number) => data[(Math.floor((v + 1) / 2 * 63) * 64 + Math.floor((u + 1) / 2 * 63)) * 4]!;
    expect(light(0, 0)).toBe(0);
    expect(light(0.5, 0)).toBe(0);
    expect(light(0, 0.97)).toBeGreaterThan(150);
    expect(light(0, 0.97)).toBeGreaterThan(light(0, -0.97));
  });
});
