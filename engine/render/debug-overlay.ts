const WINDOW = 60;

/**
 * Frame timing in a corner of the screen: frames a second, the average and worst frame, and how the time splits
 * between the rules and drawing. Shown when the page URL has `?debug`.
 */
export class DebugOverlay {
  private readonly element: HTMLElement;
  private readonly frames = new Float32Array(WINDOW);
  private readonly updates = new Float32Array(WINDOW);
  private readonly draws = new Float32Array(WINDOW);
  private index = 0;

  constructor(parent: HTMLElement) {
    this.element = document.createElement('pre');
    this.element.style.cssText =
      'position:fixed;left:8px;bottom:8px;margin:0;padding:6px 8px;font:12px/1.4 ui-monospace,monospace;' +
      'color:#d8f0c8;background:rgba(0,0,0,.6);border-radius:4px;pointer-events:none;z-index:99';
    parent.appendChild(this.element);
  }

  record(frameMs: number, updateMs: number, drawMs: number): void {
    this.frames[this.index] = frameMs;
    this.updates[this.index] = updateMs;
    this.draws[this.index] = drawMs;
    this.index = (this.index + 1) % WINDOW;
    if (this.index === 0) this.show();
  }

  private show(): void {
    const average = (a: Float32Array): number => a.reduce((s, v) => s + v, 0) / a.length;
    const frame = average(this.frames);
    this.element.textContent =
      `${(1000 / frame).toFixed(0)} fps  frame ${frame.toFixed(1)} ms (worst ${Math.max(...this.frames).toFixed(1)})\n` +
      `rules ${average(this.updates).toFixed(2)} ms  draw ${average(this.draws).toFixed(2)} ms`;
  }
}
