import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Merges a character's parts into one skinned mesh per material, so drawing a character costs one or two draw calls
 * instead of one per part (body, arms, legs, head, helmet, sword...). Skinned parts keep their weights, remapped to a
 * single shared bone list. Rigid parts hanging off a bone, such as a helmet or a held sword, become skinned to that
 * bone, so they still follow it. Returns false and leaves the model as it was if its parts can't be merged.
 */
export function mergeCharacter(root: THREE.Object3D): boolean {
  root.updateMatrixWorld(true);
  const skinned: THREE.SkinnedMesh[] = [];
  const rigid: Array<{ mesh: THREE.Mesh; bone: THREE.Bone }> = [];
  root.traverse((o) => {
    if (o instanceof THREE.SkinnedMesh) skinned.push(o);
    else if (o instanceof THREE.Mesh) {
      const bone = boneAbove(o);
      if (bone) rigid.push({ mesh: o, bone });
    }
  });
  if (skinned.length === 0 || skinned.length + rigid.length < 2) return false;

  const bones: THREE.Bone[] = [];
  const inverses: THREE.Matrix4[] = [];
  const boneIndex = new Map<THREE.Bone, number>();
  const addBone = (bone: THREE.Bone, inverse: THREE.Matrix4): number => {
    let index = boneIndex.get(bone);
    if (index === undefined) {
      index = bones.length;
      boneIndex.set(bone, index);
      bones.push(bone);
      inverses.push(inverse.clone());
    }
    return index;
  };

  const byMaterial = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const add = (material: THREE.Material, geometry: THREE.BufferGeometry): void => {
    let list = byMaterial.get(material);
    if (!list) byMaterial.set(material, (list = []));
    list.push(geometry);
  };

  for (const mesh of skinned) {
    if (Array.isArray(mesh.material)) return false;
    const toRest = restSpace(mesh);
    if (!toRest) return false;
    const remap = mesh.skeleton.bones.map((bone) => addBone(bone, bone.matrixWorld.clone().invert()));
    const geometry = floatCopy(mesh.geometry);
    if (!geometry) return false;
    const skinIndex = geometry.getAttribute('skinIndex') as THREE.BufferAttribute;
    for (let i = 0; i < skinIndex.count; i++) {
      for (let c = 0; c < 4; c++) skinIndex.setComponent(i, c, remap[skinIndex.getComponent(i, c)] ?? 0);
    }
    geometry.applyMatrix4(toRest);
    add(mesh.material, geometry);
  }

  for (const { mesh, bone } of rigid) {
    if (Array.isArray(mesh.material)) return false;
    const index = addBone(bone, bone.matrixWorld.clone().invert());
    const geometry = floatCopy(mesh.geometry);
    if (!geometry) return false;
    geometry.applyMatrix4(mesh.matrixWorld);
    const count = geometry.getAttribute('position').count;
    const skinIndex = new Uint16Array(count * 4);
    const skinWeight = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      skinIndex[i * 4] = index;
      skinWeight[i * 4] = 1;
    }
    geometry.setAttribute('skinIndex', new THREE.BufferAttribute(skinIndex, 4));
    geometry.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeight, 4));
    add(mesh.material, geometry);
  }

  const merged: THREE.SkinnedMesh[] = [];
  for (const [material, geometries] of byMaterial) {
    const geometry = mergeGeometries(geometries.map(sameAttributes(geometries)), false);
    if (!geometry) return false;
    merged.push(new THREE.SkinnedMesh(geometry, material));
  }

  const skeleton = new THREE.Skeleton(bones, inverses);
  for (const mesh of [...skinned, ...rigid.map((r) => r.mesh)]) mesh.removeFromParent();
  for (const mesh of merged) {
    mesh.castShadow = true;
    root.add(mesh);
    mesh.updateMatrixWorld(true);
    mesh.bind(skeleton, new THREE.Matrix4());
  }
  return true;
}

