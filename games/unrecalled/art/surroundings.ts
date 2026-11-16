import { clamp, hash2 } from '../../../engine/core/math';
import type { Surroundings } from '../../../engine/render/look';
import { playDistances, shadeArea } from '../../../engine/render/shade-map';
import type { Level } from '../../../engine/world/level';
import { Ground, Prop } from '../content/tiles';
import { FOUNDRY_SIDE } from '../levels/rustbelt';

/** Ground carries on this far past a level's edges: past the edge of a phone's screen from the hero. */
const MARGIN = 14;
/** Scenery stands only this far out, since the dark hides anything further. */
const SCENERY_REACH = 7;

/** What the Foundry keeps in the dark between its rooms: the clutter of a works that never stopped. */
const FOUNDRY_CLUTTER = [Prop.Crate, Prop.Crate, Prop.Barrel, Prop.Shelves, Prop.Furnace, Prop.Column, Prop.Locker];
/** The Foundry's clutter stands in the rock between this near and this far from a room, in tiles. */
const CLUTTER_BAND = [1.9, 4.5] as const;
const CLUTTER_SHARE = 0.12;

/** The Foundry itself looms past the middle of Rustbelt's top edge: tanks, scaffolds and cranes in the dark. */
const FOUNDRY_BEYOND = [Prop.Tank, Prop.Scaffold, Prop.Crane, Prop.Tank];
const FOUNDRY_SHARE = 0.22;
const FOUNDRY_EDGE_SHARE = 0.7;

/**
 * Past every level's walls and edges, so the player never sees where the map stops: in the Foundry, more of the works
 * in the dark between rooms; round Rustbelt, the dead woods carrying on, and the Foundry's bulk past its top edge.
 */
export function surroundingsOf(level: Level): Surroundings {
  if (level.building === 'foundry') return { margin: MARGIN, ground: Ground.Plate, scenery: foundryClutter(level) };
  if (level.outdoor) return { margin: MARGIN, ground: Ground.Dirt, scenery: woodsBeyond(level) };
  return { margin: MARGIN, ground: Ground.Plate, scenery: [] };
}

function foundryClutter(level: Level): Surroundings['scenery'] {
  const { map } = level;
  const area = shadeArea(map, 0);
  const distance = playDistances(map, area, () => false);
  const scenery: Surroundings['scenery'] = [];
  for (let ty = 0; ty < map.height; ty++) {
    for (let tx = 0; tx < map.width; tx++) {
      const d = distance[ty * map.width + tx]!;
      if (d < CLUTTER_BAND[0] || d > CLUTTER_BAND[1] || hash2(tx, ty, 61) > CLUTTER_SHARE) continue;
      const prop = FOUNDRY_CLUTTER[Math.floor(hash2(tx, ty, 67) * FOUNDRY_CLUTTER.length)]!;
      scenery.push({ prop, x: tx + 0.5, y: ty + 0.5 });
    }
  }
  return scenery;
}

function woodsBeyond(level: Level): Surroundings['scenery'] {
  const { map } = level;
  const scenery: Surroundings['scenery'] = [];
  for (let ty = -SCENERY_REACH; ty < map.height + SCENERY_REACH; ty++) {
    for (let tx = -SCENERY_REACH; tx < map.width + SCENERY_REACH; tx++) {
      if (tx >= 0 && ty >= 0 && tx < map.width && ty < map.height) continue;
      // The ground past an edge is the ground at the edge, so the river runs on and stays clear of trees.
      const edge = map.ground[clamp(ty, 0, map.height - 1) * map.width + clamp(tx, 0, map.width - 1)];
      if (edge === Ground.Water || edge === Ground.Mud) continue;
      const h = hash2(tx, ty, 71);
      if (ty < 0 && tx >= FOUNDRY_SIDE.from && tx <= FOUNDRY_SIDE.to) {
        // Packed close along the edge itself, so the yard is what stops the salvager, not an unseen line.
        if (h < (ty === -1 ? FOUNDRY_EDGE_SHARE : FOUNDRY_SHARE)) scenery.push({ prop: FOUNDRY_BEYOND[Math.floor(hash2(tx, ty, 73) * FOUNDRY_BEYOND.length)]!, x: tx + 0.5, y: ty + 0.5 });
      } else if (h < 0.1) scenery.push({ prop: Prop.DeadTree, x: tx + 0.5, y: ty + 0.5 });
      else if (h > 0.97) scenery.push({ prop: Prop.Rock, x: tx + 0.5, y: ty + 0.5 });
    }
  }
  return scenery;
}
