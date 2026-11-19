// Changes a model's parts by the material they're drawn in: repainting them, and splitting part of one off into
// another, such as a faceplate off a body.
import { KHRMaterialsEmissiveStrength } from '@gltf-transform/extensions';

/** A colour written as #rrggbb, in the linear values glTF stores. */
export function linear(hex) {
  const value = (i) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
  return [0, 1, 2].map((i) => {
    const c = value(i);
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
}

/**
 * Repaints parts by material name: `colour` (#rrggbb), `opacity` (below 1 makes it see-through), `glow` (#rrggbb)
 * with `glowStrength` to light it beyond full, and `roughness` and `metalness`.
 */
export function paintParts(doc, paint) {
  const known = new Set(doc.getRoot().listMaterials().map((m) => m.getName()));
  const missing = Object.keys(paint).filter((name) => !known.has(name));
  if (missing.length) throw new Error(`no material ${missing.join(', ')} to paint`);
  for (const material of doc.getRoot().listMaterials()) {
    const p = paint[material.getName()];
    if (!p) continue;
    const [r, g, b, a] = material.getBaseColorFactor();
    const colour = p.colour ? linear(p.colour) : [r, g, b];
    material.setBaseColorFactor([...colour, p.opacity ?? a]);
    if (p.opacity !== undefined) material.setAlphaMode(p.opacity < 1 ? 'BLEND' : 'OPAQUE');
    if (p.roughness !== undefined) material.setRoughnessFactor(p.roughness);
    if (p.metalness !== undefined) material.setMetallicFactor(p.metalness);
    if (p.glow) {
      material.setEmissiveFactor(linear(p.glow));
      if (p.glowStrength) {
        const strength = doc.createExtension(KHRMaterialsEmissiveStrength).createEmissiveStrength().setEmissiveStrength(p.glowStrength);
        material.setExtension('KHR_materials_emissive_strength', strength);
      }
    }
  }
}

/** The values at the given share of the way through, from lowest to highest. */
function share(values, at) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * at))] ?? 0;
}

/**
 * Moves the triangles of `material` that the named `bones` mostly move into a copy of it called `into`. `front`
 * keeps only those in front of that share of them (0.5: the front half), and `below` only those below that share of
 * their height, for a face without the back or top of the head.
 */
export function splitPart(doc, { material: name, into, bones, front = 0, below = 1 }) {
  const root = doc.getRoot();
  const source = root.listMaterials().find((m) => m.getName() === name);
  if (!source) throw new Error(`no material ${name} to split`);
  const target = root.listMaterials().find((m) => m.getName() === into) ?? source.clone().setName(into);
  let moved = 0;
  for (const node of root.listNodes()) {
    const mesh = node.getMesh();
    const skin = node.getSkin();
    if (!mesh || !skin) continue;
    const named = new Set(skin.listJoints().flatMap((joint, i) => (bones.includes(joint.getName()) ? [i] : [])));
    if (named.size !== bones.length) throw new Error(`a skin lacks one of the bones ${bones.join(', ')}`);
    for (const primitive of mesh.listPrimitives()) {
      if (primitive.getMaterial() !== source) continue;
      const indices = primitive.getIndices();
      if (!indices) throw new Error(`${name} has no indices to split`);
      const position = primitive.getAttribute('POSITION');
      const joints = primitive.getAttribute('JOINTS_0');
      const weights = primitive.getAttribute('WEIGHTS_0');
      const onBones = (v) => {
        const j = joints.getElement(v, []);
        const w = weights.getElement(v, []);
        return j.reduce((sum, joint, k) => sum + (named.has(joint) ? w[k] : 0), 0) > 0.5;
      };
      const ours = [];
      for (let v = 0; v < position.getCount(); v++) if (onBones(v)) ours.push(position.getElement(v, []));
      const frontFrom = share(ours.map((p) => p[2]), front);
      const belowTo = share(ours.map((p) => p[1]), below);
      const inPart = (v) => {
        if (!onBones(v)) return false;
        const [, y, z] = position.getElement(v, []);
        return z >= frontFrom && y <= belowTo;
      };
      const all = indices.getArray();
      const kept = [];
      const split = [];
      for (let t = 0; t < all.length; t += 3) {
        const triangle = [all[t], all[t + 1], all[t + 2]];
        (triangle.every(inPart) ? split : kept).push(...triangle);
      }
      if (split.length === 0) continue;
      const Indices = all.constructor;
      indices.setArray(new Indices(kept));
      const part = primitive.clone().setMaterial(target);
      part.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Indices(split)).setBuffer(indices.getBuffer()));
      mesh.addPrimitive(part);
      moved += split.length / 3;
    }
  }
  if (moved === 0) throw new Error(`no triangles of ${name} on ${bones.join(', ')} to split into ${into}`);
}
