import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { instancedModel } from './model-instancing';

describe('instancedModel', () => {
  it('draws every part of a model, a rigged one such as a chest with a lid that opens included', () => {
    const scene = new THREE.Group();
    const box = new THREE.BoxGeometry(1, 1, 1);
    const bone = new THREE.Bone();
    const lid = new THREE.SkinnedMesh(box, new THREE.MeshStandardMaterial());
    lid.add(bone);
    lid.bind(new THREE.Skeleton([bone]));
    scene.add(new THREE.Mesh(box, new THREE.MeshStandardMaterial()), lid);
    const placements = [new THREE.Matrix4(), new THREE.Matrix4().makeTranslation(3, 0, 0)];
    const meshes = instancedModel({ scene, animations: [], height: 1 }, new THREE.Matrix4(), placements);
    expect(meshes.map((m) => m.count)).toEqual([2, 2]);
  });
});
