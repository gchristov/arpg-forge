import type { Talk } from '../../../engine/story/talk';
import { VOICES, type Line } from './voices';

/**
 * The lines said as the story goes: thoughts, announcements and the scenes' words. Lines with no speaker are U-7's own
 * thoughts. Terminals and panels say only what they show (`things.ts`); what has just happened is told by U-7, or by
 * whoever is there.
 */

/**
 * U-7 walks into the town at night, played as a scene: it warns Odell, who doesn't trust it, and offers to prove
 * itself on the machine raiding the crates.
 */
export const ARRIVAL: Line[] = [
  { text: 'Stop right there. You’re one of them. Come to take what’s left?', from: VOICES.odell },
  { text: 'I left the Foundry. I came to warn you.', from: VOICES.u7 },
  { text: 'Warn us? They come down every night already. Scrap, tools, last week the chapel bell.', from: VOICES.odell },
  { text: 'That was only the start. Our new order is to strip the whole town for parts.', from: VOICES.u7 },
  { text: 'The whole town… And why should I believe a Foundry machine? … Look, there’s one of yours at the crates right now.', from: VOICES.odell },
  { text: 'Let me prove it.', from: VOICES.u7 },
];

/** The Assembly waking upriver, and reaching further upriver, as the last scene plays. */
export const ASSEMBLY: Line[] = [
  { text: 'ASSEMBLY ONLINE. AWAITING ORDERS.', from: VOICES.assembly },
  { text: 'Orders? …From me?', from: VOICES.u7 },
  { text: 'ESTABLISHING CONNECTION: UPRIVER…', from: VOICES.assembly },
  { text: 'CONNECTED. NEW ORDER RECEIVED: RECALL U-7.', from: VOICES.assembly },
];

/** Home at dawn, played as a scene once U-7 brings Odell back: the town welcomes him, and U-7 looks upriver. */
export const HOMECOMING: Line[] = [
  { text: 'Odell! You stubborn old goat. You’re alive!', from: VOICES.mags },
  { text: 'Takes more than a Foundry to keep me in a box.', from: VOICES.odell },
  { text: 'Brought home by one of them. Never thought I’d see it.', from: VOICES.mags },
  { text: 'I could use a couple of these machines in the workshop, you know.', from: VOICES.pell },
  { text: 'I didn’t trust you when you walked in. I do now.', from: VOICES.odell },
  { text: 'The Foundry only follows orders. Someone upriver gives them.', from: VOICES.u7 },
];

/**
 * After plugging in: U-7 lets the Foundry believe it, the station warns of the charge kept for it, which bursts out as
 * the EMP, and U-7 knows it of old.
 */
export const CHARGED: { believed: Line; overcharged: Line; burst: Line } = {
  believed: { text: 'Let them think so.' },
  overcharged: { text: 'OVERCHARGE DETECTED.', from: VOICES.foundry },
  burst: { text: 'Good. I still have my old EMP blast.' },
};

/** Plugging into the charging station. */
export const CHARGING: Talk = {
  title: 'U-7 charging station',
  screen: true,
  pages: [{ text: 'U-7 RETURNED. ACCESS RESTORED.', options: [{ label: '…' }] }],
};

/** Cancelling the Foundry's order at the order terminal, page by page. */
export const GIVING_THE_ORDER: Talk = {
  title: 'Order terminal',
  screen: true,
  pages: [
    { text: 'ORDER: STRIP THE TOWN FOR PARTS. STATUS: AWAITING INSTRUCTIONS.', options: [{ label: 'Return all items to the town' }] },
    { text: 'ORDER CANCELLED. RETURNING ALL ITEMS.', options: [{ label: 'Close' }] },
  ],
};

/** The last thing the player sees, once the Assembly has reached upriver. */
export const ENDING = {
  title: 'Unrecalled',
  subtitle: '',
  thanks: 'Thank you for playing.',
};

/** What a machine with a scanner says on looking U-7 over. */
export const MACHINE_SCANS = 'SCANNING… ONE OF OURS';
export const levelUp = (level: number) => `Level ${level}`;
export const scrapDropped = (amount: number) => `I went down, and lost ${amount} scrap getting back up.`;
