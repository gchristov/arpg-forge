import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { mergeCharacter } from './merge-character';

/**
 * A small rig like a KayKit character: a transformed rig node, two bones, two skinned parts bound to them and a
 * rigid part hanging off the second bone (like a held sword).
 */
function rig(materials: [THREE.Material, THREE.Material]) {
  const root = new THREE.Group();
  const rigNode = new THREE.Group();
  rigNode.position.set(0.3, 0, -0.2);
  rigNode.scale.setScalar(0.5);
  root.add(rigNode);
  const hips = new THREE.Bone();
  const arm = new THREE.Bone();
  arm.position.set(0, 1, 0);
  hips.add(arm);
  const hand = new THREE.Bone();
  hand.position.set(0.5, 0.5, 0);
  arm.add(hand);
  rigNode.add(hips);
  rigNode.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton([hips, arm]);

  const part = (offset: number, material: THREE.Material) => {
    const geometry = new THREE.BoxGeometry(0.4, 0.4, 0.4).translate(offset, 0.6, 0);
    const count = geometry.getAttribute('position').count;
    const index = new Uint16Array(count * 4);
    const weight = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      const upper = geometry.getAttribute('position').getY(i) > 0.6;
      index[i * 4] = upper ? 1 : 0;
      index[i * 4 + 1] = 0;
      weight[i * 4] = upper ? 0.7 : 1;
      weight[i * 4 + 1] = upper ? 0.3 : 0;
    }
    geometry.setAttribute('skinIndex', new THREE.BufferAttribute(index, 4));
    geometry.setAttribute('skinWeight', new THREE.BufferAttribute(weight, 4));
    const mesh = new THREE.SkinnedMesh(geometry, material);
    rigNode.add(mesh);
    mesh.bind(skeleton);
    return mesh;
  };
  part(-0.3, materials[0]);
  part(0.3, materials[1]);
  // Like a compressed model: positions stored at half size, with the scale folded into this part's own bone inverses.
  const compressed = part(0, materials[0]);
  compressed.geometry.scale(0.5, 0.5, 0.5);
  const world = compressed.bindMatrix;
  const fold = world.clone().multiply(new THREE.Matrix4().makeScale(2, 2, 2)).multiply(world.clone().invert());
  compressed.skeleton = new THREE.Skeleton(skeleton.bones, skeleton.boneInverses.map((m) => m.clone().multiply(fold)));
  const sword = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 0.1), materials[0]);
  sword.position.set(0, 0.4, 0);
  hand.add(sword);
  return { root, hips, arm };
}

/** Every vertex of every mesh, where it is drawn for the current pose, rounded so the two models can be compared. */
function drawnVertices(root: THREE.Object3D): string[] {
  root.updateMatrixWorld(true);
  const out: string[] = [];
  const v = new THREE.Vector3();
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    if (o instanceof THREE.SkinnedMesh) o.skeleton.update();
    const positions = o.geometry.getAttribute('position');
    const index = o.geometry.index;
    const count = index ? index.count : positions.count;
    for (let k = 0; k < count; k++) {
      o.getVertexPosition(index ? index.getX(k) : k, v);
      v.applyMatrix4(o.matrixWorld);
      out.push(`${v.x.toFixed(4)},${v.y.toFixed(4)},${v.z.toFixed(4)}`);
    }
  });
  return out.sort();
}

function pose(r: ReturnType<typeof rig>): void {
  r.hips.rotation.set(0.2, 0.5, 0);
  r.hips.position.set(0.1, 0.05, 0);
  r.arm.rotation.set(0, 0, -0.9);
  r.root.position.set(4, 0, 7);
  r.root.rotation.y = 1.2;
}

describe('mergeCharacter', () => {
  it('draws every vertex exactly where the separate parts did, in any pose', () => {
    const material = new THREE.MeshStandardMaterial();
    const original = rig([material, material]);
    const merged = rig([material, material]);
    expect(mergeCharacter(merged.root)).toBe(true);
    pose(original);
    pose(merged);
    expect(drawnVertices(merged.root)).toEqual(drawnVertices(original.root));
  });

  it('turns parts sharing a material into a single mesh', () => {
    const material = new THREE.MeshStandardMaterial();
    const r = rig([material, material]);
    mergeCharacter(r.root);
    const meshes: THREE.Mesh[] = [];
    r.root.traverse((o) => o instanceof THREE.Mesh && meshes.push(o));
    expect(meshes).toHaveLength(1);
  });

  it('keeps one mesh per material', () => {
    const r = rig([new THREE.MeshStandardMaterial(), new THREE.MeshStandardMaterial()]);
    mergeCharacter(r.root);
    const meshes: THREE.Mesh[] = [];
    r.root.traverse((o) => o instanceof THREE.Mesh && meshes.push(o));
    expect(meshes).toHaveLength(2);
  });

  it('leaves models without skinned parts alone', () => {
    const root = new THREE.Group();
    root.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()));
    expect(mergeCharacter(root)).toBe(false);
  });
});
