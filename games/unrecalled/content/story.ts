/**
 * Unrecalled's words. The story is mostly told by the places; these are the few lines it needs. The quiet question is
 * who the salvager is: every clue here points at U-7, the delivery unit that was never recalled.
 */

/** What the HUD says to do, by quest step. */
export const QUEST_TEXT = [
  'Get into the Foundry and find what is taking Rustbelt apart.',
  'Follow the line deeper.',
  'Get past the Control Gallery.',
  'Shut down the Order Engine.',
  'The Foundry has gone quiet. Head back up.',
];

/** The quest step reached when the Order Engine falls. */
export const ENGINE_DOWN_STEP = 4;

/** What the hero reads, by readable id. */
export const READINGS: Record<string, { title: string; text: string }> = {
  'recall-notice': {
    title: 'Terminal',
    text: 'RECALL NOTICE. All delivery units return to Assembly. Outstanding: U-7. Last contact: the river crossing, the night of the flood.',
  },
  'stock-tag': {
    title: 'A tag on the crate',
    text: 'STOCK: RUSTBELT. Item 212 of 340. Contents: one chapel bell.',
  },
  locker: {
    title: 'Locker',
    text: 'The door is stencilled U-7. Inside hangs a yellow hard hat, dented on the left side. Just like yours.',
  },
  cradle: {
    title: 'Charging cradle',
    text: 'A cradle shaped for something about your size. The plate reads U-7. It is still warm.',
  },
};

/** Lines the machines speak. */
/** What a machine with a scanner says on looking the salvager over: it knows what they are. */
export const MACHINE_SCANS = 'SCANNING… UNIT RECOGNISED';
export const LINE_ALERT = { title: 'Line alert', subtitle: 'Every machine on the floor turns toward you.' };
export const UNSEALED = { title: 'The door unseals', subtitle: 'The way to the Assembly Hall is open.' };
/** On a sealed floor, how many machines still keep the door shut. */
export const stillRunning = (count: number) => `The door is sealed. ${count} ${count === 1 ? 'machine' : 'machines'} still running.`;
export const ENGINE_CALLS = { title: 'U-7. You are late.', subtitle: 'The Order Engine calls the line to it.' };
export const ENGINE_FALLS = { title: 'The Order Engine falls silent', subtitle: 'Somewhere in the walls, a relay clicks: ORDER REASSIGNED.' };
