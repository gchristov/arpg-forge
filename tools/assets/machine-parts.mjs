import { bodyRound, pointIn, sliceAt } from './body-fit.mjs';
import { linear } from './model-parts.mjs';
import { meshOf, merged } from './shapes.mjs';

// What the steps that build machine parts into a character share: its bones and the body round each, materials made
// once by name, and the parts gathered so that all of one material on one bone become one mesh.

/** The quaternion turning `angle` radians about the y axis. */
export const aboutY = (angle) => [0, Math.sin(angle / 2), 0, Math.cos(angle / 2)];

/** The quaternion turning the x axis to `side`, about the y axis, which turns the z axis to the body's front. */
export const xTo = (side) => aboutY(Math.atan2(-side[2], side[0]));

/**
 * The point on `body` at `at`: across and front to back as shares of the body's half size from its middle at that
 * height, and up as a share of the bone's length, across to the other side when `sign` is -1.
 */
export function placeAt(body, [across, up, deep], sign = 1) {
  const y = up * body.length;
  const { middle: [a, d], half: [ha, hd] } = sliceAt(body, y);
  return pointIn(body, a + sign * across * ha, d + deep * hd, y);
}

/** A workshop for building parts into `doc`'s character, whose meshes are named after `what` they are. */
export function machineParts(doc, what) {
  const bones = new Map(doc.getRoot().listSkins().flatMap((skin) => skin.listJoints()).map((b) => [b.getName(), b]));
  const boneNamed = (name) => {
    const bone = bones.get(name);
    if (!bone) throw new Error(`no bone ${name} for the ${what}`);
    return bone;
  };
  const bodies = new Map();
  const groups = new Map();
  return {
    bodyOf(name) {
      if (!bodies.has(name)) bodies.set(name, bodyRound(doc, boneNamed(name)));
      return bodies.get(name);
    },
    /**
     * The material called `name`: one already in the model, or one made of `colour` the first time it's asked for, so
     * it can be painted.
     */
    materialFor(name, colour) {
      const existing = doc.getRoot().listMaterials().find((m) => m.getName() === name);
      if (existing) return existing;
      return doc.createMaterial(name).setBaseColorFactor([...linear(colour), 1]).setMetallicFactor(0.9).setRoughnessFactor(0.35);
    },
    add(boneName, material, shape) {
      const key = `${boneName}|${material.getName()}`;
      if (!groups.has(key)) groups.set(key, { boneName, material, shapes: [] });
      groups.get(key).shapes.push(shape);
    },
    /** Hangs everything added off its bone. */
    build() {
      for (const { boneName, material, shapes } of groups.values()) {
        const mesh = meshOf(doc, merged(shapes), material);
        boneNamed(boneName).addChild(doc.createNode(`${what}.${boneName}.${material.getName()}`).setMesh(mesh));
      }
    },
  };
}
