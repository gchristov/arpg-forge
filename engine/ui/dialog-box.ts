import { Typewriter, type TypingPace } from './typewriter';

/** The elements a dialogue box is made of; the game's page and style sheet decide how it looks. */
export interface DialogElements {
  root: HTMLElement;
  title: HTMLElement;
  text: HTMLElement;
  /** Where the choices go, one button each. */
  choices: HTMLElement;
}

export interface DialogChoice {
  label: string;
  /** A short note beside the label, such as a price. */
  tag?: string;
  disabled?: boolean;
  onChoose: () => void;
}

/**
 * A dialogue box: a title, some text and a list of choices. Taps on it don't reach the game. Given a typing pace, the
 * text types out as if spoken, a tap on the box shows the rest at once, and the choices come once it's all out.
 */
export class DialogBox {
  /** The NPC whose dialogue is showing, if any, so it can be refreshed after a purchase. */
  npcId: number | null = null;
  private readonly typewriter: Typewriter | null;
  private frame = 0;
  /** The tap that finishes the typing mustn't also choose the reply that appears under the finger. */
  private choicesFrom = 0;

  constructor(
    private readonly el: DialogElements,
    pace?: TypingPace,
  ) {
    this.typewriter = pace ? new Typewriter(el.text, pace) : null;
    if (this.typewriter) el.root.addEventListener('pointerdown', () => this.finishTyping());
  }

  /** `typed` false shows the text at once even when the box types, such as for a sign. */
  open(title: string, text: string, choices: DialogChoice[], npcId: number | null = null, typed = true): void {
    this.npcId = npcId;
    this.el.title.textContent = title;
    cancelAnimationFrame(this.frame);
    this.el.choices.style.visibility = '';
    if (this.typewriter && typed) this.type(text);
    else this.el.text.textContent = text;
    this.el.choices.replaceChildren(
      ...choices.map((choice) => {
        const button = document.createElement('button');
        const label = document.createElement('span');
        label.textContent = choice.label;
        button.appendChild(label);
        if (choice.tag) {
          const tag = document.createElement('em');
          tag.textContent = choice.tag;
          button.appendChild(tag);
        }
        button.disabled = Boolean(choice.disabled);
        button.addEventListener('pointerdown', (e) => e.stopPropagation());
        button.addEventListener('click', (e) => {
          e.stopPropagation();
          if (performance.now() >= this.choicesFrom) choice.onChoose();
        });
        return button;
      }),
    );
    this.el.root.hidden = false;
  }

  close(): void {
    this.npcId = null;
    this.el.root.hidden = true;
    cancelAnimationFrame(this.frame);
  }

  private type(text: string): void {
    const typewriter = this.typewriter!;
    typewriter.start(text);
    // Hidden rather than left out, so the box is its full size from the first letter.
    this.el.choices.style.visibility = 'hidden';
    const started = performance.now();
    const tick = (now: number) => {
      if (typewriter.update((now - started) / 1000)) this.el.choices.style.visibility = '';
      else this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }

  private finishTyping(): void {
    if (!this.typewriter || this.typewriter.done) return;
    cancelAnimationFrame(this.frame);
    this.typewriter.finish();
    this.el.choices.style.visibility = '';
    this.choicesFrom = performance.now() + 300;
  }
}
