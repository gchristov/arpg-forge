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

/**
 * Indoors, the works past the walls is only hinted at, in a darkness that closes in within a few tiles: pipe runs and
 * silos behind the back walls, tall enough to show over them, and low clutter past the front walls, where anything
 * tall would stand between the camera and the room.
 */
const WORKS_BEHIND = [Prop.PipeRun, Prop.PipeRun, Prop.Silo];
const WORKS_IN_FRONT = [Prop.Crate, Prop.Barrel, Prop.Crate];
const WORKS_BAND = [1.9, 2.5] as const;
const WORKS_SHARE = 0.2;
const INDOOR = { margin: 4, fade: 1.1 };
/** How far a tile looks for the room it stands behind (down and right), and for one it would stand in front of. */
const BEHIND_REACH = 4;
const IN_FRONT_REACH = 3;

/** The Foundry itself looms past the middle of Rustbelt's top edge: tanks, scaffolds and cranes in the dark. */
const FOUNDRY_BEYOND = [Prop.Tank, Prop.Scaffold, Prop.Crane, Prop.Tank];
/** Shares of tiles past that edge with a piece of the Foundry, and with a dead tree, further out and along the edge itself. */
const FOUNDRY_SHARE = { out: 0.08, edge: 0.15 };
const TREE_SHARE = { out: 0.12, edge: 0.3 };

/**
 * Past every level's walls and edges, so the player never sees where the map stops: indoors, a hint of the works
 * behind the walls; round Rustbelt, the dead woods carrying on, and the Foundry's bulk past its top edge.
 */
export function surroundingsOf(level: Level): Surroundings {
  if (level.outdoor) return { margin: MARGIN, ground: Ground.Dirt, scenery: woodsBeyond(level) };
  return { ...INDOOR, scenery: worksBehindWalls(level) };
}

function worksBehindWalls(level: Level): Surroundings['scenery'] {
  const { map } = level;
  const floorAt = (tx: number, ty: number) =>
    tx >= 0 && ty >= 0 && tx < map.width && ty < map.height && !map.solid[ty * map.width + tx];
  // As the camera sees it, a room down and to the right lies in front of the tile, and one up and to the left behind it.
  const roomWithin = (tx: number, ty: number, reach: number, sign: number) => {
    for (let k = 1; k <= reach; k++) {
      if (floorAt(tx, ty + k * sign) || floorAt(tx + k * sign, ty) || floorAt(tx + k * sign, ty + k * sign)) return true;
    }
    return false;
  };
  // Tall pieces only where they stand behind one room without standing in front of another.
  const tallFits = (tx: number, ty: number) => roomWithin(tx, ty, BEHIND_REACH, 1) && !roomWithin(tx, ty, IN_FRONT_REACH, -1);
  const area = shadeArea(map, INDOOR.margin);
  const distance = playDistances(level.map, area, () => false);
  const scenery: Surroundings['scenery'] = [];
  for (let y = 0; y < area.depth; y++) {
    for (let x = 0; x < area.width; x++) {
      const tx = x + area.x0;
      const ty = y + area.y0;
      const d = distance[y * area.width + x]!;
      if (d < WORKS_BAND[0] || d > WORKS_BAND[1] || hash2(tx, ty, 61) > WORKS_SHARE) continue;
      const choice = tallFits(tx, ty) ? WORKS_BEHIND : WORKS_IN_FRONT;
      const prop = choice[Math.floor(hash2(tx, ty, 67) * choice.length)]!;
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
