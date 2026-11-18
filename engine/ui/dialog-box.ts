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
 * text types out at it, a tap on the box shows the rest at once, and the choices come once it's all out.
 */
export class DialogBox {
  /** The NPC whose dialogue is showing, if any, so it can be refreshed after a purchase. */
  npcId: number | null = null;
  private readonly typewriter: Typewriter;
  private frame = 0;
  private typing = false;
  /** The tap that finishes the typing mustn't also choose the reply that appears under the finger. */
  private choicesFrom = 0;

  constructor(
    private readonly el: DialogElements,
    private readonly pace: TypingPace | null = null,
  ) {
    this.typewriter = new Typewriter(el.text, pace ?? undefined);
    el.root.addEventListener('pointerdown', () => this.finishTyping());
  }

  /** `pace` types this text at its own pace, such as a screen's, or with null shows it at once, such as a sign. */
  open(title: string, text: string, choices: DialogChoice[], npcId: number | null = null, pace = this.pace): void {
    this.npcId = npcId;
    this.el.title.textContent = title;
    cancelAnimationFrame(this.frame);
    this.typing = false;
    this.el.choices.style.visibility = '';
    if (pace) this.type(text, pace);
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

  private type(text: string, pace: TypingPace): void {
    const typewriter = this.typewriter;
    typewriter.start(text, pace);
    this.typing = true;
    // Hidden rather than left out, so the box is its full size from the first letter.
    this.el.choices.style.visibility = 'hidden';
    const started = performance.now();
    const tick = (now: number) => {
      if (typewriter.update((now - started) / 1000)) {
        this.typing = false;
        this.el.choices.style.visibility = '';
      } else this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }

  private finishTyping(): void {
    if (!this.typing) return;
    this.typing = false;
    cancelAnimationFrame(this.frame);
    this.typewriter.finish();
    this.el.choices.style.visibility = '';
    this.choicesFrom = performance.now() + 300;
  }
}
