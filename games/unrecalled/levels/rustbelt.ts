import { dist, hash2, lerp, valueNoise } from '../../../engine/core/math';
import type { LevelContent } from '../../../engine/sim/content';
import type { Level, Structure } from '../../../engine/world/level';
import { createTileMap, inBounds, setProp, setSolid, tileIndex, type TileMap } from '../../../engine/world/tile-map';
import { Ground, Prop } from '../content/tiles';

const WIDTH = 46;
const HEIGHT = 36;

interface BuildingSpec extends Structure {
  /** The interior its door leads into. */
  to: string;
}

/** Salvage buildings made of old base modules and cargo depots, each with a door on its front (bottom) edge. */
const BUILDINGS: BuildingSpec[] = [
  { kind: 'workshop', name: 'Pell’s Workshop', to: 'workshop', x: 7, y: 7, width: 6, depth: 5, door: { tx: 9, ty: 11 } },
  { kind: 'tradingPost', name: 'Mags’s Trading Post', to: 'tradingPost', x: 32, y: 7, width: 6, depth: 5, door: { tx: 34, ty: 11 } },
  { kind: 'pumphouse', name: 'The Old Pumphouse', to: 'pumphouse', x: 37, y: 21, width: 4, depth: 4, door: { tx: 38, ty: 24 } },
];

/** Worn paths between the gate, the camp, each door and the jetty, as points to walk between. */
const PATHS: Array<Array<[number, number]>> = [
  [[22, 1], [22, 10]],
  [[20, 13], [14, 13], [9, 13], [9, 12]],
  [[24, 13], [30, 13], [34, 13], [34, 12]],
  [[23, 16], [27, 20], [33, 24], [38, 25]],
  [[20, 16], [16, 22], [13, 26]],
];

/** The camp sits on an old concrete pad around the dead turbine. */
const CAMP = { x: 22, y: 13, rx: 6.5, ry: 4.5 };

/** The river's middle row at each column, winding gently along the bottom of the map. */
const riverRow = (x: number): number => 30.5 + Math.sin(x * 0.21) * 1.6 + Math.sin(x * 0.07 + 1) * 0.8;

