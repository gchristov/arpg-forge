import { advance, createFixedLoop } from '../../engine/core/loop';
import { lerp } from '../../engine/core/math';
import { PointerInput } from '../../engine/input/pointer';
import { DebugOverlay } from '../../engine/render/debug-overlay';
import { SceneRenderer } from '../../engine/render/scene-renderer';
import { followPath, walkTo, type Walker } from '../../engine/sim/walking';
import { ashenHollowLook } from './art/look';
import { Prop } from './content/tiles';
import { generateVillage } from './levels/village';

const HERO_SPEED = 3.7;
/** While the ground is held, the hero re-targets this often. */
const HOLD_RETARGET_SECONDS = 0.14;
const MARKER_COLOUR = 0xe8d6a6;

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const renderer = new SceneRenderer(canvas, ashenHollowLook);
const pointer = new PointerInput(canvas);
const debug = new URLSearchParams(location.search).has('debug') ? new DebugOverlay(document.body) : null;

const { level } = generateVillage();
const { map } = level;
const isDoorway = (i: number): boolean => map.prop[i] === Prop.Doorway;
const hero: Walker = { x: level.start.x, y: level.start.y, r: 0.28, facingX: 0.6, facingY: -0.8, moving: false, path: null };
let holdTimer = 0;
let previousX = hero.x;
let previousY = hero.y;

const fit = (): void => renderer.resize(innerWidth, innerHeight, devicePixelRatio);
addEventListener('resize', fit);
fit();
renderer.showLevel(level);
renderer.follow(hero.x, hero.y, 0, true);

function step(dt: number): void {
  previousX = hero.x;
  previousY = hero.y;
  const held = pointer.held();
  if (held) {
    holdTimer -= dt;
    if (holdTimer <= 0) {
      holdTimer = HOLD_RETARGET_SECONDS;
      const point = renderer.groundPointAt(held.x, held.y);
      if (point) walkTo(map, hero, point, isDoorway);
    }
  }
  followPath(map, hero, HERO_SPEED, dt);
}

const loop = createFixedLoop();
let last = performance.now();
function frame(now: number): void {
  const frameSeconds = (now - last) / 1000;
  last = now;
  for (const tap of pointer.takeTaps()) {
    const point = renderer.groundPointAt(tap.x, tap.y);
    const spot = point && walkTo(map, hero, point, isDoorway);
    if (spot) renderer.showMarker(spot.x, spot.y, MARKER_COLOUR);
    holdTimer = 0;
  }
  const t0 = performance.now();
  const alpha = advance(loop, frameSeconds, step);
  const t1 = performance.now();
  const x = lerp(previousX, hero.x, alpha);
  const y = lerp(previousY, hero.y, alpha);
  renderer.setActor('hero', 'hero', x, y, hero.facingX, hero.facingY);
  renderer.follow(x, y, frameSeconds);
  renderer.render(now / 1000, frameSeconds);
  debug?.record(frameSeconds * 1000, t1 - t0, performance.now() - t1);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
