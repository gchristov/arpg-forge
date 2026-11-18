import type { Vec2 } from '../core/math';
import type { SceneRenderer } from '../render/scene-renderer';
import { currentLevel, type Command, type GameState } from '../sim/state';
import { PX } from './world-view';

/** Taps within this many pixels (at zoom 1) of an actor's body pick it: about a fingertip on a phone. */
const TAP_REACH_PX = 44;
/**
 * Taps on the ground this close to a building, in tiles, enter it, so a tap by its door or just past its roof counts.
 * Doors and chests count from this far from their tile's middle, so a tap needn't land on the tile itself.
 */
const BUILDING_REACH = 0.8;
const THING_REACH = 0.9;
/** Where on an actor's body a tap aims, in screen pixels above its feet at zoom 1. */
const BODY_PX = 18;
/** How tall a door stands, in tiles; a tap anywhere up its height goes through it. */
const DOOR_HEIGHT = 1.6;

const screenPoint: Vec2 = { x: 0, y: 0 };
const screenTop: Vec2 = { x: 0, y: 0 };

/** What tapping needs from the renderer: where things are on screen, and what lies under a screen point. */
export type TapView = Pick<SceneRenderer, 'screenPosition' | 'pick' | 'zoom'>;

/**
 * Turns a tap on the world at screen point `x`, `y` into a command, checking in this order: enemies, NPCs, things to
 * read, doors by their body, buildings, chests, doors by the ground near them, then the ground. Only enemies `seen`
 * says the hero can see can be tapped. Null when the tap hits nothing.
 */
export function tapCommand(
  state: GameState,
  renderer: TapView,
  scaleOf: (kind: string) => number,
  x: number,
  y: number,
  seen: (enemyId: number) => boolean = () => true,
): Command | null {
  const ls = currentLevel(state);
  let best: { id: number; d: number } | null = null;
  for (const e of ls.enemies) {
    if (e.dead || !seen(e.id)) continue;
    const scale = scaleOf(e.kind);
    const p = renderer.screenPosition(e.x, e.y, BODY_PX * PX * scale, screenPoint);
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < TAP_REACH_PX * renderer.zoom * Math.max(1, scale * 0.9) && (!best || d < best.d)) best = { id: e.id, d };
  }
  if (best) return { type: 'attack', enemyId: best.id };
  for (const n of ls.npcs) {
    const p = renderer.screenPosition(n.x, n.y, BODY_PX * PX, screenPoint);
    if (Math.hypot(p.x - x, p.y - y) < TAP_REACH_PX * renderer.zoom) return { type: 'talk', npcId: n.id };
  }
  // Things to read are often tall, such as a terminal, so they're tapped by their body on screen like an NPC.
  for (const [index, r] of ls.readables.entries()) {
    const p = renderer.screenPosition(r.tx + 0.5, r.ty + 0.5, BODY_PX * PX, screenPoint);
    if (Math.hypot(p.x - x, p.y - y) < TAP_REACH_PX * renderer.zoom) return { type: 'read', index };
  }
  // A door stands up out of its wall, so a tap on it lands on the ground behind; it's tapped by its body on screen.
  const reach = TAP_REACH_PX * renderer.zoom;
  const tappedDoor = nearest(ls.level.portals, (p) => {
    const foot = renderer.screenPosition(p.tx + 0.5, p.ty + 0.5, 0, screenPoint);
    const top = renderer.screenPosition(p.tx + 0.5, p.ty + 0.5, DOOR_HEIGHT, screenTop);
    return distanceToSegment(x, y, foot, top);
  }, reach);
  if (tappedDoor >= 0) return walkInto(ls.level.portals[tappedDoor]!);
  const picked = renderer.pick(x, y);
  if (!picked) return null;
  if ('structure' in picked) return { type: 'enterStructure', index: picked.structure };
  const { ground } = picked;
  const building = nearest(ls.level.structures, (s) => distanceToArea(ground, s.x, s.y, s.width, s.depth), BUILDING_REACH);
  if (building >= 0) return { type: 'enterStructure', index: building };
  const chest = nearest(ls.containers, (c) => (c.opened ? Infinity : distanceToTile(ground, c.tx, c.ty)), THING_REACH);
  if (chest >= 0) return { type: 'open', index: chest };
  const door = nearest(ls.level.portals, (p) => distanceToTile(ground, p.tx, p.ty), THING_REACH);
  if (door >= 0) return walkInto(ls.level.portals[door]!);
  return { type: 'walk', x: ground.x, y: ground.y };
}

/** The index of the item nearest by `distance`, if it's within `reach`, or -1. */
function nearest<T>(items: readonly T[], distance: (item: T) => number, reach: number): number {
  let best = -1;
  let bestDistance = reach;
  for (const [index, item] of items.entries()) {
    const d = distance(item);
    if (d < bestDistance) {
      best = index;
      bestDistance = d;
    }
  }
  return best;
}

function walkInto(door: { tx: number; ty: number }): Command {
  return { type: 'walkInto', tx: door.tx, ty: door.ty };
}

function distanceToSegment(x: number, y: number, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = dx * dx + dy * dy;
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / length));
  return Math.hypot(x - (a.x + t * dx), y - (a.y + t * dy));
}

function distanceToTile(p: Vec2, tx: number, ty: number): number {
  return Math.hypot(p.x - (tx + 0.5), p.y - (ty + 0.5));
}

function distanceToArea(p: Vec2, x: number, y: number, width: number, depth: number): number {
  const dx = Math.max(x - p.x, 0, p.x - (x + width));
  const dy = Math.max(y - p.y, 0, p.y - (y + depth));
  return Math.hypot(dx, dy);
}
