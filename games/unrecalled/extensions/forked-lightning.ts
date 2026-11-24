/** A point in the world: along the ground and `h` tiles up. */
export interface Point {
  x: number;
  y: number;
  h: number;
}

/** What draws a single lightning stroke: the engine's `Effects.arc`. */
export type Stroke = (
  fromX: number, fromY: number, fromHeight: number, toX: number, toY: number, toHeight: number,
  colour: number, seconds: number, delay?: number, width?: number,
) => void;

/** A bolt is built from short strokes about this long, so its kinks stay small and its forks start on it. */
const JOINT_SPACING = 0.55;
/** How far a joint strays from the straight line, in tiles, at most. */
const SWAY = 0.32;
/** Chance a fork splits off at each joint of a bolt, and at the middle of a fork. */
const FORK_CHANCE = 0.55;
const SUB_FORK_CHANCE = 0.45;
/** A fork's length in tiles, and how far off the bolt's heading it turns, in radians. */
const FORK_LENGTH: [number, number] = [0.25, 0.7];
const FORK_TURN: [number, number] = [0.45, 1.25];
/** Forks are thinner than what they split from, and fade sooner. */
const FORK_WIDTH = 0.55;
const FORK_LIFE = 0.8;

/**
 * Unrecalled's lightning, with the detail of the EMP's: bolts that kink along their way and throw off thinner forks,
 * which fork again, made of the engine's single strokes. Every stroke is laid afresh, so calling these every few
 * frames makes lightning that crackles and never holds still.
 */
export class ForkedLightning {
  constructor(private readonly stroke: Stroke) {}

  /** A bolt from one point to another, `width` thick, crackling for `seconds`, forking along its way. */
  bolt(from: Point, to: Point, colour: number, seconds: number, width = 1): void {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const flat = Math.hypot(dx, dy) || 1;
    const length = Math.hypot(dx, dy, to.h - from.h);
    const joints = Math.max(2, Math.round(length / JOINT_SPACING));
    // The sway grows to its full size away from the ends, so the bolt leaves and lands where it should.
    const sway = Math.min(SWAY, length * 0.12);
    let prev = from;
    for (let k = 1; k <= joints; k++) {
      const t = k / joints;
      const envelope = k === joints ? 0 : Math.sin(Math.PI * t);
      const side = (Math.random() - 0.5) * 2 * sway * envelope;
      const next = {
        x: from.x + dx * t - (dy / flat) * side,
        y: from.y + dy * t + (dx / flat) * side,
        h: from.h + (to.h - from.h) * t + (Math.random() - 0.5) * sway * envelope,
      };
      this.line(prev, next, colour, seconds, width);
      if (k < joints && Math.random() < FORK_CHANCE) this.fork(next, dx / flat, dy / flat, colour, seconds * FORK_LIFE, width * FORK_WIDTH, true);
      prev = next;
    }
  }

  /** Forks thrown out every way from a point, as from something struck hard. */
  burst(at: Point, colour: number, seconds: number, forks: number, width = 1): void {
    for (let k = 0; k < forks; k++) {
      const a = Math.random() * Math.PI * 2;
      this.fork(at, Math.cos(a), Math.sin(a), colour, seconds, width, true, 1.6);
    }
  }

  /** Short strokes crawling over a body round a point, `radius` tiles across. */
  crawl(at: Point, radius: number, colour: number, seconds: number, strokes: number): void {
    for (let k = 0; k < strokes; k++) {
      const a = Math.random() * Math.PI * 2;
      const b = a + (Math.random() - 0.5) * 2.4;
      const r = radius * (0.5 + Math.random() * 0.5);
      this.stroke(
        at.x + Math.cos(a) * r, at.y + Math.sin(a) * r, at.h + (Math.random() - 0.5) * radius,
        at.x + Math.cos(b) * r, at.y + Math.sin(b) * r, at.h + (Math.random() - 0.5) * radius,
        colour, seconds, 0, 0.5,
      );
    }
  }

  /** A fork from a point, turned off heading (hx, hy); the first may fork once more from its middle. */
  private fork(at: Point, hx: number, hy: number, colour: number, seconds: number, width: number, again: boolean, reach = 1): void {
    const turn = (FORK_TURN[0] + Math.random() * (FORK_TURN[1] - FORK_TURN[0])) * (Math.random() < 0.5 ? -1 : 1);
    const cx = hx * Math.cos(turn) - hy * Math.sin(turn);
    const cy = hx * Math.sin(turn) + hy * Math.cos(turn);
    const length = (FORK_LENGTH[0] + Math.random() * (FORK_LENGTH[1] - FORK_LENGTH[0])) * reach;
    const end = { x: at.x + cx * length, y: at.y + cy * length, h: Math.max(0.05, at.h + (Math.random() - 0.55) * length * 0.8) };
    this.line(at, end, colour, seconds, width);
    if (!again || Math.random() >= SUB_FORK_CHANCE) return;
    const mid = { x: (at.x + end.x) / 2, y: (at.y + end.y) / 2, h: (at.h + end.h) / 2 };
    this.fork(mid, cx, cy, colour, seconds * FORK_LIFE, width * FORK_WIDTH, false, reach * 0.7);
  }

  private line(from: Point, to: Point, colour: number, seconds: number, width: number): void {
    this.stroke(from.x, from.y, from.h, to.x, to.y, to.h, colour, seconds, 0, width);
  }
}
