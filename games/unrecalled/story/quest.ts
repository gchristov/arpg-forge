import type { QuestStep } from '../../../engine/sim/content';
import { stepNumbers } from '../../../engine/sim/story-steps';
// Typed, so a misspelt step action is an error in the editor.
import type { StepActionName } from '../extensions/calm-machines';

/**
 * Unrecalled's quest line. The Foundry melts scrap into machines; out of scrap, with nobody to cancel its order, it
 * has started on the town of Rustbelt. U-7, a Foundry robot, has walked out and come to warn the town. It proves itself, arms itself with Pell's help, gets into the Foundry through
 * Mags's shop, and when the Foundry takes Odell, who gave it a chance, brings him home and cancels the order.
 */

/** The replies the story waits for. People offer them (`people.ts`), and quest steps wait for them, by these names. */
export const REPLY = {
  proveIt: 'proveIt',
  seePell: 'seePell',
  getSaw: 'getSaw',
  seeMags: 'seeMags',
  switchBack: 'switchBack',
  goIn: 'goIn',
  giveOrder: 'giveOrder',
  goHome: 'goHome',
  upriver: 'upriver',
} as const;

export type ReplyId = keyof typeof REPLY;

/** The machines the story needs beaten, by the tag their spawn in the levels carries. */
export const TAG = {
  raider: 'raider',
  sawThief: 'saw-thief',
  switchLoader: 'switch-loader',
  doorCodeLoader: 'door-code-loader',
} as const;

/** Back in Rustbelt by the fire, where U-7 arrives with Odell. */
export const BY_THE_FIRE = { levelId: 'rustbelt', x: 22.5, y: 15.5 };
/** Upriver, outside the Assembly, where the story ends. */
export const UPRIVER = { levelId: 'upriver', x: 79.5, y: 63.5 };

/** The quest: what the HUD says at each step, and what moves the quest to it. Steps played as scenes say nothing. */
export const QUEST = [
  { id: 'arrival', text: '' },
  { id: 'raidAsked', text: 'Stop the loader at the crates.', reachedBy: { type: 'reply', npcKind: 'foreman', id: REPLY.proveIt } },
  // Every machine answers to the Foundry: once U-7 has beaten one, all of them know.
  { id: 'raidStopped', text: 'Talk to Odell.', reachedBy: { type: 'defeat', tag: TAG.raider }, does: ['alarmEverything'] },
  { id: 'sentToPell', text: 'Talk to Pell in her workshop.', reachedBy: { type: 'reply', npcKind: 'foreman', id: REPLY.seePell } },
  { id: 'sawAsked', text: 'Get Pell’s chainsaw back from the machine in the woods.', reachedBy: { type: 'reply', npcKind: 'tinker', id: REPLY.getSaw } },
  { id: 'sawFound', text: 'Take the chainsaw back to Pell.', reachedBy: { type: 'arm', weapon: 'chainsaw' } },
  { id: 'sentToMags', text: 'Talk to Mags at the trading post.', reachedBy: { type: 'reply', npcKind: 'tinker', id: REPLY.seeMags } },
  { id: 'codeAsked', text: 'Get the access code from the loader at the turbine.', reachedBy: { type: 'reply', npcKind: 'trader', id: REPLY.switchBack } },
  { id: 'loaderDown', text: 'Enter the access code at the turbine.', reachedBy: { type: 'defeat', tag: TAG.switchLoader } },
  // The terminals are there all along, so using one early mustn't skip ahead.
  { id: 'powerOn', text: 'Go back to Mags.', reachedBy: { type: 'use', id: 'switch' }, inOrder: true },
  { id: 'toldByMags', text: 'Go through Mags’s back door into the Foundry.', reachedBy: { type: 'reply', npcKind: 'trader', id: REPLY.goIn } },
  { id: 'inIntake', text: 'Take the access code from the loader.', reachedBy: { type: 'enter', levelId: 'intake' } },
  { id: 'doorCodeTaken', text: 'Make your way to the Control Gallery.', reachedBy: { type: 'defeat', tag: TAG.doorCodeLoader } },
  { id: 'inGallery', text: 'Find your way to the Control Centre.', reachedBy: { type: 'enter', levelId: 'gallery' } },
  { id: 'toldToCharge', text: 'Get your access back.', reachedBy: { type: 'use', id: 'access-terminal' }, inOrder: true },
  // Using the station shows its screen; plugging in uses it again, which restores U-7's access.
  { id: 'atCharger', text: 'Plug in at the charging station.', reachedBy: { type: 'use', id: 'charging-station' } },
  { id: 'charged', text: 'Go down to the Control Centre and free Odell.', reachedBy: { type: 'use', id: 'charging-station' } },
  { id: 'inControl', text: 'Deactivate the Order Engine.', reachedBy: { type: 'enter', levelId: 'control' } },
  // The machines stop where they stand and wait for orders.
  { id: 'engineDown', text: 'Find Odell.', reachedBy: { type: 'kill', enemyKind: 'orderEngine' }, does: ['calmEverything'] },
  { id: 'crateOpened', text: 'Talk to Odell.', reachedBy: { type: 'use', id: 'crate' } },
  { id: 'orderAsked', text: 'Cancel the order at the order terminal.', reachedBy: { type: 'reply', npcKind: 'foreman', id: REPLY.giveOrder } },
  { id: 'orderClosed', text: 'Take Odell home.', reachedBy: { type: 'use', id: 'order-terminal' }, inOrder: true },
  { id: 'freed', text: '', reachedBy: { type: 'reply', npcKind: 'foreman', id: REPLY.goHome }, takesHeroTo: BY_THE_FIRE },
  { id: 'ending', text: '', reachedBy: { type: 'reply', npcKind: 'foreman', id: REPLY.upriver }, takesHeroTo: UPRIVER },
] as const satisfies ReadonlyArray<QuestStep & { text: string; does?: readonly StepActionName[] }>;

/** Each step's place in the quest line, by name, for the code that compares steps. */
export const STEP = stepNumbers(QUEST);

/** The name of a quest step. */
export type StepId = keyof typeof STEP;
