import type { Game } from '../../../engine/game/game';
import type { Look } from '../../../engine/render/look';
import { currentLevel } from '../../../engine/sim/state';

/** The screen rumbles this strongly while U-7 cuts, under the jolt of being hit, and this much harder into a machine that's down. */
const CUT_RUMBLE = 0.1;
const DOWNED = { rumble: 2, spray: 0.5 };
/**
 * While U-7 cuts into something that spatters, droplets spurt off about this often, from this share of its height, a
 * burst on this share of spurts.
 */
const SPRAY_SECONDS = 0.065;
const SPRAY_HEIGHT = 0.45;
const SPRAY_BURST = 0.16;

/**
 * While U-7 cuts (`cutting.ts`), the screen rumbles, and droplets fly off what's being cut if it spatters: out of the
 * cut, back past the blade and to the sides, harder and twice as often from a machine that's down. Drawn each frame
 * through the game's `draw` hook.
 */
export class CutSpray {
  private untilSpray = 0;

  constructor(private readonly game: Game, private readonly look: Look) {}

  draw(frameSeconds: number): void {
    const { state, renderer } = this.game;
    const { hero } = state;
    const e = hero.engagedId === null ? undefined : currentLevel(state).enemies.find((en) => en.id === hero.engagedId);
    const downed = hero.weapon === 'chainsaw' && (e?.stunnedFor ?? 0) > 0;
    if (e) renderer.shake(CUT_RUMBLE * (downed ? DOWNED.rumble : 1));
    const look = e && this.look.actor(e.kind);
    if (!e || !look?.spatter) {
      this.untilSpray = 0;
      return;
    }
    this.untilSpray -= frameSeconds;
    const d = Math.hypot(e.x - hero.x, e.y - hero.y) || 1;
    while (this.untilSpray <= 0) {
      // Spurts come unevenly: often one drop, sometimes none, now and then a burst.
      this.untilSpray += SPRAY_SECONDS * (downed ? DOWNED.spray : 1) * (0.4 + Math.random() * 1.2);
      const count = Math.random() < SPRAY_BURST ? 3 + Math.floor(Math.random() * 3) : Math.floor(Math.random() * 2.2);
      // Thrown back out of the cut rather than on through the body, which would hide it.
      const x = e.x - ((e.x - hero.x) / d) * e.r;
      const y = e.y - ((e.y - hero.y) / d) * e.r;
      renderer.spatter.spray(x, y, look.height * SPRAY_HEIGHT, (hero.x - e.x) / d, (hero.y - e.y) / d, look.spatter.colour, count, 1.6);
    }
  }
}
