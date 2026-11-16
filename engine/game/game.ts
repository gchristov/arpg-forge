import { advance, createFixedLoop } from '../core/loop';
import { lerp, type Vec2 } from '../core/math';
import { bindKeys } from '../input/keys';
import { PointerInput } from '../input/pointer';
import type { Platform } from '../platform/platform';
import { webPlatform } from '../platform/web';
import { DebugOverlay } from '../render/debug-overlay';
import type { Look } from '../render/look';
import { drawingQuality } from '../render/drawing-quality';
import { ModelLibrary } from '../render/models';
import { SceneRenderer } from '../render/scene-renderer';
import type { GameContent } from '../sim/content';
import { createGameState } from '../sim/setup';
import { currentLevel, type Command, type GameState, type SimEvent } from '../sim/state';
import { step } from '../sim/step';
import { ScreenFade } from '../ui/fade';
import { WorldLabels, type Project } from '../ui/world-labels';
import { tapCommand } from './tap-command';
import { WorldView } from './world-view';

const FADE_SECONDS = 0.3;

export interface GameSetup {
  canvas: HTMLCanvasElement;
  /** Names the game's saved settings, so games on the same site don't share them. */
  saveKey: string;
  content: GameContent;
  look: Look;
  /** URLs of the game's models, by name. */
  models: Record<string, string>;
}

/** What the game does on top of what the engine shows: sounds, text, its HUD and dialogue. */
export interface GameHooks {
  /** Called with each step's events, after the engine has shown them in the world. */
  react(events: SimEvent[]): void;
  /** Called every frame after drawing, for example to update the HUD. */
  update(state: GameState): void;
  /** Called when play starts, after the title screen. */
  onStart?(): void;
  /** Called when a tap on the world is about to become a command, for example to close a dialogue. */
  onWorldTap?(): void;
}

/**
 * A running game: the rules at a fixed rate, the world drawn every frame, and taps, held pointers and keys turned
 * into commands. The rules wait until `start`, typically from a title screen, and models load meanwhile.
 *
 * With `?debug` in the page URL it shows frame timings and exposes `window.game` (`state`, `send`, `start`) for
 * scripted checks. `#<level id>` starts in that level, `?debug&lights=N` scatters N extra lights and
 * `?debug&resolution=N` draws N pixels per screen point.
 */
export class Game {
  readonly state: GameState;
  readonly renderer: SceneRenderer;
  readonly labels: WorldLabels;
  readonly platform: Platform;
  readonly view: WorldView;
  /** Resolves once every model has loaded or failed; the game can start then. */
  readonly modelsLoaded: Promise<void>;
  readonly project: Project;
  private readonly pointer: PointerInput;
  private readonly pending: Command[] = [];
  private readonly debug: DebugOverlay | null;
  private hooks: GameHooks | null = null;
  private started = false;
  /** Holding the pointer keeps walking only when the press started a walk. */
  private holdWalks = false;

  constructor(setup: GameSetup) {
    const params = new URLSearchParams(location.search);
    const debugMode = params.has('debug');
    const models = new ModelLibrary();
    const resolution = debugMode ? Number(params.get('resolution')) || 0 : 0;
    const quality = () => (resolution ? { pixelRatio: resolution, antialias: true } : drawingQuality(devicePixelRatio));
    // Antialiasing is fixed when the drawing surface is made; the pixel density follows the browser's zoom.
    this.renderer = new SceneRenderer(setup.canvas, setup.look, models, quality().antialias);
    this.modelsLoaded = models.load(setup.models);
    this.pointer = new PointerInput(setup.canvas);
    this.labels = new WorldLabels(document.body);
    this.platform = webPlatform(setup.saveKey);
    this.debug = debugMode ? new DebugOverlay(document.body) : null;
    this.project = (x, y, height, out) => this.renderer.screenPosition(x, y, height, out);

    const { content } = setup;
    const jumpTo = location.hash.slice(1);
    const startLevel = content.levels.some((l) => l.level.id === jumpTo) ? jumpTo : content.startLevel;
    this.state = createGameState(content, (Math.random() * 2 ** 32) >>> 0, startLevel);
    if (debugMode) this.scatterLights(Number(params.get('lights') ?? 0));
    const fade = new ScreenFade(document.body, FADE_SECONDS);
    this.view = new WorldView(this.state, this.renderer, setup.look, this.labels, fade, this.project);

    if (debugMode) Object.assign(window, { game: { state: this.state, send: (c: Command) => this.send(c), start: () => this.start() } });
    // 1 heals, 2 and space attack, and 3 onwards use the skills in order.
    bindKeys({
      '1': () => this.send({ type: 'heal' }),
      '2': () => this.send({ type: 'attackNearest' }),
      ' ': () => this.send({ type: 'attackNearest' }),
      ...Object.fromEntries(content.hero.skills.map((_, slot) => [String(slot + 3), () => this.send({ type: 'useSkill', slot })])),
    });
    const fit = (): void => this.renderer.resize(innerWidth, innerHeight, quality().pixelRatio);
    addEventListener('resize', fit);
    fit();
    this.view.showCurrentLevel();
    // Shown again once models are in, so the level is drawn with them behind the title screen.
    void this.modelsLoaded.then(() => this.view.showCurrentLevel());
  }

