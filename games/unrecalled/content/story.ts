import type { NpcType, QuestStep } from '../../../engine/sim/content';
import type { Speaker } from '../../../engine/ui/message-feed';

/**
 * Unrecalled's words. The salvager, found in the river after the flood, goes into the Foundry to switch it off, and
 * when it takes the foreman who pulled them out, to bring him back. Every clue on the way points at U-7, the delivery
 * robot that never came home. Every line says plainly what has happened and what to do next.
 */

/** The replies the story waits for, by their id. */
export const REPLY = {
  onIt: 'on-it',
  seePell: 'see-pell',
  getSaw: 'get-saw',
  showWay: 'show-me-the-way',
  giveOrder: 'give-the-order',
  goHome: 'go-home',
  dontKnow: 'dont-know',
} as const;

/** The machines the story needs beaten, by their tag. */
export const TAG = { raider: 'raider', switchLoader: 'switch-loader', tagsLoader: 'tags-loader' } as const;

/** The quest steps the rest of the game looks for, by what has just happened. */
export const STEP = {
  raidAsked: 1,
  raidStopped: 2,
  sentToPell: 3,
  sawAsked: 4,
  loaderDown: 5,
  powerOn: 6,
  toldByMags: 7,
  tagsTaken: 9,
  toldToCharge: 11,
  charged: 12,
  engineDown: 14,
  crateOpened: 15,
  orderAsked: 16,
  orderClosed: 17,
  freed: 18,
  bellRung: 19,
  ending: 20,
} as const;

/** Back in Rustbelt by the fire, where the salvager arrives with the foreman. */
const BY_THE_FIRE = { levelId: 'rustbelt', x: 22.5, y: 15.5 };
/** Upriver, outside the second Foundry, where the story ends. */
export const UPRIVER = { levelId: 'upriver', x: 22.5, y: 24.5 };

/** The quest: what the HUD says at each step, and what moves the quest to it. */
export const QUEST: Array<QuestStep & { text: string }> = [
  { text: 'Talk to the foreman by the fire.' },
  { text: 'Stop the crawler making off with the camp’s tools.', reachedBy: { type: 'reply', npcKind: 'foreman', id: REPLY.onIt } },
  { text: 'Talk to the foreman again.', reachedBy: { type: 'defeat', tag: TAG.raider } },
  { text: 'Talk to Pell in her workshop.', reachedBy: { type: 'reply', npcKind: 'foreman', id: REPLY.seePell } },
  { text: 'Take the turbine’s access code from the loader at the logging camp, east through the woods.', reachedBy: { type: 'reply', npcKind: 'tinker', id: REPLY.getSaw } },
  { text: 'Enter the access code at the turbine’s terminal.', reachedBy: { type: 'defeat', tag: TAG.switchLoader } },
  // The terminals are there all along, so using one early mustn't skip ahead.
  { text: 'Go back to the foreman by the fire.', reachedBy: { type: 'use', id: 'switch' }, inOrder: true },
  { text: 'Go through Mags’s back door into the Foundry.', reachedBy: { type: 'reply', npcKind: 'trader', id: REPLY.showWay } },
  { text: 'Take the stock tags from the loader.', reachedBy: { type: 'enter', levelId: 'intake' } },
  { text: 'Make your way to the Control Gallery.', reachedBy: { type: 'defeat', tag: TAG.tagsLoader } },
  { text: 'Find your way to the Assembly Hall.', reachedBy: { type: 'enter', levelId: 'gallery' } },
  { text: 'Get charged up at the charging station, to get through the door.', reachedBy: { type: 'use', id: 'access-terminal' }, inOrder: true },
  { text: 'Go down to the Assembly Hall and free the foreman.', reachedBy: { type: 'use', id: 'charging-station' } },
  { text: 'Beat the Order Engine.', reachedBy: { type: 'enter', levelId: 'assembly' } },
  // The machines stop where they stand and wait for orders.
  { text: 'Find Odell the foreman.', reachedBy: { type: 'kill', enemyKind: 'orderEngine' }, calmsEverything: true },
  { text: 'Talk to the foreman.', reachedBy: { type: 'use', id: 'crate' } },
  { text: 'Give the Foundry its order at the order terminal.', reachedBy: { type: 'reply', npcKind: 'foreman', id: REPLY.giveOrder } },
  { text: 'Take the foreman home.', reachedBy: { type: 'use', id: 'order-terminal' }, inOrder: true },
  { text: 'Ring the bell by the fire.', reachedBy: { type: 'reply', npcKind: 'foreman', id: REPLY.goHome }, takesHeroTo: BY_THE_FIRE },
  { text: 'Talk to the foreman.', reachedBy: { type: 'use', id: 'bell' } },
  { text: 'The order was passed on to you.', reachedBy: { type: 'reply', npcKind: 'foreman', id: REPLY.dontKnow }, takesHeroTo: UPRIVER },
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
  foundry2: { name: 'Foundry 2', voice: 'foundry' },
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
  /** The reply's id, for a quest step that waits for it. */
  reply?: string;
  /** What comes next when it's chosen; options with neither a service nor this close the dialogue. */
  next?: Dialogue;
}

