import '@fontsource/alegreya-sans/400.css';
import '@fontsource/alegreya-sans/500.css';
import '@fontsource/alegreya-sans/700.css';
import '@fontsource/cinzel/500.css';
import '@fontsource/cinzel/700.css';
import { Synth } from '../../engine/audio/synth';
import { advance, createFixedLoop } from '../../engine/core/loop';
import { lerp, type Vec2 } from '../../engine/core/math';
import { bindKeys } from '../../engine/input/keys';
import { PointerInput } from '../../engine/input/pointer';
import { DebugOverlay } from '../../engine/render/debug-overlay';
import { ModelLibrary } from '../../engine/render/models';
import { SceneRenderer } from '../../engine/render/scene-renderer';
import { createGameState } from '../../engine/sim/setup';
import { servicePrice } from '../../engine/sim/interaction';
import { currentLevel, type Actor, type Command, type SimEvent } from '../../engine/sim/state';
import { step } from '../../engine/sim/step';
import { ScreenFade } from '../../engine/ui/fade';
import { WorldLabels, type Project } from '../../engine/ui/world-labels';
import { tileIndex } from '../../engine/world/tile-map';
import { ashenHollowLook, MODEL_URLS } from './art/look';
import { ashenHollowSounds } from './audio/sounds';
import { ENEMIES } from './content/enemies';
import { BOSS_DEFEATED_STEP, dialogueFor, NPCS } from './content/story';
import { Prop } from './content/tiles';
import { ashenHollowContent } from './content/world';
import { DialogBox } from './ui/dialog';
import { Hud } from './ui/hud';

const WALK_MARKER = 0xe8d6a6;
const TARGET_MARKER = 0xff5a4a;
const FADE_SECONDS = 0.3;
/** The prototype measured heights in pixels; this many make one tile. */
const PX = 1 / 39.2;
/** Taps within this many pixels (at zoom 1) of an enemy's body pick it. */
const TAP_REACH_PX = 34;
const HIT_FLASH_SECONDS = 0.12;
/** Each chimney puffs this often. */
const SMOKE_SECONDS = 1.6;
const HERO_FLASH_SECONDS = 0.15;

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const models = new ModelLibrary();
const renderer = new SceneRenderer(canvas, ashenHollowLook, models);
/** Models load behind the title screen; the game can start once they're in. */
const modelsLoaded = models.load(MODEL_URLS);
const pointer = new PointerInput(canvas);
const fade = new ScreenFade(document.body, FADE_SECONDS);
const labels = new WorldLabels(document.body);
const synth = new Synth();
const sfx = ashenHollowSounds(synth);
const debugMode = new URLSearchParams(location.search).has('debug');
const debug = debugMode ? new DebugOverlay(document.body) : null;
const project: Project = (x, y, height, out) => renderer.screenPosition(x, y, height, out);

const content = ashenHollowContent();
/** `#crypt` and the like start in that level, to get straight to it when testing. */
const jumpTo = location.hash.slice(1);
const startLevel = content.levels.some((l) => l.level.id === jumpTo) ? jumpTo : content.startLevel;
const state = createGameState(content, (Math.random() * 2 ** 32) >>> 0, startLevel);
const pending: Command[] = [];
const dialog = new DialogBox();
const hud = new Hud((c) => {
  if (c.type === 'attackNearest') dialog.close();
  pending.push(c);
});
/** Holding the pointer keeps walking only when the press started a walk. */
let holdWalks = false;
/** The rules wait behind the title screen until the first tap. */
let started = false;
let nextSmokeAt = 0;
/** Seconds left of each actor's hit flash, by id. */
const flashes = new Map<number, number>();
const screenPoint: Vec2 = { x: 0, y: 0 };

/** With `?debug`, scripts such as browser tests can read the state and send commands. */
if (debugMode) Object.assign(window, { game: { state, send: (c: Command) => pending.push(c), start } });

const $ = (id: string): HTMLElement => document.getElementById(id)!;

async function start(): Promise<void> {
  if (started) return;
  await modelsLoaded;
  if (started) return;
  started = true;
  synth.unlock();
  $('title').hidden = true;
  hud.banner('Ashen Hollow', 'Speak to Elder Maren in the square.', 3);
}

$('title').addEventListener('pointerdown', (e) => {
  e.preventDefault();
  void start();
});
const goLabel = document.querySelector<HTMLElement>('#title .go');
if (goLabel) {
  const ready = goLabel.textContent;
  goLabel.textContent = 'Loading…';
  void modelsLoaded.then(() => {
    goLabel.textContent = ready;
    showCurrentLevel();
  });
}
$('mute').addEventListener('pointerdown', (e) => {
  e.preventDefault();
  e.stopPropagation();
  synth.unlock();
  synth.muted = !synth.muted;
  $('waves').style.display = synth.muted ? 'none' : '';
});
document.addEventListener('pointerdown', () => synth.unlock(), { capture: true });

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
  renderer.effects.clearDecals();
  renderer.follow(state.hero.x, state.hero.y, 0, true);
}