/**
 * The transform that takes a skinned part's vertices into the shared space where every bone's inverse is simply its
 * rest pose inverted. Parts don't agree on their own bone inverses: compressed models fold each part's own
 * dequantisation into them. The transform must be the same whichever of the part's bones it's measured through;
 * null if not, so the model is left unmerged rather than drawn wrong.
 */
function restSpace(mesh: THREE.SkinnedMesh): THREE.Matrix4 | null {
  const { bones, boneInverses } = mesh.skeleton;
  const through = (i: number) => bones[i]!.matrixWorld.clone().multiply(boneInverses[i]!).multiply(mesh.bindMatrix);
  const transform = through(0);
  for (let i = 1; i < bones.length; i++) {
    const other = through(i).elements;
    if (transform.elements.some((e, k) => Math.abs(e - other[k]!) > 1e-3 * Math.max(1, Math.abs(e)))) return null;
  }
  return transform;
}

/** The nearest bone above an object, if it hangs off one. */
function boneAbove(o: THREE.Object3D): THREE.Bone | null {
  for (let p = o.parent; p; p = p.parent) if (p instanceof THREE.Bone) return p;
  return null;
}

/**
 * A copy of a geometry with its positions, normals and UVs as plain floats, since compressed models store them as
 * quantised integers that can't be transformed or merged with other parts. Null if it lacks positions.
 */
function floatCopy(source: THREE.BufferGeometry): THREE.BufferGeometry | null {
  const geometry = (source.index ? source.toNonIndexed() : source.clone()) as THREE.BufferGeometry;
  if (!geometry.getAttribute('position')) return null;
  for (const name of ['position', 'normal', 'uv']) {
    const attribute = geometry.getAttribute(name);
    if (!attribute) continue;
    const values = new Float32Array(attribute.count * attribute.itemSize);
    for (let i = 0; i < attribute.count; i++) {
      for (let c = 0; c < attribute.itemSize; c++) values[i * attribute.itemSize + c] = attribute.getComponent(i, c);
    }
    geometry.setAttribute(name, new THREE.BufferAttribute(values, attribute.itemSize));
  }
  const skinIndex = geometry.getAttribute('skinIndex');
  if (skinIndex) {
    const values = new Uint16Array(skinIndex.count * 4);
    for (let i = 0; i < skinIndex.count; i++) for (let c = 0; c < 4; c++) values[i * 4 + c] = skinIndex.getComponent(i, c);
    geometry.setAttribute('skinIndex', new THREE.BufferAttribute(values, 4));
  }
  const skinWeight = geometry.getAttribute('skinWeight');
  if (skinWeight) {
    const values = new Float32Array(skinWeight.count * 4);
    for (let i = 0; i < skinWeight.count; i++) for (let c = 0; c < 4; c++) values[i * 4 + c] = skinWeight.getComponent(i, c);
    geometry.setAttribute('skinWeight', new THREE.BufferAttribute(values, 4));
  }
  geometry.morphAttributes = {};
  return geometry;
}

/** Gives every geometry the attributes all of them need, filling missing normals and UVs with zeros. */
function sameAttributes(all: THREE.BufferGeometry[]) {
  const sizes = new Map<string, number>();
  for (const g of all) for (const name of Object.keys(g.attributes)) sizes.set(name, g.getAttribute(name).itemSize);
  return (g: THREE.BufferGeometry): THREE.BufferGeometry => {
    const count = g.getAttribute('position').count;
    for (const [name, size] of sizes) {
      if (g.getAttribute(name)) continue;
      const values = name === 'skinIndex' ? new Uint16Array(count * size) : new Float32Array(count * size);
      g.setAttribute(name, new THREE.BufferAttribute(values, size));
    }
    for (const name of Object.keys(g.attributes)) if (!sizes.has(name)) g.deleteAttribute(name);
    return g;
  };
}
