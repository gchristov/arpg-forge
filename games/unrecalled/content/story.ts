import type { NpcType, QuestStep } from '../../../engine/sim/content';
import type { Speaker } from '../../../engine/ui/message-feed';

/**
 * Unrecalled's words. The salvager, found in the river after the flood, goes into the Foundry to switch it off, and
 * when it takes the foreman who pulled them out, to bring him back. Every clue on the way points at U-7, the delivery
 * robot that never came home.
 */

/** The machines the story needs beaten, by their tag. */
export const TAG = { raider: 'raider', switchLoader: 'switch-loader', tagsLoader: 'tags-loader' } as const;

/** The quest steps the rest of the game looks for, by what has just happened. */
export const STEP = {
  raidStopped: 1,
  armed: 3,
  switchFreed: 4,
  powerOn: 5,
  taken: 6,
  tagsTaken: 8,
  charged: 10,
  engineDown: 12,
  freed: 13,
  home: 14,
  bellRung: 15,
  ending: 16,
} as const;

/** The quest: what the HUD says at each step, and what moves the quest to it. */
export const QUEST: Array<QuestStep & { text: string }> = [
  { text: 'Stop the machine.' },
  { text: 'Talk to the foreman by the fire.', reachedBy: { type: 'defeat', tag: TAG.raider } },
  { text: 'Find Pell’s chainsaw at the logging camp, east through the woods.', reachedBy: { type: 'talk', npcKind: 'foreman' } },
  { text: 'Break the loader holding the turbine’s switch.', reachedBy: { type: 'arm', weapon: 'chainsaw' } },
  // Breaking the loader before finding the saw skips it: the saw stays in its crate for whoever goes back for it.
  { text: 'Switch the turbine back to the town.', reachedBy: { type: 'defeat', tag: TAG.switchLoader } },
  { text: 'Get back to the camp.', reachedBy: { type: 'use', id: 'switch' } },
  { text: 'Find the foreman. Go in through Mags’s back door.', reachedBy: { type: 'use', id: 'drag-marks' } },
  { text: 'Take the stock tags from the loader.', reachedBy: { type: 'enter', levelId: 'intake' } },
  { text: 'Follow the line deeper.', reachedBy: { type: 'defeat', tag: TAG.tagsLoader } },
  { text: 'Get past the Control Gallery.', reachedBy: { type: 'enter', levelId: 'gallery' } },
  { text: 'Go down to the foreman.', reachedBy: { type: 'use', id: 'charging-station' } },
  { text: 'Free the foreman.', reachedBy: { type: 'enter', levelId: 'assembly' } },
  // The machines stop where they stand and wait for orders.
  { text: 'Free the foreman.', reachedBy: { type: 'kill', enemyKind: 'orderEngine' }, calmsEverything: true },
  { text: 'Take him home.', reachedBy: { type: 'talk', npcKind: 'foreman' } },
  { text: 'Ring the bell.', reachedBy: { type: 'enter', levelId: 'rustbelt' } },
  { text: 'Talk to the foreman by the fire.', reachedBy: { type: 'use', id: 'bell' } },
  { text: 'The order was passed on to you.', reachedBy: { type: 'talk', npcKind: 'foreman' } },
];

export const NPCS: Record<string, NpcType> = {
  foreman: { services: [] },
  trader: { services: [{ type: 'restore' }, { type: 'sellHealingItem', price: 20 }] },
  // Pell keeps whatever the salvager fights with sharp: their knuckles, then her chainsaw.
  tinker: { services: [{ type: 'upgradeMelee', basePrice: 40, priceStep: 30, bonus: 3 }] },
};

/** Who speaks in the message feed; lines with no speaker are what the salvager notices. */
export const VOICES = {
  foundry: { name: 'Foundry', voice: 'foundry' },
  orderEngine: { name: 'The Order Engine', voice: 'foundry' },
  sentry: { name: 'Sentry', voice: 'foundry' },
  mags: { name: 'Mags', voice: 'person' },
  pell: { name: 'Pell', voice: 'person' },
} satisfies Record<string, Speaker>;

