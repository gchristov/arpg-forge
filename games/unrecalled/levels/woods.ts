import { valueNoise } from '../../../engine/core/math';
import type { LevelContent } from '../../../engine/sim/content';
import { inBounds, setProp, setSolid, tileIndex } from '../../../engine/world/tile-map';
import { STEP, TAG } from '../content/story';
import { Ground, Prop } from '../content/tiles';
import { paintPath } from './wilds';

/** How far the dead woods run east of the town. */
export const WOODS_WIDTH = 50;

/** The row the trail leaves the town by, into the woods. */
export const WOODS_TRAIL_ROW = 16;

/**
 * The trail winding east from the town through the trees to the logging camp, a spur north past the pond to a lost
 * stash, and one south to the old sawmill yard, in the woods' own columns.
 */
const TRAILS: Array<Array<[number, number]>> = [
  [[0, WOODS_TRAIL_ROW], [7, 15], [13, 19], [20, 20], [27, 17], [33, 13], [41, 12]],
  [[13, 18], [10, 10], [8, 6]],
  [[20, 20], [25, 23], [30, 23]],
];

interface Ellipse {
  x: number;
  y: number;
  rx: number;
  ry: number;
}

/** The logging camp's clearing, round the wind turbine that once powered the town. */
const CAMP: Ellipse = { x: 41, y: 11, rx: 7.5, ry: 6.5 };
/** The sawmill yard by the river, where the logs were cut. */
const YARD: Ellipse = { x: 31, y: 23, rx: 4.5, ry: 2.6 };
/** How much tougher than its kind the loader at the switch is, for a salvager who may still be on their fists. */
const WOODS_STRENGTH = 0.5;

/** A still pond in the trees north of the trail. */
const POND: Ellipse = { x: 24, y: 7, rx: 4.5, ry: 2.6 };

/** How far out from an ellipse's middle a tile is: under 1 inside it. */
const reach = (e: Ellipse, x: number, y: number) => ((x + 0.5 - e.x) / e.rx) ** 2 + ((y + 0.5 - e.y) / e.ry) ** 2;

/**
 * The dead woods east of the town, laid into Rustbelt's map from column `x0`. A trail winds to the logging camp: the
 * turbine whose switch a loader holds over to the Foundry and, in a crate by the cutting bench, Pell's chainsaw. Off the
 * trail lie a pond, a stash past it, and the sawmill yard by the river with a cache of its own and U-4 on the bank below.
 */
export function addWoods(room: LevelContent, reserve: (x: number, y: number, w: number, h: number) => void, x0: number): void {
  const { level } = room;
  const { map } = level;
  const prop = (x: number, y: number, kind: number) => setProp(map, x0 + x, y, kind, true);
  const light = (x: number, y: number, colour: string, seed: number) =>
    level.lights.push({ x: x0 + x + 0.5, y: y + 0.5, radius: colour === 'cyan' ? 2.4 : 3.6, intensity: 0.9, colour, flicker: 1, seed });
  const cache = (x: number, y: number, gold: number) => {
    prop(x, y, Prop.Cache);
    room.containers!.push({ tx: x0 + x, ty: y, gold, healingItems: 1 });
    reserve(x0 + x - 1, y - 1, 3, 3);
  };

  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < WOODS_WIDTH; x++) {
      if (!inBounds(map, x0 + x, y)) continue;
      const i = tileIndex(map, x0 + x, y);
      for (const clearing of [CAMP, YARD]) {
        const d = reach(clearing, x, y);
        if (d < 1) reserve(x0 + x, y, 1, 1);
        if (d < 0.45) map.ground[i] = Ground.Pad;
      }
      const pond = reach(POND, x, y);
      if (pond < 1) {
        map.ground[i] = Ground.Water;
        setSolid(map, x0 + x, y, true);
      } else if (pond < 1.7) map.ground[i] = Ground.Mud;
    }
  }
  for (const trail of TRAILS) paintPath(map, trail.map(([x, y]) => [x0 + x, y]), reserve);

  // The logging camp: the turbine and its switch at its foot, held over to the Foundry by a loader until it's broken,
  // the crate by the cutting bench, a truck, stacked salvage and a brazier.
  prop(42, 8, Prop.Pylon);
  prop(44, 8, Prop.Computer);
  room.readables!.push({ tx: x0 + 44, ty: 8, id: 'switch', fromStep: STEP.switchFreed, untilStep: STEP.powerOn });
  room.spawns.push({ kind: 'loader', x: x0 + 43.5, y: 10.5, tag: TAG.switchLoader, strength: WOODS_STRENGTH });
  light(44, 8, 'cyan', 4);
  prop(45, 13, Prop.Crate);
  room.containers!.push({ tx: x0 + 45, ty: 13, gold: 0, healingItems: 0, weapon: 'chainsaw' });
  prop(37, 9, Prop.Truck);
  prop(37, 8, Prop.Building);
  prop(37, 10, Prop.Building);
  for (const [x, y] of [[46, 10], [38, 15], [46, 16]] as const) prop(x, y, Prop.Containers);
  for (const [x, y] of [[44, 14], [40, 7]] as const) prop(x, y, Prop.Cargo);
  prop(42, 15, Prop.FireBarrel);
  light(42, 15, 'molten', 11);

  // The sawmill yard: cut logs long gone, what they were loaded on left behind.
  for (const [x, y] of [[29, 22], [30, 24]] as const) prop(x, y, Prop.Cargo);
  prop(34, 24, Prop.Containers);
  prop(28, 24, Prop.Barrel);
  cache(35, 22, 25);

  cache(7, 5, 30);

  // U-4, face down in the reeds on the river's bank below the sawmill yard, reaching upriver.
  room.readables!.push({ tx: x0 + 26, ty: 27, id: 'u-4' });
  reserve(x0 + 25, 26, 3, 3);
}

/** In the woods' own columns: trees everywhere, thickest in clumps and along the far edges, so the trails are the way through. */
export function woodsTreeChance(x: number, y: number): number {
  const edge = Math.min(y, WOODS_WIDTH - 1 - x);
  const clump = valueNoise(x * 0.2 + 9, y * 0.2) > 0.55;
  return Math.max(edge < 2 ? 0.45 : 0, clump ? 0.2 : 0.08);
}