/**
 * Turns a tap into a command, in the prototype's order: enemies, NPCs, buildings, the chest, doorways, then the
 * ground. Any tap closes an open dialogue.
 */
function commandForTap(x: number, y: number): Command | null {
  if (state.transition) return null;
  if (state.hero.dead) return { type: 'respawn' };
  dialog.close();
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
  for (const n of ls.npcs) {
    const p = renderer.screenPosition(n.x, n.y, 18 * PX, screenPoint);
    if (Math.hypot(p.x - x, p.y - y) < TAP_REACH_PX * renderer.zoom) return { type: 'talk', npcId: n.id };
  }
  const picked = renderer.pick(x, y);
  if (!picked) return null;
  if ('structure' in picked) return { type: 'enterStructure', index: picked.structure };
  const { map } = ls.level;
  const tx = Math.floor(picked.ground.x);
  const ty = Math.floor(picked.ground.y);
  const chest = ls.containers.findIndex((c) => c.tx === tx && c.ty === ty && !c.opened);
  if (chest >= 0) return { type: 'open', index: chest };
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

/** Ashen Hollow's sounds for the rules' events, as in the prototype. */
function playSounds(events: SimEvent[]): void {
  const heroHurt = events.some((e) => e.type === 'HeroHurt');
  for (const e of events) {
    switch (e.type) {
      case 'Swung':
        if (e.actorId === state.hero.id || !heroHurt) sfx.swing();
        break;
      case 'EnemyDamaged': {
        const kind = currentLevel(state).enemies.find((en) => en.id === e.enemyId)?.kind;
        if (kind === 'goblin') sfx.hit();
        else sfx.bone();
        break;
      }
      case 'HeroHurt':
        sfx.hurt();
        break;
      case 'BlastCast':
        sfx.fire();
        break;
      case 'Exploded':
        sfx.boom();
        break;
      case 'PickedUp':
        sfx.coin();
        break;
      case 'Healed':
        sfx.potion();
        break;
      case 'LevelUp':
        sfx.level();
        break;
      case 'TransitionStarted':
        sfx.door();
        break;
      case 'HeroDied':
        sfx.die();
        break;
      case 'ShotFired':
        sfx.arrow();
        break;
      case 'EnemyAlerted':
        sfx.alert();
        break;
      case 'SlamLanded':
        sfx.slam();
        break;
      case 'ContainerOpened':
        sfx.chest();
        break;
      case 'Refused':
        if (e.reason !== 'fullHealth') sfx.deny();
        break;
      case 'ServiceUsed': {
        const npc = currentLevel(state).npcs.find((n) => n.id === e.npcId);
        const service = npc && NPCS[npc.kind]?.services[e.service];
        if (service?.type === 'restore') sfx.potion();
        else if (service?.type === 'sellHealingItem') sfx.coin();
        else sfx.chest();
        break;
      }
      case 'QuestAdvanced':
        if (e.step === BOSS_DEFEATED_STEP) sfx.level();
        break;
    }
  }
}

function react(events: SimEvent[]): void {
  playSounds(events);
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
      case 'Swung':
        if (e.actorId === state.hero.id) renderer.playActor(String(e.actorId), 'attack', state.rules.hero.melee.swingSeconds * 1.6);
        break;
      case 'BlastCast':
        renderer.playActor(String(state.hero.id), 'cast', 0.45);
        break;
      case 'EnemyDamaged': {
        renderer.playActor(String(e.enemyId), 'hit');
        const scale = scaleOf(e.enemyId);
        labels.text(e.x, e.y, 40 * PX * scale, String(e.amount), e.crit ? '#ffd25a' : '#f3ead6', e.crit ? 20 : 15);
        flashes.set(e.enemyId, HIT_FLASH_SECONDS);
        renderer.shake(e.crit ? 0.18 : 0.08);
        break;
      }
      case 'HeroHurt':
        renderer.playActor(String(state.hero.id), 'hit');
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
      case 'EnemyKilled': {
        const scale = ENEMIES[e.kind]?.scale ?? 1;
        if (e.kind === 'goblin') renderer.effects.decal(e.x, e.y, 0.35 * scale, 0x4a0808, 0.75, 40);
        else renderer.effects.decal(e.x, e.y, 0.3 * scale, 0xd8d0b8, 0.55, 40);
        break;
      }
      case 'Exploded':
        renderer.effects.decal(e.x, e.y, 0.8, 0x120a06, 0.7, 12);
        renderer.effects.flash(e.x, e.y, e.radius, 0xff9a3a, 0.35);
        renderer.shake(0.22);
        break;
      case 'SlamWarned':
        renderer.playActor(String(e.enemyId), 'cast', 1.0);
        labels.text(e.x, e.y, 70 * PX, '!', '#c77dff', 24);
        break;
      case 'SlamLanded':
        renderer.effects.decal(e.x, e.y, e.radius, 0x24123a, 0.7, 8);
        renderer.effects.flash(e.x, e.y, e.radius, 0xb98cff, 0.5);
        renderer.shake(0.45);
        break;
      case 'Summoned':
        hud.banner('The dead answer his call', '', 2.2);
        break;
      case 'LevelUp':
        hud.banner(`Level ${e.level}`, 'Stronger, and fully healed.');
        break;
      case 'Talked':
        showDialogue(e.npcId, e.questBefore);
        break;
      case 'ServiceUsed':
        reactToService(e.npcId, e.service, e.x, e.y);
        break;
      case 'PickedUp':
        if (e.kind === 'gold') labels.text(e.x, e.y, 30 * PX, `+${e.amount} gold`, '#ffd25a', 13);
        else labels.text(e.x, e.y, 30 * PX, '+1 potion', '#ff8a96', 13);
        break;
      case 'QuestAdvanced':
        if (e.step === BOSS_DEFEATED_STEP) {
          setTimeout(() => hud.banner('The Bone Lord is destroyed', 'Ashen Hollow is safe. The wilds still stir.', 4.5), 600);
        }
        break;
      case 'HeroDied':
        dialog.close();
        hud.banner('You have fallen', 'Tap to rise again in the village.', Infinity);
        break;
      case 'HeroRespawned':
        hud.hideBanner();
        if (e.goldLost) setTimeout(() => hud.banner('Ashen Hollow', `${e.goldLost} gold lost.`), 400);
        break;
    }
  }
}

