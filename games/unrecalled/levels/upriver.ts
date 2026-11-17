import { valueNoise } from '../../../engine/core/math';
import type { LevelContent } from '../../../engine/sim/content';
import type { BuildingPart, Level } from '../../../engine/world/level';
import { createTileMap, setProp, setSolid, tileIndex } from '../../../engine/world/tile-map';
import { Ground, Prop } from '../content/tiles';

const WIDTH = 44;
const HEIGHT = 32;

/** Foundry 2's hall and towers. */
const PARTS: BuildingPart[] = [
  { x: 16, y: 9, width: 12, depth: 5, floors: 2 },
  { x: 18, y: 7, width: 4, depth: 2, floors: 3 },
  { x: 24, y: 7, width: 2, depth: 2, floors: 4 },
];
const DOOR = { tx: 22, ty: 13 };

/** Tanks, scaffolds and a crane round its walls. */
const DRESSING: Array<{ prop: number; tx: number; ty: number }> = [
  { prop: Prop.Tank, tx: 14, ty: 10 },
  { prop: Prop.Tank, tx: 14, ty: 12 },
  { prop: Prop.Tank, tx: 29, ty: 9 },
  { prop: Prop.Scaffold, tx: 15, ty: 8 },
  { prop: Prop.Crane, tx: 30, ty: 12 },
];

/** Where the camera looks once the salvager arrives: the middle of Foundry 2's front. */
export const FOUNDRY_2_VIEW = { x: 22, y: 12.5 };

/** Where Foundry 2's lights come on as it wakes, in the order they light: along its front from end to end, then its towers. */
export const FOUNDRY_2_LIGHTS: Array<{ x: number; y: number }> = [
  ...Array.from({ length: 6 }, (_, i) => ({ x: 16.8 + i * 2.1, y: 14.3 })),
  { x: 20, y: 9.2 },
  { x: 25, y: 9.2 },
];

/**
 * Upriver, outside Foundry 2, where the story ends: bare ground in the dark facing a second Foundry. The story brings
 * the salvager here; no door leads in or out.
 */
export function buildUpriver(): LevelContent {
  const map = createTileMap(WIDTH, HEIGHT);
  const level: Level = {
    id: 'upriver', name: 'Upriver', subtitle: 'Foundry 2', outdoor: true, map,
    start: { x: 22.5, y: 24.5 }, portals: [], lights: [], structures: [],
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
    kind: 'foundry', name: 'Foundry 2', x, y,
    width: Math.max(...PARTS.map((p) => p.x + p.width)) - x,
    depth: Math.max(...PARTS.map((p) => p.y + p.depth)) - y,
    door: DOOR, parts: PARTS,
  });
  return { level, spawns: [], camps: [], npcs: [], containers: [], readables: [] };
}
