/** A full-screen black overlay that fades in and out, for moving between levels. */
export class ScreenFade {
  private readonly element: HTMLElement;

  constructor(parent: HTMLElement, seconds: number) {
    this.element = document.createElement('div');
    this.element.style.cssText =
      `position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;z-index:50;transition:opacity ${seconds}s`;
    parent.appendChild(this.element);
  }

  toBlack(): void {
    this.element.style.opacity = '1';
  }

  fromBlack(): void {
    this.element.style.opacity = '0';
  }
}
