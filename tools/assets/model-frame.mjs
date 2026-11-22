import { linear } from './model-parts.mjs';
import { ball, helix, meshOf, tube, turnUpTo } from './shapes.mjs';

// Builds a machine's skeleton into a character: a metal frame along its bones with wires wound round it, seen through
// a see-through body. Each piece hangs off a bone, so it moves with every animation.

const bonesOf = (doc) => new Set(doc.getRoot().listSkins().flatMap((skin) => skin.listJoints()));

/**
 * Runs a rod `width` across (in metres, the same on every bone) along every bone to each child bone, in a new
 * material called `material` of `colour`, with a ball `joint` times as wide at each joint, in its own material called
 * `material` + Joint so it can be painted apart. Bones whose names contain any of `skip` are left bare, except that
 * the bones named in `reach` run a rod to their end bone too, such as a shin that has no foot below it.
 * `wires` winds wires round the rods, each in its own material called Wire.0, Wire.1 and so on, of its `colour`: see
 * `helix` for their shape. A wire with `bones` winds only round the rods of bones whose names contain one of them.
 */
export function addFrame(doc, { material: name, colour, width, joint = 1.8, skip = [], reach = [], wires = [] }) {
  const metal = (materialName) =>
    doc.createMaterial(materialName).setBaseColorFactor([...linear(colour), 1]).setMetallicFactor(0.9).setRoughnessFactor(0.35);
  const material = metal(name);
  const jointMaterial = metal(`${name}Joint`);
  const wireMaterials = wires.map(({ colour: c }, i) =>
    doc.createMaterial(`Wire.${i}`).setBaseColorFactor([...linear(c), 1]).setRoughnessFactor(0.5));
  const bones = bonesOf(doc);
  const bare = (bone) => skip.some((part) => bone.getName().includes(part));
  let rods = 0;
  for (const bone of bones) {
    if (bare(bone)) continue;
    for (const child of bone.listChildren()) {
      const toEnd = reach.includes(bone.getName()) && child.getName() === `${bone.getName()}_end`;
      if (!bones.has(child) || (bare(child) && !toEnd)) continue;
      const to = child.getTranslation();
      const length = Math.hypot(...to);
      if (length < 1e-6) continue;
      bone.addChild(doc.createNode(`${name}.${bone.getName()}`).setMesh(meshOf(doc, tube(width / 2, length), material)).setRotation(turnUpTo(to)));
      child.addChild(doc.createNode(`${name}.${child.getName()}.joint`).setMesh(meshOf(doc, ball((width / 2) * joint), jointMaterial)));
      wires.forEach((wire, i) => {
        if (wire.bones && !wire.bones.some((part) => bone.getName().includes(part))) return;
        const node = doc.createNode(`Wire.${i}.${bone.getName()}`).setMesh(meshOf(doc, helix(wire, length), wireMaterials[i]));
        bone.addChild(node.setRotation(turnUpTo(to)));
      });
      rods++;
    }
  }
  if (rods === 0) throw new Error('no bones to build a frame along');
}
