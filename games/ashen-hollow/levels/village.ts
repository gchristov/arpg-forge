import { dist, hash2, lerp, valueNoise } from '../../../engine/core/math';
import type { Level, Structure } from '../../../engine/world/level';
import { createTileMap, inBounds, setProp, setSolid, tileIndex, type TileMap } from '../../../engine/world/tile-map';
import { Ground, Prop } from '../content/tiles';

const SIZE = 54;

export interface Spawn {
  kind: string;
  x: number;
  y: number;
}

export interface Camp {
  tx: number;
  ty: number;
  kind: string;
}

export interface Village {
  level: Level;
  spawns: Spawn[];
  camps: Camp[];
  npcs: Array<{ kind: string; name: string; x: number; y: number }>;
}

interface BuildingSpec extends Structure {
  to: string;
  frontWindows?: number[];
  sideWindows?: number[];
}

const BUILDINGS: BuildingSpec[] = [
  {
    kind: 'tavern', name: 'The Sleeping Boar', to: 'tavern',
    x: 8, y: 5, width: 7, depth: 4, door: { tx: 11, ty: 8 }, chimney: { tx: 9, ty: 6 },
    frontWindows: [1, 5], sideWindows: [1, 2],
  },
  {
    kind: 'smithy', name: 'The Smithy', to: 'smithy',
    x: 19, y: 6, width: 5, depth: 4, door: { tx: 21, ty: 9 }, chimney: { tx: 22, ty: 7 },
    frontWindows: [4], sideWindows: [1],
  },
  {
    kind: 'cottage', name: 'Maren’s Cottage', to: 'cottage',
    x: 5, y: 14, width: 4, depth: 4, door: { tx: 6, ty: 17 },
    frontWindows: [3], sideWindows: [2],
  },
  { kind: 'crypt', name: 'The Old Crypt', to: 'crypt', x: 38, y: 30, width: 4, depth: 4, door: { tx: 39, ty: 33 } },
];

const ROADS: Array<Array<[number, number]>> = [
  [[11, 9], [11, 12]],
  [[21, 10], [21, 12]],
  [[6, 18], [12, 18]],
  [[22, 15], [30, 15], [30, 26], [34, 30], [34, 36], [39, 36], [39, 34]],
  [[30, 15], [38, 13]],
  [[16, 20], [16, 27], [13, 29]],
  [[16, 27], [15, 40]],
  [[30, 22], [44, 24]],
];

const CAMPS: Camp[] = [
  { tx: 40, ty: 13, kind: 'goblin' },
  { tx: 15, ty: 42, kind: 'goblin' },
  { tx: 45, ty: 25, kind: 'skeleton' },
];

/**
 * The village of Ashen Hollow. The layout is fixed by design and by `hash2`/`valueNoise`, so it comes out the
 * same every time, tile for tile.
 */
export function generateVillage(): Village {
  const map = createTileMap(SIZE, SIZE);
  const level: Level = {
    id: 'town',
    name: 'Ashen Hollow',
    subtitle: '',
    outdoor: true,
    map,
    start: { x: 16.5, y: 22.5 },
    portals: [],
    lights: [],
    structures: [],
  };
  /** Tiles kept clear of scattered trees, rocks and bushes. */
  const reserved = new Uint8Array(SIZE * SIZE);
  const reserve = (x0: number, y0: number, w: number, h: number): void => {
    for (let y = y0; y < y0 + h; y++)
      for (let x = x0; x < x0 + w; x++) if (inBounds(map, x, y)) reserved[tileIndex(map, x, y)] = 1;
  };
  const groundAt = (x: number, y: number): number => map.ground[tileIndex(map, x, y)]!;
  const setGround = (x: number, y: number, kind: number): void => {
    if (inBounds(map, x, y)) map.ground[tileIndex(map, x, y)] = kind;
  };

  map.ground.fill(Ground.Grass);
  for (let y = 12; y < 20; y++) for (let x = 12; x < 22; x++) setGround(x, y, Ground.Stone);
  reserve(11, 11, 12, 10);

  for (const road of ROADS) paintRoad(map, road, setGround, reserve);

  for (let y = 26; y < 37; y++) {
    for (let x = 3; x < 16; x++) {
      if (((x - 8.5) / 4.6) ** 2 + ((y - 31.5) / 3.3) ** 2 < 1) {
        setGround(x, y, Ground.Water);
        setSolid(map, x, y, true);
      }
    }
  }
  reserve(3, 26, 13, 11);

  for (let y = 34; y < 46; y++)
    for (let x = 33; x < 47; x++) if (groundAt(x, y) === Ground.Grass) setGround(x, y, Ground.DeadGrass);
  reserve(33, 33, 14, 13);
  for (const gy of [38, 40, 42, 44])
    for (const gx of [35, 37, 42, 44]) if (groundAt(gx, gy) !== Ground.Path) setProp(map, gx, gy, Prop.Grave, true);
  setProp(map, 46, 37, Prop.DeadTree, true);
  setProp(map, 33, 44, Prop.DeadTree, true);

  BUILDINGS.forEach((b, id) => addBuilding(level, b, id));
  for (const b of BUILDINGS) reserve(b.x - 1, b.y - 1, b.width + 2, b.depth + 3);

  for (const [x, y] of [[12, 12], [21, 12], [12, 19], [21, 19]] as const) {
    setProp(map, x, y, Prop.Lamp, true);
    level.lights.push({ x: x + 0.5, y: y + 0.5, radius: 3.2, intensity: 0.85, colour: 'warm', flicker: 0.4, seed: x + y });
  }
  setProp(map, 16, 15, Prop.Well, true);
  for (const [x, y] of [[37, 34], [42, 34]] as const) {
    setProp(map, x, y, Prop.Brazier, true);
    level.lights.push({ x: x + 0.5, y: y + 0.5, radius: 2.8, intensity: 0.9, colour: 'purple', flicker: 1, seed: x });
  }

  for (const c of CAMPS) {
    for (let y = c.ty - 3; y <= c.ty + 3; y++) {
      for (let x = c.tx - 3; x <= c.tx + 3; x++) {
        if (!inBounds(map, x, y)) continue;
        const d = dist(x, y, c.tx, c.ty);
        if (d < 3.4) reserved[tileIndex(map, x, y)] = 1;
        if (d < 2.2 + valueNoise(x * 0.7, y * 0.7) * 0.8 && groundAt(x, y) === Ground.Grass) setGround(x, y, Ground.Path);
      }
    }
    setProp(map, c.tx, c.ty, Prop.Brazier, true);
    level.lights.push({ x: c.tx + 0.5, y: c.ty + 0.5, radius: 3.4, intensity: 0.95, colour: 'warm', flicker: 1.3, seed: c.tx * 2 });
  }
  reserve(14, 20, 6, 4);

  scatterWilds(map, reserved);

  return {
    level,
    spawns: [[36, 36], [43, 37], [36, 43], [44, 42]].map(([x, y]) => ({ kind: 'skeleton', x: x! + 0.5, y: y! + 0.5 })),
    camps: CAMPS,
    npcs: [{ kind: 'elder', name: 'Elder Maren', x: 14.5, y: 15.6 }],
  };
}

