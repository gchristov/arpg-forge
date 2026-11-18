import { valueNoise } from '../../../engine/core/math';
import type { LevelContent } from '../../../engine/sim/content';
import type { BuildingPart, Level } from '../../../engine/world/level';
import { createTileMap, setProp, setSolid, tileIndex } from '../../../engine/world/tile-map';
import { UPRIVER } from '../content/story';
import { Ground, Prop } from '../content/tiles';

// Wide enough that the salvager, set down in its far corner, is out of the picture while the Works wakes.
const WIDTH = 84;
const HEIGHT = 68;

/** The Works' hall and towers. */
const PARTS: BuildingPart[] = [
  { x: 30, y: 23, width: 12, depth: 5, floors: 2 },
  { x: 32, y: 21, width: 4, depth: 2, floors: 3 },
  { x: 38, y: 21, width: 2, depth: 2, floors: 4 },
];
const DOOR = { tx: 36, ty: 27 };

/** Tanks, scaffolds and a crane round its walls. */
const DRESSING: Array<{ prop: number; tx: number; ty: number }> = [
  { prop: Prop.Tank, tx: 28, ty: 24 },
  { prop: Prop.Tank, tx: 28, ty: 26 },
  { prop: Prop.Tank, tx: 43, ty: 23 },
  { prop: Prop.Scaffold, tx: 29, ty: 22 },
  { prop: Prop.Crane, tx: 44, ty: 26 },
];

/** Where the camera comes to rest upriver: the Works' middle, with its towers above. */
export const WORKS_VIEW = { x: 36, y: 24 };

/** Where the light from the Works' ground floor falls once its windows are lit: along its front. */
export const WORKS_LIGHTS: Array<{ x: number; y: number }> = Array.from({ length: 6 }, (_, i) => ({ x: 30.8 + i * 2.1, y: 28.3 }));

/** Where the salvager is set down upriver: far from the Works, so only the building is seen. */
const OUT_OF_SIGHT = { x: UPRIVER.x, y: UPRIVER.y };

/**
 * Upriver, outside the Works, where the story ends: bare ground in the dark round it. The story brings
 * the salvager here, out of sight of it; no door leads in or out.
 */
export function buildUpriver(): LevelContent {
  const map = createTileMap(WIDTH, HEIGHT);
  const level: Level = {
    id: 'upriver', name: 'Upriver', subtitle: 'The Works', outdoor: true, map,
    start: OUT_OF_SIGHT, portals: [], lights: [], structures: [],
  };
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) map.ground[tileIndex(map, x, y)] = valueNoise(x * 0.13, y * 0.13) > 0.55 ? Ground.DeadGrass : Ground.Dirt;
  }
  for (const p of PARTS) {
    for (let y = p.y; y < p.y + p.depth; y++) for (let x = p.x; x < p.x + p.width; x++) setProp(map, x, y, Prop.Building, true);
  }
  for (const d of DRESSING) setProp(map, d.tx, d.ty, d.prop, true);
  // Its door stands shut; the tile is left open only so the door is drawn in its wall.
  setSolid(map, DOOR.tx, DOOR.ty, false);
  const x = Math.min(...PARTS.map((p) => p.x));
  const y = Math.min(...PARTS.map((p) => p.y));
  level.structures.push({
    kind: 'works', name: 'The Works', x, y,
    width: Math.max(...PARTS.map((p) => p.x + p.width)) - x,
    depth: Math.max(...PARTS.map((p) => p.y + p.depth)) - y,
    door: DOOR, parts: PARTS,
  });
  return { level, spawns: [], camps: [], npcs: [], containers: [], readables: [] };
}
