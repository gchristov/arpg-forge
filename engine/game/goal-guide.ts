import type { Vec2 } from '../core/math';
import { findPath } from '../world/pathfinding';
import type { TileMap } from '../world/tile-map';

/** The arrow aims at the first step of the walk at least this far from the hero, so it turns before corners. */
const AIM_AHEAD = 2.5;

/**
 * Which way to head for a goal: along the walk there rather than straight at it, so the way round a building
 * shows. The walk is found again only when the hero or the goal moves to another tile.
 */
export class GoalGuide {
  private path: Vec2[] | null = null;
  private map: TileMap | null = null;
  private readonly from = { x: -1, y: -1 };
  private readonly to = { x: -1, y: -1 };

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
      this.path = findPath(map, x, y, goal.x, goal.y);
    }
    out.x = goal.x;
    out.y = goal.y;
    for (const p of this.path ?? []) {
      if (Math.hypot(p.x - x, p.y - y) >= AIM_AHEAD) {
        out.x = p.x;
        out.y = p.y;
        break;
      }
    }
    return out;
  }
}
