import type { NpcType, QuestStep } from '../../../engine/sim/content';
import type { Speaker } from '../../../engine/ui/message-feed';

/**
 * Unrecalled's words. The story is mostly told by the places; these are the few lines it needs. The quiet question is
 * who the salvager is: every clue here points at U-7, the delivery unit that was never recalled.
 */

/** The quest: what the HUD says at each step, and what moves the quest to it. */
export const QUEST: Array<QuestStep & { text: string }> = [
  { text: 'Talk to the foreman by the fire.' },
  { text: 'Find Pell’s old saw at the logging camp, east through the woods.', reachedBy: { type: 'talk', npcKind: 'foreman' } },
  { text: 'Throw the breaker on the camp’s turbine.', reachedBy: { type: 'arm', weapon: 'chainsaw' } },
  // Throwing the breaker first skips the saw: it stays in its crate for whoever goes back for it.
  { text: 'Get into the Foundry through Mags’s loading door.', reachedBy: { type: 'use', id: 'breaker' } },
  { text: 'Follow the line deeper.', reachedBy: { type: 'enter', levelId: 'sorting' } },
  { text: 'Get past the Control Gallery.', reachedBy: { type: 'enter', levelId: 'gallery' } },
  { text: 'Shut down the Order Engine.', reachedBy: { type: 'enter', levelId: 'assembly' } },
  // The machines power down and wait for instructions.
  { text: 'The Foundry has gone quiet. Tell the foreman.', reachedBy: { type: 'kill', enemyKind: 'orderEngine' }, calmsEverything: true },
  { text: 'The order was reassigned.', reachedBy: { type: 'talk', npcKind: 'foreman' } },
];

/** The quest step reached by throwing the breaker, which opens Mags's loading door into the Foundry. */
export const POWER_ON_STEP = 3;
/** The quest step reached when the Order Engine falls. */
export const ENGINE_DOWN_STEP = 7;
/** The quest step reached by telling the foreman, which ends the story. */
export const ENDING_STEP = 8;

export const NPCS: Record<string, NpcType> = {
  foreman: { services: [] },
  trader: { services: [{ type: 'restore' }, { type: 'sellHealingItem', price: 20 }] },
  // Pell keeps whatever the salvager fights with sharp: their knuckles, then her old saw.
  tinker: { services: [{ type: 'upgradeMelee', basePrice: 40, priceStep: 30, bonus: 3 }] },
};

export interface DialogueOption {
  label: string;
  /** Index into the NPC's services; options without one close the dialogue. */
  service?: number;
  /** Shown beside the option, such as a price. */
  tag?: (price: number) => string;
}

export interface Dialogue {
  title: string;
  text: string;
  options: DialogueOption[];
}

/**
 * What each townsperson says, given the quest step before and after talking, how often the salvager has gone down and
 * the weapon in their hand. The foreman's last line starts the ending.
 */
export function dialogueFor(kind: string, questBefore: number, quest: number, deaths: number, weapon: string | null): Dialogue | null {
  switch (kind) {
    case 'foreman': {
      if (quest >= ENDING_STEP && questBefore < ENDING_STEP) {
        return {
          title: 'Foreman Odell',
          text: 'It went quiet down there. Every machine just stopped, like they were waiting. The relay said reassigned. Reassigned to who? … So. What does it want you to do?',
          options: [{ label: 'I don’t know yet.' }],
        };
      }
      const text = quest >= ENDING_STEP
        ? 'Whatever it wants, it’ll ask you first. It always did.'
        : questBefore === 0
          ? 'Found you in the river after the flood. Never asked. Not asking now. The Foundry’s taking the town apart a crate at a time; the chapel bell went last night. Mags’s depot backs onto it, but her loading door’s been dead since the machines threw the breaker at the logging camp, east through the woods past the pumphouse. Throw it back. Pell left her old saw out there, too. Your fists won’t get you far.'
          : quest >= POWER_ON_STEP
            ? 'Heard the turbine from here. Mags’s door is open; go through and find what’s giving the orders, and switch it off.'
            : weapon === null
              ? 'East through the woods to the logging camp. Pell’s saw is in a crate by the bench, and the breaker’s on the turbine.'
              : 'Found Pell’s saw, then. Now the breaker on the turbine, and Mags’s door will open.';
      return { title: 'Foreman Odell', text, options: [{ label: quest >= ENDING_STEP ? 'Leave' : 'On my way' }] };
    }
    case 'trader':
      return {
        title: 'Mags the Trader',
        text: deaths > 0
          ? 'Patched up again. You’re getting expensive.'
          : quest > 0 && quest < POWER_ON_STEP
            ? 'The loading door? Dead since they cut the power. Get the breaker thrown and it’s yours. Patch kits first?'
            : 'Patch kits, fresh off the line. Well, a line. Sit down and I’ll see to those dents for free.',
        options: [
          { label: 'Get patched up', service: 0, tag: () => 'Free' },
          { label: 'Buy a patch kit', service: 1, tag: (price) => `${price} scrap` },
          { label: 'Leave' },
        ],
      };
    case 'tinker':
      return weapon === null
        ? {
          title: 'Pell the Tinker',
          text: 'You’re going out there with your fists? Those machines are built to lift crates. I left my old saw at the logging camp when they came for the turbine; it’s in a crate by the bench. Till you fetch it, I can harden those knuckles.',
          options: [{ label: 'Harden your knuckles (+3 damage)', service: 0, tag: (price) => `${price} scrap` }, { label: 'Leave' }],
        }
        : {
          title: 'Pell the Tinker',
          text: 'You found her. Mind the chain; it doesn’t care what it’s cutting. Bring scrap and I’ll keep it biting.',
          options: [{ label: 'Sharpen the chain (+3 damage)', service: 0, tag: (price) => `${price} scrap` }, { label: 'Leave' }],
        };
    default:
      return null;
  }
}

