import type { Vec2 } from '../core/math';

const TEXT_POOL = 32;
const BAR_POOL = 24;
const TAG_POOL = 8;
/** Floating text rises and fades over this long. */
const TEXT_SECONDS = 1.1;
/** Tiles a second. */
const TEXT_RISE = 0.75;

/**
 * Positions a label centred on a screen point. A transform only moves the element's layer, where changing `left` and
 * `top` every frame would make the browser lay out the page again.
 */
const place = (p: Vec2): string => `translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px) translate(-50%,-50%)`;

export type Project = (x: number, y: number, height: number, out: Vec2) => Vec2;

interface FloatingText {
  element: HTMLElement;
  x: number;
  y: number;
  height: number;
  age: number;
}

/**
 * Text and health bars that follow points in the world: damage numbers, pickups, messages. Pooled DOM elements,
 * positioned each frame by projecting world points onto the screen.
 */
export class WorldLabels {
  private readonly texts: FloatingText[] = [];
  private readonly bars: Array<{ element: HTMLElement; fill: HTMLElement }> = [];
  private readonly point: Vec2 = { x: 0, y: 0 };
  private readonly tags: Array<{ element: HTMLElement; text: string; colour: string; size: number }> = [];
  private barsUsed = 0;
  private tagsUsed = 0;

  constructor(parent: HTMLElement) {
    const layer = document.createElement('div');
    layer.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:5';
    parent.appendChild(layer);
    for (let i = 0; i < TEXT_POOL; i++) {
      const element = document.createElement('div');
      element.className = 'world-text';
      element.style.cssText =
        'position:absolute;left:0;top:0;white-space:nowrap;font-weight:700;will-change:transform;' +
        'text-shadow:0 0 3px #000,0 1px 3px #000;display:none';
      layer.appendChild(element);
      this.texts.push({ element, x: 0, y: 0, height: 0, age: TEXT_SECONDS });
    }
    for (let i = 0; i < BAR_POOL; i++) {
      const element = document.createElement('div');
      element.className = 'world-bar';
      element.style.cssText = 'position:absolute;left:0;top:0;height:4px;will-change:transform;display:none';
      const fill = document.createElement('i');
      fill.style.cssText = 'display:block;height:100%';
      element.appendChild(fill);
      layer.appendChild(element);
      this.bars.push({ element, fill });
    }
    for (let i = 0; i < TAG_POOL; i++) {
      const element = document.createElement('div');
      element.className = 'world-tag';
      element.style.cssText =
        'position:absolute;left:0;top:0;white-space:nowrap;font-weight:700;will-change:transform;' +
        'text-shadow:0 0 3px #000,0 1px 3px #000;display:none';
      layer.appendChild(element);
      this.tags.push({ element, text: '', colour: '', size: 0 });
    }
  }

  /** Floating text that rises from a point, `height` tiles above the ground. */
  text(x: number, y: number, height: number, text: string, colour: string, sizePx: number): void {
    const t = this.texts.reduce((oldest, candidate) => (candidate.age > oldest.age ? candidate : oldest));
    t.x = x;
    t.y = y;
    t.height = height;
    t.age = 0;
    t.element.textContent = text;
    t.element.style.color = colour;
    t.element.style.fontSize = `${sizePx}px`;
    t.element.style.display = '';
  }

  /** Starts a frame's health bars. Call `bar` for each, then `endBars`. */
  beginBars(): void {
    this.barsUsed = 0;
  }

  bar(project: Project, x: number, y: number, height: number, share: number, widthPx: number): void {
    const bar = this.bars[this.barsUsed++];
    if (!bar) return;
    const p = project(x, y, height, this.point);
    bar.element.style.display = '';
    bar.element.style.width = `${widthPx}px`;
    bar.element.style.transform = place(p);
    bar.fill.style.width = `${Math.max(0, Math.min(1, share)) * 100}%`;
  }

  endBars(): void {
    for (let i = this.barsUsed; i < BAR_POOL; i++) this.bars[i]!.element.style.display = 'none';
  }

  /** Starts a frame's tags, text held over a point such as a name. Call `tag` for each, then `endTags`. */
  beginTags(): void {
    this.tagsUsed = 0;
  }

  tag(project: Project, x: number, y: number, height: number, text: string, colour: string, sizePx: number): void {
    const tag = this.tags[this.tagsUsed++];
    if (!tag) return;
    const { element } = tag;
    // Restyled only on change, so a tag held still doesn't make the browser lay it out again each frame.
    if (tag.text !== text) element.textContent = tag.text = text;
    if (tag.colour !== colour) element.style.color = tag.colour = colour;
    if (tag.size !== sizePx) element.style.fontSize = `${(tag.size = sizePx)}px`;
    element.style.display = '';
    element.style.transform = place(project(x, y, height, this.point));
  }

  endTags(): void {
    for (let i = this.tagsUsed; i < TAG_POOL; i++) this.tags[i]!.element.style.display = 'none';
  }

  update(project: Project, frameSeconds: number): void {
    for (const t of this.texts) {
      if (t.age >= TEXT_SECONDS) continue;
      t.age += frameSeconds;
      if (t.age >= TEXT_SECONDS) {
        t.element.style.display = 'none';
        continue;
      }
      const p = project(t.x, t.y, t.height + t.age * TEXT_RISE, this.point);
      t.element.style.transform = place(p);
      t.element.style.opacity = String(Math.max(0, Math.min(1, 1.4 - t.age * 1.3)));
    }
  }
}
