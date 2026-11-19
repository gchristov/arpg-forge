import type { NpcType, QuestStep } from '../../../engine/sim/content';
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

export const NPCS: Record<string, NpcType> = {
  elder: { services: [] },
  innkeeper: { services: [{ type: 'restore' }, { type: 'sellHealingItem', price: 25 }] },
  smith: { services: [{ type: 'upgradeMelee', basePrice: 40, priceStep: 30, bonus: 3 }] },
};

export interface DialogueOption {
  label: string;
  /** Index into the NPC's services; options without one just close the dialogue. */
  service?: number;
  /** Shown on the right of the option, such as a price. */
  tag?: (price: number) => string;
}

export interface Dialogue {
  title: string;
  text: string;
  options: DialogueOption[];
}

/** What each NPC says, given the quest step before and after talking. */
export function dialogueFor(kind: string, questBefore: number, quest: number): Dialogue | null {
  switch (kind) {
    case 'elder': {
      const text =
        quest >= STEP.bossDefeated
          ? 'You did what no one else would. Rest well. The goblins in the woods will keep you sharp.'
          : questBefore === STEP.start
            ? 'Thank the old gods, a sword arm. Something woke beneath the Old Crypt, east past the graveyard. Bones walk at night. Put the Bone Lord back in the ground.'
            : 'The Old Crypt lies east, beyond the graves. Rest at the Sleeping Boar if you need it, and see the smith about that blade.';
      return { title: 'Elder Maren', text, options: [{ label: 'I’ll go' }] };
    }
    case 'innkeeper':
      return {
        title: 'Brann the Innkeeper',
        text: 'Sit by the fire a while, friend. A bed is free for anyone fighting those things.',
        options: [
          { label: 'Rest by the fire', service: 0, tag: () => 'Free' },
          { label: 'Buy a healing potion', service: 1, tag: (price) => `${price} gold` },
          { label: 'Leave' },
        ],
      };
    case 'smith':
      return {
        title: 'Hilde the Smith',
        text: 'Bring me gold and I’ll put a proper edge on that sword. Each hone costs more than the last.',
        options: [{ label: 'Hone your blade (+3 damage)', service: 0, tag: (price) => `${price} gold` }, { label: 'Leave' }],
      };
    default:
      return null;
  }
}