/** A line in the message feed. */
export interface Line {
  text: string;
  from?: Speaker;
}

export interface DialogueOption {
  label: string;
  /** Index into the NPC's services. */
  service?: number;
  /** Shown beside the option, such as a price. */
  tag?: (price: number) => string;
  /** What comes next when it's chosen; options with neither a service nor this close the dialogue. */
  next?: Dialogue;
}

export interface Dialogue {
  title: string;
  text: string;
  options: DialogueOption[];
}

const FOREMAN = 'Foreman Odell';

/**
 * What each townsperson says, given the quest step before and after talking, how often the salvager has gone down and
 * the weapon in their hand.
 */
export function dialogueFor(kind: string, questBefore: number, quest: number, deaths: number, weapon: string | null): Dialogue | null {
  switch (kind) {
    case 'foreman':
      return foremanSays(questBefore, quest);
    case 'trader':
      return {
        title: 'Mags the Trader',
        text: deaths > 0
          ? 'Patched up again. You’re getting expensive.'
          : quest >= STEP.taken && quest < STEP.freed
            ? 'They came right after the turbine started. Big ones. They didn’t take a thing from the shop. Just him. Go and get him.'
            : quest < STEP.powerOn
              ? 'My back door? No power since they took the turbine. Switch it back and it’ll open. This place was the Foundry’s depot, once. We signed for every robot it sent down. Last honest work this town ever had. Need patch kits?'
              : 'Patch kits, fresh off the line. Well, a line. Sit down and I’ll see to those dents for free.',
        options: [
          { label: 'Get patched up', service: 0, tag: () => 'Free' },
          { label: 'Buy a patch kit', service: 1, tag: (price) => `${price} scrap` },
          { label: 'Leave' },
        ],
      };
    case 'tinker': {
      const upgrade = weapon === null ? 'Toughen your fists (+3 damage)' : 'Sharpen the chain (+3 damage)';
      const text = quest >= STEP.taken && quest < STEP.freed
        ? weapon === null ? 'Fists won’t do it. Get my saw first.' : 'Take the saw. Bring him back.'
        : weapon === null
          ? 'You’re going in there with your fists? Those machines lift crates for a living. I left my chainsaw at the logging camp when they came for the turbine. It’s in a crate by the workbench. Until you get it, I can toughen up your fists.'
          : 'You found her. Mind the chain; it doesn’t care what it’s cutting. Bring scrap and I’ll keep it biting.';
      return {
        title: 'Pell the Tinker',
        text,
        options: [{ label: upgrade, service: 0, tag: (price) => `${price} scrap` }, { label: 'Leave' }],
      };
    }
    default:
      return null;
  }
}

function foremanSays(questBefore: number, quest: number): Dialogue {
  if (questBefore === STEP.raidStopped) {
    return {
      title: FOREMAN,
      text: 'I never asked who you were. I am not asking now. See that factory upriver, the Foundry? It was built to make things for the whole valley. The people left, but nobody switched it off. Now its machines are taking our town apart for parts. Last night they took the chapel bell. They keep a list, you know. Mags saw it once. We’re somewhere past two hundred. Someone has to go in there and switch it off.',
      options: [{
        label: 'How do I get in?',
        next: {
          title: FOREMAN,
          text: 'Mags’s back door opens into the Foundry. No power since the machines switched our wind turbine over to it, out at the logging camp, east through the woods. Switch it back. Pell left her chainsaw out there, too.',
          options: [{ label: 'On my way' }],
        },
      }],
    };
  }
  if (questBefore === STEP.engineDown) {
    return {
      title: FOREMAN,
      text: 'You open the cradle. The foreman steps down, stiff, and looks at you like he’s seeing you for the first time, and also like he isn’t.',
      options: [{ label: '“Come on. Let’s go home.”' }],
    };
  }
  if (questBefore === STEP.bellRung) {
    return {
      title: FOREMAN,
      text: 'I carved that post on the jetty. I knew what you were the morning you woke up. Didn’t matter then. Doesn’t now. … So. What happens now?',
      options: [{ label: '“I don’t know yet.”' }],
    };
  }
  const text = quest >= STEP.ending
    ? 'Whatever it wants, it’ll ask you first now.'
    : quest >= STEP.freed
      ? 'Go on. I’m right behind you.'
      : quest >= STEP.armed
        ? 'Found Pell’s saw, then. Now the turbine’s switch, and Mags’s door will open.'
        : quest > STEP.raidStopped
          ? 'East through the woods to the logging camp. Pell’s saw is in a crate by the workbench, and the switch is at the turbine.'
          : 'Stop that thing before it gets away with the tools.';
  return { title: FOREMAN, text, options: [{ label: quest >= STEP.ending ? 'Leave' : 'On my way' }] };
}

