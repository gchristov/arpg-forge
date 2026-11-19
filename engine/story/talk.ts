import type { GameState } from '../sim/state';
import { holds, type When } from '../sim/story-steps';

/**
 * A button under a page of dialogue. `Step` and `Reply` narrow the names to a game's own, so a misspelt one is a type
 * error.
 */
export interface Option<Step extends string = string, Reply extends string = string> {
  label: string;
  /** Offered only while this holds. */
  when?: When<Step>;
  /** The reply the story waits for, sent when it's chosen. */
  reply?: Reply;
  /** One of the person's services, by its index in their `NpcType`, bought when it's chosen. */
  service?: number;
  /** Shown beside the label, such as a price; `{price}` is replaced by the service's price. */
  tag?: string;
}

export interface Page<Step extends string = string, Reply extends string = string> {
  text: string;
  options?: Option<Step, Reply>[];
}

/**
 * One thing someone says, while its condition holds: a single page, or several in a row. Choosing any button on a page
 * but the last moves on to the next one. `services` adds the person's services as buttons on the last page.
 */
export type Said<Step extends string = string, Reply extends string = string> = When<Step> & { services?: boolean } & (
  | { text: string; options?: Option<Step, Reply>[] }
  | { pages: Page<Step, Reply>[] }
);

/** Someone to talk to: their name over the box, and what they say, the first entry whose condition holds. */
export interface Person<Step extends string = string, Reply extends string = string> {
  title: string;
  says: Said<Step, Reply>[];
  /** Buttons for their services, added where an entry asks for them. */
  services?: Option<Step, Reply>[];
  /** The button that closes a last page with no others; "Leave" if not given. */
  leave?: string;
}

/** Something to read or use: its name over the box, whether it's a screen, and what it shows, first match first. */
export interface Thing<Step extends string = string> {
  title: string;
  /** A machine's screen, which prints, rather than something written, which shows at once. */
  screen?: boolean;
  says: Array<When<Step> & { text: string }>;
}

/** A conversation or reading, ready to show: pages with only the buttons on offer now. */
export interface Talk {
  title: string;
  screen?: boolean;
  /** Something written, shown all at once. */
  written?: boolean;
  pages: Array<{ text: string; options: Option[] }>;
}

const LEAVE = 'Leave';
const ON = '…';

/** What `person` says now, or with the quest at `quest`; null if nothing they say applies. */
export function talkTo(person: Person, state: GameState, quest = state.quest): Talk | null {
  const said = person.says.find((s) => holds(state, s, quest));
  if (!said) return null;
  const pages = 'pages' in said ? said.pages : [{ text: said.text, options: said.options }];
  const offered = (options: Option[]) => options.filter((o) => !o.when || holds(state, o.when, quest));
  return {
    title: person.title,
    pages: pages.map((page, i) => {
      const last = i === pages.length - 1;
      const options = offered([...(last && said.services ? person.services ?? [] : []), ...(page.options ?? [])]);
      if (!last) return { text: page.text, options: options.length ? options : [{ label: ON }] };
      const closes = options.some((o) => o.service === undefined);
      return { text: page.text, options: closes ? options : [...options, { label: person.leave ?? LEAVE }] };
    }),
  };
}

/** What `thing` shows now, or with the quest at `quest`, as one page closed by `close`; null if nothing applies. */
export function read(thing: Thing, state: GameState, quest = state.quest, close = 'Close'): Talk | null {
  const shown = thing.says.find((s) => holds(state, s, quest));
  if (!shown) return null;
  return {
    title: thing.title,
    ...(thing.screen ? { screen: true } : { written: true }),
    pages: [{ text: shown.text, options: [{ label: close }] }],
  };
}

/** Fills `{price}` in an option's tag. */
export const priceTag = (tag: string, price: number): string => tag.replaceAll('{price}', String(price));
