import type { QuestStep } from '../../../engine/sim/content';
import { stepNumbers } from '../../../engine/sim/story-steps';

/** The quest line: what the HUD says at each step, and what moves the quest to it. */
export const QUEST = [
  { id: 'start', text: 'Speak to Elder Maren in the square.' },
  { id: 'sentToCrypt', text: 'Clear the Old Crypt, east past the graveyard.', reachedBy: { type: 'talk', npcKind: 'elder' } },
  { id: 'inCrypt', text: 'Find the Bone Lord in the crypt’s north chamber.', reachedBy: { type: 'enter', levelId: 'crypt' } },
  { id: 'bossDefeated', text: 'The Bone Lord is dead. Hunt what’s left in the wilds.', reachedBy: { type: 'kill', enemyKind: 'boss' } },
] as const satisfies ReadonlyArray<QuestStep & { text: string }>;

/** Each step's place in the quest line, by name, for the code that compares steps. */
export const STEP = stepNumbers(QUEST);

/** The name of a quest step. */
export type StepId = keyof typeof STEP;
