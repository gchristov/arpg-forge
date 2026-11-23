import type { Game } from '../../../engine/game/game';
import { currentLevel, type SimEvent } from '../../../engine/sim/state';
import { STRIKE_SIGNAL } from './blaster';

/** How high U-7's hand is when it fires, and how high on a machine the beam lands, in tiles. */
const HAND_HEIGHT = 0.75;
const HIT_HEIGHT = 0.5;
/** The beam is redrawn as a fresh crackling stroke this often, each lasting a little longer, so it never gaps. */
const BEAM_SECONDS = 0.05;
/** A downed machine throws a spark about this often. */
const SPARK_SECONDS = 0.18;

/**
 * Draws U-7's blaster (`blaster.ts`): a crackling beam from its hand to the machine it's held on, a flash and a jolt
 * for a powered strike, and sparks off machines that are down.
 */
export class BlastEffects {
  private untilBeam = 0;
  private untilSpark = 0;

  constructor(private readonly game: Game, private readonly colour: number) {}

  react(events: SimEvent[]): void {
    const { renderer, state } = this.game;
    for (const e of events) {
      if (e.type !== 'Signal' || e.name !== STRIKE_SIGNAL) continue;
      renderer.effects.flash(e.x, e.y, 1.1, this.colour, 0.25);
      renderer.shake(0.3);
      renderer.playActor(String(state.hero.id), 'attack', 0.35);
    }
  }

  draw(frameSeconds: number): void {
    this.drawBeam(frameSeconds);
    this.untilSpark -= frameSeconds;
    if (this.untilSpark > 0) return;
    this.untilSpark = SPARK_SECONDS;
    const { effects } = this.game.renderer;
    for (const e of currentLevel(this.game.state).enemies) {
      if (e.dead || e.stunnedFor <= 0) continue;
      const a = Math.random() * Math.PI * 2;
      effects.arc(e.x, e.y, 0.7, e.x + Math.cos(a) * 0.5, e.y + Math.sin(a) * 0.5, 0.2 + Math.random() * 0.5, this.colour, 0.1, 0, 0.4);
    }
  }

  private drawBeam(frameSeconds: number): void {
    const { state, renderer } = this.game;
    const { hero } = state;
    const target = hero.attackMemory.beaming ? currentLevel(state).enemies.find((e) => e.id === hero.engagedId) : undefined;
    this.untilBeam -= frameSeconds;
    if (!target || this.untilBeam > 0) return;
    this.untilBeam = BEAM_SECONDS;
    renderer.effects.arc(hero.x, hero.y, HAND_HEIGHT, target.x, target.y, HIT_HEIGHT, this.colour, BEAM_SECONDS * 1.6, 0, 0.7);
    renderer.effects.flash(target.x, target.y, 0.4, this.colour, BEAM_SECONDS * 1.6);
  }
}
