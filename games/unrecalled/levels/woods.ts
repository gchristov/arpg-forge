import { valueNoise } from '../../../engine/core/math';
import type { LevelContent } from '../../../engine/sim/content';
import { inBounds, setProp, tileIndex } from '../../../engine/world/tile-map';
import { Ground, Prop } from '../content/tiles';
import { paintPath } from './wilds';

/** How far the dead woods run east of the town. */
export const WOODS_WIDTH = 30;

/** The row the trail leaves the town by, into the woods. */
export const WOODS_TRAIL_ROW = 16;

/**
 * The trail winding east from the town through the trees to the logging camp, and a spur north to a lost stash, in the
 * woods' own columns.
 */
const TRAILS: Array<Array<[number, number]>> = [
  [[0, WOODS_TRAIL_ROW], [6, 15], [12, 19], [17, 18], [21, 14]],
  [[12, 18], [9, 10], [7, 7]],
];

/** The logging camp's clearing, round the wind turbine that once powered the town. */
const CLEARING = { x: 21, y: 12, rx: 7.5, ry: 6.5 };

/**
 * The dead woods east of the town, laid into Rustbelt's map from column `x0`: a trail past packs of crawlers to the
 * logging camp, with the turbine whose breaker the machines threw to cut the town's power and, in a crate by the
 * cutting bench, Pell's old chainsaw.
 */
export function addWoods(room: LevelContent, reserve: (x: number, y: number, w: number, h: number) => void, x0: number): void {
  const { level } = room;
  const { map } = level;
  const prop = (x: number, y: number, kind: number) => setProp(map, x0 + x, y, kind, true);
  const lamp = (x: number, y: number, colour: string, seed: number) =>
    level.lights.push({ x: x0 + x + 0.5, y: y + 0.5, radius: colour === 'cyan' ? 2.4 : 3.3, intensity: 0.8, colour, flicker: 0.7, seed });

  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < WOODS_WIDTH; x++) {
      const d = ((x + 0.5 - CLEARING.x) / CLEARING.rx) ** 2 + ((y + 0.5 - CLEARING.y) / CLEARING.ry) ** 2;
      if (d >= 1 || !inBounds(map, x0 + x, y)) continue;
      reserve(x0 + x, y, 1, 1);
      if (d < 0.45) map.ground[tileIndex(map, x0 + x, y)] = Ground.Pad;
    }
  }
  for (const trail of TRAILS) paintPath(map, trail.map(([x, y]) => [x0 + x, y]), reserve);

  // The camp: the turbine and the breaker cabinet at its foot, the crate by the cutting bench, a truck and stacked salvage.
  prop(22, 9, Prop.Pylon);
  prop(24, 9, Prop.Computer);
  room.readables!.push({ tx: x0 + 24, ty: 9, id: 'breaker' });
  lamp(24, 9, 'cyan', 4);
  prop(25, 13, Prop.Crate);
  room.containers!.push({ tx: x0 + 25, ty: 13, gold: 0, healingItems: 0, weapon: 'chainsaw' });
  prop(17, 9, Prop.Truck);
  prop(17, 8, Prop.Building);
  prop(17, 10, Prop.Building);
  for (const [x, y] of [[26, 10], [18, 15], [26, 16]] as const) prop(x, y, Prop.Containers);
  for (const [x, y] of [[24, 14], [20, 7]] as const) prop(x, y, Prop.Cargo);
  prop(22, 15, Prop.Post);
  lamp(22, 15, 'amber', 11);
  // A lamp where the trail enters the trees, so the way between the woods and the town is easy to find.
  prop(1, WOODS_TRAIL_ROW - 1, Prop.Post);
  lamp(1, WOODS_TRAIL_ROW - 1, 'amber', 3);

  // Packs along the trail, and one working the camp.
  room.camps.push(...[[8, 17], [14, 20], [22, 12]].map(([x, y]) => ({ tx: x0 + x!, ty: y!, kind: 'crawler' })));

  // A stash at the end of the spur north.
  prop(6, 6, Prop.Cache);
  room.containers!.push({ tx: x0 + 6, ty: 6, gold: 30, healingItems: 1 });
  reserve(x0 + 5, 5, 3, 3);
}

/** In the woods' own columns: trees everywhere, thickest in clumps and along the far edges, so the trail is the way through. */
export function woodsTreeChance(x: number, y: number): number {
  const edge = Math.min(y, WOODS_WIDTH - 1 - x);
  const clump = valueNoise(x * 0.2 + 9, y * 0.2) > 0.55;
  return Math.max(edge < 2 ? 0.45 : 0, clump ? 0.2 : 0.08);
}
