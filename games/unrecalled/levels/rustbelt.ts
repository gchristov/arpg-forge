import { valueNoise } from '../../../engine/core/math';
import type { LevelContent } from '../../../engine/sim/content';
import type { BuildingPart, Level, Structure } from '../../../engine/world/level';
import { createTileMap, inBounds, setProp, setSolid, tileIndex } from '../../../engine/world/tile-map';
import { STEP, TAG } from '../content/story';
import { Ground, Prop } from '../content/tiles';
import { paintPath, scatterWilds } from './wilds';
import { addWoods, WOODS_TRAIL_ROW, WOODS_WIDTH, woodsTreeChance } from './woods';

/** The town's own columns; the dead woods carry the map on east of them. */
export const TOWN_WIDTH = 46;
const WIDTH = TOWN_WIDTH + WOODS_WIDTH;
const HEIGHT = 36;

interface BuildingSpec {
  kind: string;
  name: string;
  /** The interior its door leads into. */
  to: string;
  door: { tx: number; ty: number };
  parts: BuildingPart[];
  /** What stands round it: a prop on a tile, and the further tiles it covers, kept solid. */
  dressing: Array<{ prop: number; tx: number; ty: number; covers?: Array<[number, number]> }>;
}

/**
 * Buildings put together from salvaged Foundry walls, each with a door on its front (bottom) edge. Mags's trading
 * post, the old depot, is the biggest: a two-storey hall with a wing and a tower, a cargo crane beside it. Pell's
 * workshop has a loft at the back, a scaffold and a truck; the pumphouse its pump tower, a lean-to and the rig that
 * pumps.
 */
const BUILDINGS: BuildingSpec[] = [
  {
    kind: 'workshop', name: 'Pell’s Workshop', to: 'workshop', door: { tx: 9, ty: 11 },
    parts: [{ x: 7, y: 8, width: 6, depth: 4, floors: 1 }, { x: 7, y: 6, width: 4, depth: 2, floors: 2 }],
    dressing: [
      { prop: Prop.Scaffold, tx: 12, ty: 7 },
      { prop: Prop.Truck, tx: 5, ty: 10, covers: [[5, 9], [5, 11]] },
    ],
  },
  {
    kind: 'tradingPost', name: 'Mags’s Trading Post', to: 'tradingPost', door: { tx: 34, ty: 11 },
    parts: [
      { x: 32, y: 6, width: 8, depth: 6, floors: 2 },
      { x: 40, y: 8, width: 4, depth: 4, floors: 1 },
      { x: 34, y: 4, width: 4, depth: 2, floors: 3 },
    ],
    dressing: [
      { prop: Prop.Crane, tx: 42, ty: 6, covers: [[41, 6], [43, 6], [41, 7], [42, 7], [43, 7]] },
      { prop: Prop.Cargo, tx: 40, ty: 13 },
      { prop: Prop.Cargo, tx: 42, ty: 13 },
      { prop: Prop.Cargo, tx: 31, ty: 9 },
    ],
  },
  {
    kind: 'pumphouse', name: 'The Old Pumphouse', to: 'pumphouse', door: { tx: 38, ty: 24 },
    parts: [
      { x: 37, y: 21, width: 4, depth: 4, floors: 1 },
      { x: 37, y: 19, width: 2, depth: 2, floors: 3 },
      { x: 41, y: 23, width: 2, depth: 2, floors: 1 },
    ],
    dressing: [
      { prop: Prop.PumpRig, tx: 42, ty: 21, covers: [[41, 21], [43, 21], [41, 22], [42, 22], [43, 22]] },
      { prop: Prop.Tank, tx: 36, ty: 21 },
    ],
  },
];

/** Worn paths between the camp, each door, the jetty and the woods, as points to walk between. */
const PATHS: Array<Array<[number, number]>> = [
  [[20, 13], [14, 13], [9, 13], [9, 12]],
  [[24, 13], [30, 13], [34, 13], [34, 12]],
  [[23, 16], [27, 20], [33, 24], [38, 25]],
  [[20, 16], [16, 22], [13, 26]],
  [[34, 14], [40, WOODS_TRAIL_ROW], [TOWN_WIDTH, WOODS_TRAIL_ROW]],
];

