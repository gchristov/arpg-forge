// Measures a character's body round one of its bones, so parts built inside it fit within its skin.
import { cross, dot, normalise } from './shapes.mjs';

/** Where `matrix` (column major, as glTF stores it) takes the point or, with `w` 0, the direction `p`. */
const transform = (m, [x, y, z], w = 1) => [0, 1, 2].map((k) => m[k] * x + m[4 + k] * y + m[8 + k] * z + m[12 + k] * w);

/**
 * The body round `bone`, in the bone's own space (y along it, as parts hung off it are placed): the points of the skin
 * it mostly moves, which way the body's front faces (`forward`, the model's +z) and its side (`side`), both across the
 * bone, and the bone's `length` to its first child bone, or to the far end of the body for a bone with none, such as a
 * head.
 */
export function bodyRound(doc, bone) {
  const points = [];
  let forward = null;
  for (const node of doc.getRoot().listNodes()) {
    const skin = node.getSkin();
    const index = skin?.listJoints().indexOf(bone) ?? -1;
    if (index < 0) continue;
    const matrix = skin.getInverseBindMatrices().getElement(index, []);
    forward ??= transform(matrix, [0, 0, 1], 0);
    for (const primitive of node.getMesh().listPrimitives()) {
      const [position, joints, weights] = ['POSITION', 'JOINTS_0', 'WEIGHTS_0'].map((s) => primitive.getAttribute(s));
      if (!joints) continue;
      for (let v = 0; v < position.getCount(); v++) {
        const j = joints.getElement(v, []);
        const w = weights.getElement(v, []);
        const share = j.reduce((sum, joint, k) => sum + (joint === index ? w[k] : 0), 0);
        if (share > 0.5) points.push(transform(matrix, position.getElement(v, [])));
      }
    }
  }
  if (!points.length) throw new Error(`no body round ${bone.getName()}`);
  const front = normalise([forward[0], 0, forward[2]]);
  const child = bone.listChildren().find((c) => doc.getRoot().listSkins().some((s) => s.listJoints().includes(c)));
  const length = child ? Math.hypot(...child.getTranslation()) : Math.max(...points.map((p) => p[1]));
  return { points, forward: front, side: cross([0, 1, 0], front), length };
}

/**
 * The body's outline at height `y` up `body`'s bone: its middle and half its size across (`side`) and front to back
 * (`forward`), as distances along those, and how far its skin is from the bone in a `direction` across it.
 */
export function sliceAt(body, y) {
  const band = Math.max(0.015, body.length * 0.12);
  let near = body.points.filter((p) => Math.abs(p[1] - y) < band);
  if (near.length < 8) near = body.points;
  const across = near.map((p) => dot(p, body.side));
  const deep = near.map((p) => dot(p, body.forward));
  const [minA, maxA, minD, maxD] = [Math.min(...across), Math.max(...across), Math.min(...deep), Math.max(...deep)];
  return {
    middle: [(minA + maxA) / 2, (minD + maxD) / 2],
    half: [(maxA - minA) / 2, (maxD - minD) / 2],
    reach: (direction) => Math.max(...near.map((p) => dot(p, direction))),
  };
}

/** The point in `body`'s bone space `a` across, `d` to the front and `y` up the bone. */
export const pointIn = (body, a, d, y) => [0, 1, 2].map((k) => body.side[k] * a + body.forward[k] * d + (k === 1 ? y : 0));