function paintRoad(
  map: TileMap,
  points: Array<[number, number]>,
  setGround: (x: number, y: number, kind: number) => void,
  reserve: (x: number, y: number, w: number, h: number) => void,
): void {
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
          if (inBounds(map, x, y) && map.ground[tileIndex(map, x, y)] !== Ground.Stone) setGround(x, y, Ground.Path);
        }
      }
      reserve(Math.floor(px) - 1, Math.floor(py) - 1, 4, 4);
    }
  }
}

function addBuilding(level: Level, b: BuildingSpec, id: number): void {
  const { map } = level;
  for (let y = b.y; y < b.y + b.depth; y++) for (let x = b.x; x < b.x + b.width; x++) setProp(map, x, y, Prop.Building, true);
  const { tx, ty } = b.door;
  setSolid(map, tx, ty, false);
  level.portals.push({ tx, ty, to: b.to, stepOut: { x: 0, y: 1 } });
  level.structures.push({
    kind: b.kind, name: b.name, x: b.x, y: b.y, width: b.width, depth: b.depth, door: b.door,
    ...(b.chimney ? { chimney: b.chimney } : {}),
  });
  level.lights.push({
    x: tx + 0.5, y: ty + 1.25, radius: 2.4, intensity: 0.75,
    colour: b.kind === 'crypt' ? 'purple' : 'warm', flicker: 1, seed: id * 3,
  });
  for (const i of b.frontWindows ?? []) {
    level.lights.push({ x: b.x + i + 0.5, y: b.y + b.depth + 0.6, radius: 1.6, intensity: 0.45, colour: 'warm', flicker: 0.5, seed: i });
  }
  for (const j of b.sideWindows ?? []) {
    level.lights.push({ x: b.x + b.width + 0.6, y: b.y + j + 0.5, radius: 1.6, intensity: 0.45, colour: 'warm', flicker: 0.5, seed: j + 9 });
  }
}

/** Trees thicken towards the map edge and in the wilds to the east and south; rocks and bushes are sparse. */
function scatterWilds(map: TileMap, reserved: Uint8Array): void {
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = tileIndex(map, x, y);
      if (reserved[i] || map.prop[i] || map.ground[i] === Ground.Water) continue;
      const edge = Math.min(x, y, SIZE - 1 - x, SIZE - 1 - y);
      const h = hash2(x, y, 11);
      if (edge < 2 || (edge < 4 && h < 0.75)) {
        setProp(map, x, y, Prop.Tree, true);
        continue;
      }
      const wild = x > 26 || y > 24;
      const n = valueNoise(x * 0.16, y * 0.16);
      const treeChance = wild ? (n > 0.56 ? 0.5 : 0.05) : 0.025;
      if (h < treeChance) setProp(map, x, y, Prop.Tree, true);
      else if (wild && h > 0.97) setProp(map, x, y, Prop.Rock, true);
      else if (h > 0.955 && h <= 0.97) setProp(map, x, y, Prop.Bush, true);
    }
  }
}

