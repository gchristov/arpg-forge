import { linear } from './model-parts.mjs';
import { cross, normalise } from './shapes.mjs';

// Lays a seam along every edge where two of a character's materials meet, such as where a metal shell ends and glass
// begins, with staples across it. The seam is skinned as the body is there, so it bends with every animation.

/** How close two corners are, in metres, to count as the same place where two parts were cut apart. */
const SAME_PLACE = 1e-4;

const placeKey = (p) => p.map((v) => Math.round(v / SAME_PLACE)).join(',');

/**
 * Adds a seam, in a new material called `material` of `colour`, along every edge where a triangle in material
 * `between[0]` meets one in `between[1]`: a band `width` across, raised `raise` off the surface, with a staple across
 * it every `staples.every` metres, `staples.length` long, `staples.width` wide and standing `staples.height` above
 * the band.
 */
export function addSeams(doc, { between: [first, second], material: name, colour, width, raise, staples }) {
  const material = doc.createMaterial(name).setBaseColorFactor([...linear(colour), 1]);
  material.setMetallicFactor(0.9).setRoughnessFactor(0.35);
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
    const seam = { positions: [], normals: [], joints: [], weights: [], indices: [] };
    let sinceStaple = staples.every / 2;
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
      // Staples sit evenly along the seam's edges, carried on from one edge to the next.
      for (sinceStaple += length; sinceStaple >= staples.every; sinceStaple -= staples.every) {
        const t = 1 - (sinceStaple - staples.every) / length;
        const at = t < 0.5 ? from : to;
        const centre = from.p.map((v, k) => v + (to.p[k] - v) * Math.min(1, Math.max(0, t)));
        addStaple(seam, centre, along, up, across, at, raise, staples);
      }
    }
    mesh.addPrimitive(seamPrimitive(doc, primitives[0], seam, material));
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

/** A staple standing on the seam at `centre`, across it, moved by the bones of the corner `at`. */
function addStaple(seam, centre, along, up, across, at, raise, { length, width, height }) {
  const corner = (x, y, z) => centre.map((v, k) => v + along[k] * x + up[k] * (raise + y) + across[k] * z);
  const [x, z] = [width / 2, length / 2];
  const faces = [
    [up, [[-x, height, -z], [x, height, -z], [x, height, z], [-x, height, z]]],
    [along, [[x, 0, -z], [x, 0, z], [x, height, z], [x, height, -z]]],
    [along.map((v) => -v), [[-x, 0, z], [-x, 0, -z], [-x, height, -z], [-x, height, z]]],
    [across, [[-x, 0, z], [-x, height, z], [x, height, z], [x, 0, z]]],
    [across.map((v) => -v), [[x, 0, -z], [x, height, -z], [-x, height, -z], [-x, 0, -z]]],
  ];
  for (const [n, square] of faces) addQuad(seam, square.map(([cx, cy, cz]) => ({ ...at, p: corner(cx, cy, cz), n })));
}

/** The seam as a primitive skinned as `like` is, in `material`. */
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
