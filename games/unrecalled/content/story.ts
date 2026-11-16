import type { NpcType, QuestStep } from '../../../engine/sim/content';

/**
 * Unrecalled's words. The story is mostly told by the places; these are the few lines it needs. The quiet question is
 * who the salvager is: every clue here points at U-7, the delivery unit that was never recalled.
 */

/** The quest: what the HUD says at each step, and what moves the quest to it. */
export const QUEST: Array<QuestStep & { text: string }> = [
  { text: 'Talk to the foreman by the fire.' },
  { text: 'Get into the Foundry through Mags’s depot.', reachedBy: { type: 'talk', npcKind: 'foreman' } },
  { text: 'Follow the line deeper.', reachedBy: { type: 'enter', levelId: 'sorting' } },
  { text: 'Get past the Control Gallery.', reachedBy: { type: 'enter', levelId: 'gallery' } },
  { text: 'Shut down the Order Engine.', reachedBy: { type: 'enter', levelId: 'assembly' } },
  // The machines power down and wait for instructions.
  { text: 'The Foundry has gone quiet. Tell the foreman.', reachedBy: { type: 'kill', enemyKind: 'orderEngine' }, calmsEverything: true },
  { text: 'The order was reassigned.', reachedBy: { type: 'talk', npcKind: 'foreman' } },
];

/** The quest step reached when the Order Engine falls. */
export const ENGINE_DOWN_STEP = 5;
/** The quest step reached by telling the foreman, which ends the story. */
export const ENDING_STEP = 6;

export const NPCS: Record<string, NpcType> = {
  foreman: { services: [] },
  trader: { services: [{ type: 'restore' }, { type: 'sellHealingItem', price: 20 }] },
  // Pell builds the chainsaw, then keeps whatever the salvager fights with sharp.
  tinker: { services: [{ type: 'sellWeapon', weapon: 'chainsaw', price: 60 }, { type: 'upgradeMelee', basePrice: 40, priceStep: 30, bonus: 3 }] },
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
          ? 'Found you in the river after the flood. Never asked. Not asking now. The Foundry’s taking the town apart a crate at a time; the chapel bell went last night. Mags’s depot backs onto it; go through her loading door and find what’s giving the orders. And if your fists won’t do, Pell will build you something, for scrap.'
          : weapon === null
            ? 'Through Mags’s loading door. Bring back scrap, and Pell will build you something better than your fists.'
            : 'Through Mags’s loading door. Whatever’s running that place, switch it off.';
      return { title: 'Foreman Odell', text, options: [{ label: quest >= ENDING_STEP ? 'Leave' : 'On my way' }] };
    }
    case 'trader':
      return {
        title: 'Mags the Trader',
        text: deaths > 0
          ? 'Patched up again. You’re getting expensive.'
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
          text: 'You’re going down there with your fists? Those machines are built to lift crates. There’s a saw in the back that only wants an engine. Bring me scrap and I’ll give it teeth.',
          options: [
            { label: 'Build the chainsaw', service: 0, tag: (price) => `${price} scrap` },
            { label: 'Harden your knuckles (+3 damage)', service: 1, tag: (price) => `${price} scrap` },
            { label: 'Leave' },
          ],
        }
        : {
          title: 'Pell the Tinker',
          text: 'Mind the chain. It doesn’t care what it’s cutting. Bring scrap and I’ll keep it biting.',
          options: [{ label: 'Sharpen the chain (+3 damage)', service: 1, tag: (price) => `${price} scrap` }, { label: 'Leave' }],
        };
    default:
      return null;
  }
}

/** The banner once the chainsaw is in the salvager's hands. */
export const CHAINSAW_FOUND = { title: 'The chainsaw', subtitle: 'It keeps cutting for as long as you hold it on them.' };

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