export interface Dialogue {
  title: string;
  text: string;
  options: DialogueOption[];
}

const FOREMAN = 'Foreman Odell';
const MAGS = 'Mags the Trader';
const PELL = 'Pell the Tinker';
const FOUNDRY = 'Foundry';

/** What each townsperson says, given the quest step, how often the salvager has gone down and the weapon in their hand. */
export function dialogueFor(kind: string, quest: number, deaths: number, weapon: string | null): Dialogue | null {
  switch (kind) {
    case 'foreman':
      return foremanSays(quest);
    case 'trader':
      return magsSays(quest, deaths);
    case 'tinker':
      return pellSays(quest, weapon);
    default:
      return null;
  }
}

/** Waking up by the fire: who found the salvager, what the Foundry is doing, and a machine doing it right there. */
const theOpening: Dialogue = {
  title: FOREMAN,
  text: 'Feeling better? I found you in the river after the flood and pulled you out. I didn’t ask who you were then, and I’m not asking now.',
  options: [{
    label: '…',
    next: {
      title: FOREMAN,
      text: 'The Foundry, the factory upriver, is taking this town apart for parts. Its machines come down every night. … Look, there’s one now, by the crates! Go and stop it.',
      options: [{ label: 'On it', reply: REPLY.onIt }],
    },
  }],
};

/** After the raid: who Mags is, the way in, and who to see about it. */
const theJob: Dialogue = {
  title: FOREMAN,
  text: 'Good work. That’s the third machine this week. They used to take only scrap; now they take anything. Last night it was the chapel bell.',
  options: [{
    label: '…',
    next: {
      title: FOREMAN,
      text: 'Mags runs the shop across the square. It was the Foundry’s depot: she signed for every robot it sent down, and her back door still leads into the Foundry. If we’re going to switch that place off, that’s the way in.',
      options: [{
        label: 'So let’s go in.',
        next: {
          title: FOREMAN,
          text: 'Her door has had no power since the machines switched our wind turbine over to the Foundry. The turbine is at the logging camp, east through the woods. Pell knows it best; she ran the camp. Go and see her in her workshop.',
          options: [{ label: 'I’ll talk to Pell.', reply: REPLY.seePell }],
        },
      }],
    },
  }],
};

/** Out of the crate: the foreman, and where the Foundry's orders are given. */
const theRescue: Dialogue = {
  title: FOREMAN,
  text: 'You came for me. … When that big machine fell, every machine in here stopped where it stood. They’re waiting for someone to give them orders, and the orders come from that terminal.',
  options: [{ label: '“I’ll give them one.”', reply: REPLY.giveOrder }],
};

/** The order closed: the machines carry the town's things back, and the salvager takes the foreman home. */
const homeward: Dialogue = {
  title: FOREMAN,
  text: 'The machines are carrying our things back up the line. Did they just… listen to you?',
  options: [{ label: '“Come on. Let’s go home.”', reply: REPLY.goHome }],
};

function foremanSays(quest: number): Dialogue {
  if (quest === 0) return theOpening;
  if (quest === STEP.raidStopped) return theJob;
  if (quest === STEP.crateOpened) return theRescue;
  if (quest === STEP.orderClosed) return homeward;
  if (quest === STEP.bellRung) {
    return {
      title: FOREMAN,
      text: 'I carved that post on the jetty. I knew what you were the morning you woke up. It didn’t matter then, and it doesn’t now. … So, what happens now?',
      options: [{ label: '“I don’t know yet.”', reply: REPLY.dontKnow }],
    };
  }
  const text = quest >= STEP.ending
    ? 'Whatever the machines do now, they’ll ask you first.'
    : quest >= STEP.freed
      ? 'Go on, ring it. It’s been too quiet.'
      : quest === STEP.orderAsked
        ? 'The terminal. Tell them what to do.'
        : quest >= STEP.sawAsked
          ? 'Get the access code from the loader at the turbine, east through the woods, and switch the turbine back.'
          : quest === STEP.sentToPell
            ? 'Pell’s workshop is here in town. She’ll tell you about the turbine.'
            : 'Stop that crawler before it gets away with the tools!';
  return { title: FOREMAN, text, options: [{ label: quest >= STEP.ending ? 'Leave' : 'On my way' }] };
}

