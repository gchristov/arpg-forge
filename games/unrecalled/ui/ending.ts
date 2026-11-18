import type { Game } from '../../../engine/game/game';
import { FOUNDRY_2_LIGHTS, FOUNDRY_2_VIEW } from '../levels/upriver';

/**
 * When each beat lands, in seconds from arriving upriver: the picture fades up from black on empty ground below
 * Foundry 2, the camera drifts up to it standing dark, its windows come on a storey at a time from the ground up, it
 * shudders awake, its speakers speak and the salvager answers, and once they've said their piece the closing card
 * fades in.
 */
const TIMING = { panFrom: 0.6, panSeconds: 5, lightsFrom: 6, storeyEvery: 0.9, online: 1.4, card: 1.2 };
/** How close the camera comes as it pans, from the empty ground to Foundry 2 whole, towers and all, even on a phone. */
const CLOSENESS = { from: 1, to: 0.55 };
/** Where the camera starts, below Foundry 2, in tiles from where it ends up. */
const PAN_FROM = { x: 0, y: 9 };
/** Each storey takes this long to come up, stuttering as it catches. */
const LIGHT_RISE = 0.6;
const GROUND_LIGHT = { radius: 3.2, intensity: 1.8, colour: 0xffb050 };
/** Foundry 2 is the only building upriver. */
const FOUNDRY_2 = 0;

export interface EndingBeats {
  /** The picture goes cinematic: HUD away, letterbox in, and up from black. */
  begin(): void;
  /** Storey number `storey` catches. */
  light(storey: number): void;
  /** The top storey is lit: the building shudders awake. */
  awake(): void;
  /** Foundry 2 speaks, and the salvager answers. */
  online(): void;
  /** Everything said has been read. */
  quiet(): boolean;
  card(): void;
}

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/** How lit something is `t` rise-times after it starts to catch: flickering on and off, then steady. */
const catching = (t: number) => (t <= 0 ? 0 : t < 1 ? (Math.sin(t * 46) > 0 ? t : t * 0.2) : 1);

/** The last moment of the story, played out over Foundry 2 upriver once the salvager arrives there. */
export class Ending {
  private startedAt: number | null = null;
  private readonly focus = { x: 0, y: 0 };
  private lit = 0;
  private done = new Set<keyof EndingBeats>();
  private quietAt: number | null = null;

  constructor(
    private readonly game: Game,
    private readonly beats: EndingBeats,
  ) {}

  get playing(): boolean {
    return this.startedAt !== null;
  }

  play(now: number): void {
    this.startedAt = now;
    this.focus.x = FOUNDRY_2_VIEW.x + PAN_FROM.x;
    this.focus.y = FOUNDRY_2_VIEW.y + PAN_FROM.y;
    this.game.cameraFocus = this.focus;
    this.once('begin');
  }

  /** Called every frame: moves the camera, lights Foundry 2 as far as the moment has got, and lands each beat in turn. */
  update(now: number): void {
    if (this.startedAt === null) return;
    const seconds = (now - this.startedAt) / 1000;
    const pan = easeInOut(Math.min(1, Math.max(0, (seconds - TIMING.panFrom) / TIMING.panSeconds)));
    this.focus.x = FOUNDRY_2_VIEW.x + PAN_FROM.x * (1 - pan);
    this.focus.y = FOUNDRY_2_VIEW.y + PAN_FROM.y * (1 - pan);
    this.game.renderer.setCloseness(CLOSENESS.from + (CLOSENESS.to - CLOSENESS.from) * pan);

    const { renderer } = this.game;
    const storeys = renderer.darkStoreys(FOUNDRY_2);
    const since = seconds - TIMING.lightsFrom;
    for (let storey = 0; storey < storeys; storey++) {
      const t = (since - storey * TIMING.storeyEvery) / LIGHT_RISE;
      if (t <= 0) break;
      if (storey >= this.lit) {
        this.lit = storey + 1;
        this.beats.light(storey);
      }
      const amount = catching(t);
      renderer.lightWindows(FOUNDRY_2, storey, amount);
      if (storey === 0) {
        for (const light of FOUNDRY_2_LIGHTS) renderer.glow(light.x, light.y, GROUND_LIGHT.radius, GROUND_LIGHT.colour, GROUND_LIGHT.intensity * amount);
      }
    }
    const allLit = TIMING.lightsFrom + Math.max(0, storeys - 1) * TIMING.storeyEvery + LIGHT_RISE;
    if (seconds >= allLit) this.once('awake');
    if (seconds >= allLit + TIMING.online) this.once('online');
    if (this.done.has('online') && this.quietAt === null && this.beats.quiet()) this.quietAt = seconds;
    if (this.quietAt !== null && seconds >= this.quietAt + TIMING.card) this.once('card');
  }

  private once(beat: Exclude<keyof EndingBeats, 'light' | 'quiet'>): void {
    if (this.done.has(beat)) return;
    this.done.add(beat);
    this.beats[beat]();
  }
}