/** The camp sits on an old concrete pad around the dead turbine. */
const CAMP = { x: 22, y: 13, rx: 6.5, ry: 4.5 };

/** The columns of the top edge the Foundry looms beyond. The way in is through Mags's depot, built at its foot. */
export const FOUNDRY_SIDE = { from: 7, to: 37 };

/** The river's middle row at each column, winding gently along the bottom of the map. */
const riverRow = (x: number): number => 30.5 + Math.sin(x * 0.21) * 1.6 + Math.sin(x * 0.07 + 1) * 0.8;

/**
 * Rustbelt, the salvage camp in the Foundry's shadow, as a map built from fixed features and `hash2` and
 * `valueNoise`, so it comes out the same every time. The camp's concrete pad and its dead wind turbine sit in the
 * middle, with paths out to Pell's workshop, Mags's trading post (the way into the Foundry), the old pumphouse and
 * the jetty where the flood left the salvager, and a trail east into the dead woods. Dead trees thicken towards the
 * town's edges.
 */
export function buildRustbelt(): LevelContent {
  const map = createTileMap(WIDTH, HEIGHT);
  const level: Level = {
    id: 'rustbelt', name: 'Rustbelt', subtitle: 'What is left of the town', outdoor: true, map,
    start: { x: 22.5, y: 16.5 }, portals: [], lights: [], structures: [],
  };
  const room: LevelContent = { level, spawns: [], camps: [], npcs: [], containers: [], readables: [] };
  const at = (x: number, y: number) => tileIndex(map, x, y);
  const setGround = (x: number, y: number, kind: number): void => {
    if (inBounds(map, x, y)) map.ground[at(x, y)] = kind;
  };
  /** Tiles kept clear of the scattered wilds. */
  const reserved = new Uint8Array(WIDTH * HEIGHT);
  const reserve = (x0: number, y0: number, w: number, h: number): void => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (inBounds(map, x, y)) reserved[at(x, y)] = 1;
  };

  // Scrub and dead grass in broad patches over packed earth.
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) setGround(x, y, valueNoise(x * 0.11, y * 0.11) > 0.52 ? Ground.DeadGrass : Ground.Dirt);
  }

  // The river, with muddy banks and a short jetty reaching out over it.
  for (let x = 0; x < WIDTH; x++) {
    const middle = riverRow(x);
    for (let y = 0; y < HEIGHT; y++) {
      const d = Math.abs(y + 0.5 - middle);
      if (d < 2) {
        setGround(x, y, Ground.Water);
        setSolid(map, x, y, true);
      } else if (d < 3.2) setGround(x, y, Ground.Mud);
    }
  }
  const jetty = { x: 13, y: Math.floor(riverRow(13)) };
  for (let y = jetty.y - 3; y < jetty.y; y++) {
    setGround(jetty.x, y, Ground.Path);
    setSolid(map, jetty.x, y, false);
  }
  reserve(jetty.x - 1, jetty.y - 5, 3, 6);

  // The Foundry stands in the dark past the middle of the top edge, so the ground there is kept open towards it.
  reserve(FOUNDRY_SIDE.from, 0, FOUNDRY_SIDE.to - FOUNDRY_SIDE.from + 1, 3);

  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      if (((x + 0.5 - CAMP.x) / CAMP.rx) ** 2 + ((y + 0.5 - CAMP.y) / CAMP.ry) ** 2 < 1) setGround(x, y, Ground.Pad);
    }
  }
  reserve(CAMP.x - 8, CAMP.y - 6, 17, 13);
  for (const path of PATHS) paintPath(map, path, reserve);

  BUILDINGS.forEach((b, i) => {
    const s = addBuilding(level, b, i);
    reserve(s.x - 1, s.y - 1, s.width + 2, s.depth + 3);
  });

  // The camp: the dead turbine it grew up under, the fire, and salvage stacked where it was dropped.
  setProp(map, 22, 10, Prop.Pylon, true);
  setProp(map, 20, 13, Prop.FireBarrel, true);
  level.lights.push({ x: 20.5, y: 13.5, radius: 4.4, intensity: 1.3, colour: 'molten', flicker: 1.6, seed: 7 });
  // Odell by the fire, until the Foundry takes him and after he's brought home, when Mags and Pell join him there at
  // dawn. A loader is at the camp's crates as U-7 arrives: a weak one, for its first fight, bare-handed. It fights
  // alone; beating it is what sets every machine off.
  const foreman = { kind: 'foreman', name: 'Foreman Odell', x: 21.5, y: 13.6 };
  room.npcs.push({ ...foreman, untilStep: STEP.powerOn }, { ...foreman, fromStep: STEP.freed });
  room.npcs.push({ kind: 'trader', name: 'Mags', x: 19.5, y: 15.5, fromStep: STEP.freed });
  room.npcs.push({ kind: 'tinker', name: 'Pell', x: 25.5, y: 15.5, fromStep: STEP.freed });
  room.spawns.push({ kind: 'loader', x: 31.5, y: 13.5, tag: TAG.raider, strength: 0.35, quiet: true });
  for (const [x, y] of [[17, 10], [26, 9], [27, 15], [16, 16], [29, 11], [14, 9], [30, 16]] as const) {
    setProp(map, x, y, Prop.Containers, true);
  }
  for (const [x, y] of [[25, 11], [18, 15], [28, 7]] as const) setProp(map, x, y, Prop.Cargo, true);
  // Braziers at the camp's edges. Posts are kept for things to read, so they don't look like something to tap.
  for (const [x, y] of [[15, 12], [29, 14]] as const) {
    setProp(map, x, y, Prop.FireBarrel, true);
    level.lights.push({ x: x + 0.5, y: y + 0.5, radius: 3.2, intensity: 0.9, colour: 'molten', flicker: 1.2, seed: x * 3 });
  }

  // A stash someone forgot, out in the dead trees to the north-west.
  setProp(map, 3, 4, Prop.Cache, true);
  room.containers!.push({ tx: 3, ty: 4, gold: 40, healingItems: 1 });
  reserve(2, 3, 3, 4);

  addWoods(room, reserve, TOWN_WIDTH);
  scatterWilds(map, reserved, (x, y) => (x < TOWN_WIDTH ? treeChance(x, y) : woodsTreeChance(x - TOWN_WIDTH, y)));
  return room;
}

