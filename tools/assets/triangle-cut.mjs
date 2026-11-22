// Cuts a primitive's triangles along a line on its surface, so a part split off it has a smooth edge rather than
// one that zig-zags along whole triangles.

/** How many corner weights a vertex keeps, as glTF skins allow. */
const BONES_PER_VERTEX = 4;

/**
 * Sorts the triangles of `primitive` into those where `margin` is at least zero and those where it's below, cutting
 * each triangle the line crosses in two along it. `margin` is measured at a vertex and is zero on the line. The new
 * vertices are added to the primitive's attributes (shared with any primitive that shares them), blended from the
 * two corners of the edge they sit on, one per edge so the surface stays joined. Returns the two lists of indices.
 */
export function cutAlong(primitive, margin) {
  const all = primitive.getIndices().getArray();
  const count = primitive.getAttribute('POSITION').getCount();
  const margins = new Map();
  const marginOf = (v) => {
    if (!margins.has(v)) margins.set(v, margin(v));
    return margins.get(v);
  };
  const added = [];
  const onEdge = new Map();
  const cut = (a, b) => {
    const key = a < b ? `${a},${b}` : `${b},${a}`;
    let v = onEdge.get(key);
    if (v === undefined) {
      v = count + added.length;
      added.push({ a, b, t: marginOf(a) / (marginOf(a) - marginOf(b)) });
      onEdge.set(key, v);
    }
    return v;
  };
  const inside = [];
  const outside = [];
  for (let i = 0; i < all.length; i += 3) {
    const corners = [all[i], all[i + 1], all[i + 2]];
    const isIn = corners.map((v) => marginOf(v) >= 0);
    if (isIn.every(Boolean)) inside.push(...corners);
    else if (!isIn.some(Boolean)) outside.push(...corners);
    else {
      // Walks round the triangle, keeping its winding, and starts a new corner wherever the line crosses an edge.
      const inPart = [];
      const outPart = [];
      for (let k = 0; k < 3; k++) {
        const [p, q] = [corners[k], corners[(k + 1) % 3]];
        (isIn[k] ? inPart : outPart).push(p);
        if (isIn[k] !== isIn[(k + 1) % 3]) {
          const c = cut(p, q);
          inPart.push(c);
          outPart.push(c);
        }
      }
      fan(inPart, inside);
      fan(outPart, outside);
    }
  }
  if (added.length) addVertices(primitive, count, added);
  return { inside, outside, vertexCount: count + added.length };
}

function fan(polygon, out) {
  for (let k = 1; k + 1 < polygon.length; k++) out.push(polygon[0], polygon[k], polygon[k + 1]);
}

function addVertices(primitive, count, added) {
  const grow = (accessor) => {
    const old = accessor.getArray();
    const grown = new old.constructor(old.length + added.length * accessor.getElementSize());
    grown.set(old);
    accessor.setArray(grown);
  };
  const joints = primitive.getAttribute('JOINTS_0');
  const weights = primitive.getAttribute('WEIGHTS_0');
  for (const semantic of primitive.listSemantics()) {
    const accessor = primitive.getAttribute(semantic);
    if (accessor.getCount() !== count) throw new Error(`${semantic} has ${accessor.getCount()} vertices, not ${count}`);
    if (accessor === joints || accessor === weights) continue;
    grow(accessor);
    for (const [i, { a, b, t }] of added.entries()) {
      const [from, to] = [accessor.getElement(a, []), accessor.getElement(b, [])];
      const value = from.map((x, k) => x + (to[k] - x) * t);
      if (semantic === 'NORMAL') {
        const length = Math.hypot(...value) || 1;
        for (let k = 0; k < value.length; k++) value[k] /= length;
      }
      accessor.setElement(count + i, value);
    }
  }
  if (joints && weights) {
    grow(joints);
    grow(weights);
    for (const [i, { a, b, t }] of added.entries()) {
      const [js, ws] = blendSkin(joints, weights, a, b, t);
      joints.setElement(count + i, js);
      weights.setElement(count + i, ws);
    }
  }
}

/** The bones moving a point `t` of the way from vertex `a` to `b`: both corners' bones, the strongest four kept. */
function blendSkin(joints, weights, a, b, t) {
  const mix = new Map();
  for (const [v, share] of [[a, 1 - t], [b, t]]) {
    const js = joints.getElement(v, []);
    const ws = weights.getElement(v, []);
    js.forEach((joint, k) => mix.set(joint, (mix.get(joint) ?? 0) + ws[k] * share));
  }
  const strongest = [...mix].filter(([, w]) => w > 0).sort((p, q) => q[1] - p[1]).slice(0, BONES_PER_VERTEX);
  const total = strongest.reduce((sum, [, w]) => sum + w, 0) || 1;
  while (strongest.length < BONES_PER_VERTEX) strongest.push([0, 0]);
  return [strongest.map(([joint]) => joint), strongest.map(([, w]) => w / total)];
}
