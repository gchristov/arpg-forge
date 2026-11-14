import { advance, createFixedLoop } from '../../engine/core/loop';
import { lerp, type Vec2 } from '../../engine/core/math';
import { bindKeys } from '../../engine/input/keys';
import { PointerInput } from '../../engine/input/pointer';
import { DebugOverlay } from '../../engine/render/debug-overlay';
import { SceneRenderer } from '../../engine/render/scene-renderer';
import { createGameState } from '../../engine/sim/setup';
import { currentLevel, type Actor, type Command, type SimEvent } from '../../engine/sim/state';
import { step } from '../../engine/sim/step';
import { ScreenFade } from '../../engine/ui/fade';
import { WorldLabels, type Project } from '../../engine/ui/world-labels';
import { tileIndex } from '../../engine/world/tile-map';
import { ashenHollowLook } from './art/look';
import { ENEMIES } from './content/enemies';
import { Prop } from './content/tiles';
import { ashenHollowContent } from './content/world';
import { Hud } from './ui/hud';

const WALK_MARKER = 0xe8d6a6;
const TARGET_MARKER = 0xff5a4a;
const FADE_SECONDS = 0.3;
/** The prototype measured heights in pixels; this many make one tile. */
const PX = 1 / 39.2;
/** Taps within this many pixels (at zoom 1) of an enemy's body pick it. */
const TAP_REACH_PX = 34;
const HIT_FLASH_SECONDS = 0.12;
const HERO_FLASH_SECONDS = 0.15;

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const renderer = new SceneRenderer(canvas, ashenHollowLook);
const pointer = new PointerInput(canvas);
const fade = new ScreenFade(document.body, FADE_SECONDS);
const labels = new WorldLabels(document.body);
const debug = new URLSearchParams(location.search).has('debug') ? new DebugOverlay(document.body) : null;
const project: Project = (x, y, height, out) => renderer.screenPosition(x, y, height, out);

const content = ashenHollowContent();
/** `#crypt` and the like start in that level, to get straight to it when testing. */
const jumpTo = location.hash.slice(1);
const startLevel = content.levels.some((l) => l.level.id === jumpTo) ? jumpTo : content.startLevel;
const state = createGameState(content, (Math.random() * 2 ** 32) >>> 0, startLevel);
const pending: Command[] = [];
const hud = new Hud((c) => pending.push(c));
/** Holding the pointer keeps walking only when the press started a walk. */
let holdWalks = false;
/** Seconds left of each actor's hit flash, by id. */
const flashes = new Map<number, number>();
const screenPoint: Vec2 = { x: 0, y: 0 };

bindKeys({
  '1': () => pending.push({ type: 'heal' }),
  '2': () => pending.push({ type: 'attackNearest' }),
  ' ': () => pending.push({ type: 'attackNearest' }),
  '3': () => pending.push({ type: 'blast' }),
});

const fit = (): void => renderer.resize(innerWidth, innerHeight, devicePixelRatio);
addEventListener('resize', fit);
fit();
showCurrentLevel();

function showCurrentLevel(): void {
  renderer.showLevel(currentLevel(state).level);
  renderer.clearActors();
  renderer.follow(state.hero.x, state.hero.y, 0, true);
}

/** Turns a tap into a command, in the prototype's order: enemies, then buildings, then doorways, then ground. */
function commandForTap(x: number, y: number): Command | null {
  if (state.transition) return null;
  if (state.hero.dead) return { type: 'respawn' };
  const ls = currentLevel(state);
  let best: { id: number; d: number } | null = null;
  for (const e of ls.enemies) {
    if (e.dead) continue;
    const scale = ENEMIES[e.kind]?.scale ?? 1;
    const p = renderer.screenPosition(e.x, e.y, 18 * PX * scale, screenPoint);
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < TAP_REACH_PX * renderer.zoom * Math.max(1, scale * 0.9) && (!best || d < best.d)) best = { id: e.id, d };
  }
  if (best) return { type: 'attack', enemyId: best.id };
  const picked = renderer.pick(x, y);
  if (!picked) return null;
  if ('structure' in picked) return { type: 'enterStructure', index: picked.structure };
  const { map } = ls.level;
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

const scaleOf = (enemyId: number): number => {
  const e = currentLevel(state).enemies.find((candidate) => candidate.id === enemyId);
  return (e && ENEMIES[e.kind]?.scale) ?? 1;
};

const REFUSALS = {
  noResource: ['Not enough mana', '#8fb0ff'],
  noHealingItems: ['No potions', '#ff8a7a'],
  fullHealth: ['Already healthy', '#e0d3b5'],
} as const;

