import { clamp, hash2 } from '../../../engine/core/math';
import type { Surroundings } from '../../../engine/render/look';
import type { Level } from '../../../engine/world/level';
import { Ground, Prop } from '../content/tiles';
import { FOUNDRY_SIDE } from '../levels/rustbelt';

/** Ground carries on this far past a level's edges: past the edge of a phone's screen from the hero. */
const MARGIN = 14;
/** Scenery stands only this far out, since the dark hides anything further. */
const SCENERY_REACH = 7;

/**
 * Indoors, the ground stops at the walls and the dark closes in within a tile or so; what lies past the walls shows
 * only in the cables running over their tops.
 */
const INDOOR = { margin: 4, fade: 1.1, scenery: [] };

/** The Foundry itself looms past the middle of Rustbelt's top edge: tanks, scaffolds and cranes in the dark. */
const FOUNDRY_BEYOND = [Prop.Tank, Prop.Scaffold, Prop.Crane, Prop.Tank];
/** Shares of tiles past that edge with a piece of the Foundry, and with a dead tree, further out and along the edge itself. */
const FOUNDRY_SHARE = { out: 0.08, edge: 0.15 };
const TREE_SHARE = { out: 0.12, edge: 0.3 };

/**
 * Past every level's walls and edges, so the player never sees where the map stops: indoors, darkness past the walls;
 * outdoors, the dead woods carrying on, and the Foundry's bulk past Rustbelt's top edge.
 */
export function surroundingsOf(level: Level): Surroundings {
  if (level.outdoor) return { margin: MARGIN, ground: Ground.Dirt, scenery: woodsBeyond(level) };
  return INDOOR;
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
      if (nearEdgePortal(level, tx, ty)) continue;
      if (level.id === 'rustbelt' && ty < 0 && tx >= FOUNDRY_SIDE.from && tx <= FOUNDRY_SIDE.to) {
        // Closer together along the edge itself, so trees and the yard are what stop the salvager, not an unseen line.
        const at = ty === -1 ? 'edge' : 'out';
        if (h < FOUNDRY_SHARE[at]) scenery.push({ prop: FOUNDRY_BEYOND[Math.floor(hash2(tx, ty, 73) * FOUNDRY_BEYOND.length)]!, x: tx + 0.5, y: ty + 0.5 });
        else if (h < FOUNDRY_SHARE[at] + TREE_SHARE[at]) scenery.push({ prop: Prop.DeadTree, x: tx + 0.5, y: ty + 0.5 });
      } else if (h < 0.1) scenery.push({ prop: Prop.DeadTree, x: tx + 0.5, y: ty + 0.5 });
      else if (h > 0.97) scenery.push({ prop: Prop.Rock, x: tx + 0.5, y: ty + 0.5 });
    }
  }
  return scenery;
}

/** A trail leaving through an edge carries on clear of trees, so the way out looks like one. */
function nearEdgePortal(level: Level, tx: number, ty: number): boolean {
  const { map } = level;
  const x = clamp(tx, 0, map.width - 1);
  const y = clamp(ty, 0, map.height - 1);
  return level.portals.some((p) => Math.abs(p.tx - x) + Math.abs(p.ty - y) <= 1);
}
