import type { Sitter } from './portrait-drawing';
import { dressHero } from '../art/look';
import type { Speaker } from '../../../engine/ui/message-feed';
import { SPEAKERS, VOICES } from '../story/voices';

/** Who has a portrait, and how they sit for it. The Foundry's speakers and its screens have no face. */
const SITTERS: Record<string, Sitter> = {
  u7: { model: 'hero', pose: 'Idle', dress: dressHero },
  foreman: { model: 'foreman', pose: 'Idle' },
  trader: { model: 'trader', pose: 'Idle' },
  tinker: { model: 'tinker', pose: 'Idle' },
  orderEngine: { model: 'order-engine', pose: 'Idle', show: 0.5, turn: 0.3 },
};

/** Whose portrait goes with each name a line or page of dialogue is said under. */
const BY_NAME: Record<string, string> = {
  [SPEAKERS.foreman]: 'foreman',
  [SPEAKERS.mags]: 'trader',
  [SPEAKERS.pell]: 'tinker',
  [VOICES.odell.name]: 'foreman',
  [VOICES.mags.name]: 'trader',
  [VOICES.pell.name]: 'tinker',
  [VOICES.orderEngine.name]: 'orderEngine',
  [VOICES.u7.name]: 'u7',
};

/** The speakers' portraits, drawn once the models have loaded; until then nobody has one. */
export class Portraits {
  private urls: Record<string, string> = {};

  constructor(draw: (sitters: Record<string, Sitter>) => Promise<Record<string, string>>) {
    void draw(SITTERS).then((urls) => (this.urls = urls));
  }

  /** The portrait for a page of dialogue said under `name`. */
  ofName(name: string): string | undefined {
    const sitter = BY_NAME[name];
    return sitter ? this.urls[sitter] : undefined;
  }

  /** The portrait for a line in the feed: its speaker's, or U-7's for its own thoughts. */
  of(from?: Speaker): string | undefined {
    return from ? this.ofName(from.name) : this.urls.u7;
  }
}
