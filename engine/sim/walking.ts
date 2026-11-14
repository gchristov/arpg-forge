import { dist, lerp, type Vec2 } from '../core/math';
import { moveBody } from '../world/collision';
import { hasLineOfSight } from '../world/line-of-sight';
import { nearestFreePoint, planRoute } from '../world/pathfinding';
import type { TileMap } from '../world/tile-map';

/** Anything that walks: the hero, enemies, summons. */
export interface Walker {
  x: number;
  y: number;
  r: number;
  facingX: number;
  facingY: number;
  moving: boolean;
  path: Vec2[] | null;
}

const ARRIVED = 0.02;
const TURN_RATE = 0.35;

/**
 * Walks straight towards a point for one step, sliding along walls, and turns to face the way it's going.
 * Returns true once the point is reached.
 */
export function steerTowards(map: TileMap, w: Walker, tx: number, ty: number, speed: number, dt: number): boolean {
  const d = dist(w.x, w.y, tx, ty);
  if (d < ARRIVED) return true;
  const stride = Math.min(d, speed * dt);
  const vx = (tx - w.x) / d;
  const vy = (ty - w.y) / d;
  const ox = w.x;
  const oy = w.y;
  moveBody(map, w, vx * stride, vy * stride);
  w.facingX = lerp(w.facingX, vx, TURN_RATE);
  w.facingY = lerp(w.facingY, vy, TURN_RATE);
  w.moving = Math.hypot(w.x - ox, w.y - oy) > stride * 0.2;
  return d <= stride + 0.01;
}

/**
 * Walks along the current path for one step. Waypoints that can be skipped by walking straight are dropped,
 * so paths look natural rather than tile by tile. Returns true when there's no path left.
 */
export function followPath(map: TileMap, w: Walker, speed: number, dt: number): boolean {
  const path = w.path;
  if (!path || path.length === 0) {
    w.moving = false;
    return true;
  }
  while (path.length > 1 && hasLineOfSight(map, w.x, w.y, path[1]!.x, path[1]!.y, w.r)) path.shift();
  const next = path[0]!;
  if (steerTowards(map, w, next.x, next.y, speed, dt)) path.shift();
  if (path.length === 0) {
    w.moving = false;
    return true;
  }
  return false;
}

/**
 * Sends a walker towards a point, or the nearest free spot next to it. Returns where it will end up, or null
 * if there's no way there, in which case the walker keeps its current path.
 */
export function walkTo(
  map: TileMap,
  w: Walker,
  target: Vec2,
  avoid?: (tileIndex: number) => boolean,
): Vec2 | null {
  const spot = nearestFreePoint(map, target.x, target.y, avoid);
  if (!spot) return null;
  const route = planRoute(map, w, spot);
  if (!route) return null;
  w.path = route;
  return spot;
}
