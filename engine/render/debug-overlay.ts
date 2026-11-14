const WINDOW = 60;
/** Frames this long or longer are logged as slow. */
const SLOW_MS = 50;
const SLOW_SHOWN = 4;

/**
 * Frame timing in a corner of the screen: frames a second, the average and worst frame, and how the time splits
 * between the rules and drawing. Shown when the page URL has `?debug`.
 *
 * It also logs the last few slow frames with what happened just before them. A frame's length is the gap since the
 * previous one, so a slow frame is charged to the previous frame's work: its rules and drawing time, and the events it
 * marked. When those are small, the time went to the browser instead (page layout, compositing, garbage collection).
 */
export class DebugOverlay {
  private readonly element: HTMLElement;
  private readonly frames = new Float32Array(WINDOW);
  private readonly updates = new Float32Array(WINDOW);
  private readonly draws = new Float32Array(WINDOW);
  private index = 0;
  private extra = '';
  private marks = new Set<string>();
  private previous = { updateMs: 0, drawMs: 0, marks: new Set<string>() };
  private readonly slow: string[] = [];
  private readonly started = performance.now();

  constructor(parent: HTMLElement) {
    this.element = document.createElement('pre');
    this.element.style.cssText =
      'position:fixed;left:8px;bottom:8px;margin:0;padding:6px 8px;font:12px/1.4 ui-monospace,monospace;' +
      'color:#d8f0c8;background:rgba(0,0,0,.6);border-radius:4px;pointer-events:none;z-index:99';
    parent.appendChild(this.element);
  }

  /** A line of extra detail shown under the timings, such as draw calls. */
  note(extra: string): void {
    this.extra = extra;
  }

  /** Names something that happened this frame, such as an event, for the slow-frame log. */
  mark(name: string): void {
    this.marks.add(name);
  }

  record(frameMs: number, updateMs: number, drawMs: number): void {
    if (frameMs >= SLOW_MS) this.logSlow(frameMs);
    this.previous = { updateMs, drawMs, marks: this.marks };
    this.marks = new Set();
    this.frames[this.index] = frameMs;
    this.updates[this.index] = updateMs;
    this.draws[this.index] = drawMs;
    this.index = (this.index + 1) % WINDOW;
    if (this.index === 0) this.show();
  }

  private logSlow(frameMs: number): void {
    const { updateMs, drawMs, marks } = this.previous;
    const at = ((performance.now() - this.started) / 1000).toFixed(1);
    const after = marks.size ? `  after ${[...marks].join(', ')}` : '';
    this.slow.unshift(`${at}s ${frameMs.toFixed(0)} ms: rules ${updateMs.toFixed(1)} draw ${drawMs.toFixed(1)}${after}`);
    this.slow.length = Math.min(this.slow.length, SLOW_SHOWN);
  }

  private show(): void {
    const average = (a: Float32Array): number => a.reduce((s, v) => s + v, 0) / a.length;
    const frame = average(this.frames);
    this.element.textContent =
      `${(1000 / frame).toFixed(0)} fps  frame ${frame.toFixed(1)} ms (worst ${Math.max(...this.frames).toFixed(1)})\n` +
      `rules ${average(this.updates).toFixed(2)} ms  draw ${average(this.draws).toFixed(2)} ms` +
      (this.extra ? `\n${this.extra}` : '') +
      (this.slow.length ? `\nslow frames:\n${this.slow.join('\n')}` : '');
  }
}
