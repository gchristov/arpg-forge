import type { Game } from '../../../engine/game/game';
import { currentLevel, type SimEvent } from '../../../engine/sim/state';
import { BLOW_SIGNALS } from './blaster';
import { ForkedLightning } from './forked-lightning';

/** The hand U-7 holds out at a machine to fire, by its bone's name, and how high on a machine the beam lands, in tiles. */
const FIRING_HAND = 'hand_l';
const HIT_HEIGHT = 0.5;
/** Where the beam leaves from until U-7's model has loaded: ahead of its middle and up, in tiles. */
const HAND_AHEAD = 0.3;
const HAND_HEIGHT = 0.75;
/** Chance each redraw that a thinner second strand runs alongside the beam. */
const SECOND_STRAND = 0.4;
/** The beam is redrawn as a fresh crackling stroke this often, each lasting a little longer, so it never gaps. */
const BEAM_SECONDS = 0.05;
/**
 * How each blow of a combo looks, in turn: U-7's animation and how long it takes, how big its flash and burst of forks
 * are, how hard the screen shakes, and for how long a discharge runs from the firing hand into the machine. The
 * punches play at about three times their pace, not squeezed to their gaps: their fists are out for only a quarter of
 * each, so faster they'd only flicker, and the next blow cuts in as the last fist pulls back. The last blow snaps into
 * the pose U-7 holds the beam in, one arm thrust out at the machine, and discharges into it.
 */
const BLOWS = [
  { clip: 'Punch', seconds: 0.28, flash: 0.8, forks: 3, shake: 0.15, discharge: 0 },
  { clip: 'PunchCross', seconds: 0.32, flash: 0.9, forks: 4, shake: 0.2, discharge: 0 },
  { clip: 'AimOneHanded', seconds: 0.4, flash: 1.6, forks: 9, shake: 0.45, discharge: 0.1 },
];
/** A downed machine throws a spark about this often. */
const SPARK_SECONDS = 0.18;

/**
 * Draws U-7's blaster (`blaster.ts`): a forked, crackling beam from its hand to the machine it's held on, crawling over
 * it where it lands, a punch with a burst of forks, a flash and a jolt for each blow of a combo, the last the biggest
 * and discharging from the hand like the beam, and sparks off machines that are down.
 */
export class BlastEffects {
  private untilBeam = 0;
  private untilSpark = 0;
  /** The machine a blow is discharging into, and for how much longer. */
  private discharge = { enemyId: -1, seconds: 0 };
  private readonly hand = { x: 0, y: 0, h: 0 };
  private readonly hit = { x: 0, y: 0, h: HIT_HEIGHT };
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
      if (blow.discharge > 0 && e.enemyId !== undefined) this.discharge = { enemyId: e.enemyId, seconds: blow.discharge };
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
    this.discharge.seconds -= frameSeconds;
    const into = this.discharge.seconds > 0 ? this.discharge.enemyId : hero.attackMemory.beaming ? hero.engagedId : null;
    const target = into === null ? undefined : currentLevel(state).enemies.find((e) => e.id === into && !e.dead);
    this.untilBeam -= frameSeconds;
    if (!target || this.untilBeam > 0) return;
    this.untilBeam = BEAM_SECONDS;
    const seconds = BEAM_SECONDS * 1.6;
    const hand = this.hand;
    if (!renderer.actorBone(String(hero.id), FIRING_HAND, hand)) {
      const d = Math.hypot(target.x - hero.x, target.y - hero.y) || 1;
      hand.x = hero.x + ((target.x - hero.x) / d) * HAND_AHEAD;
      hand.y = hero.y + ((target.y - hero.y) / d) * HAND_AHEAD;
      hand.h = HAND_HEIGHT;
    }
    const hit = this.hit;
    hit.x = target.x;
    hit.y = target.y;
    this.lightning.bolt(hand, hit, this.colour, seconds);
    if (Math.random() < SECOND_STRAND) this.lightning.bolt(hand, hit, this.colour, seconds, 0.45);
    this.lightning.crawl(hit, target.r + 0.1, this.colour, seconds, 2);
    renderer.effects.flash(target.x, target.y, 0.4, this.colour, seconds);
    this.lightning.crawl(hand, 0.12, this.colour, seconds, 1);
  }
}
