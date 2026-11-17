/** How fast text types out, and how long it rests at the end of a sentence or clause, as someone speaking would. */
export interface TypingPace {
  charactersPerSecond: number;
  sentencePause: number;
  clausePause: number;
}

export const SPEAKING: TypingPace = { charactersPerSecond: 40, sentencePause: 0.3, clausePause: 0.12 };

const pauseAfter = (character: string, pace: TypingPace): number =>
  '.!?…'.includes(character) ? pace.sentencePause : ',;:—'.includes(character) ? pace.clausePause : 0;

/** How many of `text`'s characters have typed out after `seconds`. */
export function charactersTyped(text: string, seconds: number, pace: TypingPace = SPEAKING): number {
  const perCharacter = 1 / pace.charactersPerSecond;
  let t = 0;
  for (let i = 0; i < text.length; i++) {
    t += perCharacter;
    if (t > seconds) return i;
    // A run of stops ("…" or "?!") rests once, after the last.
    const next = text[i + 1];
    if (next === undefined || !pauseAfter(next, pace)) t += pauseAfter(text[i]!, pace);
  }
  return text.length;
}

/** How long `text` takes to type out in full. */
export function typingSeconds(text: string, pace: TypingPace = SPEAKING): number {
  let t = 0;
  for (let i = 0; i < text.length; i++) {
    t += 1 / pace.charactersPerSecond;
    const next = text[i + 1];
    if (next !== undefined && !pauseAfter(next, pace)) t += pauseAfter(text[i]!, pace);
  }
  return t;
}

/**
 * Types text into an element: the part typed so far shows, and the rest is laid out but invisible, so the box it sits
 * in keeps its size and words don't jump between lines as they arrive.
 */
export class Typewriter {
  private readonly typed = document.createElement('span');
  private readonly rest = document.createElement('span');
  private text = '';
  private shown = 0;

  constructor(
    private readonly el: HTMLElement,
    private readonly pace: TypingPace = SPEAKING,
  ) {
    this.rest.style.visibility = 'hidden';
  }

  get done(): boolean {
    return this.shown >= this.text.length;
  }

  start(text: string): void {
    this.text = text;
    this.shown = -1;
    this.el.replaceChildren(this.typed, this.rest);
    this.show(0);
  }

  /** Types as far as `seconds` since the start; returns whether it's all out. */
  update(seconds: number): boolean {
    this.show(charactersTyped(this.text, seconds, this.pace));
    return this.done;
  }

  finish(): void {
    this.show(this.text.length);
  }

  private show(count: number): void {
    if (count === this.shown) return;
    this.shown = count;
    this.typed.textContent = this.text.slice(0, count);
    this.rest.textContent = this.text.slice(count);
  }
}