/** Opens an NPC's dialogue, with each service's price and whether the hero can afford it. */
function showDialogue(npcId: number, questBefore: number): void {
  const npc = currentLevel(state).npcs.find((n) => n.id === npcId);
  const d = npc && dialogueFor(npc.kind, questBefore, state.quest);
  if (!npc || !d) return;
  const services = NPCS[npc.kind]?.services ?? [];
  dialog.open(
    npcId,
    d.title,
    d.text,
    d.options.map((o) => {
      const service = o.service === undefined ? undefined : services[o.service];
      const price = service ? servicePrice(state.hero, service) : 0;
      return {
        label: o.label,
        ...(o.tag ? { tag: o.tag(price) } : {}),
        disabled: state.hero.gold < price,
        onChoose: () => {
          if (o.service === undefined) dialog.close();
          else pending.push({ type: 'useService', npcId, service: o.service });
        },
      };
    }),
  );
}

/** After a purchase: resting closes the dialogue, other services refresh it with the new prices. */
function reactToService(npcId: number, index: number, x: number, y: number): void {
  const npc = currentLevel(state).npcs.find((n) => n.id === npcId);
  const service = npc && NPCS[npc.kind]?.services[index];
  if (!service) return;
  if (service.type === 'restore') {
    labels.text(x, y, 46 * PX, 'Rested', '#7dff8a', 15);
    dialog.close();
    return;
  }
  if (service.type === 'upgradeMelee') labels.text(x, y, 46 * PX, 'Blade honed', '#ffd25a', 15);
  if (dialog.npcId === npcId) showDialogue(npcId, state.quest);
}

function drawActor(actor: Actor & { dead?: boolean }, alpha: number, fade = 1): void {
  renderer.setActor(
    String(actor.id), actor.kind,
    lerp(actor.prevX, actor.x, alpha), lerp(actor.prevY, actor.y, alpha),
    actor.facingX, actor.facingY,
    { moving: actor.moving, dead: Boolean(actor.dead), flash: (flashes.get(actor.id) ?? 0) > 0 ? 1 : 0, fade },
  );
}

/** Enemies seen winding up an attack, so each wind-up starts its attack animation once. */
const windingUp = new Set<number>();

/** Starts an enemy's attack animation as its wind-up begins, timed so the blow lands as the attack does. */
function animateWindUps(): void {
  for (const e of currentLevel(state).enemies) {
    if (e.windUp >= 0 && !windingUp.has(e.id)) {
      windingUp.add(e.id);
      renderer.playActor(String(e.id), 'attack', (ENEMIES[e.kind]?.windUp ?? 0.4) * 1.8);
    } else if (e.windUp < 0) windingUp.delete(e.id);
  }
}

/** Smoke drifts from each chimney, as in the prototype's village. */
function puffChimneys(): void {
  if (state.time < nextSmokeAt) return;
  nextSmokeAt = state.time + SMOKE_SECONDS;
  for (const s of currentLevel(state).level.structures) {
    if (!s.chimney) continue;
    const look = ashenHollowLook.structure(s.kind);
    const height = look.wallHeight + look.roofHeight + 22 * PX;
    const vx = (0.05 + Math.random() * 0.2) * 0.7;
    const vy = -(0.05 + Math.random() * 0.2) * 0.7;
    renderer.effects.smoke(s.chimney.tx + 0.5, s.chimney.ty + 0.5, height, vx, vy, (10 + Math.random() * 8) * PX, 0x6b6672, 3.5);
  }
}

function drawWorld(alpha: number, frameSeconds: number): void {
  puffChimneys();
  animateWindUps();
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
  renderer.effects.showItems(ls.items, performance.now() / 1000);
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
  if (!started) pending.length = 0;
  const held = heldGroundPoint();
  const t0 = performance.now();
  const alpha = started
    ? advance(loop, frameSeconds, (dt) => react(step(state, { commands: pending.splice(0), held }, dt)))
    : 1;
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
