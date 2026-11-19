import { lerp } from '../../../engine/core/math';
import type { Game } from '../../../engine/game/game';
import type { Look } from '../../../engine/render/look';
import { currentLevel } from '../../../engine/sim/state';
import { POOL, ScanBeams, scanStrength, type ScanView } from './scan-beams';

/** A scan lights the ground round the body it looks over this far, this brightly at its height. */
const SCAN_GLOW = { radius: 1.4, intensity: 0.9 };

/**
 * Beams from the calm machines looking U-7 over (`calm-machines.ts`), drawn each frame through the game's `draw` hook,
 * from the eye of each machine kind that has one in `eyeHeights`.
 */
export class MachineScans {
  private readonly beams: ScanBeams;
  /** Reused each frame for the machines scanning the hero. */
  private readonly scans: ScanView[] = Array.from({ length: POOL }, () => ({
    fromX: 0, fromY: 0, fromHeight: 0, x: 0, y: 0, height: 0, radius: 0, progress: 0,
  }));

  constructor(
    private readonly game: Game,
    private readonly look: Look,
    /** The height of the eye the beam comes from, in tiles, by machine kind. */
    private readonly eyeHeights: Readonly<Record<string, number>>,
    private readonly colour: number,
  ) {
    this.beams = new ScanBeams(game.renderer, colour);
  }

  draw(alpha: number): void {
    const { state, renderer, view } = this.game;
    const hero = this.look.actor(state.hero.kind);
    let count = 0;
    for (const e of currentLevel(state).enemies) {
      const eye = this.eyeHeights[e.kind];
      const progress = e.memory.scan;
      if (progress === undefined || e.dead || eye === undefined || view.sight.of(e.id) < 0.5 || count >= POOL) continue;
      const s = this.scans[count++]!;
      s.fromX = lerp(e.prevX, e.x, alpha);
      s.fromY = lerp(e.prevY, e.y, alpha);
      s.fromHeight = eye;
      s.x = lerp(state.hero.prevX, state.hero.x, alpha);
      s.y = lerp(state.hero.prevY, state.hero.y, alpha);
      s.height = hero.height;
      s.radius = hero.radius * 1.3;
      s.progress = progress;
      renderer.glow(s.x, s.y, SCAN_GLOW.radius, this.colour, SCAN_GLOW.intensity * scanStrength(progress));
    }
    this.beams.show(this.scans, count);
  }
}
