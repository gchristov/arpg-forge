import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { meshLines } from './mesh-lines';

describe('meshLines', () => {
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

  it('draws the edges of the named part as lines over it, sharing its shape', () => {
    const model = modelIn('Mesh');
    const kept: THREE.Material[] = [];
    meshLines({ material: 'Mesh', colour: 0xeef3f8, opacity: 0.5 })(model, (m) => kept.push(m));
    const [part, lines] = meshesOf(model);
    expect(lines!.geometry).toBe(part!.geometry);
    expect((lines!.material as THREE.MeshBasicMaterial).wireframe).toBe(true);
    expect(kept).toEqual([lines!.material]);
  });

  it('draws no lines when no part has the named material', () => {
    const model = modelIn('Skin');
    const kept: THREE.Material[] = [];
    meshLines({ material: 'Mesh', colour: 0, opacity: 1 })(model, (m) => kept.push(m));
    expect(meshesOf(model)).toHaveLength(1);
    expect(kept).toHaveLength(0);
  });
});
