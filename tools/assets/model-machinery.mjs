import { bodyRound, pointIn, sliceAt } from './body-fit.mjs';
import { linear } from './model-parts.mjs';
import { ball, box, cylinder, meshOf, merged, moved, sweep, turnUpTo } from './shapes.mjs';

// Builds machinery into a character's body round its skeleton, fitted to the body's own shape at each bone: ribs,
// pistons, and parts such as canisters and gears. Each hangs off a bone, so it moves with every animation.

/** How many lengths a rib's curve is cut into. */
const RIB_STEPS = 10;
/** How far along a piston its barrel reaches before its rod comes out. */
const BARREL_SHARE = 0.6;

/** The quaternion turning `angle` radians about the y axis. */
const aboutY = (angle) => [0, Math.sin(angle / 2), 0, Math.cos(angle / 2)];

/** The quaternion turning the x axis to `side`, about the y axis. */
const xTo = (side) => aboutY(Math.atan2(-side[2], side[0]));

/**
 * Builds `ribs`, `pistons` and `parts` into the body, each in the material it names, of its `colour` (a new one the
 * first time a name is used, so it can be painted). All of one material on one bone become one mesh.
 *
 * - `ribs`: `perBone` ribs on each of `bones`, `width` across, curving from the spine round each side to the front,
 *   `fill` of the way out to the skin, open at the front by `gap` of the way round, and dropping `droop` metres to
 *   the front.
 * - `pistons`: a barrel `width` across and a rod coming out of it in `rodMaterial`, beside each of `bones` from `from`
 *   to `to` of its length, `out` of the way to the skin `toward` the front, back, side or otherSide.
 * - `parts`: a `canister`, `gear` or `block` `size` across on `bone`, at `at`: across and front to back as shares of
 *   the body's half size from its middle, and up as a share of the bone's length; `mirror` adds one on the other side.
 */
export function addMachinery(doc, { ribs = [], pistons = [], parts = [] }) {
  const bones = new Map(doc.getRoot().listSkins().flatMap((skin) => skin.listJoints()).map((b) => [b.getName(), b]));
  const boneNamed = (name) => bones.get(name) ?? fail(`no bone ${name} for machinery`);
  const bodies = new Map();
  const bodyOf = (name) => {
    if (!bodies.has(name)) bodies.set(name, bodyRound(doc, boneNamed(name)));
    return bodies.get(name);
  };
  const materials = new Map();
  const materialFor = (name, colour) => {
    if (!materials.has(name)) {
      const material = doc.createMaterial(name).setBaseColorFactor([...linear(colour), 1]);
      materials.set(name, material.setMetallicFactor(0.9).setRoughnessFactor(0.35));
    }
    return materials.get(name);
  };
  const groups = new Map();
  const add = (boneName, material, shape) => {
    const key = `${boneName}|${material.getName()}`;
    if (!groups.has(key)) groups.set(key, { boneName, material, shapes: [] });
    groups.get(key).shapes.push(shape);
  };

  for (const { bones: names, perBone, width, fill = 0.8, gap = 0.2, droop = 0, material, colour } of ribs) {
    const metal = materialFor(material, colour);
    for (const name of names) {
      const body = bodyOf(name);
      for (let k = 0; k < perBone; k++) {
        const y = ((k + 0.5) / perBone) * body.length;
        const { middle: [a, d], half } = sliceAt(body, y);
        const [ra, rd] = half.map((h) => h * fill);
        for (const sign of [-1, 1]) {
          const curve = [];
          for (let i = 0; i <= RIB_STEPS; i++) {
            const turn = (i / RIB_STEPS) * Math.PI * (1 - gap);
            curve.push(pointIn(body, a + sign * ra * Math.sin(turn), d - rd * Math.cos(turn), y - (droop * turn) / Math.PI));
          }
          add(name, metal, sweep(curve, width / 2));
        }
        add(name, metal, sweep([[0, y, 0], pointIn(body, a, d - rd, y)], width / 2));
      }
    }
  }

  for (const piston of pistons) {
    const { bones: names, toward, out, from = 0.15, to = 0.85, width, material, colour, rodMaterial, rodColour } = piston;
    const [barrel, rod] = [materialFor(material, colour), materialFor(rodMaterial, rodColour)];
    for (const name of names) {
      const body = bodyOf(name);
      const away = (v) => v.map((c) => -c);
      const direction = { front: body.forward, back: away(body.forward), side: body.side, otherSide: away(body.side) }[toward];
      const at = (share) => {
        const y = share * body.length;
        const reach = sliceAt(body, y).reach(direction) * out;
        return direction.map((v, k) => v * reach + (k === 1 ? y : 0));
      };
      const [start, end] = [at(from), at(to)];
      const middle = start.map((v, k) => v + (end[k] - v) * BARREL_SHARE);
      add(name, barrel, merged([
        sweep([start, middle], width / 2, 8),
        moved(ball(width / 2), undefined, middle),
        moved(ball(width * 0.55), undefined, start),
      ]));
      add(name, rod, merged([sweep([middle, end], width * 0.2, 6), moved(ball(width * 0.35), undefined, end)]));
    }
  }

  for (const { bone: name, kind, at: [across, up, deep], size, mirror = false, material, colour } of parts) {
    const metal = materialFor(material, colour);
    const body = bodyOf(name);
    const y = up * body.length;
    const { middle: [a, d], half: [ha, hd] } = sliceAt(body, y);
    for (const sign of mirror ? [1, -1] : [1]) {
      const position = pointIn(body, a + sign * across * ha, d + deep * hd, y);
      add(name, metal, partShape(kind, size, body, position));
    }
  }

  for (const { boneName, material, shapes } of groups.values()) {
    const mesh = meshOf(doc, merged(shapes), material);
    boneNamed(boneName).addChild(doc.createNode(`Machinery.${boneName}.${material.getName()}`).setMesh(mesh));
  }
}

/** A canister standing up the bone, a gear facing the front, or a pump block with a pipe out of its top. */
function partShape(kind, size, body, position) {
  if (kind === 'canister') {
    return moved(merged([cylinder(size / 2, size * 1.8), cylinder(size * 0.3, size * 2.2, 8)]), undefined, position);
  }
  if (kind === 'gear') {
    const teeth = 10;
    const tooth = box([size * 0.18, size * 0.2, size * 0.14]);
    const shapes = [cylinder(size / 2, size * 0.2, 14), cylinder(size * 0.15, size * 0.4, 8)];
    for (let t = 0; t < teeth; t++) {
      const angle = (t / teeth) * Math.PI * 2;
      shapes.push(moved(tooth, aboutY(-angle), [Math.cos(angle) * size * 0.55, 0, Math.sin(angle) * size * 0.55]));
    }
    return moved(merged(shapes), turnUpTo(body.forward), position);
  }
  if (kind === 'block') {
    const pipe = moved(cylinder(size * 0.12, size * 0.5, 8), undefined, [size * 0.2, size * 0.5, 0]);
    const shape = merged([box([size, size * 0.7, size * 0.5]), pipe]);
    return moved(shape, xTo(body.side), position);
  }
  throw new Error(`no machine part called ${kind}`);
}

function fail(message) {
  throw new Error(message);
}
