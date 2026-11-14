import type { Vec2 } from '../core/math';
import { inBounds, isSolidAt, tileIndex, type TileMap } from './tile-map';

const DIAGONAL = Math.SQRT2;
const NEIGHBOURS: ReadonlyArray<readonly [dx: number, dy: number, cost: number]> = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, DIAGONAL],
  [1, -1, DIAGONAL],
  [-1, 1, DIAGONAL],
  [-1, -1, DIAGONAL],
];

/** Search effort is capped, so an unreachable target costs a bounded amount of time. */
const DEFAULT_MAX_EXPANSIONS = 3500;

/**
 * Working memory for searches, reused between calls so pathfinding doesn't allocate per search. One is kept
 * per map size.
 */
interface Scratch {
  cost: Float32Array;
  cameFrom: Int32Array;
  closed: Uint8Array;
  heapPriority: Float32Array;
  heapNode: Int32Array;
}
const scratchBySize = new Map<number, Scratch>();

function scratchFor(size: number): Scratch {
  let s = scratchBySize.get(size);
  if (!s) {
    const heapCapacity = size * NEIGHBOURS.length + 1;
    s = {
      cost: new Float32Array(size),
      cameFrom: new Int32Array(size),
      closed: new Uint8Array(size),
      heapPriority: new Float32Array(heapCapacity),
      heapNode: new Int32Array(heapCapacity),
    };
    scratchBySize.set(size, s);
  }
  s.cost.fill(Infinity);
  s.cameFrom.fill(-1);
  s.closed.fill(0);
  return s;
}

/**
 * A* over the tile grid in eight directions. Diagonal steps may not cut a solid corner. Returns the centres of
 * the tiles to walk through, excluding the start tile: an empty list when start and target share a tile, and
 * null when the target tile is solid, outside the map or not reached within the search budget.
 */
export function findPath(
  map: TileMap,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  maxExpansions = DEFAULT_MAX_EXPANSIONS,
): Vec2[] | null {
  const sx = Math.floor(fromX);
  const sy = Math.floor(fromY);
  const tx = Math.floor(toX);
  const ty = Math.floor(toY);
  if (!inBounds(map, tx, ty) || map.solid[tileIndex(map, tx, ty)]) return null;
  const width = map.width;
  const start = tileIndex(map, sx, sy);
  const goal = tileIndex(map, tx, ty);
  if (start === goal) return [];

  const s = scratchFor(width * map.height);
  const heuristic = (x: number, y: number): number => {
    const dx = Math.abs(x - tx);
    const dy = Math.abs(y - ty);
    return Math.max(dx, dy) + (DIAGONAL - 1) * Math.min(dx, dy);
  };

  let heapSize = 0;
  const push = (priority: number, node: number): void => {
    let k = heapSize++;
    while (k > 0) {
      const parent = (k - 1) >> 1;
      if (s.heapPriority[parent]! <= priority) break;
      s.heapPriority[k] = s.heapPriority[parent]!;
      s.heapNode[k] = s.heapNode[parent]!;
      k = parent;
    }
    s.heapPriority[k] = priority;
    s.heapNode[k] = node;
  };
  const pop = (): number => {
    const top = s.heapNode[0]!;
    heapSize--;
    const lastPriority = s.heapPriority[heapSize]!;
    const lastNode = s.heapNode[heapSize]!;
    let k = 0;
    for (;;) {
      const left = k * 2 + 1;
      if (left >= heapSize) break;
      const right = left + 1;
      const child = right < heapSize && s.heapPriority[right]! < s.heapPriority[left]! ? right : left;
      if (s.heapPriority[child]! >= lastPriority) break;
      s.heapPriority[k] = s.heapPriority[child]!;
      s.heapNode[k] = s.heapNode[child]!;
      k = child;
    }
    s.heapPriority[k] = lastPriority;
    s.heapNode[k] = lastNode;
    return top;
  };

  s.cost[start] = 0;
  push(heuristic(sx, sy), start);
  let expansions = 0;
  while (heapSize > 0 && expansions++ < maxExpansions) {
    const current = pop();
    if (current === goal) break;
    if (s.closed[current]) continue;
    s.closed[current] = 1;
    const cx = current % width;
    const cy = (current / width) | 0;
    for (const [dx, dy, stepCost] of NEIGHBOURS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!inBounds(map, nx, ny)) continue;
      const neighbour = ny * width + nx;
      if (map.solid[neighbour] || s.closed[neighbour]) continue;
      if (dx && dy && (map.solid[cy * width + nx] || map.solid[ny * width + cx])) continue;
      const cost = s.cost[current]! + stepCost;
      if (cost < s.cost[neighbour]!) {
        s.cost[neighbour] = cost;
        s.cameFrom[neighbour] = current;
        push(cost + heuristic(nx, ny), neighbour);
      }
    }
  }

  if (s.cameFrom[goal]! < 0) return null;
  const path: Vec2[] = [];
  for (let node = goal; node !== start && node >= 0; node = s.cameFrom[node]!) {
    path.push({ x: (node % width) + 0.5, y: ((node / width) | 0) + 0.5 });
  }
  return path.reverse();
}

/**
 * A walkable route from a point to an exact target point. Like `findPath`, but the last waypoint is the target
 * itself rather than its tile's centre, so the walker ends where it was sent.
 */
export function planRoute(map: TileMap, from: Vec2, to: Vec2): Vec2[] | null {
  const path = findPath(map, from.x, from.y, to.x, to.y);
  if (!path) return null;
  if (path.length === 0) path.push({ x: to.x, y: to.y });
  else if (!isSolidAt(map, to.x, to.y)) path[path.length - 1] = { x: to.x, y: to.y };
  return path;
}

/**
 * The point itself if its tile is free, otherwise the centre of the closest free tile within three rings
 * around it, or null if there's none. `avoid` rules out tiles in that ring search, such as doorways.
 */
export function nearestFreePoint(
  map: TileMap,
  x: number,
  y: number,
  avoid: (tileIndex: number) => boolean = () => false,
): Vec2 | null {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  if (inBounds(map, tx, ty) && !map.solid[tileIndex(map, tx, ty)]) return { x, y };
  for (let ring = 1; ring < 4; ring++) {
    for (let dy = -ring; dy <= ring; dy++) {
      for (let dx = -ring; dx <= ring; dx++) {
        const nx = tx + dx;
        const ny = ty + dy;
        if (!inBounds(map, nx, ny)) continue;
        const i = tileIndex(map, nx, ny);
        if (!map.solid[i] && !avoid(i)) return { x: nx + 0.5, y: ny + 0.5 };
      }
    }
  }
  return null;
}
