import { sliceAt, pointIn } from './body-fit.mjs';
import { machineParts, xTo } from './machine-parts.mjs';
import { ball, box, cylinder, drift, moved, normalise, scaled, sweep } from './shapes.mjs';

// Builds a machine's brain into a character's head, fitted to the skull: two metal lobes wound with wires in place of
// folds, a plate between them, glowing nodes on top, and a stem of cables down into the neck.

/** How many lengths a coil round a lobe is cut into for each turn. */
const COIL_STEPS_PER_TURN = 10;
/** How many lengths a cable down the stem is cut into. */
const STEM_STEPS = 8;

/**
 * Fills the skull round `bone` with a brain centred at `at` (across and front to back as shares of the head's half
 * size, up as a share of its height), `fill` of the skull's half width, half depth and height across, made of:
 *
 * - two `lobes` side by side, in their `material` of `colour`;
 * - `coils`: wires wound round each lobe, `width` across, making `turns` turns, starting `phase` of a turn round, as
 *   the folds of a brain: from back to front, or `across` from side to side, so coils both ways cross like a weave
 *   and cover the lobe's ends; `wobble` from 0 to 1 makes them wander as wound wire does;
 * - a `plate` between the lobes;
 * - `nodes`: `count` balls `size` across in their own material, spread over the top of the lobes, for painting to
 *   glow;
 * - `stem`: `cables` (each a `material` of `colour`) `width` across, from under the brain down to the bone, with a
 *   sleeve round them in the plate's material.
 */
export function addBrain(doc, { bone, at, fill, lobes, coils = [], plate, nodes, stem }) {
  const { bodyOf, materialFor, add, build } = machineParts(doc, 'Brain');
  const body = bodyOf(bone);
  const y = at[1] * body.length;
  const { middle: [a, d], half: [ha, hd] } = sliceAt(body, y);
  const centre = pointIn(body, a + at[0] * ha, d + at[2] * hd, y);
  // Each lobe takes half the brain's width; together they span it.
  const radii = [(ha * fill[0]) / 2, (body.length * fill[1]) / 2, hd * fill[2]];
  const turn = xTo(body.side);
  const place = (shape, offset) => moved(shape, turn, centre.map((v, k) => v + offset[k]));
  const across = (x) => body.side.map((v) => v * x);

  for (const sign of [-1, 1]) {
    const offset = across(sign * radii[0] * 1.02);
    add(bone, materialFor(lobes.material, lobes.colour), place(scaled(ball(1, 8), radii), offset));
    coils.forEach((coil, i) => {
      add(bone, materialFor(coil.material, coil.colour), place(coilRound(radii, coil, sign, i * 3.7 + sign), offset));
    });
    if (nodes) {
      for (let i = 0; i < nodes.count; i++) {
        // Spread over the lobe's top by the golden angle, so no two crowd together.
        const angle = i * 2.39996;
        const lift = 0.35 + 0.6 * ((i + 0.5) / nodes.count);
        const out = Math.sqrt(1 - lift * lift);
        const spot = [Math.cos(angle) * out * radii[0], lift * radii[1], Math.sin(angle) * out * radii[2]];
        add(bone, materialFor(nodes.material, nodes.colour), place(moved(ball(nodes.size / 2, 4), undefined, spot), offset));
      }
    }
  }
  if (plate) {
    const shape = box([radii[0] * 0.12, radii[1] * 1.7, radii[2] * 1.9]);
    add(bone, materialFor(plate.material, plate.colour), place(shape, [0, 0, 0]));
  }
  if (stem) {
    const bottom = centre.map((v, k) => v - (k === 1 ? radii[1] * 0.8 : 0));
    const sleeve = moved(cylinder(stem.width * 1.6, bottom[1], 10), undefined, [bottom[0] / 2, bottom[1] / 2, bottom[2] / 2]);
    add(bone, materialFor(plate?.material ?? lobes.material, plate?.colour ?? lobes.colour), sleeve);
    stem.cables.forEach(({ material, colour }, i) => {
      const angle = (i / stem.cables.length) * Math.PI * 2;
      const side = [Math.cos(angle) * stem.width, 0, Math.sin(angle) * stem.width];
      const start = bottom.map((v, k) => v + side[k] * 3);
      const curve = [];
      for (let s = 0; s <= STEM_STEPS; s++) {
        const t = s / STEM_STEPS;
        curve.push(start.map((v, k) => v * (1 - t) + side[k] * t + (k === 1 ? 0 : side[k] * Math.sin(t * Math.PI))));
      }
      add(bone, materialFor(material, colour), sweep(curve, stem.width / 2, 5));
    });
  }
  build();
}

/** How many times a coil's wander turns back on itself over its length, at its slowest. */
const COIL_DRIFT = 9;

/**
 * A wire wound round a lobe of `radii` on its surface, from its back to its front or, `across`, from side to side, on
 * the side given by `sign`, wandering by `wobble` a way of its own for each `seed`.
 */
function coilRound(radii, { width, turns, phase = 0, across = false, wobble = 0 }, sign, seed) {
  const steps = Math.ceil(turns * COIL_STEPS_PER_TURN);
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const along = (t * 2 - 1) * 0.96 + wobble * 0.1 * drift(t * COIL_DRIFT * 3, seed);
    const ring = Math.sqrt(Math.max(0, 1 - along * along));
    const angle = (phase + turns * t + wobble * 0.3 * drift(t * COIL_DRIFT * 2, seed + 1)) * Math.PI * 2 * sign;
    const [c, s] = [Math.cos(angle) * ring, Math.sin(angle) * ring];
    const p = across ? [along, s, c] : [c, s, along];
    // Half its width proud of the surface, so it sits on the lobe rather than sinking in.
    const lift = normalise(p.map((v, k) => v / radii[k]));
    const proud = width * (0.4 + wobble * 0.8 * (drift(t * COIL_DRIFT * 2, seed + 2) + 1));
    points.push(p.map((v, k) => v * radii[k] + lift[k] * proud));
  }
  return sweep(points, width / 2, 5);
}