function addBuilding(level: Level, b: BuildingSpec, seed: number): Structure {
  const { map } = level;
  for (const p of b.parts) {
    for (let y = p.y; y < p.y + p.depth; y++) for (let x = p.x; x < p.x + p.width; x++) setProp(map, x, y, Prop.Building, true);
  }
  const { tx, ty } = b.door;
  setSolid(map, tx, ty, false);
  level.portals.push({ tx, ty, to: b.to, stepOut: { x: 0, y: 1 } });
  const x = Math.min(...b.parts.map((p) => p.x));
  const y = Math.min(...b.parts.map((p) => p.y));
  const structure: Structure = {
    kind: b.kind, name: b.name, x, y,
    width: Math.max(...b.parts.map((p) => p.x + p.width)) - x,
    depth: Math.max(...b.parts.map((p) => p.y + p.depth)) - y,
    door: b.door, parts: b.parts,
  };
  level.structures.push(structure);
  for (const d of b.dressing) {
    setProp(map, d.tx, d.ty, d.prop, true);
    for (const [x, y] of d.covers ?? []) setProp(map, x, y, Prop.Building, true);
  }
  level.lights.push({ x: tx + 0.5, y: ty + 1.25, radius: 2.6, intensity: 0.8, colour: 'amber', flicker: 0.8, seed: seed * 3 });
  return structure;
}

/** Dead trees thicken towards the town's edges, except the river's, and gather in a few thickets. */
function treeChance(x: number, y: number): number {
  const edge = Math.min(x, y, TOWN_WIDTH - 1 - x);
  const thicket = valueNoise(x * 0.18 + 5, y * 0.18) > 0.6;
  return Math.max(edge < 2 ? 0.4 : 0, edge < 4 ? 0.12 : 0, thicket ? 0.07 : 0);
}