  /** Queues a command for the next step, such as one from a HUD button. Ignored until the game starts. */
  send(command: Command): void {
    this.pending.push(command);
  }

  /** Starts drawing and listening to the player, with the game's own reactions. */
  run(hooks: GameHooks): void {
    this.hooks = hooks;
    let last = performance.now();
    const loop = createFixedLoop();
    const frame = (now: number): void => {
      const frameSeconds = (now - last) / 1000;
      last = now;
      this.frame(loop, now, frameSeconds);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  /** Starts play once the models have loaded. */
  async start(): Promise<void> {
    if (this.started) return;
    await this.modelsLoaded;
    if (this.started) return;
    this.started = true;
    this.hooks?.onStart?.();
  }

  private frame(loop: ReturnType<typeof createFixedLoop>, now: number, frameSeconds: number): void {
    const { state, renderer, debug } = this;
    for (const tap of this.pointer.takeTaps()) {
      const command = this.commandForTap(tap.x, tap.y);
      this.holdWalks = command?.type === 'walk';
      if (command) this.pending.push(command);
    }
    if (!this.started) this.pending.length = 0;
    const held = this.heldGroundPoint();
    const t0 = performance.now();
    const alpha = this.started
      ? advance(loop, frameSeconds, (dt) => this.react(step(state, { commands: this.pending.splice(0), held }, dt)))
      : 1;
    const t1 = performance.now();
    this.view.draw(alpha, frameSeconds, loop.stepSeconds);
    renderer.follow(lerp(state.hero.prevX, state.hero.x, alpha), lerp(state.hero.prevY, state.hero.y, alpha), frameSeconds);
    renderer.render(now / 1000, frameSeconds);
    this.labels.update(this.project, frameSeconds);
    this.hooks?.update(state);
    if (debug) {
      const { calls, triangles } = renderer.stats();
      const alive = currentLevel(state).enemies.filter((e) => !e.dead).length;
      debug.note(`${calls} draw calls  ${(triangles / 1000).toFixed(0)}k triangles  ${alive} enemies`);
    }
    debug?.record(frameSeconds * 1000, t1 - t0, performance.now() - t1);
  }

  private react(events: SimEvent[]): void {
    if (this.debug) for (const e of events) this.debug.mark(e.type);
    this.view.react(events);
    this.hooks?.react(events);
  }

  /** While the rules move between levels taps do nothing, and once the hero has fallen any tap rises again. */
  private commandForTap(x: number, y: number): Command | null {
    if (this.state.transition) return null;
    if (this.state.hero.dead) return { type: 'respawn' };
    this.hooks?.onWorldTap?.();
    return tapCommand(this.state, this.renderer, (kind) => this.view.scaleOf(kind), x, y, (id) => this.view.sight.of(id) > 0.5);
  }

  private heldGroundPoint(): Vec2 | null {
    const held = this.pointer.held();
    if (!held || !this.holdWalks) return null;
    const picked = this.renderer.pick(held.x, held.y);
    return picked && 'ground' in picked ? picked.ground : null;
  }

  /** Scatters extra flickering lights over the start level, to check lighting cost stays flat. */
  private scatterLights(count: number): void {
    const { map, lights } = currentLevel(this.state).level;
    for (let i = 0; i < count; i++) {
      const colour = ['warm', 'purple', 'cold'][i % 3]!;
      lights.push({ x: Math.random() * map.width, y: Math.random() * map.height, radius: 2.5, intensity: 0.8, colour, flicker: 1, seed: i });
    }
  }
}
