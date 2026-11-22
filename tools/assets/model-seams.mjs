import { linear } from './model-parts.mjs';
import { ball, cross, normalise } from './shapes.mjs';

// Lays a seam along every edge where two of a character's materials meet, such as where a metal shell ends and glass
// begins, with studs along it. The seam is skinned as the body is there, so it bends with every animation.

/** How many rings of faces a stud's dome has; few, as many studs line a body. */
const STUD_RINGS = 3;

/** How close two corners are, in metres, to count as the same place where two parts were cut apart. */
const SAME_PLACE = 1e-4;

const placeKey = (p) => p.map((v) => Math.round(v / SAME_PLACE)).join(',');

/**
 * Adds a seam, in a new material called `material` of `colour`, along every edge where a triangle in material
 * `between[0]` meets one in `between[1]`: a band `width` across, raised `raise` off the surface, with a domed stud
 * `studs.size` across on it every `studs.every` metres, in a material of its own (`studs.material`, `studs.colour`).
 */
export function addSeams(doc, { between: [first, second], material: name, colour, width, raise, studs }) {
  const metal = (materialName, c) =>
    doc.createMaterial(materialName).setBaseColorFactor([...linear(c), 1]).setMetallicFactor(0.9).setRoughnessFactor(0.35);
  const [material, studMaterial] = [metal(name, colour), metal(studs.material, studs.colour)];
  const dome = ball(studs.size / 2, STUD_RINGS);
  let seams = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    const primitives = mesh.listPrimitives().filter((p) => p.getAttribute('JOINTS_0'));
    const edgesIn = (materialName) => {
      const edges = new Map();
      for (const primitive of primitives.filter((p) => p.getMaterial()?.getName() === materialName)) {
        const position = primitive.getAttribute('POSITION');
        const all = primitive.getIndices().getArray();
        for (let t = 0; t < all.length; t += 3) {
          for (let k = 0; k < 3; k++) {
            const [a, b] = [all[t + k], all[t + ((k + 1) % 3)]];
            const [ka, kb] = [placeKey(position.getElement(a, [])), placeKey(position.getElement(b, []))];
            edges.set(ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`, { primitive, a, b });
          }
        }
      }
      return edges;
    };
    const theirs = edgesIn(second);
    const shared = [...edgesIn(first)].filter(([key]) => theirs.has(key)).map(([, edge]) => edge);
    if (!shared.length) continue;
    const [seam, studded] = [0, 1].map(() => ({ positions: [], normals: [], joints: [], weights: [], indices: [] }));
    let sinceStud = studs.every / 2;
    for (const { primitive, a, b } of shared) {
      const corner = (v) => ({
        p: primitive.getAttribute('POSITION').getElement(v, []),
        n: normalise(primitive.getAttribute('NORMAL').getElement(v, [])),
        j: primitive.getAttribute('JOINTS_0').getElement(v, []),
        w: primitive.getAttribute('WEIGHTS_0').getElement(v, []),
      });
      const [from, to] = [corner(a), corner(b)];
      const length = Math.hypot(...to.p.map((v, k) => v - from.p[k]));
      if (length < SAME_PLACE) continue;
      const along = normalise(to.p.map((v, k) => v - from.p[k]));
      const up = normalise(from.n.map((v, k) => v + to.n[k]));
      const across = normalise(cross(up, along));
      const lift = (c, side) => c.p.map((v, k) => v + c.n[k] * raise + across[k] * side * (width / 2));
      const band = [from, to].flatMap((c) => [-1, 1].map((side) => ({ ...c, p: lift(c, side) })));
      addQuad(seam, [band[0], band[2], band[3], band[1]]);
      // Studs sit evenly along the seam's edges, carried on from one edge to the next.
      for (sinceStud += length; sinceStud >= studs.every; sinceStud -= studs.every) {
        const t = Math.min(1, Math.max(0, 1 - (sinceStud - studs.every) / length));
        const centre = from.p.map((v, k) => v + (to.p[k] - v) * t + up[k] * raise);
        // Half sunk into the band, so it shows as a dome; moved by the bones of the nearer corner.
        addShape(studded, dome, centre, [along, up, across.map((v) => -v)], t < 0.5 ? from : to);
      }
    }
    mesh.addPrimitive(seamPrimitive(doc, primitives[0], seam, material));
    mesh.addPrimitive(seamPrimitive(doc, primitives[0], studded, studMaterial));
    seams++;
  }
  if (seams === 0) throw new Error(`no edges where ${first} meets ${second}`);
}

/** A face of four corners, each a place `p`, a normal `n` and the bones `j` moving it by weights `w`, facing along `n`. */
function addQuad(seam, corners) {
  const start = seam.positions.length / 3;
  for (const { p, n, j, w } of corners) {
    seam.positions.push(...p);
    seam.normals.push(...n);
    seam.joints.push(...j);
    seam.weights.push(...w);
  }
  seam.indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
}

/** `shape` with its x, y and z along `axes`, moved to `centre`, moved by the bones `j` of `skin` with weights `w`. */
function addShape(part, shape, centre, axes, { j, w }) {
  const start = part.positions.length / 3;
  const turn = (v) => [0, 1, 2].map((k) => axes[0][k] * v[0] + axes[1][k] * v[1] + axes[2][k] * v[2]);
  for (let i = 0; i < shape.positions.length; i += 3) {
    const p = turn(shape.positions.slice(i, i + 3));
    part.positions.push(...p.map((v, k) => v + centre[k]));
    part.normals.push(...turn(shape.normals.slice(i, i + 3)));
    part.joints.push(...j);
    part.weights.push(...w);
  }
  part.indices.push(...shape.indices.map((i) => start + i));
}

/** A seam's band or studs as a primitive skinned as `like` is, in `material`. */
function seamPrimitive(doc, like, seam, material) {
  const buffer = like.getAttribute('POSITION').getBuffer();
  const accessor = (type, array) => doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
  const Joints = like.getAttribute('JOINTS_0').getArray().constructor;
  const Indices = seam.positions.length / 3 > 65535 ? Uint32Array : Uint16Array;
  return doc.createPrimitive()
    .setAttribute('POSITION', accessor('VEC3', new Float32Array(seam.positions)))
    .setAttribute('NORMAL', accessor('VEC3', new Float32Array(seam.normals)))
    .setAttribute('JOINTS_0', accessor('VEC4', new Joints(seam.joints)))
    .setAttribute('WEIGHTS_0', accessor('VEC4', new Float32Array(seam.weights)))
    .setIndices(accessor('SCALAR', new Indices(seam.indices)))
    .setMaterial(material);
}
