import type { Vec2 } from '../core/math';
import { hasLineOfSight } from '../world/line-of-sight';
import { findPath } from '../world/pathfinding';
import type { TileMap } from '../world/tile-map';

/** The width a straight walk to the aim must leave either side, so it never aims across the corner of a wall. */
const CLEARANCE = 0.25;

/**
 * Which way to head for a goal: at the furthest point of the walk there that is in plain sight, which is the goal
 * itself in the open and the next corner round a building. The walk steps from tile to tile in eight directions,
 * so aiming along it would zigzag; aiming at what's in sight doesn't. Both are worked out again only when the hero
 * or the goal moves to another tile.
 */
export class GoalGuide {
  private map: TileMap | null = null;
  private readonly from = { x: -1, y: -1 };
  private readonly to = { x: -1, y: -1 };
  /** The point of the walk to aim at, or null to aim at the goal. */
  private corner: Vec2 | null = null;

  /** Where to aim from `x`, `y` to reach `goal`, written to `out`: the goal itself if no walk reaches it. */
  aim(map: TileMap, x: number, y: number, goal: Vec2, out: Vec2): Vec2 {
    const fx = Math.floor(x);
    const fy = Math.floor(y);
    const tx = Math.floor(goal.x);
    const ty = Math.floor(goal.y);
    if (map !== this.map || fx !== this.from.x || fy !== this.from.y || tx !== this.to.x || ty !== this.to.y) {
      this.map = map;
      this.from.x = fx;
      this.from.y = fy;
      this.to.x = tx;
      this.to.y = ty;
      this.corner = furthestInSight(map, x, y, goal, findPath(map, x, y, goal.x, goal.y));
    }
    out.x = this.corner?.x ?? goal.x;
    out.y = this.corner?.y ?? goal.y;
    return out;
  }
}

function furthestInSight(map: TileMap, x: number, y: number, goal: Vec2, path: Vec2[] | null): Vec2 | null {
  if (!path?.length || hasLineOfSight(map, x, y, goal.x, goal.y, CLEARANCE)) return null;
  let seen = path[0]!;
  for (let i = 1; i < path.length - 1; i++) {
    if (!hasLineOfSight(map, x, y, path[i]!.x, path[i]!.y, CLEARANCE)) break;
    seen = path[i]!;
  }
  return seen;
}
