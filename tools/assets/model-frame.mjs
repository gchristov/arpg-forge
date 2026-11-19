import { linear } from './model-parts.mjs';

// Builds a machine's insides into a character: a metal frame along its skeleton and a glowing core in its chest,
// seen through a see-through body. Each piece hangs off a bone, so it moves with every animation.

const SIDES = 8;

/** A tube of `radius` from y = 0 to y = `length`, open at the ends, which the joints cover. */
function tube(radius, length) {
  const positions = [];
  const normals = [];
  const indices = [];
  for (let i = 0; i <= SIDES; i++) {
    const a = (i / SIDES) * Math.PI * 2;
    const [x, z] = [Math.cos(a), Math.sin(a)];
    positions.push(x * radius, 0, z * radius, x * radius, length, z * radius);
    normals.push(x, 0, z, x, 0, z);
  }
  for (let i = 0; i < SIDES; i++) {
    const [a, b, c, d] = [i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 3];
    indices.push(a, b, c, c, b, d);
  }
  return { positions, normals, indices };
}

/** A ball of `radius` about the origin. */
function ball(radius, rings = 6) {
  const positions = [];
  const normals = [];
  const indices = [];
  for (let r = 0; r <= rings; r++) {
    const polar = (r / rings) * Math.PI;
    for (let s = 0; s <= SIDES; s++) {
      const a = (s / SIDES) * Math.PI * 2;
      const n = [Math.sin(polar) * Math.cos(a), Math.cos(polar), Math.sin(polar) * Math.sin(a)];
      normals.push(...n);
      positions.push(...n.map((v) => v * radius));
    }
  }
  for (let r = 0; r < rings; r++) {
    for (let s = 0; s < SIDES; s++) {
      const a = r * (SIDES + 1) + s;
      const b = a + SIDES + 1;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  return { positions, normals, indices };
}

/** A mesh of one shape in one material. */
function meshOf(doc, shape, material) {
  const buffer = doc.getRoot().listBuffers()[0];
  const accessor = (type, array) => doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
  const primitive = doc.createPrimitive()
    .setAttribute('POSITION', accessor('VEC3', new Float32Array(shape.positions)))
    .setAttribute('NORMAL', accessor('VEC3', new Float32Array(shape.normals)))
    .setIndices(accessor('SCALAR', new Uint16Array(shape.indices)))
    .setMaterial(material);
  return doc.createMesh().addPrimitive(primitive);
}

/** The rotation that turns the y axis to point along `to`, as a quaternion. */
function turnUpTo([x, y, z]) {
  const length = Math.hypot(x, y, z);
  const [dx, dy, dz] = [x / length, y / length, z / length];
  if (dy < -0.9999) return [1, 0, 0, 0];
  // Half way between up and the direction, as a quaternion: the cross product and 1 + the dot product.
  const q = [dz, 0, -dx, 1 + dy];
  const n = Math.hypot(...q);
  return q.map((v) => v / n);
}

const bonesOf = (doc) => new Set(doc.getRoot().listSkins().flatMap((skin) => skin.listJoints()));

/**
 * Runs a rod of `thickness` (a share of its length) along every bone to each child bone, with a ball at each joint,
 * drawn in a new material called `material` of `colour`. Bones whose names contain any of `skip` are left bare.
 */
export function addFrame(doc, { material: name, colour, thickness, skip = [] }) {
  const material = doc.createMaterial(name).setBaseColorFactor([...linear(colour), 1]).setMetallicFactor(0.9).setRoughnessFactor(0.35);
  const bones = bonesOf(doc);
  const bare = (bone) => skip.some((part) => bone.getName().includes(part));
  let rods = 0;
  for (const bone of bones) {
    if (bare(bone)) continue;
    for (const child of bone.listChildren()) {
      if (!bones.has(child) || bare(child)) continue;
      const to = child.getTranslation();
      const length = Math.hypot(...to);
      if (length < 1e-6) continue;
      const radius = length * thickness;
      bone.addChild(doc.createNode(`${name}.${bone.getName()}`).setMesh(meshOf(doc, tube(radius, length), material)).setRotation(turnUpTo(to)));
      child.addChild(doc.createNode(`${name}.${child.getName()}.joint`).setMesh(meshOf(doc, ball(radius * 1.8), material)));
      rods++;
    }
  }
  if (rods === 0) throw new Error('no bones to build a frame along');
}

/**
 * Hangs a glowing ball of `colour`, in a material called Core, in front of `bone`, `size` (a share of the bone's
 * length) across, inside a fainter `halo`, called Halo, of `halo.size` times the ball and `halo.opacity`. Paint
 * either to make it glow brighter.
 */
export function addCore(doc, { bone: boneName, colour, size, halo }) {
  const bone = [...bonesOf(doc)].find((b) => b.getName() === boneName);
  if (!bone) throw new Error(`no bone ${boneName} for the core`);
  const child = bone.listChildren().find((c) => bonesOf(doc).has(c));
  const radius = (child ? Math.hypot(...child.getTranslation()) : 1) * size;
  const glowing = (materialName, opacity) => {
    const material = doc.createMaterial(materialName).setBaseColorFactor([...linear(colour), opacity]).setEmissiveFactor(linear(colour));
    if (opacity < 1) material.setAlphaMode('BLEND');
    return material;
  };
  const core = doc.createNode('Core').setMesh(meshOf(doc, ball(radius, 8), glowing('Core', 1))).setTranslation([0, radius * 0.6, radius * 0.9]);
  bone.addChild(core);
  if (halo) core.addChild(doc.createNode('Core.halo').setMesh(meshOf(doc, ball(radius * halo.size, 8), glowing('Halo', halo.opacity))));
}
