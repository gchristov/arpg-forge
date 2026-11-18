/**
 * Lines taking turns: one shows at a time, for as long as `seconds` gives it, and the rest wait in order. While held,
 * nothing shows, and a line cut short before it could be read (`seenAfter`) goes back to the front to show again in
 * full; one already read is let go.
 */
export class LineQueue<T> {
  private readonly waiting: T[] = [];
  private current: { line: T; left: number; shownFor: number } | null = null;
  private held = false;

  constructor(
    private readonly seconds: (line: T) => number,
    private readonly seenAfter: (line: T) => number = seconds,
  ) {}

  get showing(): T | null {
    return this.current?.line ?? null;
  }

  /** Nothing showing and nothing waiting. */
  get idle(): boolean {
    return !this.current && this.waiting.length === 0;
  }

  push(line: T): void {
    this.waiting.push(line);
  }

  /** Holds or lets go; returns the line taken off the screen by holding, if any. */
  hold(held: boolean): T | null {
    if (held === this.held) return null;
    this.held = held;
    if (!held || !this.current) return null;
    const { line, shownFor } = this.current;
    this.current = null;
    if (shownFor < this.seenAfter(line)) this.waiting.unshift(line);
    return line;
  }

  /** Moves time on: the line read long enough is retired, and the next one is shown. */
  tick(seconds: number): { retired: T | null; shown: T | null } {
    if (this.held) return { retired: null, shown: null };
    let retired: T | null = null;
    if (this.current) {
      this.current.left -= seconds;
      this.current.shownFor += seconds;
      if (this.current.left > 0) return { retired: null, shown: null };
      retired = this.current.line;
      this.current = null;
    }
    const next = this.waiting.shift();
    if (next === undefined) return { retired, shown: null };
    this.current = { line: next, left: this.seconds(next), shownFor: 0 };
    return { retired, shown: next };
  }

  clear(): void {
    this.waiting.length = 0;
    this.current = null;
  }
}
