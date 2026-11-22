// Changes a model's parts by the material they're drawn in: repainting them, and splitting part of one off into
// another, such as a faceplate off a body.
import { KHRMaterialsEmissiveStrength } from '@gltf-transform/extensions';
import { cutAlong } from './triangle-cut.mjs';

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
 * with `glowStrength` to light it beyond full, and `roughness` and `metalness`. `plain` drops the part's texture, so
 * it's drawn in its colour alone, such as a body painted over its skin.
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
    if (p.plain) material.setBaseColorTexture(null);
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

/**
 * How far, in metres, a change of a whole bone weight moves an edge cut along the weights: half a weight is a few
 * centimetres, about a triangle across on a character.
 */
const WEIGHT_SPAN = 0.1;

/** The values at the given share of the way through, from lowest to highest. */
function share(values, at) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * at))] ?? 0;
}

/**
 * Moves the triangles of `material` that the named `bones` mostly move into a copy of it called `into`. `front`
 * keeps only those in front of that share of them (0.5: the front half), `back` only those behind that share,
 * `below` only those below that share of their height, for a face without the back or top of the head, and `above`
 * only those above it, such as the line of the shoulders off the top of a chest. `inner` keeps
 * only those within that share of their distance out to the side, such as the top of an arm held out from the body,
 * and `outer` only those beyond it, such as the wrist end of a forearm. Triangles across the part's edge are cut
 * along it, so the edge runs smoothly rather than along whole triangles.
 */
export function splitPart(doc, { material: name, into, bones, front = 0, back = 1, above = 0, below = 1, inner = 1, outer = 0 }) {
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
      const boneWeight = (v) => {
        const j = joints.getElement(v, []);
        const w = weights.getElement(v, []);
        return j.reduce((sum, joint, k) => sum + (named.has(joint) ? w[k] : 0), 0);
      };
      const ours = [];
      for (let v = 0; v < position.getCount(); v++) if (boneWeight(v) > 0.5) ours.push(position.getElement(v, []));
      const limits = [];
      const limit = (used, distance) => used && limits.push(distance);
      const [zs, ys, xs] = [ours.map((p) => p[2]), ours.map((p) => p[1]), ours.map((p) => Math.abs(p[0]))];
      const [frontFrom, backTo, aboveFrom, belowTo, innerTo, outerFrom] =
        [share(zs, front), share(zs, back), share(ys, above), share(ys, below), share(xs, inner), share(xs, outer)];
      limit(front > 0, ([, , z]) => z - frontFrom);
      limit(back < 1, ([, , z]) => backTo - z);
      limit(above > 0, ([, y]) => y - aboveFrom);
      limit(below < 1, ([, y]) => belowTo - y);
      limit(inner < 1, ([x]) => innerTo - Math.abs(x));
      limit(outer > 0, ([x]) => Math.abs(x) - outerFrom);
      // How far inside the part a vertex is, in metres: zero on its edge, below zero outside it.
      const margin = (v) => {
        const p = position.getElement(v, []);
        return Math.min((boneWeight(v) - 0.5) * WEIGHT_SPAN, ...limits.map((distance) => distance(p)));
      };
      const { inside: split, outside: kept, vertexCount } = cutAlong(primitive, margin);
      if (split.length === 0) continue;
      const Indices = vertexCount > 65535 ? Uint32Array : indices.getArray().constructor;
      indices.setArray(new Indices(kept));
      const part = primitive.clone().setMaterial(target);
      part.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Indices(split)).setBuffer(indices.getBuffer()));
      mesh.addPrimitive(part);
      moved += split.length / 3;
    }
  }
  if (moved === 0) throw new Error(`no triangles of ${name} on ${bones.join(', ')} to split into ${into}`);
}

/**
 * Adds a copy of every part drawn in `material`, in a new material called `into`, `lift` out from the part's
 * surface: something to draw a mesh of lines over the part from, which the part itself doesn't hide. The copy is
 * weighted to the same bones, so it bends with the part.
 */
export function addRaisedCopy(doc, { material: name, into, lift }) {
  const source = doc.getRoot().listMaterials().find((m) => m.getName() === name);
  if (!source) throw new Error(`no material ${name} to copy`);
  // Marked as a copy, so it isn't merged back into its part when identical materials are merged.
  const material = source.clone().setName(into).setExtras({ ...source.getExtras(), raisedCopyOf: name });
  let copied = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      if (primitive.getMaterial() !== source) continue;
      const position = primitive.getAttribute('POSITION');
      const raised = raise(position, primitive.getIndices().getArray(), lift);
      mesh.addPrimitive(primitive.clone().setMaterial(material)
        .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(raised).setBuffer(position.getBuffer())));
      copied++;
    }
  }
  if (copied === 0) throw new Error(`no part in ${name} to copy`);
}

/**
 * The points of `position`, each moved `lift` along the mean normal of the triangles round its place. Flat-shaded
 * parts give each triangle corners of its own, so corners at the same place share one normal and stay joined.
 */
function raise(position, indices, lift) {
  const points = position.getArray();
  const placeOf = (v) => [0, 1, 2].map((k) => points[v * 3 + k].toFixed(5)).join();
  const normals = new Map();
  for (let t = 0; t < indices.length; t += 3) {
    const [a, b, c] = [0, 1, 2].map((k) => points.subarray(indices[t + k] * 3, indices[t + k] * 3 + 3));
    const [u, v] = [[0, 1, 2].map((k) => b[k] - a[k]), [0, 1, 2].map((k) => c[k] - a[k])];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    for (let k = 0; k < 3; k++) {
      const place = placeOf(indices[t + k]);
      const sum = normals.get(place) ?? [0, 0, 0];
      normals.set(place, sum.map((value, i) => value + n[i]));
    }
  }
  const raised = new Float32Array(points);
  for (let v = 0; v < raised.length / 3; v++) {
    const n = normals.get(placeOf(v));
    if (!n) continue;
    const length = Math.hypot(...n) || 1;
    for (let k = 0; k < 3; k++) raised[v * 3 + k] += (n[k] / length) * lift;
  }
  return raised;
}
