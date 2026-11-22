// Shapes for the parts the model build adds to a character, as positions, normals and indices, and the mesh of one.

const SIDES = 8;

/** A tube of `radius` from y = 0 to y = `length`, open at the ends, which the joints cover. */
export function tube(radius, length) {
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

/** How many sides a wire has round, fewer for a thin one, where more wouldn't show. */
const wireSides = (width) => (width < 0.005 ? 4 : 6);
/** How many lengths a wire is cut into for each turn it makes, so its curves stay smooth. */
const STEPS_PER_TURN = 9;

/**
 * A wire `width` across, wound `around` metres out from the y axis from y = 0 to y = `length`, making `turns` turns a
 * metre (a negative number winds the other way), starting `phase` degrees round. `flat` is how thick it is beside its
 * width: 1 is a round cable, less a ribbon lying against what it winds round.
 */
export function helix({ width, around, turns, phase = 0, flat = 1 }, length) {
  const steps = Math.max(4, Math.ceil(Math.abs(turns) * length * STEPS_PER_TURN));
  const twist = Math.PI * 2 * turns;
  const [across, out] = [width / 2, (width * flat) / 2];
  const sides = wireSides(width);
  const positions = [];
  const normals = [];
  const indices = [];
  for (let i = 0; i <= steps; i++) {
    const y = (i / steps) * length;
    const a = (phase * Math.PI) / 180 + twist * y;
    const [cos, sin] = [Math.cos(a), Math.sin(a)];
    // Along the wire, straight out from the axis, and the way round the axis at right angles to both.
    const along = normalise([-sin * around * twist, 1, cos * around * twist]);
    const outwards = [cos, 0, sin];
    const round = cross(outwards, along);
    for (let j = 0; j <= sides; j++) {
      const t = (j / sides) * Math.PI * 2;
      const [c, s] = [Math.cos(t), Math.sin(t)];
      const centre = [cos * around, y, sin * around];
      positions.push(...[0, 1, 2].map((k) => centre[k] + outwards[k] * c * out + round[k] * s * across));
      normals.push(...normalise([0, 1, 2].map((k) => outwards[k] * c * across + round[k] * s * out)));
    }
  }
  const ring = sides + 1;
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < sides; j++) {
      const [a, b] = [i * ring + j, (i + 1) * ring + j];
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  return { positions, normals, indices };
}

export const normalise = (v) => {
  const length = Math.hypot(...v) || 1;
  return v.map((x) => x / length);
};
export const cross = ([ax, ay, az], [bx, by, bz]) => [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];

/** A ball of `radius` about the origin. */
export function ball(radius, rings = 6) {
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
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  return { positions, normals, indices };
}

/** A mesh of one shape in one material. */
export function meshOf(doc, shape, material) {
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
export function turnUpTo([x, y, z]) {
  const length = Math.hypot(x, y, z);
  const [dx, dy, dz] = [x / length, y / length, z / length];
  if (dy < -0.9999) return [1, 0, 0, 0];
  // Half way between up and the direction, as a quaternion: the cross product and 1 + the dot product.
  const q = [dz, 0, -dx, 1 + dy];
  const n = Math.hypot(...q);
  return q.map((v) => v / n);
}

export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** A tube of `radius` along the line through `points`, its rings turned as little as they can between points. */
export function sweep(points, radius, sides = 6) {
  const positions = [];
  const normals = [];
  const indices = [];
  const along = (i) => {
    const [from, to] = [points[Math.max(i - 1, 0)], points[Math.min(i + 1, points.length - 1)]];
    return normalise(to.map((v, k) => v - from[k]));
  };
  const first = along(0);
  let side = normalise(cross(first, Math.abs(first[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
  points.forEach((point, i) => {
    const tangent = along(i);
    // Carries the ring's sideways direction on from the last point, so the tube doesn't twist.
    side = normalise(cross(cross(tangent, side), tangent));
    const up = cross(tangent, side);
    for (let j = 0; j <= sides; j++) {
      const a = (j / sides) * Math.PI * 2;
      const n = [0, 1, 2].map((k) => side[k] * Math.cos(a) + up[k] * Math.sin(a));
      positions.push(...point.map((v, k) => v + n[k] * radius));
      normals.push(...n);
    }
  });
  const ring = sides + 1;
  for (let i = 0; i + 1 < points.length; i++) {
    for (let j = 0; j < sides; j++) {
      const [a, b] = [i * ring + j, (i + 1) * ring + j];
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  return { positions, normals, indices };
}

/** A closed cylinder of `radius` and `height` standing on the y axis, centred on the origin. */
export function cylinder(radius, height, sides = 10) {
  const positions = [];
  const normals = [];
  const indices = [];
  const h = height / 2;
  for (let i = 0; i <= sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    const [x, z] = [Math.cos(a), Math.sin(a)];
    positions.push(x * radius, -h, z * radius, x * radius, h, z * radius);
    normals.push(x, 0, z, x, 0, z);
  }
  for (let i = 0; i < sides; i++) indices.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 2, i * 2 + 1, i * 2 + 3);
  for (const y of [-h, h]) {
    const centre = positions.length / 3;
    positions.push(0, y, 0);
    normals.push(0, Math.sign(y), 0);
    for (let i = 0; i <= sides; i++) {
      const a = (i / sides) * Math.PI * 2;
      positions.push(Math.cos(a) * radius, y, Math.sin(a) * radius);
      normals.push(0, Math.sign(y), 0);
    }
    for (let i = 0; i < sides; i++) {
      const [a, b] = [centre + 1 + i, centre + 2 + i];
      indices.push(...(y > 0 ? [centre, b, a] : [centre, a, b]));
    }
  }
  return { positions, normals, indices };
}

/** A box `size` across in x, y and z, centred on the origin. */
export function box([sx, sy, sz]) {
  const positions = [];
  const normals = [];
  const indices = [];
  const half = [sx / 2, sy / 2, sz / 2];
  for (let axis = 0; axis < 3; axis++) {
    for (const sign of [-1, 1]) {
      const [u, v] = [(axis + 1) % 3, (axis + 2) % 3];
      const start = positions.length / 3;
      for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const p = [0, 0, 0];
        p[axis] = sign * half[axis];
        p[u] = a * half[u];
        p[v] = b * half[v];
        positions.push(...p);
        const n = [0, 0, 0];
        n[axis] = sign;
        normals.push(...n);
      }
      indices.push(...(sign > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]).map((i) => start + i));
    }
  }
  return { positions, normals, indices };
}

/** `shape` turned by the quaternion `turn`, then moved by `by`. */
export function moved(shape, turn = [0, 0, 0, 1], by = [0, 0, 0]) {
  const rotate = (v) => {
    const [x, y, z, w] = turn;
    const t = cross([x, y, z], v).map((c) => c * 2);
    const u = cross([x, y, z], t);
    return v.map((c, k) => c + w * t[k] + u[k]);
  };
  const map = (values, f) => {
    const out = [];
    for (let i = 0; i < values.length; i += 3) out.push(...f([values[i], values[i + 1], values[i + 2]]));
    return out;
  };
  return {
    positions: map(shape.positions, (p) => rotate(p).map((c, k) => c + by[k])),
    normals: map(shape.normals, rotate),
    indices: shape.indices,
  };
}

/** One shape made of all of `shapes`. */
export function merged(shapes) {
  const out = { positions: [], normals: [], indices: [] };
  for (const shape of shapes) {
    const start = out.positions.length / 3;
    out.positions.push(...shape.positions);
    out.normals.push(...shape.normals);
    out.indices.push(...shape.indices.map((i) => i + start));
  }
  return out;
}
