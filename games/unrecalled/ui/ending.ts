import type { Game } from '../../../engine/game/game';
import { FOUNDRY_2_LIGHTS, FOUNDRY_2_VIEW } from '../levels/upriver';

/**
 * When each beat lands, in seconds from arriving upriver: the picture fades up from black on the salvager, the camera
 * drifts up to Foundry 2 standing dark, its lights come on one by one, it shudders awake, its speakers speak, and the
 * closing card fades in.
 */
const TIMING = { panFrom: 0.6, panSeconds: 5.4, lightsFrom: 6.4, lightEvery: 0.32, online: 1.4, card: 5.2 };
/** Each light takes this long to come up, stuttering as it catches. */
const LIGHT_RISE = 0.45;
const LIGHT = { radius: 3.2, intensity: 1.8, front: 0xffb050, towers: 0x6ad8ff };

export interface EndingBeats {
  /** The picture goes cinematic: HUD away, letterbox in, and up from black. */
  begin(): void;
  /** Light number `index` catches. */
  light(index: number): void;
  /** The last light is on: the building shudders awake. */
  awake(): void;
  online(): void;
  card(): void;
}

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/** The last moment of the story, played out over Foundry 2 upriver once the salvager arrives there. */
export class Ending {
  private startedAt: number | null = null;
  private from = { x: 0, y: 0 };
  private readonly focus = { x: 0, y: 0 };
  private lit = 0;
  private done = new Set<keyof EndingBeats>();

  constructor(
    private readonly game: Game,
    private readonly beats: EndingBeats,
  ) {}

  get playing(): boolean {
    return this.startedAt !== null;
  }

  play(now: number): void {
    this.startedAt = now;
    this.from = { x: this.game.state.hero.x, y: this.game.state.hero.y };
    this.focus.x = this.from.x;
    this.focus.y = this.from.y;
    this.game.cameraFocus = this.focus;
    this.once('begin');
  }

  /** Called every frame: moves the camera, lights Foundry 2 as far as the moment has got, and lands each beat in turn. */
  update(now: number): void {
    if (this.startedAt === null) return;
    const seconds = (now - this.startedAt) / 1000;
    const pan = easeInOut(Math.min(1, Math.max(0, (seconds - TIMING.panFrom) / TIMING.panSeconds)));
    this.focus.x = this.from.x + (FOUNDRY_2_VIEW.x - this.from.x) * pan;
    this.focus.y = this.from.y + (FOUNDRY_2_VIEW.y - this.from.y) * pan;

    const since = seconds - TIMING.lightsFrom;
    FOUNDRY_2_LIGHTS.forEach((light, i) => {
      const t = (since - i * TIMING.lightEvery) / LIGHT_RISE;
      if (t <= 0) return;
      if (i >= this.lit) {
        this.lit = i + 1;
        this.beats.light(i);
      }
      const flicker = t < 1 ? (Math.sin(t * 46) > 0 ? t : t * 0.2) : 1;
      const colour = i < FOUNDRY_2_LIGHTS.length - 2 ? LIGHT.front : LIGHT.towers;
      this.game.renderer.glow(light.x, light.y, LIGHT.radius, colour, LIGHT.intensity * flicker);
    });
    const allLit = TIMING.lightsFrom + FOUNDRY_2_LIGHTS.length * TIMING.lightEvery + LIGHT_RISE;
    if (seconds >= allLit) this.once('awake');
    if (seconds >= allLit + TIMING.online) this.once('online');
    if (seconds >= allLit + TIMING.card) this.once('card');
  }

  private once(beat: Exclude<keyof EndingBeats, 'light'>): void {
    if (this.done.has(beat)) return;
    this.done.add(beat);
    this.beats[beat]();
  }
}