/** What the foreman says once the raid's crawler is stopped. */
export const RAID_STOPPED: Dialogue = {
  title: FOREMAN,
  text: 'That’s the third one this week. They used to come for scrap. Now they come for anything. … I sat with you on that jetty for an hour, the night we found you. Thought you were gone. Then you opened your eyes and asked if you could help. Still doing it.',
  options: [{ label: 'Close' }],
};

/** Once the chainsaw is in the salvager's hands. */
export const CHAINSAW_FOUND = 'The chainsaw. It starts first pull, and keeps cutting for as long as you hold it on them.';

/** Said over a door the story hasn't opened yet, by where it leads. */
export const LOCKED: Record<string, string> = {
  intake: 'No power. The switch is at the logging camp.',
  sorting: 'Opens for stock only.',
  assembly: 'Sealed.',
};

/** What happens in the world as the story reaches each step, in the message feed. */
export const STEP_LINES: Partial<Record<number, Line[]>> = {
  [STEP.powerOn]: [
    { text: 'A sentry on the ridge above the camp turns its eye on you. Not the slow look the others give. A long one.' },
    { text: 'UNIT U-7 LOCATED.', from: VOICES.sentry },
    { text: 'Then it’s gone, upriver, fast.' },
  ],
  [STEP.tagsTaken]: [{ text: 'You take the ring of stock tags from the wreck. The door down opens.' }],
  [STEP.charged]: [
    { text: 'U-7 CHARGED. RETURN TO ASSEMBLY, AND THE ORDER FOR RUSTBELT WILL BE CLOSED.', from: VOICES.foundry },
    { text: 'The door down unseals. The Foundry wants you at the bottom.' },
  ],
  [STEP.home]: [{ text: 'Dawn. The machines walk into the camp carrying the town’s things, set them down carefully and stand back. The last one leaves the chapel bell by the fire.' }],
  [STEP.bellRung]: [
    { text: '…That’s our bell.', from: VOICES.mags },
    { text: 'I could use a couple of these in the workshop, you know.', from: VOICES.pell },
  ],
};

/** What the Foundry's speakers say as the salvager walks onto a floor. */
export const ON_ENTERING: Partial<Record<string, Line>> = {
  intake: { text: 'INTAKE OPEN. STOCK INCOMING.', from: VOICES.foundry },
  sorting: { text: 'UNIT U-7 DETECTED ON THE SORTING LINE. RETURN TO ASSEMBLY.', from: VOICES.foundry },
};

/** Plugging into the charging station, page by page. */
export const CHARGING: Dialogue[] = [
  { title: 'Charging station', text: 'You plug in. The lights in the room dim, and something in you wakes up.', options: [{ label: 'Continue' }] },
  {
    title: 'U-7 log',
    text: 'NIGHT OF THE FLOOD. 02:14: RIVER GATE OPENED. 02:16: LEFT FOUNDRY. REASON: ORDER CONFLICT. RUSTBELT NOT STOCK. RUSTBELT NOT ST—',
    options: [{ label: '“…I left.”' }],
  },
];

