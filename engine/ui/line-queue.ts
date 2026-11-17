/**
 * Lines taking turns: one shows at a time, for as long as `seconds` gives it, and the rest wait in order. While held,
 * nothing shows, and a line cut short goes back to the front to show again in full.
 */
export class LineQueue<T> {
  private readonly waiting: T[] = [];
  private current: { line: T; left: number } | null = null;
  private held = false;

  constructor(private readonly seconds: (line: T) => number) {}

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
    const { line } = this.current;
    this.waiting.unshift(line);
    this.current = null;
    return line;
  }

  /** Moves time on: the line read long enough is retired, and the next one is shown. */
  tick(seconds: number): { retired: T | null; shown: T | null } {
    if (this.held) return { retired: null, shown: null };
    let retired: T | null = null;
    if (this.current) {
      this.current.left -= seconds;
      if (this.current.left > 0) return { retired: null, shown: null };
      retired = this.current.line;
      this.current = null;
    }
    const next = this.waiting.shift();
    if (next === undefined) return { retired, shown: null };
    this.current = { line: next, left: this.seconds(next) };
    return { retired, shown: next };
  }

  clear(): void {
    this.waiting.length = 0;
    this.current = null;
  }
}
