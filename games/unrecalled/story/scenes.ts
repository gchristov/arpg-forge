import type { Action } from '../../../engine/story/story-runner';
import type { Talk } from '../../../engine/story/talk';
import { ASSEMBLY_VIEW } from '../levels/upriver';
import type { ReplyId, StepId } from './quest';
import type { VoiceId } from './voices';

/**
 * The story's scenes: lists of actions played one after another, each waiting for the one before. The rules in
 * `rules.ts` say when each plays. `run` names one of the game's own actions (see `EXTENSIONS.md`). See
 * `engine/story/README.md`.
 */
type Scene = Action<StepId, VoiceId, ReplyId>[];

/** Where the camera rests while the town welcomes Odell home: on the fire and the people round it. */
const AROUND_THE_FIRE = { x: 22.5, y: 15 };
/** Far enough out to show the Assembly whole, towers and all, even on a phone. */
const ASSEMBLY_CLOSENESS = 0.55;

/**
 * U-7 walks into the town at night and warns Odell, who doesn't trust it; offering to prove itself on the loader at
 * the crates starts the game proper.
 */
export const ARRIVAL: Scene = [
  { cinematic: true },
  { say: 'Stop right there. You’re from the Foundry. Come to take what’s left?', by: 'odell' },
  { say: 'I left the Foundry. I came to warn you.', by: 'u7' },
  { say: 'Warn us? Your machines raid us every night already. Scrap, tools, last week the chapel bell.', by: 'odell' },
  { say: 'That was the start. The Foundry needs scrap for new machines, and a new order came: strip the whole town.', by: 'u7' },
  { say: 'The whole town… Why would a Foundry machine warn us?', by: 'odell' },
  { say: 'I was an experiment: a machine built to think like you. It failed, but I understood what that order means.', by: 'u7' },
  { say: 'Words are cheap. There’s one of yours at the crates right now.', by: 'odell' },
  { say: 'Let me prove it.', by: 'u7' },
  { waitForLines: true },
  { cinematic: false },
  { reply: 'proveIt', to: 'foreman' },
];

/** Plugged into the charging station: U-7 breaks into the Foundry's network, overrides its access and unlocks its EMP. */
export const OVERRIDE: Talk = {
  title: 'U-7 charging station',
  screen: true,
  pages: [
    { text: 'U-7 CONNECTED. ACCESS: REVOKED.', options: [{ label: 'Override access' }] },
    { text: 'OVERRIDE ACCEPTED. ACCESS: RESTORED.', options: [{ label: 'Unlock weapon systems' }] },
    { text: 'EMP: UNLOCKED.', options: [{ label: 'Test the EMP' }] },
  ],
};

/**
 * Once the screen closes, the EMP bursts out before its button appears, so the player sees what it does rather than
 * reads it, and the Foundry notices.
 */
export const FIRST_EMP: Scene = [
  { useSkill: 'emp' },
  { run: 'showEmp' },
  { think: 'Good. My EMP blast is back.' },
  { say: 'UNAUTHORISED OVERRIDE DETECTED.', by: 'foundry' },
];

/** Cancelling the Foundry's order at the order terminal, page by page. */
export const GIVING_THE_ORDER: Talk = {
  title: 'Order terminal',
  screen: true,
  pages: [
    { text: 'ORDER: STRIP RUSTBELT FOR SCRAP. STATUS: AWAITING INSTRUCTIONS.', options: [{ label: 'Cancel the order' }] },
    { text: 'ORDER CANCELLED. RETURNING ALL ITEMS.', options: [{ label: 'Close' }] },
  ],
};

/**
 * Home at dawn, from leaving the Foundry until the Assembly upriver, played with no input from the player: the town
 * welcomes Odell, U-7 looks upriver, and the picture fades out towards the ending.
 */
export const HOMECOMING: Scene = [
  { cinematic: true },
  { waitUntilIn: 'rustbelt' },
  { cut: AROUND_THE_FIRE },
  { wait: 1.6 },
  { say: 'Odell! You stubborn old goat. You’re alive!', by: 'mags' },
  { say: 'Takes more than a Foundry to keep me in a box.', by: 'odell' },
  { say: 'Brought home by a Foundry robot. Never thought I’d see it.', by: 'mags' },
  { say: 'I could use a couple of these machines in the workshop, you know.', by: 'pell' },
  { say: 'I didn’t trust you when you walked in. I do now.', by: 'odell' },
  { say: 'The Foundry only follows orders. Someone upriver gives them.', by: 'u7' },
  { waitForLines: true },
  { wait: 0.8 },
  { fade: 'out' },
  { wait: 1.4 },
  { reply: 'upriver', to: 'foreman' },
];

/**
 * The last scene, upriver: framed on the Assembly standing dark before the picture fades up, its storeys light one by
 * one, it wakes and reaches further upriver, and once that's been read the closing card comes in.
 */
export const THE_ASSEMBLY: Scene = [
  { cut: ASSEMBLY_VIEW, closeness: ASSEMBLY_CLOSENESS },
  { cinematic: true },
  { fade: 'up' },
  { run: 'assemblyWakes' },
  { wait: 1.4 },
  { say: 'ASSEMBLY ONLINE. AWAITING ORDERS.', by: 'assembly' },
  { say: 'Orders? …From me?', by: 'u7' },
  { say: 'ESTABLISHING CONNECTION: UPRIVER…', by: 'assembly' },
  { say: 'CONNECTED. NEW ORDER RECEIVED: RECALL U-7.', by: 'assembly' },
  { waitForLines: true },
  { wait: 1.2 },
  { run: 'endCard' },
];