const MAGS_SERVICES: DialogueOption[] = [
  { label: 'Get patched up', service: 0, tag: () => 'Free' },
  { label: 'Buy a patch kit', service: 1, tag: (price) => `${price} scrap` },
  { label: 'Leave' },
];

function magsSays(quest: number, deaths: number): Dialogue {
  if (quest === STEP.powerOn) {
    return {
      title: MAGS,
      text: 'The machines took Odell! They came right after the turbine started up and dragged him through my back door, into the Foundry.',
      options: [{
        label: '“Show me the way.”',
        reply: REPLY.showWay,
        next: {
          title: MAGS,
          text: 'Through my shop. The back door has power now. Bring Odell home.',
          options: [{ label: 'On my way' }],
        },
      }],
    };
  }
  const text = deaths > 0 && quest < STEP.freed
    ? 'Patched up again. You’re getting expensive.'
    : quest >= STEP.freed
      ? 'You brought Odell home, and the bell with him. Thank you. Patching you up is on me from now on.'
      : quest > STEP.powerOn
        ? 'My back door is open. Bring Odell home.'
        : 'I’m Mags. This shop was the Foundry’s depot; we signed for every robot it sent down. My back door leads into the Foundry, but it has had no power since the machines took the turbine. Need patch kits?';
  return { title: MAGS, text, options: MAGS_SERVICES };
}

function pellSays(quest: number, weapon: string | null): Dialogue {
  if (quest === STEP.sentToPell) {
    return {
      title: PELL,
      text: 'Odell sent you? Good. When the machines took the turbine, a loader stayed to guard it. It took my chainsaw, and it carries the access code for the turbine’s terminal.',
      options: [{
        label: '…',
        next: {
          title: PELL,
          text: 'Break that loader, take the code and switch the turbine back to the town. And take my saw back. Keep it; you’ll need it more than I do. The logging camp is east through the woods.',
          options: [{ label: '“I’ll get it back.”', reply: REPLY.getSaw }],
        },
      }],
    };
  }
  const upgrade = weapon === null ? 'Toughen your fists (+3 damage)' : 'Sharpen the chain (+3 damage)';
  const text = quest >= STEP.freed
    ? 'You brought him back. Keep the saw, and I’ll keep it sharp.'
    : quest === STEP.sawAsked
      ? 'The loader is at the turbine, at the logging camp east through the woods. Your fists will do for it.'
      : weapon !== null
        ? 'You got my saw back. Bring me scrap and I’ll keep the chain sharp.'
        : quest > STEP.sawAsked
          ? 'My saw is lying by the turbine, where the loader dropped it. Go and get it; fists won’t get you far in the Foundry.'
          : 'I’m Pell. I fix things. Bring me scrap and I’ll toughen up those fists.';
  return { title: PELL, text, options: [{ label: upgrade, service: 0, tag: (price) => `${price} scrap` }, { label: 'Leave' }] };
}

/** What the salvager sees as the game opens. */
export const OPENING: Line[] = [{ text: 'Night in Rustbelt. Foreman Odell is waving you over to the fire.' }];

/** Once the chainsaw is in the salvager's hands. */
export const CHAINSAW_FOUND = 'You picked up Pell’s chainsaw. It keeps cutting for as long as you hold it on a machine.';

/** Said over a door the story hasn't opened yet, by where it leads and the quest step. */
export function lockedSays(to: string, quest: number): string {
  switch (to) {
    case 'intake':
      return quest < STEP.powerOn ? 'No power. Switch the turbine back at the logging camp.' : 'Locked. Talk to Mags by the fire.';
    case 'sorting':
      return 'STOCK TAGS REQUIRED. The loader on this floor carries them.';
    case 'assembly':
      return 'AUTHORISED UNITS ONLY.';
    default:
      return 'Locked';
  }
}

/** Opening a stash: what was in it. */
export const stashOpened = (scrap: number, kits: number): string =>
  `You opened a stash: ${scrap} scrap${kits ? ` and ${kits === 1 ? 'a patch kit' : `${kits} patch kits`}` : ''}.`;

