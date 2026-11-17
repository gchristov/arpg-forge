/** Who a line in the feed comes from: a name shown before it, and a voice the game's style sheet can colour. */
export interface Speaker {
  name: string;
  voice: string;
}

/**
 * What just happened, in words, so nothing depends on sound: a few lines with the newest last, each fading out after
 * a while. Each line can say who it's from. The game's page and style sheet decide how it looks: a line is a `div`
 * with the class `line` and its speaker's voice, and gets `gone` as it fades.
 */
export class MessageFeed {
  constructor(
    private readonly root: HTMLElement,
    private readonly maxLines = 4,
    private readonly seconds = 9,
    private readonly fadeSeconds = 0.6,
  ) {}

  add(text: string, from?: Speaker): void {
    const line = document.createElement('div');
    line.className = from ? `line ${from.voice}` : 'line';
    if (from) {
      const name = document.createElement('b');
      name.textContent = from.name;
      line.append(name, ' ');
    }
    line.append(text);
    this.root.append(line);
    while (this.root.children.length > this.maxLines) this.root.firstElementChild!.remove();
    window.setTimeout(() => {
      line.classList.add('gone');
      window.setTimeout(() => line.remove(), this.fadeSeconds * 1000);
    }, this.seconds * 1000);
  }

  clear(): void {
    this.root.replaceChildren();
  }
}
