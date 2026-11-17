import type { Game } from '../../../engine/game/game';
import { FOUNDRY_2_LIGHTS, FOUNDRY_2_VIEW } from '../levels/upriver';

/** How long the camera takes to settle on Foundry 2 before its lights come on, then the beats after. */
const LIGHTS_ON_AFTER = 2.6;
const ONLINE_AFTER = 4.8;
const CARD_AFTER = 8;
/** Each light comes on this long after the one before, and takes this long to reach full brightness. */
const LIGHT_STAGGER = 0.14;
const LIGHT_RISE = 0.35;
const LIGHT = { radius: 3.2, intensity: 1.8, front: 0xffb050, towers: 0x6ad8ff };

/**
 * The last moment: the camera turns from the salvager to Foundry 2 standing dark, its lights come on one after another,
 * its speakers say it's online, and then the closing card.
 */
export class Ending {
  private startedAt: number | null = null;
  private lit = false;
  private spoke = false;
  private carded = false;

  constructor(
    private readonly game: Game,
    private readonly beats: { lightsOn(): void; online(): void; card(): void },
  ) {}

  get playing(): boolean {
    return this.startedAt !== null;
  }

  play(now: number): void {
    this.startedAt = now;
    this.game.cameraFocus = FOUNDRY_2_VIEW;
  }

  /** Called every frame: lights Foundry 2 up as far as the moment has got, and moves on to each beat in turn. */
  update(now: number): void {
    if (this.startedAt === null) return;
    const seconds = (now - this.startedAt) / 1000;
    const since = seconds - LIGHTS_ON_AFTER;
    if (since >= 0 && !this.lit) {
      this.lit = true;
      this.beats.lightsOn();
    }
    FOUNDRY_2_LIGHTS.forEach((light, i) => {
      const t = (since - i * LIGHT_STAGGER) / LIGHT_RISE;
      if (t <= 0) return;
      // A stutter as each one catches, then steady.
      const flicker = t < 1 ? (Math.sin(t * 40) > 0 ? t : t * 0.3) : 1;
      const colour = i < FOUNDRY_2_LIGHTS.length - 2 ? LIGHT.front : LIGHT.towers;
      this.game.renderer.glow(light.x, light.y, LIGHT.radius, colour, LIGHT.intensity * flicker);
    });
    if (seconds >= ONLINE_AFTER && !this.spoke) {
      this.spoke = true;
      this.beats.online();
    }
    if (seconds >= CARD_AFTER && !this.carded) {
      this.carded = true;
      this.beats.card();
    }
  }
}
