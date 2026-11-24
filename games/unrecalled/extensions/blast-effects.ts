import type { Game } from '../../../engine/game/game';
import { currentLevel, type SimEvent } from '../../../engine/sim/state';
import { BLOW_SIGNALS } from './blaster';
import { ForkedLightning } from './forked-lightning';

/** How high U-7's hand is when it fires, how far ahead of its middle, and how high on a machine the beam lands, in tiles. */
const HAND_HEIGHT = 0.75;
const HAND_AHEAD = 0.3;
const HIT_HEIGHT = 0.5;
/** Chance each redraw that a thinner second strand runs alongside the beam. */
const SECOND_STRAND = 0.4;
/** The beam is redrawn as a fresh crackling stroke this often, each lasting a little longer, so it never gaps. */
const BEAM_SECONDS = 0.05;
/**
 * How each blow of a combo looks, in turn: U-7's animation and how long it takes, how big its flash and burst of forks
 * are, and how hard the screen shakes.
 */
const BLOWS = [
  { clip: 'Punch', seconds: 0.14, flash: 0.8, forks: 3, shake: 0.15 },
  { clip: 'PunchCross', seconds: 0.16, flash: 0.9, forks: 4, shake: 0.2 },
  { clip: 'Shoot_OneHanded', seconds: 0.4, flash: 1.6, forks: 9, shake: 0.45 },
];
/** A downed machine throws a spark about this often. */
const SPARK_SECONDS = 0.18;

/**
 * Draws U-7's blaster (`blaster.ts`): a forked, crackling beam from its hand to the machine it's held on, crawling over
 * it where it lands, a punch with a burst of forks, a flash and a jolt for each blow of a combo, the last the biggest, and sparks off machines that are
 * down.
 */
export class BlastEffects {
  private untilBeam = 0;
  private untilSpark = 0;
  private readonly lightning: ForkedLightning;

  constructor(private readonly game: Game, private readonly colour: number) {
    const { effects } = game.renderer;
    this.lightning = new ForkedLightning(effects.arc.bind(effects));
  }

  react(events: SimEvent[]): void {
    const { renderer, state } = this.game;
    for (const e of events) {
      if (e.type !== 'Signal') continue;
      const blow = BLOWS[BLOW_SIGNALS.indexOf(e.name)];
      if (!blow) continue;
      renderer.effects.flash(e.x, e.y, blow.flash, this.colour, 0.25);
      this.lightning.burst({ x: e.x, y: e.y, h: HIT_HEIGHT }, this.colour, 0.2, blow.forks, blow === BLOWS[2] ? 1.3 : 1);
      renderer.shake(blow.shake);
      renderer.playActor(String(state.hero.id), 'attack', blow.seconds, blow.clip);
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
    const seconds = BEAM_SECONDS * 1.6;
    const d = Math.hypot(target.x - hero.x, target.y - hero.y) || 1;
    const hand = { x: hero.x + ((target.x - hero.x) / d) * HAND_AHEAD, y: hero.y + ((target.y - hero.y) / d) * HAND_AHEAD, h: HAND_HEIGHT };
    const hit = { x: target.x, y: target.y, h: HIT_HEIGHT };
    this.lightning.bolt(hand, hit, this.colour, seconds);
    if (Math.random() < SECOND_STRAND) this.lightning.bolt(hand, hit, this.colour, seconds, 0.45);
    this.lightning.crawl(hit, target.r + 0.1, this.colour, seconds, 2);
    renderer.effects.flash(target.x, target.y, 0.4, this.colour, seconds);
    this.lightning.crawl(hand, 0.12, this.colour, seconds, 1);
  }
}
