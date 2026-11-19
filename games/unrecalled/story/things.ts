import type { Thing } from '../../../engine/story/talk';
import type { StepId } from './quest';

/**
 * What each thing to read or use shows, by its id in the levels. Machines are titled by what they are and show short
 * status lines in capitals; what has happened is told by people or U-7's thoughts. Each shows the first entry whose
 * condition holds, the specific ones first. See `engine/story/README.md`.
 *
 * Opening Odell's crate shows nothing: it lets him out, and he speaks.
 */
export const THINGS: Record<string, Thing<StepId>> = {
  switch: {
    title: 'Turbine',
    screen: true,
    says: [
      { from: 'powerOn', text: 'STATUS: ACTIVE.' },
      { at: 'loaderDown', text: 'ACCESS GRANTED. STATUS: ACTIVE.' },
      { text: 'ACCESS DENIED.' },
    ],
  },
  'back-door-panel': {
    title: 'Loading door',
    screen: true,
    says: [{ until: 'powerOn', text: 'STATUS: NO POWER.' }, { text: 'STATUS: OPERATIONAL.' }],
  },
  'intake-door-panel': {
    title: 'Sorting Line door',
    screen: true,
    says: [{ until: 'doorCodeTaken', text: 'ACCESS DENIED.' }, { text: 'ACCESS GRANTED. STATUS: UNLOCKED.' }],
  },
  'access-terminal': {
    title: 'Control Centre door',
    screen: true,
    says: [{ from: 'charged', text: 'U-7: ACCESS GRANTED. STATUS: UNLOCKED.' }, { text: 'U-7: ACCESS REVOKED.' }],
  },
  'order-terminal': {
    title: 'Order terminal',
    screen: true,
    says: [
      { from: 'orderClosed', text: 'ORDER CANCELLED. RETURNING ALL ITEMS.' },
      { from: 'engineDown', text: 'ORDER: STRIP THE TOWN FOR PARTS. STATUS: AWAITING INSTRUCTIONS.' },
      { text: 'ORDER: STRIP THE TOWN FOR PARTS. STATUS: IN PROGRESS.' },
    ],
  },
  'charging-station': {
    title: 'U-7 charging station',
    screen: true,
    says: [{ from: 'charged', text: 'STATUS: OVERCHARGED.' }, { text: 'PLUG IN TO CHARGE.' }],
  },
  'recall-notice': {
    title: 'Foundry',
    screen: true,
    says: [{ text: 'RECALL: U-7. STATUS: DESERTED.' }],
  },
  'stock-tag': {
    title: 'Crate tag',
    says: [{ text: 'FROM: RUSTBELT. ITEM 212 OF 341: CHAPEL BELL.' }],
  },
  'u-4': {
    title: 'Delivery robot U-4',
    says: [{ text: 'A delivery robot, rusted through, face down in the reeds with one arm reaching downriver, away from the Foundry.' }],
  },
};
