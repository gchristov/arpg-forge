import type { Line } from '../content/story';

/** What the homecoming needs from the game to play out. */
export interface HomecomingParts {
  /** The picture goes cinematic and settles on the fire. */
  begin(): void;
  say(lines: Line[]): void;
  /** Every line said has been read. */
  quiet(): boolean;
  /** The salvager walks to the bell and rings it. */
  ringBell(): void;
  rung(): boolean;
  /** The picture fades to black. */
  fadeOut(): void;
  /** The salvager answers the foreman, which moves the story on to its end. */
  answer(): void;
}

export interface HomecomingLines {
  welcome: Line[];
  /** Said once the bell has been rung. */
  afterBell: Line[];
}

const BEATS = { settle: 1.6, afterLines: 0.8, fade: 1.4 };

const wait = (seconds: number) => new Promise<void>((done) => setTimeout(done, seconds * 1000));
const until = (test: () => boolean) => new Promise<void>((done) => {
  const check = () => (test() ? done() : requestAnimationFrame(check));
  check();
});

/**
 * Home at dawn, played out with no input from the player: the town greets the foreman, the salvager rings the bell,
 * the foreman says his piece, and the picture fades out towards the ending.
 */
export class Homecoming {
  playing = false;

  constructor(private readonly parts: HomecomingParts) {}

  async play(lines: HomecomingLines): Promise<void> {
    if (this.playing) return;
    this.playing = true;
    const { parts } = this;
    parts.begin();
    await wait(BEATS.settle);
    parts.say(lines.welcome);
    await until(parts.quiet);
    parts.ringBell();
    await until(parts.rung);
    parts.say(lines.afterBell);
    await until(parts.quiet);
    await wait(BEATS.afterLines);
    parts.fadeOut();
    await wait(BEATS.fade);
    parts.answer();
    this.playing = false;
  }
}