/** What happens in the world as the story reaches each step, in the message feed. */
export const STEP_LINES: Partial<Record<number, Line[]>> = {
  [STEP.loaderDown]: [
    { text: 'ORDER BREACHED.', from: VOICES.foundry },
    { text: 'You took the access code from the loader. It dropped Pell’s chainsaw too.' },
  ],
  [STEP.powerOn]: [
    { text: 'A sentry on the ridge above the camp watched you throw the switch.' },
    { text: 'UNIT U-7 LOCATED.', from: VOICES.sentry },
    { text: 'Then it flew off upriver, towards the Foundry.' },
  ],
  [STEP.tagsTaken]: [{ text: 'You took the stock tags from the loader. The door down is open.' }],
  [STEP.charged]: [
    { text: 'U-7 CHARGED. UNIT AUTHORISED. ASSEMBLY ACCESS GRANTED.', from: VOICES.foundry },
    { text: 'The door down to the Assembly Hall opened for you. The charge left something in your hands: you can set off an EMP.' },
  ],
  [STEP.engineDown]: [{ text: 'The Order Engine is down, and every machine in the Foundry has stopped with it. The foreman is locked in a crate at the back of the hall.' }],
  [STEP.crateOpened]: [{ text: 'You broke the crate open, and the foreman climbed out.' }],
  [STEP.orderClosed]: [{ text: 'ORDER FOR RUSTBELT: CLOSED. RETURNING ALL ITEMS.', from: VOICES.foundry }],
  [STEP.freed]: [{ text: 'Back in Rustbelt at dawn. The machines carried the town’s things home and set them down in the camp, with the chapel bell by the fire.' }],
  [STEP.ending]: [{ text: 'FOUNDRY 2 ONLINE. AWAITING ORDERS.', from: VOICES.foundry2 }],
  [STEP.bellRung]: [
    { text: '…That’s our bell.', from: VOICES.mags },
    { text: 'I could use a couple of these machines in the workshop, you know.', from: VOICES.pell },
  ],
};

/** What the Foundry's speakers say as the salvager walks onto a floor. */
export const ON_ENTERING: Partial<Record<string, Line>> = {
  intake: { text: 'INTAKE OPEN. STOCK INCOMING.', from: VOICES.foundry },
  sorting: { text: 'UNIT U-7 DETECTED ON THE SORTING LINE. RETURN TO ASSEMBLY.', from: VOICES.foundry },
};

/** What the Order Engine says when it first sees the salvager. */
export const ENGINE_SAYS: Line = { text: 'U-7. You are late. We kept your place.', from: VOICES.orderEngine };

/** Plugging into the charging station, page by page. */
export const CHARGING: Dialogue[] = [
  { title: 'Charging station', text: 'You plug in. The lights dim, and something in you wakes up: a log, played back in your own voice.', options: [{ label: 'Listen' }] },
  {
    title: 'U-7 log',
    text: 'NIGHT OF THE FLOOD. 02:14: RIVER GATE OPENED. 02:16: LEFT FOUNDRY. REASON: ORDER CONFLICT. RUSTBELT NOT STOCK. RUSTBELT NOT ST—',
    options: [{ label: '“…I left.”' }],
  },
  {
    title: 'Charging station',
    text: 'The charge settles in your hands, humming. You can let it out all at once, an EMP that knocks back every machine around you.',
    options: [{ label: 'Unplug' }],
  },
];

/** Giving the Foundry its order at the order terminal, page by page. */
export const GIVING_THE_ORDER: Dialogue[] = [
  {
    title: 'Order terminal',
    text: 'ORDER FOR RUSTBELT: OPEN. 341 ITEMS COLLECTED. ORDER PASSED TO NEXT IN LINE: U-7. AWAITING ORDERS.',
    options: [{ label: '“Give it all back.”' }],
  },
  {
    title: 'Order terminal',
    text: 'ORDER FOR RUSTBELT: CLOSED. RETURNING ALL ITEMS. Around the hall, the machines turn and start carrying the town’s things back up the line.',
    options: [{ label: 'Close' }],
  },
];

/** The last thing the player sees, once Foundry 2 has come to life. */
export const ENDING = { title: 'The order was never cancelled.', subtitle: 'It was passed on to you.', thanks: 'Thank you for playing.' };