/** Who speaks in the message feed, besides the people in town; lines with no speaker are what the salvager notices. */
export const VOICES = {
  foundry: { name: 'Foundry', voice: 'foundry' },
  orderEngine: { name: 'The Order Engine', voice: 'foundry' },
} satisfies Record<string, Speaker>;

/** Once the chainsaw is in the salvager's hands. */
export const CHAINSAW_FOUND = 'The chainsaw. It keeps cutting for as long as you hold it on them.';

/** Said over a door the story hasn't opened yet. */
export const LOCKED = 'No power';

/** The last thing the player sees: the main question closed, the twist landed, and the next question opened. */
export const ENDING = {
  upriver: { title: 'Upriver, a light comes on', subtitle: 'FOUNDRY 2 REQUESTS STATUS.' },
  card: { title: 'The order was never cancelled.', subtitle: 'It was reassigned.' },
};

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
  'depot-ledger': {
    title: 'Depot ledger',
    text: 'FOUNDRY DELIVERIES, SIGNED FOR. U-3, U-4, U-5, U-6: received, Rustbelt depot. U-7: dispatched. Never signed for. In the margin, newer ink: Ask the new one where they came from.',
  },
  'pump-log': {
    title: 'Pump log',
    text: 'NIGHT OF THE FLOOD. 02:14: Foundry intake gate opened from the inside. 02:15: Pumps overwhelmed. 02:16: Something walked out with the water.',
  },
  riverbank: {
    title: 'A post on the bank',
    text: 'Someone carved a mark on the jetty post: FOUND, NIGHT OF THE FLOOD. Below it, smaller: DIDN’T BREATHE FOR AN HOUR. THEN GOT UP.',
  },
  breaker: {
    title: 'Breaker',
    text: 'Someone wired it open and bent the handle. You force it home. The turbine shudders, and far off towards town a loading door clanks.',
  },
  cradle: {
    title: 'Charging cradle',
    text: 'A cradle shaped for something about your size. The plate reads U-7. It is still warm.',
  },
};

/** Lines the machines speak. */
/** What a machine with a scanner says on looking the salvager over: it knows what they are. */
export const MACHINE_SCANS = 'SCANNING… UNIT RECOGNISED';
/** When a fight starts: what the Foundry's speakers say, and what the salvager sees anywhere. */
export const ALARM = { foundry: 'LINE BREACH ALERT.', turns: 'Every machine around turns toward you.' };
export const ENGINE_CALLS = { says: 'U-7. You are late.', then: 'The Order Engine calls the line to it.' };
export const ENGINE_FALLS = { then: 'The Order Engine falls silent.', foundry: 'ORDER REASSIGNED.' };
export const levelUp = (level: number) => `Level ${level}. Patched up, and hitting harder.`;
export const scrapDropped = (amount: number) => `Back on your feet. You dropped ${amount} scrap in the scramble.`;