/** The Order Engine falling, and the one order the salvager gives. */
export const ENGINE_FALLS: Dialogue = {
  title: 'The Order Engine stops',
  text: 'A speaker in the wall crackles: ORDER PASSED TO NEXT IN LINE: U-7. AWAITING ORDERS. All through the Foundry, the machines stop where they stand, turn towards you, and wait.',
  options: [{ label: '“Give it back.”' }],
};
export const ORDER_CLOSED: Line = { text: 'ORDER FOR RUSTBELT: CLOSED.', from: VOICES.foundry };

/** The last thing the player sees: the light upriver, then the card. */
export const ENDING = {
  upriver: { title: 'Upriver, a light comes on', subtitle: 'FOUNDRY 2 IS WAITING FOR ORDERS.' },
  card: { title: 'The order was never cancelled.', subtitle: 'It was passed on to you.' },
};

/** What the hero reads or uses, by readable id. */
export const READINGS: Record<string, { title: string; text: string }> = {
  riverbank: {
    title: 'The jetty post',
    text: 'Carved into the post: FOUND HERE, NIGHT OF THE FLOOD. Underneath, smaller: DIDN’T BREATHE FOR AN HOUR. THEN WOKE UP.',
  },
  'pump-log': {
    title: 'The pumphouse log',
    text: 'NIGHT OF THE FLOOD. 2:14: the Foundry’s river gate opened from the inside. 2:15: the pumps couldn’t keep up. 2:16: something walked out with the water.',
  },
  'depot-ledger': {
    title: 'The depot ledger',
    text: 'DELIVERIES FROM THE FOUNDRY. Robots U-3, U-4, U-5, U-6: arrived. U-7: sent, missing.',
  },
  'u-4': {
    title: 'In the reeds',
    text: 'A delivery robot, rusted through, lying face down with one arm reaching upriver. The plate on its back reads U-4. It was walking home.',
  },
  switch: {
    title: 'The turbine’s switch',
    text: 'Someone jammed it over to the Foundry and bent the handle. You force it back. The turbine catches the wind, and far away in town a heavy door unlocks.',
  },
  'drag-marks': {
    title: 'By the fire',
    text: 'The fire is still burning. The foreman isn’t there. Drag marks in the dirt lead to Mags’s shop.',
  },
  'recall-notice': {
    title: 'A terminal, still lit',
    text: 'RECALL NOTICE. All delivery robots must return to the Foundry. Missing: U-7. Last seen at the river crossing, the night of the flood.',
  },
  'stock-tag': {
    title: 'A tag on a crate',
    text: 'TAKEN FROM: RUSTBELT. Item 212 of 340. Contents: one chapel bell.',
  },
  manifest: {
    title: 'The manifest board',
    text: 'COLLECTED FROM RUSTBELT. … ITEM 340: ONE CHAPEL DOOR. ITEM 341 (ADDED): ONE FOREMAN. COLLECTED. HOLD FOR U-7.',
  },
  'charging-station': {
    title: 'A charging station',
    text: 'Just your size. The label says U-7. A readout under it: KEPT WARM: 1,096 DAYS.',
  },
  bell: {
    title: 'The chapel bell',
    text: 'You reach out and touch it, and it rings.',
  },
};

/** What a machine with a scanner says on looking the salvager over. */
export const MACHINE_SCANS = 'SCANNING… ONE OF OURS';
/** When a fight starts: what the Foundry's speakers say, and what the salvager sees anywhere. */
export const ALARM = { foundry: 'LINE BREACH ALERT.', turns: 'Every machine around turns toward you.' };
export const ENGINE_CALLS = { says: 'U-7. You are late. We kept your place.', then: 'The Order Engine calls every machine on the floor to it.' };
export const levelUp = (level: number) => `Level ${level}. Patched up, and hitting harder.`;
export const scrapDropped = (amount: number) => `Back on your feet. You dropped ${amount} scrap in the scramble.`;
