/** The elements a banner is made of; the game's page and style sheet decide how it looks. */
export interface BannerElements {
  root: HTMLElement;
  title: HTMLElement;
  subtitle: HTMLElement;
}

/** A title and subtitle across the screen for a while, shown by adding the `show` class to its root. */
export class Banner {
  private timer = 0;

  constructor(private readonly el: BannerElements) {}

  /** Shows until replaced when `seconds` is Infinity. */
  show(title: string, subtitle = '', seconds = 2.4): void {
    this.el.title.textContent = title;
    this.el.subtitle.textContent = subtitle;
    this.el.root.classList.add('show');
    clearTimeout(this.timer);
    if (Number.isFinite(seconds)) this.timer = window.setTimeout(() => this.hide(), seconds * 1000);
  }

  hide(): void {
    this.el.root.classList.remove('show');
  }
}
