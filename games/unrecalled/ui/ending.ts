import type { Game } from '../../../engine/game/game';
import { CRADLE_LIGHTS, CRADLE_VIEW } from '../levels/upriver';

/**
 * When each beat lands, in seconds from arriving upriver: the picture fades up from black on the Cradle standing dark,
 * its windows come on a storey at a time from the ground up, it comes awake with a siren, it speaks, the salvager answers and it
 * reaches upriver, and once they've said their piece the closing card fades in.
 */
const TIMING = { lightsFrom: 2.2, storeyEvery: 0.9, online: 1.4, card: 1.2 };
/** Far enough out to show the Cradle whole, towers and all, even on a phone. */
const CLOSENESS = 0.55;
/** Each storey takes this long to come up, stuttering as it catches. */
const LIGHT_RISE = 0.6;
const GROUND_LIGHT = { radius: 3.2, intensity: 1.8, colour: 0xffb050 };
/** The Cradle is the only building upriver. */
const CRADLE = 0;

export interface EndingBeats {
  /** The picture goes cinematic: HUD away, letterbox in, and up from black. */
  begin(): void;
  /** Storey number `storey` catches. */
  light(storey: number): void;
  /** The top storey is lit: the building comes awake. */
  awake(): void;
  /** The Cradle speaks, the salvager answers, and the Cradle reaches upriver. */
  online(): void;
  /** Everything said has been read. */
  quiet(): boolean;
  card(): void;
}

/** How lit something is `t` rise-times after it starts to catch: flickering on and off, then steady. */
const catching = (t: number) => (t <= 0 ? 0 : t < 1 ? (Math.sin(t * 46) > 0 ? t : t * 0.2) : 1);

/** The last moment of the story, played out over the Cradle upriver once the salvager arrives there. */
export class Ending {
  private startedAt: number | null = null;
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
    // Framed before the picture fades up, so nothing moves but the lights.
    this.game.cutTo(CRADLE_VIEW);
    this.game.renderer.setCloseness(CLOSENESS);
    this.once('begin');
  }

  /** Called every frame: lights the Cradle as far as the moment has got, and lands each beat in turn. */
  update(now: number): void {
    if (this.startedAt === null) return;
    const seconds = (now - this.startedAt) / 1000;
    const { renderer } = this.game;
    const storeys = renderer.darkStoreys(CRADLE);
    const since = seconds - TIMING.lightsFrom;
    for (let storey = 0; storey < storeys; storey++) {
      const t = (since - storey * TIMING.storeyEvery) / LIGHT_RISE;
      if (t <= 0) break;
      if (storey >= this.lit) {
        this.lit = storey + 1;
        this.beats.light(storey);
      }
      const amount = catching(t);
      renderer.lightWindows(CRADLE, storey, amount);
      if (storey === 0) {
        for (const light of CRADLE_LIGHTS) renderer.glow(light.x, light.y, GROUND_LIGHT.radius, GROUND_LIGHT.colour, GROUND_LIGHT.intensity * amount);
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
