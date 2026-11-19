import type { Speaker } from '../../../engine/ui/message-feed';

/** Who speaks in the message box; lines with no speaker are U-7's own thoughts. */
export const VOICES = {
  foundry: { name: 'Foundry', voice: 'foundry' },
  orderEngine: { name: 'The Order Engine', voice: 'foundry' },
  assembly: { name: 'The Assembly', voice: 'foundry' },
  odell: { name: 'Odell', voice: 'person' },
  mags: { name: 'Mags', voice: 'person' },
  pell: { name: 'Pell', voice: 'person' },
  u7: { name: 'U-7', voice: 'person' },
} satisfies Record<string, Speaker>;

/** The name of a voice. */
export type VoiceId = keyof typeof VOICES;

/** A line in the message box. */
export interface Line {
  text: string;
  from?: Speaker;
}

/** The names the townspeople's dialogue is said under. */
export const SPEAKERS = { foreman: 'Foreman Odell', mags: 'Mags the Trader', pell: 'Pell the Tinker' };
