import { machineParts, placeAt } from './machine-parts.mjs';
import { ball, cylinder, merged, moved, sweep } from './shapes.mjs';

// Builds a glowing power core into a character's body: a fuel rod inside a glowing halo, held in a cage of caps and
// bars with rings round it, standing up the bone it hangs off.

/** How many bars hold the cage's caps apart. */
const BARS = 4;
/** How many lengths a ring round the cage is cut into. */
const RING_STEPS = 16;

/**
 * Stands a core `size` across on `bone` at `at` (across and front to back as shares of the body's half size, up as a
 * share of the bone's length), each part in its own material for painting: the `rod` and the `halo` round it (to
 * glow), the `cage`'s caps and bars, and two `rings` round the cage. Cables of each of `cables` run from the bottom
 * cap down to the bone.
 */
export function addReactor(doc, { bone, at, size, rod, halo, cage, rings, cables = [] }) {
  const { bodyOf, materialFor, add, build } = machineParts(doc, 'Reactor');
  const body = bodyOf(bone);
  const centre = placeAt(body, at);
  const place = (shape) => moved(shape, undefined, centre);
  const height = size * 1.3;
  const end = (sign) => [0, (sign * height) / 2, 0];

  add(bone, materialFor(rod.material, rod.colour), place(merged([
    cylinder(size * 0.16, height * 0.75, 12),
    moved(ball(size * 0.16, 5), undefined, [0, height * 0.375, 0]),
    moved(ball(size * 0.16, 5), undefined, [0, -height * 0.375, 0]),
  ])));
  add(bone, materialFor(halo.material, halo.colour), place(moved(cylinder(size * 0.3, height * 0.8, 14))));

  const bars = [];
  for (let i = 0; i < BARS; i++) {
    const angle = ((i + 0.5) / BARS) * Math.PI * 2;
    bars.push(moved(cylinder(size * 0.04, height, 6), undefined, [Math.cos(angle) * size * 0.42, 0, Math.sin(angle) * size * 0.42]));
  }
  const cap = (sign) => moved(cylinder(size * 0.5, size * 0.12, 16), undefined, end(sign));
  add(bone, materialFor(cage.material, cage.colour), place(merged([cap(-1), cap(1), ...bars])));

  const ring = (y) => {
    const points = [];
    for (let i = 0; i <= RING_STEPS; i++) {
      const angle = (i / RING_STEPS) * Math.PI * 2;
      points.push([Math.cos(angle) * size * 0.44, y, Math.sin(angle) * size * 0.44]);
    }
    return sweep(points, size * 0.04, 6);
  };
  add(bone, materialFor(rings.material, rings.colour), place(merged([ring(height * 0.22), ring(-height * 0.22)])));

  const bottom = centre.map((v, k) => v + end(-1)[k]);
  cables.forEach(({ material, colour, width }, i) => {
    const angle = (i / cables.length) * Math.PI * 2;
    const from = bottom.map((v, k) => v + [Math.cos(angle) * size * 0.3, 0, Math.sin(angle) * size * 0.3][k]);
    const to = [from[0] * 0.3, 0, from[2] * 0.3];
    const sag = [from[0] * 0.4, (from[1] + to[1]) / 2, from[2] * 0.4];
    const curve = [];
    for (let s = 0; s <= 8; s++) {
      const t = s / 8;
      curve.push(from.map((v, k) => (1 - t) ** 2 * v + 2 * t * (1 - t) * sag[k] + t ** 2 * to[k]));
    }
    add(bone, materialFor(material, colour), sweep(curve, width / 2, 5));
  });
  build();
}