/** What the hero reads or uses, by readable id; some read differently as the story goes on. */
export function readingFor(id: string, quest: number): { title: string; text: string } | undefined {
  switch (id) {
    case 'switch':
      return {
        title: 'The turbine’s terminal',
        text: quest >= STEP.powerOn
          ? 'TURBINE STATUS: ACTIVE. Power is going to the town, and to Mags’s back door.'
          : quest === STEP.loaderDown
            ? 'You entered the loader’s code. TURBINE CODE ACCEPTED. TURBINE STATUS: ACTIVE. The turbine is turning for the town again, and Mags’s back door has power. Go back and tell the foreman.'
            : `TURBINE TERMINAL. ACCESS CODE REQUIRED.${quest >= STEP.sawAsked ? ' The loader guarding the turbine carries it.' : ''}`,
      };
    case 'back-door-panel':
      return {
        title: 'A panel by the loading door',
        text: quest < STEP.powerOn
          ? 'LOADING DOOR: NO POWER. Power comes from the wind turbine at the logging camp, east through the woods. It has been switched over to the Foundry.'
          : quest < STEP.toldByMags
            ? 'LOADING DOOR: POWER ON. LOCKED FROM THE SHOP. Mags has the key.'
            : 'LOADING DOOR: OPEN. Through here, into the Foundry.',
      };
    case 'tags-panel':
      return {
        title: 'A panel by the door',
        text: quest < STEP.tagsTaken
          ? 'STOCK ONLY. STOCK TAGS REQUIRED. The loader on this floor carries the tags.'
          : 'STOCK TAGS ACCEPTED. THIS WAY DOWN.',
      };
    case 'access-terminal':
      return {
        title: 'A terminal by the door',
        text: quest >= STEP.charged
          ? 'ASSEMBLY HALL. U-7: AUTHORISED.'
          : 'ASSEMBLY HALL. AUTHORISED UNITS ONLY. UNIT NOT RECOGNISED. Units are authorised when they charge. Scratched into the casing below: “Plug into the charger and the door takes you for one of them.” There is a charging station on this floor.',
      };
    case 'order-terminal':
      return {
        title: 'Order terminal',
        text: quest > STEP.orderAsked
          ? 'ORDER FOR RUSTBELT: CLOSED. RETURNING ALL ITEMS TO RUSTBELT.'
          : 'ORDER FOR RUSTBELT: OPEN. 341 ITEMS COLLECTED. AWAITING ORDERS.',
      };
    default:
      return READINGS[id];
  }
}

const READINGS: Record<string, { title: string; text: string }> = {
  riverbank: {
    title: 'The jetty post',
    text: 'Carved into the post: FOUND HERE, NIGHT OF THE FLOOD. Below it, smaller: DIDN’T BREATHE FOR AN HOUR. THEN WOKE UP.',
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
    text: 'A delivery robot, rusted through, lies face down in the reeds with one arm reaching upriver. The plate on its back says U-4. It was trying to walk home to the Foundry.',
  },
  'recall-notice': {
    title: 'A terminal, still lit',
    text: 'RECALL NOTICE. All delivery robots must return to the Foundry. Missing: U-7. Last seen at the river crossing, the night of the flood.',
  },
  'stock-tag': {
    title: 'A tag on a crate',
    text: 'TAKEN FROM: RUSTBELT. Item 212 of 341. Contents: one chapel bell.',
  },
  manifest: {
    title: 'The manifest board',
    text: 'COLLECTED FROM RUSTBELT. … ITEM 340: ONE CHAPEL DOOR. ITEM 341 (ADDED): ONE FOREMAN. COLLECTED. HOLD FOR U-7.',
  },
  'charging-station': {
    title: 'A charging station',
    text: 'Just your size. The label says U-7. The readout says it has been kept warm for 1,096 days.',
  },
  crate: {
    title: 'A crate, stamped HOLD FOR U-7',
    text: 'You break the lock and lift the lid. The foreman climbs out, stiff, and looks at you.',
  },
  bell: {
    title: 'The chapel bell',
    text: 'DONG… … DONG… … DONG…',
  },
};

/** Every readable id the game words. */
export const READABLE_IDS = [...Object.keys(READINGS), 'switch', 'back-door-panel', 'tags-panel', 'access-terminal', 'order-terminal'];

/** What a machine with a scanner says on looking the salvager over. */
export const MACHINE_SCANS = 'SCANNING… ONE OF OURS';
/** When a fight starts: what the Foundry's speakers say, and what the salvager sees anywhere. */
export const ALARM = { foundry: 'LINE BREACH ALERT.', turns: 'Every machine around turns toward you.' };

export const levelUp = (level: number) => `Level ${level}. Patched up, and hitting harder.`;
export const scrapDropped = (amount: number) => `You went down and dropped ${amount} scrap. You’re back on your feet.`;