/**
 * Rustbelt, the salvage camp under the Foundry's outer wall, as a map built from fixed features and `hash2` and
 * `valueNoise`, so it comes out the same every time. The camp's concrete pad and its dead wind turbine sit in the
 * middle, with paths out to the gate, Pell's workshop, Mags's trading post, the old pumphouse and the jetty where
 * the flood left the salvager. Dead trees thicken towards the edges.
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
  // The post stands at the jetty's end, read from the planks in front of it.
  setProp(map, jetty.x, jetty.y - 4, Prop.Post, true);
  room.readables!.push({ tx: jetty.x, ty: jetty.y - 4, id: 'riverbank' });

  // The Foundry's outer wall across the middle of the top edge, with its gate into Intake.
  for (let x = 8; x <= 36; x++) {
    const lamp = x === 12 || x === 32;
    const beacon = x === 16 || x === 28;
    setProp(map, x, 0, lamp ? Prop.WallLight : beacon ? Prop.WallAlarm : Prop.Wall, true);
    if (lamp) level.lights.push({ x: x + 0.5, y: 1.2, radius: 3.6, intensity: 0.9, colour: 'cyan', flicker: 0.3, seed: x });
  }
  setProp(map, 22, 0, Prop.Door, false);
  level.portals.push({ tx: 22, ty: 0, to: 'intake', stepOut: { x: 0, y: 0.9 } });
  level.lights.push({ x: 22.5, y: 1.2, radius: 2.4, intensity: 0.9, colour: 'amber', flicker: 0.2, seed: 22 });
  reserve(7, 0, 31, 3);

  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      if (((x + 0.5 - CAMP.x) / CAMP.rx) ** 2 + ((y + 0.5 - CAMP.y) / CAMP.ry) ** 2 < 1) setGround(x, y, Ground.Pad);
    }
  }
  reserve(CAMP.x - 8, CAMP.y - 6, 17, 13);
  for (const path of PATHS) paintPath(map, path, reserve);

  BUILDINGS.forEach((b, i) => addBuilding(level, b, i));
  for (const b of BUILDINGS) reserve(b.x - 1, b.y - 1, b.width + 2, b.depth + 3);

  // The camp: the dead turbine it grew up under, the fire, and salvage stacked where it was dropped.
  setProp(map, 22, 10, Prop.Pylon, true);
  setProp(map, 20, 13, Prop.FireBarrel, true);
  level.lights.push({ x: 20.5, y: 13.5, radius: 4.4, intensity: 1.3, colour: 'molten', flicker: 1.6, seed: 7 });
  room.npcs.push({ kind: 'foreman', name: 'Foreman Odell', x: 21.5, y: 13.6 });
  for (const [x, y] of [[17, 10], [26, 9], [27, 15], [16, 16], [29, 11], [14, 9], [30, 16]] as const) {
    setProp(map, x, y, Prop.Containers, true);
  }
  for (const [x, y] of [[25, 11], [18, 15], [31, 9]] as const) setProp(map, x, y, Prop.Cargo, true);
  for (const [x, y] of [[15, 12], [29, 14]] as const) {
    setProp(map, x, y, Prop.Post, true);
    level.lights.push({ x: x + 0.5, y: y + 0.5, radius: 3.2, intensity: 0.8, colour: 'amber', flicker: 0.6, seed: x * 3 });
  }

  // A stash someone forgot, out in the dead trees to the north-west.
  setProp(map, 3, 4, Prop.Cache, true);
  room.containers!.push({ tx: 3, ty: 4, gold: 40, healingItems: 1 });
  reserve(2, 3, 3, 4);

  scatterWilds(map, reserved);
  return room;
}

/** Wears a path two tiles wide between each pair of points. */
function paintPath(map: TileMap, points: Array<[number, number]>, reserve: (x: number, y: number, w: number, h: number) => void): void {
  for (let k = 0; k < points.length - 1; k++) {
    const [ax, ay] = points[k]!;
    const [bx, by] = points[k + 1]!;
    const samples = Math.ceil(dist(ax, ay, bx, by) * 4);
    for (let s = 0; s <= samples; s++) {
      const px = lerp(ax, bx, s / samples);
      const py = lerp(ay, by, s / samples);
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const x = Math.floor(px) + dx;
          const y = Math.floor(py) + dy;
          if (inBounds(map, x, y) && map.ground[tileIndex(map, x, y)] !== Ground.Pad) map.ground[tileIndex(map, x, y)] = Ground.Path;
        }
      }
      reserve(Math.floor(px) - 1, Math.floor(py) - 1, 4, 4);
    }
  }
}

function addBuilding(level: Level, b: BuildingSpec, seed: number): void {
  const { map } = level;
  for (let y = b.y; y < b.y + b.depth; y++) for (let x = b.x; x < b.x + b.width; x++) setProp(map, x, y, Prop.Building, true);
  const { tx, ty } = b.door;
  setSolid(map, tx, ty, false);
  level.portals.push({ tx, ty, to: b.to, stepOut: { x: 0, y: 1 } });
  level.structures.push({ kind: b.kind, name: b.name, x: b.x, y: b.y, width: b.width, depth: b.depth, door: b.door });
  level.lights.push({ x: tx + 0.5, y: ty + 1.25, radius: 2.6, intensity: 0.8, colour: 'amber', flicker: 0.8, seed: seed * 3 });
}

/** Dead trees thicken towards the map's edges; rocks, weeds and pebbles scatter over the rest. */
function scatterWilds(map: TileMap, reserved: Uint8Array): void {
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const i = tileIndex(map, x, y);
      if (reserved[i] || map.prop[i] || map.solid[i] || map.ground[i] === Ground.Mud) continue;
      const edge = Math.min(x, y, WIDTH - 1 - x);
      const h = hash2(x, y, 23);
      const thicket = valueNoise(x * 0.18 + 5, y * 0.18) > 0.6;
      if ((edge < 2 && h < 0.4) || (edge < 4 && h < 0.12) || (thicket && h < 0.07)) setProp(map, x, y, Prop.DeadTree, true);
      else if (h > 0.965) setProp(map, x, y, Prop.Rock, true);
      else if (h > 0.9) setProp(map, x, y, Prop.GrassTall, false);
      else if (h > 0.84) setProp(map, x, y, Prop.GrassShort, false);
      else if (h > 0.82) setProp(map, x, y, Prop.Pebbles, false);
    }
  }
}
