import { valueNoise } from '../../../engine/core/math';
import type { LevelContent } from '../../../engine/sim/content';
import type { Level } from '../../../engine/world/level';
import { createTileMap, inBounds, setProp, tileIndex } from '../../../engine/world/tile-map';
import { Ground, Prop } from '../content/tiles';
import { paintPath, scatterWilds } from './wilds';

const WIDTH = 40;
const HEIGHT = 30;

/** Where the trail leaves for Rustbelt, on the east edge, level with the trail that leaves Rustbelt's west edge. */
export const WOODS_EXIT = { tx: WIDTH - 1, ty: 15 };

/** The trail from Rustbelt winding west through the trees to the logging camp, and a spur north to a lost stash. */
const TRAILS: Array<Array<[number, number]>> = [
  [[WIDTH - 1, 15], [32, 14], [26, 18], [19, 17], [14, 13], [10, 12]],
  [[26, 17], [29, 9], [32, 6]],
];

/** The logging camp's clearing, round the wind turbine that once powered the town. */
const CLEARING = { x: 9, y: 11, rx: 8, ry: 6.5 };

/**
 * The dead woods west of Rustbelt, built like the town from fixed features and noise so it comes out the same every
 * time. A trail winds through the trees past packs of crawlers to the logging camp: the turbine whose breaker the
 * machines threw to cut the town's power, and in a crate by the cutting bench, Pell's old chainsaw.
 */
export function buildWoods(): LevelContent {
  const map = createTileMap(WIDTH, HEIGHT);
  const level: Level = {
    id: 'woods', name: 'The Dead Woods', subtitle: 'The logging camp is somewhere west', outdoor: true, map,
    start: { x: WOODS_EXIT.tx - 0.5, y: WOODS_EXIT.ty + 0.5 },
    portals: [{ ...WOODS_EXIT, to: 'rustbelt', stepOut: { x: -1, y: 0 } }],
    lights: [], structures: [],
  };
  const room: LevelContent = { level, spawns: [], camps: [], npcs: [], containers: [], readables: [] };
  const at = (x: number, y: number) => tileIndex(map, x, y);
  const reserved = new Uint8Array(WIDTH * HEIGHT);
  const reserve = (x0: number, y0: number, w: number, h: number): void => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (inBounds(map, x, y)) reserved[at(x, y)] = 1;
  };

  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) map.ground[at(x, y)] = valueNoise(x * 0.13 + 3, y * 0.13) > 0.42 ? Ground.DeadGrass : Ground.Dirt;
  }
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const d = ((x + 0.5 - CLEARING.x) / CLEARING.rx) ** 2 + ((y + 0.5 - CLEARING.y) / CLEARING.ry) ** 2;
      if (d < 1) reserved[at(x, y)] = 1;
      if (d < 0.45) map.ground[at(x, y)] = Ground.Pad;
    }
  }
  for (const trail of TRAILS) paintPath(map, trail, reserve);

  // The camp: the turbine and the breaker cabinet at its foot, the cutting bench's crate, a truck and the stacked salvage.
  setProp(map, 7, 8, Prop.Pylon, true);
  setProp(map, 9, 8, Prop.Computer, true);
  room.readables!.push({ tx: 9, ty: 8, id: 'breaker' });
  level.lights.push({ x: 9.5, y: 8.9, radius: 2.4, intensity: 0.7, colour: 'cyan', flicker: 0.8, seed: 4 });
  setProp(map, 5, 12, Prop.Crate, true);
  room.containers!.push({ tx: 5, ty: 12, gold: 0, healingItems: 0, weapon: 'chainsaw' });
  setProp(map, 13, 8, Prop.Truck, true);
  setProp(map, 13, 7, Prop.Building, true);
  setProp(map, 13, 9, Prop.Building, true);
  for (const [x, y] of [[4, 9], [5, 15], [11, 15]] as const) setProp(map, x, y, Prop.Containers, true);
  for (const [x, y] of [[6, 13], [12, 6]] as const) setProp(map, x, y, Prop.Cargo, true);
  setProp(map, 8, 14, Prop.Post, true);
  level.lights.push({ x: 8.5, y: 14.5, radius: 3.4, intensity: 0.8, colour: 'amber', flicker: 0.6, seed: 11 });
  // A lamp where the trail meets the edge of the woods, so the way back to town is easy to find.
  setProp(map, WIDTH - 3, WOODS_EXIT.ty - 1, Prop.Post, true);
  level.lights.push({ x: WIDTH - 2.5, y: WOODS_EXIT.ty - 0.5, radius: 3.2, intensity: 0.8, colour: 'amber', flicker: 0.6, seed: 3 });

  // Packs along the trail, and one working the camp.
  room.camps.push({ tx: 30, ty: 15, kind: 'crawler' }, { tx: 20, ty: 19, kind: 'crawler' }, { tx: 10, ty: 13, kind: 'crawler' });

  // A stash at the end of the spur north.
  setProp(map, 33, 5, Prop.Cache, true);
  room.containers!.push({ tx: 33, ty: 5, gold: 30, healingItems: 1 });
  reserve(32, 4, 3, 3);

  scatterWilds(map, reserved, treeChance);
  return room;
}

/** Trees everywhere, thickest in clumps and along the edges, so the trail is the way through. */
function treeChance(x: number, y: number): number {
  const edge = Math.min(x, y, WIDTH - 1 - x, HEIGHT - 1 - y);
  const clump = valueNoise(x * 0.2 + 9, y * 0.2) > 0.55;
  return Math.max(edge < 2 ? 0.45 : 0, clump ? 0.2 : 0.08);
}