function react(events: SimEvent[]): void {
  for (const e of events) {
    switch (e.type) {
      case 'WalkTargetSet':
        renderer.showMarker(e.x, e.y, WALK_MARKER);
        break;
      case 'TargetSet':
        renderer.showMarker(e.x, e.y, TARGET_MARKER);
        break;
      case 'TransitionStarted':
        fade.toBlack();
        break;
      case 'EnteredLevel': {
        showCurrentLevel();
        fade.fromBlack();
        const { level } = currentLevel(state);
        if (!state.hero.dead && events.every((other) => other.type !== 'HeroRespawned')) hud.banner(level.name, level.subtitle, 1.8);
        break;
      }
      case 'EnemyDamaged': {
        const scale = scaleOf(e.enemyId);
        labels.text(e.x, e.y, 40 * PX * scale, String(e.amount), e.crit ? '#ffd25a' : '#f3ead6', e.crit ? 20 : 15);
        flashes.set(e.enemyId, HIT_FLASH_SECONDS);
        renderer.shake(e.crit ? 0.18 : 0.08);
        break;
      }
      case 'HeroHurt':
        labels.text(e.x, e.y, 46 * PX, `-${e.amount}`, '#ff5a4a', 15);
        flashes.set(state.hero.id, HERO_FLASH_SECONDS);
        renderer.shake(0.25);
        hud.flashHurt();
        break;
      case 'Healed':
        labels.text(e.x, e.y, 46 * PX, `+${e.amount}`, '#7dff8a', 16);
        break;
      case 'Refused': {
        const [text, colour] = REFUSALS[e.reason];
        labels.text(e.x, e.y, 50 * PX, text, colour, 13);
        break;
      }
      case 'Exploded':
        renderer.effects.flash(e.x, e.y, e.radius, 0xff9a3a, 0.35);
        renderer.shake(0.22);
        break;
      case 'SlamWarned':
        labels.text(e.x, e.y, 70 * PX, '!', '#c77dff', 24);
        break;
      case 'SlamLanded':
        renderer.effects.flash(e.x, e.y, e.radius, 0xb98cff, 0.5);
        renderer.shake(0.45);
        break;
      case 'Summoned':
        hud.banner('The dead answer his call', '', 2.2);
        break;
      case 'LevelUp':
        hud.banner(`Level ${e.level}`, 'Stronger, and fully healed.');
        break;
      case 'HeroDied':
        hud.banner('You have fallen', 'Tap to rise again in the village.', Infinity);
        break;
      case 'HeroRespawned':
        hud.hideBanner();
        if (e.goldLost) setTimeout(() => hud.banner('Ashen Hollow', `${e.goldLost} gold lost.`), 400);
        break;
    }
  }
}

function drawActor(actor: Actor, alpha: number, fadeShare = 1): void {
  const flash = flashes.get(actor.id) ?? 0;
  renderer.setActor(
    String(actor.id), actor.kind,
    lerp(actor.prevX, actor.x, alpha), lerp(actor.prevY, actor.y, alpha),
    actor.facingX, actor.facingY,
    flash > 0 ? 1 : 0, fadeShare,
  );
}

function drawWorld(alpha: number, frameSeconds: number): void {
  for (const [id, left] of flashes) {
    if (left - frameSeconds <= 0) flashes.delete(id);
    else flashes.set(id, left - frameSeconds);
  }
  const ls = currentLevel(state);
  drawActor(state.hero, alpha);
  for (const n of ls.npcs) drawActor(n, alpha);
  labels.beginBars();
  for (const e of ls.enemies) {
    drawActor(e, alpha, e.dead ? Math.max(0, 1 - e.deadFor) : 1);
    const type = ENEMIES[e.kind]!;
    if (!e.dead && !type.boss && (e.hp < e.maxHp || e.id === state.hero.targetId)) {
      const x = lerp(e.prevX, e.x, alpha);
      const y = lerp(e.prevY, e.y, alpha);
      labels.bar(project, x, y, (44 * type.scale + 6) * PX, e.hp / e.maxHp, 28 * Math.max(1, type.scale * 0.8) * renderer.zoom);
    }
  }
  labels.endBars();
  renderer.effects.showProjectiles(state.projectiles, alpha);
  renderer.effects.showTelegraphs(state.telegraphs);
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
  drawWorld(alpha, frameSeconds);
  renderer.follow(lerp(state.hero.prevX, state.hero.x, alpha), lerp(state.hero.prevY, state.hero.y, alpha), frameSeconds);
  renderer.render(now / 1000, frameSeconds);
  labels.update(project, frameSeconds);
  hud.update(state);
  debug?.record(frameSeconds * 1000, t1 - t0, performance.now() - t1);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
