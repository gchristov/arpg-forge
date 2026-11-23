import type { Game } from '../../../engine/game/game';
import { currentLevel, type SimEvent } from '../../../engine/sim/state';
import { REPEL } from '../content/hero';
import { BLAST_SIGNAL } from './blaster';

/** How high U-7's hand is when it shoots, and how high on a machine shots land, in tiles. */
const HAND_HEIGHT = 0.75;
const HIT_HEIGHT = 0.5;
/** A downed machine throws a spark about this often. */
const SPARK_SECONDS = 0.18;
/** The repel's strokes fan out over its cone, as far as it reaches. */
const REPEL_STROKES = 7;

/**
 * Draws U-7's blaster (`blaster.ts`) and repel: a crackling stroke from its hand to each shot's target, a flash and a
 * jolt for a powered strike, strokes fanning out ahead for the repel, and sparks off machines that are down.
 */
export class BlastEffects {
  private untilSpark = 0;

  constructor(private readonly game: Game, private readonly colour: number) {}

  react(events: SimEvent[]): void {
    const { state, renderer } = this.game;
    const { hero } = state;
    const heroId = String(hero.id);
    for (const e of events) {
      if (e.type === 'Signal' && e.name === BLAST_SIGNAL.shot) {
        renderer.effects.arc(hero.x, hero.y, HAND_HEIGHT, e.x, e.y, HIT_HEIGHT, this.colour, 0.1, 0, 0.7);
        renderer.effects.flash(e.x, e.y, 0.5, this.colour, 0.12);
        renderer.playActor(heroId, 'cast', 0.3);
      } else if (e.type === 'Signal' && e.name === BLAST_SIGNAL.strike) {
        renderer.effects.flash(e.x, e.y, 1.1, this.colour, 0.25);
        renderer.shake(0.3);
        renderer.playActor(heroId, 'attack', 0.35);
      } else if (e.type === 'SkillUsed' && e.skill === 'repel') {
        const facing = Math.atan2(hero.facingY, hero.facingX);
        for (let k = 0; k < REPEL_STROKES; k++) {
          const a = facing + ((k / (REPEL_STROKES - 1)) * 2 - 1) * ((REPEL.arc ?? 0) * Math.PI) / 180;
          const x = hero.x + Math.cos(a) * REPEL.radius;
          const y = hero.y + Math.sin(a) * REPEL.radius;
          renderer.effects.arc(hero.x, hero.y, HAND_HEIGHT, x, y, 0.3, this.colour, 0.18, k * 0.01, 0.8);
        }
        renderer.effects.flash(hero.x + hero.facingX, hero.y + hero.facingY, 1.4, this.colour, 0.2);
        renderer.shake(0.25);
      }
    }
  }

  draw(frameSeconds: number): void {
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
}
