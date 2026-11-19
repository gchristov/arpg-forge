import type { Game } from '../../../engine/game/game';
import { ASSEMBLY_LIGHTS } from '../levels/upriver';

/**
 * The Assembly upriver waking for the last scene: its windows come on a storey at a time from the ground up, each
 * stuttering as it catches, with a sound per storey, and once the top one is lit it comes awake with a sound of its
 * own. Only Unrecalled lights a building like this, so it's the game's own action, `assemblyWakes` (see EXTENSIONS.md).
 */
const TIMING = { lightsFrom: 2.2, storeyEvery: 0.9 };
/** Each storey takes this long to come up. */
const LIGHT_RISE = 0.6;
const GROUND_LIGHT = { radius: 3.2, intensity: 1.8, colour: 0xffb050 };
/** The Assembly is the only building upriver. */
const ASSEMBLY = 0;

export interface WakingSounds {
  /** A storey catches. */
  light(storey: number): void;
  /** The top storey is lit: the building comes awake. */
  awake(): void;
}

/** How lit something is `t` rise-times after it starts to catch: flickering on and off, then steady. */
const catching = (t: number) => (t <= 0 ? 0 : t < 1 ? (Math.sin(t * 46) > 0 ? t : t * 0.2) : 1);

export class AssemblyWakes {
  private startedAt: number | null = null;
  private lit = 0;
  private awoken: (() => void) | null = null;

  constructor(
    private readonly game: Game,
    private readonly sounds: WakingSounds,
  ) {}

  /** Starts it; resolves once the building is awake. */
  play(now: number): Promise<void> {
    this.startedAt = now;
    return new Promise((done) => (this.awoken = done));
  }

  /** Called every frame: lights the Assembly as far as the moment has got. */
  update(now: number): void {
    if (this.startedAt === null) return;
    const seconds = (now - this.startedAt) / 1000;
    const { renderer } = this.game;
    const storeys = renderer.darkStoreys(ASSEMBLY);
    const since = seconds - TIMING.lightsFrom;
    for (let storey = 0; storey < storeys; storey++) {
      const t = (since - storey * TIMING.storeyEvery) / LIGHT_RISE;
      if (t <= 0) break;
      if (storey >= this.lit) {
        this.lit = storey + 1;
        this.sounds.light(storey);
      }
      const amount = catching(t);
      renderer.lightWindows(ASSEMBLY, storey, amount);
      if (storey === 0) {
        for (const light of ASSEMBLY_LIGHTS) renderer.glow(light.x, light.y, GROUND_LIGHT.radius, GROUND_LIGHT.colour, GROUND_LIGHT.intensity * amount);
      }
    }
    const allLit = TIMING.lightsFrom + Math.max(0, storeys - 1) * TIMING.storeyEvery + LIGHT_RISE;
    if (seconds >= allLit && this.awoken) {
      this.sounds.awake();
      this.awoken();
      this.awoken = null;
    }
  }
}
