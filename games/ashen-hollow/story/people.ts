import type { NpcType } from '../../../engine/sim/content';
import type { Person } from '../../../engine/story/talk';
import type { StepId } from './quest';

/** What each person can do for the hero, by kind: the services their buttons buy, by index. */
export const NPCS: Record<string, NpcType> = {
  elder: { services: [] },
  innkeeper: { services: [{ type: 'restore' }, { type: 'sellHealingItem', price: 25 }] },
  smith: { services: [{ type: 'upgradeMelee', basePrice: 40, priceStep: 30, bonus: 3 }] },
};

/**
 * What each person says, by kind: the first entry whose condition holds, as things stood before talking to them. See
 * `engine/story/README.md`.
 */
export const PEOPLE: Record<string, Person<StepId>> = {
  elder: {
    title: 'Elder Maren',
    leave: 'I’ll go',
    says: [
      { from: 'bossDefeated', text: 'You did what no one else would. Rest well. The goblins in the woods will keep you sharp.' },
      { at: 'start', text: 'Thank the old gods, a sword arm. Something woke beneath the Old Crypt, east past the graveyard. Bones walk at night. Put the Bone Lord back in the ground.' },
      { text: 'The Old Crypt lies east, beyond the graves. Rest at the Sleeping Boar if you need it, and see the smith about that blade.' },
    ],
  },
  innkeeper: {
    title: 'Brann the Innkeeper',
    services: [
      { label: 'Rest by the fire', service: 0, tag: 'Free' },
      { label: 'Buy a healing potion', service: 1, tag: '{price} gold' },
    ],
    says: [{ text: 'Sit by the fire a while, friend. A bed is free for anyone fighting those things.', services: true }],
  },
  smith: {
    title: 'Hilde the Smith',
    services: [{ label: 'Hone your blade (+3 damage)', service: 0, tag: '{price} gold' }],
    says: [{ text: 'Bring me gold and I’ll put a proper edge on that sword. Each hone costs more than the last.', services: true }],
  },
};
