import { advance, createFixedLoop } from '../../engine/core/loop';
import { lerp, type Vec2 } from '../../engine/core/math';
import { PointerInput } from '../../engine/input/pointer';
import { DebugOverlay } from '../../engine/render/debug-overlay';
import { SceneRenderer } from '../../engine/render/scene-renderer';
import { createGameState } from '../../engine/sim/setup';
import { currentLevel, type Actor, type Command, type SimEvent } from '../../engine/sim/state';
import { step } from '../../engine/sim/step';
import { ScreenFade } from '../../engine/ui/fade';
import { tileIndex } from '../../engine/world/tile-map';
import { ashenHollowLook } from './art/look';
import { Prop } from './content/tiles';
import { ashenHollowContent } from './content/world';

const MARKER_COLOUR = 0xe8d6a6;
const FADE_SECONDS = 0.3;

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const renderer = new SceneRenderer(canvas, ashenHollowLook);
const pointer = new PointerInput(canvas);
const fade = new ScreenFade(document.body, FADE_SECONDS);
const debug = new URLSearchParams(location.search).has('debug') ? new DebugOverlay(document.body) : null;

const content = ashenHollowContent();
/** `#crypt` and the like start in that level, to get straight to it when testing. */
const jumpTo = location.hash.slice(1);
const startLevel = content.levels.some((l) => l.level.id === jumpTo) ? jumpTo : content.startLevel;
const state = createGameState(content, (Math.random() * 2 ** 32) >>> 0, startLevel);
const pending: Command[] = [];
/** Holding the pointer keeps walking only when the press started a walk, not when it tapped a building. */
let holdWalks = false;

const fit = (): void => renderer.resize(innerWidth, innerHeight, devicePixelRatio);
addEventListener('resize', fit);
fit();
showCurrentLevel();

function showCurrentLevel(): void {
  renderer.showLevel(currentLevel(state).level);
  renderer.clearActors();
  renderer.follow(state.hero.x, state.hero.y, 0, true);
}

/** Turns a tap into a command, deciding what was tapped. */
function commandForTap(x: number, y: number): Command | null {
  if (state.transition) return null;
  const picked = renderer.pick(x, y);
  if (!picked) return null;
  if ('structure' in picked) return { type: 'enterStructure', index: picked.structure };
  const { map } = currentLevel(state).level;
  const tx = Math.floor(picked.ground.x);
  const ty = Math.floor(picked.ground.y);
  if (tx >= 0 && ty >= 0 && tx < map.width && ty < map.height && map.prop[tileIndex(map, tx, ty)] === Prop.Doorway) {
    return { type: 'walkInto', tx, ty };
  }
  return { type: 'walk', x: picked.ground.x, y: picked.ground.y };
}

function heldGroundPoint(): Vec2 | null {
  const held = pointer.held();
  if (!held || !holdWalks) return null;
  const picked = renderer.pick(held.x, held.y);
  return picked && 'ground' in picked ? picked.ground : null;
}

function react(events: SimEvent[]): void {
  for (const e of events) {
    if (e.type === 'WalkTargetSet') renderer.showMarker(e.x, e.y, MARKER_COLOUR);
    else if (e.type === 'TransitionStarted') fade.toBlack();
    else if (e.type === 'EnteredLevel') {
      showCurrentLevel();
      fade.fromBlack();
    }
  }
}

function drawActor(actor: Actor, alpha: number): void {
  renderer.setActor(
    String(actor.id), actor.kind,
    lerp(actor.prevX, actor.x, alpha), lerp(actor.prevY, actor.y, alpha),
    actor.facingX, actor.facingY,
  );
}

const loop = createFixedLoop();
let last = performance.now();
function frame(now: number): void {
  const frameSeconds = (now - last) / 1000;
  last = now;
  for (const tap of pointer.takeTaps()) {
    const command = commandForTap(tap.x, tap.y);
    holdWalks = command?.type === 'walk';
    if (command) pending.push(command);
  }
  const held = heldGroundPoint();
  const t0 = performance.now();
  const alpha = advance(loop, frameSeconds, (dt) => react(step(state, { commands: pending.splice(0), held }, dt)));
  const t1 = performance.now();
  const ls = currentLevel(state);
  drawActor(state.hero, alpha);
  for (const n of ls.npcs) drawActor(n, alpha);
  for (const e of ls.enemies) drawActor(e, alpha);
  renderer.follow(lerp(state.hero.prevX, state.hero.x, alpha), lerp(state.hero.prevY, state.hero.y, alpha), frameSeconds);
  renderer.render(now / 1000, frameSeconds);
  debug?.record(frameSeconds * 1000, t1 - t0, performance.now() - t1);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
