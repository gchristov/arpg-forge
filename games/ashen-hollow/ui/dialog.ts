const $ = (id: string): HTMLElement => document.getElementById(id)!;

export interface DialogChoice {
  label: string;
  tag?: string;
  disabled?: boolean;
  onChoose: () => void;
}

/** The dialogue box: a title, a line of text and a list of choices. */
export class DialogBox {
  /** The NPC whose dialogue is showing, so it can be refreshed after a purchase. */
  npcId: number | null = null;

  open(npcId: number, title: string, text: string, choices: DialogChoice[]): void {
    this.npcId = npcId;
    $('dlgT').textContent = title;
    $('dlgP').textContent = text;
    const list = $('dlgO');
    list.replaceChildren(
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
    $('dialog').hidden = false;
  }

  close(): void {
    this.npcId = null;
    $('dialog').hidden = true;
  }
}
