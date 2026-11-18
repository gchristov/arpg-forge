import { LineQueue } from './line-queue';
import { SPEAKING, Typewriter, type TypingPace, typingSeconds } from './typewriter';

/** Who a line in the feed comes from: a name shown before it, and a voice the game's style sheet can colour. */
export interface Speaker {
  name: string;
  voice: string;
}

/** How long a line stays up once it has typed out, to finish reading it at an easy pace, in seconds. */
const READING = { base: 1.5, perCharacter: 0.025, max: 4 };
const FADE_SECONDS = 0.4;

interface Line {
  text: string;
  from?: Speaker;
}

export interface FeedOptions {
  /** A picture of whoever says a line, or of the hero for their own thoughts, as an image URL, if there is one. */
  portraitOf?: (from?: Speaker) => string | undefined;
  /** How fast a speaker's lines type out, such as a machine's printing faster than a person speaks. */
  paceOf?: (from?: Speaker) => TypingPace;
  /** How many lines the history keeps. */
  keep?: number;
}

/**
 * What happens, in words, so nothing depends on sound: one line at a time in one place, typed out as if spoken, each
 * waiting its turn, so a line never lands on top of another or goes unread. While something else is being read
 * (`hold`), lines wait, and one cut short shows again afterwards. The game's page and style sheet decide how it looks: a
 * line is a `div` with the class `line` and its speaker's voice, or `own` when it has no speaker (such as the hero's own
 * thoughts), with the speaker's name in a `b`; it gets `gone` as it fades. With a portrait it's also `pictured`, with
 * the `img` first and the words in a `div` after it.
 */
export class MessageFeed {
  /** Every line so far, oldest first, up to `keep`, so a line missed can be read again. */
  private readonly said: Line[] = [];
  private readonly lines = new LineQueue<Line>(({ text, from }) =>
    typingSeconds(text, this.paceOf(from)) + Math.min(READING.max, READING.base + text.length * READING.perCharacter));
  private readonly portraitOf: (from?: Speaker) => string | undefined;
  private readonly paceOf: (from?: Speaker) => TypingPace;
  private readonly keep: number;
  private el: HTMLElement | null = null;
  private typing: { typewriter: Typewriter; seconds: number } | null = null;
  private lastUpdate: number | null = null;

  constructor(
    private readonly root: HTMLElement,
    { portraitOf = () => undefined, paceOf = () => SPEAKING, keep = 80 }: FeedOptions = {},
  ) {
    this.portraitOf = portraitOf;
    this.paceOf = paceOf;
    this.keep = keep;
  }

  /** Every line has had its turn: nothing showing and nothing waiting. */
  get idle(): boolean {
    return this.lines.idle;
  }

  /** The lines said so far, oldest first. */
  history(): readonly Line[] {
    return this.said;
  }

  /** Keeps a line for the history without showing it, such as a page of dialogue the player has just read. */
  remember(text: string, from?: Speaker): void {
    this.said.push(from ? { text, from } : { text });
    if (this.said.length > this.keep) this.said.shift();
  }

  /** Queues a line to show once those before it have had their turn. */
  add(text: string, from?: Speaker): void {
    this.remember(text, from);
    this.lines.push(from ? { text, from } : { text });
  }

  /** While held, nothing shows; a line cut short shows again afterwards. */
  hold(held: boolean): void {
    if (this.lines.hold(held)) {
      this.el?.remove();
      this.el = null;
      this.typing = null;
    }
  }

  /** Called every frame with the time in milliseconds: retires the line showing once it's been read, and shows the next. */
  update(now: number): void {
    const seconds = this.lastUpdate === null ? 0 : (now - this.lastUpdate) / 1000;
    this.lastUpdate = now;
    const { retired, shown } = this.lines.tick(seconds);
    if (this.typing && !this.typing.typewriter.done) this.typing.typewriter.update((this.typing.seconds += seconds));
    if (retired && this.el) {
      const el = this.el;
      el.classList.add('gone');
      window.setTimeout(() => el.remove(), FADE_SECONDS * 1000);
      this.el = null;
      this.typing = null;
    }
    if (shown) this.show(shown);
  }

  clear(): void {
    this.lines.clear();
    this.el = null;
    this.typing = null;
    this.root.replaceChildren();
  }

  private show(line: Line): void {
    const el = document.createElement('div');
    el.className = line.from ? `line ${line.from.voice}` : 'line own';
    const portrait = this.portraitOf(line.from);
    let words: HTMLElement = el;
    if (portrait) {
      const picture = document.createElement('img');
      picture.src = portrait;
      picture.alt = '';
      words = document.createElement('div');
      el.classList.add('pictured');
      el.append(picture, words);
    }
    if (line.from) {
      const name = document.createElement('b');
      name.textContent = line.from.name;
      words.append(name);
    }
    const text = document.createElement('span');
    words.append(text);
    const typewriter = new Typewriter(text, this.paceOf(line.from));
    typewriter.start(line.text);
    this.typing = { typewriter, seconds: 0 };
    this.root.append(el);
    this.el = el;
  }
}
