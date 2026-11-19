import type { Command } from '../sim/state';
import type { DialogBox } from '../ui/dialog-box';
import type { TypingPace } from '../ui/typewriter';
import { priceTag, type Talk } from './talk';

/** What showing a conversation needs from the game. */
export interface ConversationParts {
  send(command: Command): void;
  /** What a person's service costs now, by their id and the service's index. */
  price(npcId: number, service: number): number;
  /** What the hero can spend. */
  money(): number;
  /** How a page is typed: screens print, written things show at once (null), and people speak. */
  pace(talk: Talk): TypingPace | null | undefined;
  /** As each page opens, for a game's own touches: a portrait, a log of what was said. */
  onPage?(talk: Talk, text: string): void;
}

/**
 * Shows a conversation or reading in the dialogue box, page by page. A button with a reply sends it; one with a service
 * buys it and leaves the box open; any other moves on to the next page, or on the last one closes the box and runs
 * `then`.
 */
export class ConversationView {
  constructor(
    private readonly dialog: DialogBox,
    private readonly parts: ConversationParts,
  ) {}

  show(talk: Talk, npcId: number | null = null, then?: () => void, page = 0): void {
    const { dialog, parts } = this;
    const shown = talk.pages[page];
    if (!shown) return;
    parts.onPage?.(talk, shown.text);
    const last = page === talk.pages.length - 1;
    dialog.open(
      talk.title,
      shown.text,
      shown.options.map((o) => {
        const price = o.service !== undefined && npcId !== null ? parts.price(npcId, o.service) : 0;
        return {
          label: o.label,
          ...(o.tag ? { tag: priceTag(o.tag, price) } : {}),
          disabled: parts.money() < price,
          onChoose: () => {
            if (o.reply && npcId !== null) parts.send({ type: 'reply', npcId, id: o.reply });
            if (o.service !== undefined && npcId !== null) parts.send({ type: 'useService', npcId, service: o.service });
            else if (!last) this.show(talk, npcId, then, page + 1);
            else {
              dialog.close();
              then?.();
            }
          },
        };
      }),
      npcId,
      parts.pace(talk),
    );
  }
}
