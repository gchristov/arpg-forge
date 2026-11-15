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

/** A dialogue box: a title, some text and a list of choices. Taps on it don't reach the game. */
export class DialogBox {
  /** The NPC whose dialogue is showing, if any, so it can be refreshed after a purchase. */
  npcId: number | null = null;

  constructor(private readonly el: DialogElements) {}

  open(title: string, text: string, choices: DialogChoice[], npcId: number | null = null): void {
    this.npcId = npcId;
    this.el.title.textContent = title;
    this.el.text.textContent = text;
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
          choice.onChoose();
        });
        return button;
      }),
    );
    this.el.root.hidden = false;
  }

  close(): void {
    this.npcId = null;
    this.el.root.hidden = true;
  }
}
