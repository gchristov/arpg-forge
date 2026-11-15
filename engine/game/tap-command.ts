import type { Vec2 } from '../core/math';
import type { SceneRenderer } from '../render/scene-renderer';
import { currentLevel, type Command, type GameState } from '../sim/state';
import { PX } from './world-view';

/** Taps within this many pixels (at zoom 1) of an actor's body pick it. */
const TAP_REACH_PX = 34;
/** Where on an actor's body a tap aims, in screen pixels above its feet at zoom 1. */
const BODY_PX = 18;

const screenPoint: Vec2 = { x: 0, y: 0 };

/** What tapping needs from the renderer: where things are on screen, and what lies under a screen point. */
export type TapView = Pick<SceneRenderer, 'screenPosition' | 'pick' | 'zoom'>;

/**
 * Turns a tap on the world at screen point `x`, `y` into a command, checking in this order: enemies, NPCs,
 * buildings, chests, portals, then the ground. Null when the tap hits nothing.
 */
export function tapCommand(
  state: GameState,
  renderer: TapView,
  scaleOf: (kind: string) => number,
  x: number,
  y: number,
): Command | null {
  const ls = currentLevel(state);
  let best: { id: number; d: number } | null = null;
  for (const e of ls.enemies) {
    if (e.dead) continue;
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
  const picked = renderer.pick(x, y);
  if (!picked) return null;
  if ('structure' in picked) return { type: 'enterStructure', index: picked.structure };
  const tx = Math.floor(picked.ground.x);
  const ty = Math.floor(picked.ground.y);
  const chest = ls.containers.findIndex((c) => c.tx === tx && c.ty === ty && !c.opened);
  if (chest >= 0) return { type: 'open', index: chest };
  if (ls.level.portals.some((p) => p.tx === tx && p.ty === ty)) return { type: 'walkInto', tx, ty };
  return { type: 'walk', x: picked.ground.x, y: picked.ground.y };
}
