import { linear } from './model-parts.mjs';
import { ball, helix, meshOf, tube, turnUpTo } from './shapes.mjs';

// Builds a machine's insides into a character: a metal frame along its skeleton and a glowing core in its chest,
// seen through a see-through body. Each piece hangs off a bone, so it moves with every animation.

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

/**
 * Hangs a glowing ball of `colour`, in a material called Core, `out` of its own size in front of `bone`, `size` (a
 * share of the bone's length) across, inside a fainter `halo`, called Halo, of `halo.size` times the ball and `halo.opacity`. Paint
 * either to make it glow brighter.
 */
export function addCore(doc, { bone: boneName, colour, size, halo, out = 0.9 }) {
  const bone = [...bonesOf(doc)].find((b) => b.getName() === boneName);
  if (!bone) throw new Error(`no bone ${boneName} for the core`);
  const child = bone.listChildren().find((c) => bonesOf(doc).has(c));
  const radius = (child ? Math.hypot(...child.getTranslation()) : 1) * size;
  const glowing = (materialName, opacity) => {
    const material = doc.createMaterial(materialName).setBaseColorFactor([...linear(colour), opacity]).setEmissiveFactor(linear(colour));
    if (opacity < 1) material.setAlphaMode('BLEND');
    return material;
  };
  const core = doc.createNode('Core').setMesh(meshOf(doc, ball(radius, 8), glowing('Core', 1))).setTranslation([0, radius * 0.6, radius * out]);
  bone.addChild(core);
  if (halo) core.addChild(doc.createNode('Core.halo').setMesh(meshOf(doc, ball(radius * halo.size, 8), glowing('Halo', halo.opacity))));
}

/**
 * Fits a machine's brain into `bone` (a head): two metal lobes of `colour`, `size` of the bone's length across, a
 * `back` share of it behind the bone and `up` above it, studded with up to six glowing `nodes` of `nodeSize` (a share
 * of the brain) in a material called Synapse.
 */
export function addBrain(doc, { bone: boneName, colour, size, up = 0.5, back = 0.1, nodes = 6, nodeSize = 0.11 }) {
  const bone = [...bonesOf(doc)].find((b) => b.getName() === boneName);
  if (!bone) throw new Error(`no bone ${boneName} for the brain`);
  const child = bone.listChildren().find((c) => bonesOf(doc).has(c));
  const length = child ? Math.hypot(...child.getTranslation()) : 1;
  const lobe = doc.createMaterial('Brain').setBaseColorFactor([...linear(colour), 1]).setMetallicFactor(0.8).setRoughnessFactor(0.4);
  const synapse = doc.createMaterial('Synapse').setBaseColorFactor([1, 1, 1, 1]);
  const radius = (length * size) / 2;
  const brain = doc.createNode('Brain').setTranslation([0, length * up, -length * back]);
  bone.addChild(brain);
  const lobeShape = [0.62, 0.78, 1];
  const lobeAt = (side) => side * radius * 0.48;
  for (const side of [-1, 1]) {
    brain.addChild(doc.createNode(`Brain.lobe.${side}`).setMesh(meshOf(doc, ball(radius, 8), lobe))
      .setTranslation([lobeAt(side), 0, 0]).setScale(lobeShape));
  }
  // Nodes on the top and outer sides of the lobes, each the way given from its lobe's centre, half sunk into it.
  const spots = [[0.3, 0.9, 0.3], [-0.3, 0.9, 0.3], [0.9, 0.4, -0.2], [-0.9, 0.4, -0.2], [0.2, 0.9, -0.5], [-0.2, 0.9, -0.5]];
  spots.slice(0, nodes).forEach(([x, y, z], i) => {
    const away = Math.hypot(x, y, z);
    const surface = [x, y, z].map((v, k) => (v / away) * lobeShape[k] * radius);
    brain.addChild(doc.createNode(`Synapse.${i}`).setMesh(meshOf(doc, ball(radius * nodeSize, 4), synapse))
      .setTranslation([lobeAt(Math.sign(x)) + surface[0], surface[1], surface[2]]));
  });
}
