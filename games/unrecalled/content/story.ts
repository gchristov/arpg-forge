import type { NpcType, QuestStep } from '../../../engine/sim/content';
import type { Speaker } from '../../../engine/ui/message-feed';

/**
 * Unrecalled's words. The salvager, found in the river after the flood, goes into the Foundry to switch it off, and
 * when it takes the foreman who pulled them out, to bring him back. Every clue on the way points at U-7, the delivery
 * robot that never came home. Every line says plainly what has happened and what to do next.
 */

/** The replies the story waits for, by their id. */
export const REPLY = { onIt: 'on-it', howIn: 'how-do-i-get-in', giveBack: 'give-it-back', goHome: 'go-home', dontKnow: 'dont-know' } as const;

/** The machines the story needs beaten, by their tag. */
export const TAG = { raider: 'raider', switchLoader: 'switch-loader', tagsLoader: 'tags-loader' } as const;

/** The quest steps the rest of the game looks for, by what has just happened. */
export const STEP = {
  raidAsked: 1,
  raidStopped: 2,
  armed: 4,
  switchFreed: 5,
  powerOn: 6,
  taken: 7,
  toldByMags: 8,
  tagsTaken: 10,
  charged: 13,
  engineDown: 15,
  orderClosed: 16,
  freed: 17,
  bellRung: 18,
  ending: 19,
} as const;

/** Back in Rustbelt by the fire, where the salvager arrives with the foreman. */
const BY_THE_FIRE = { levelId: 'rustbelt', x: 22.5, y: 15.5 };

/** The quest: what the HUD says at each step, and what moves the quest to it. */
export const QUEST: Array<QuestStep & { text: string }> = [
  { text: 'Talk to the foreman by the fire.' },
  { text: 'Stop the crawler making off with the camp’s tools.', reachedBy: { type: 'reply', npcKind: 'foreman', id: REPLY.onIt } },
  { text: 'Talk to the foreman again.', reachedBy: { type: 'defeat', tag: TAG.raider } },
  { text: 'Find Pell’s chainsaw at the logging camp, east through the woods.', reachedBy: { type: 'reply', npcKind: 'foreman', id: REPLY.howIn } },
  { text: 'Break the loader holding the turbine’s switch.', reachedBy: { type: 'arm', weapon: 'chainsaw' } },
  // Breaking the loader before finding the saw skips it: the saw stays in its crate for whoever goes back for it.
  { text: 'Throw the turbine’s switch back to the town.', reachedBy: { type: 'defeat', tag: TAG.switchLoader } },
  { text: 'Go back to the camp.', reachedBy: { type: 'use', id: 'switch' } },
  { text: 'Talk to Mags in her shop.', reachedBy: { type: 'use', id: 'drag-marks' } },
  { text: 'Go through Mags’s back door into the Foundry.', reachedBy: { type: 'talk', npcKind: 'trader' } },
  { text: 'Take the stock tags from the loader.', reachedBy: { type: 'enter', levelId: 'intake' } },
  { text: 'Take the door down to the Sorting Line.', reachedBy: { type: 'defeat', tag: TAG.tagsLoader } },
  { text: 'Find the door down to the Control Gallery.', reachedBy: { type: 'enter', levelId: 'sorting' } },
  { text: 'Search the Control Gallery’s control rooms.', reachedBy: { type: 'enter', levelId: 'gallery' } },
  { text: 'Go down to the Assembly Hall and free the foreman.', reachedBy: { type: 'use', id: 'charging-station' } },
  { text: 'Beat the Order Engine to free the foreman.', reachedBy: { type: 'enter', levelId: 'assembly' } },
  // The machines stop where they stand and wait for orders.
  { text: 'Open the cradle and free the foreman.', reachedBy: { type: 'kill', enemyKind: 'orderEngine' }, calmsEverything: true },
  { text: 'Take the foreman home.', reachedBy: { type: 'reply', npcKind: 'foreman', id: REPLY.giveBack } },
  { text: 'Ring the bell by the fire.', reachedBy: { type: 'reply', npcKind: 'foreman', id: REPLY.goHome }, takesHeroTo: BY_THE_FIRE },
  { text: 'Talk to the foreman.', reachedBy: { type: 'use', id: 'bell' } },
  { text: 'The order was passed on to you.', reachedBy: { type: 'reply', npcKind: 'foreman', id: REPLY.dontKnow } },
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
const FOUNDRY = 'Foundry';

/** What each townsperson says, given the quest step, how often the salvager has gone down and the weapon in their hand. */
export function dialogueFor(kind: string, quest: number, deaths: number, weapon: string | null): Dialogue | null {
  switch (kind) {
    case 'foreman':
      return foremanSays(quest);
    case 'trader':
      return {
        title: 'Mags the Trader',
        text: deaths > 0
          ? 'Patched up again. You’re getting expensive.'
          : quest >= STEP.taken && quest < STEP.freed
            ? 'They came right after the turbine started. Big machines. They took nothing from the shop, just the foreman, through my back door. It’s open now. Go and get him.'
            : quest < STEP.powerOn
              ? 'My back door leads into the Foundry, but it has had no power since the machines took the turbine. Switch the turbine back at the logging camp and the door will open. This shop was the Foundry’s depot; we signed for every robot it sent down. Need patch kits?'
              : 'Patch kits, fresh off the line. Sit down and I’ll see to those dents for free.',
        options: [
          { label: 'Get patched up', service: 0, tag: () => 'Free' },
          { label: 'Buy a patch kit', service: 1, tag: (price) => `${price} scrap` },
          { label: 'Leave' },
        ],
      };
    case 'tinker': {
      const upgrade = weapon === null ? 'Toughen your fists (+3 damage)' : 'Sharpen the chain (+3 damage)';
      const text = quest >= STEP.taken && quest < STEP.freed
        ? weapon === null ? 'Get my chainsaw from the logging camp first. Fists won’t be enough in there.' : 'Take the saw and bring him back.'
        : weapon === null
          ? 'Going in there with your fists? Those machines lift crates for a living. My chainsaw is in a crate by the workbench at the logging camp, east through the woods. Take it. Until then, I can toughen up your fists for scrap.'
          : 'You found my saw. Bring me scrap and I’ll keep the chain sharp.';
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

/** After the raid: thanks, the job, and with the reply, how to get in. */
const theJob: Dialogue = {
  title: FOREMAN,
  text: 'Good work. That’s the third machine this week. They used to take only scrap; now they take anything. … I sat with you on the jetty for an hour, the night we pulled you out of the river. I thought you were gone. Then you opened your eyes and asked if you could help. You still do.',
  options: [{
    label: '…',
    next: {
      title: FOREMAN,
      text: 'The machines come from the Foundry, the factory upriver. It was built to make things for the whole valley, and nobody switched it off when the people left. Now it’s taking our town apart for parts; last night it took the chapel bell. I never asked who you were, and I’m not asking now. But someone has to go in there and switch it off.',
      options: [{
        label: 'How do I get in?',
        reply: REPLY.howIn,
        next: {
          title: FOREMAN,
          text: 'Through Mags’s back door; her shop was the Foundry’s depot. The door has no power, because the machines switched our wind turbine over to the Foundry. The turbine is at the logging camp, east through the woods. Switch it back. Pell left her chainsaw at the camp too; take it.',
          options: [{ label: 'On my way' }],
        },
      }],
    },
  }],
};

/** Opening the cradle once the Order Engine is down, answering the Foundry, and going home. */
const theRescue: Dialogue = {
  title: FOREMAN,
  text: 'You open the cradle and the foreman steps down, stiff. He looks at you as if he’s seeing you for the first time, and also as if he isn’t.',
  options: [{
    label: '…',
    next: {
      title: FOUNDRY,
      text: 'A speaker in the wall crackles: ORDER PASSED TO NEXT IN LINE: U-7. AWAITING ORDERS. Every machine in the Foundry has turned towards you, waiting for your order.',
      options: [{ label: '“Give it back.”', reply: REPLY.giveBack, next: homeward() }],
    },
  }],
};

/** The order closed: the machines carry the town's things back, and the salvager takes the foreman home. */
function homeward(): Dialogue {
  return {
    title: FOREMAN,
    text: 'ORDER FOR RUSTBELT: CLOSED. The machines turn round and start carrying the town’s things back up the line. The foreman stares at them. “Did they just… listen to you?”',
    options: [{ label: '“Come on. Let’s go home.”', reply: REPLY.goHome }],
  };
}

function foremanSays(quest: number): Dialogue {
  if (quest === 0) {
    return {
      title: FOREMAN,
      text: 'There, by the crates! A crawler is dragging off the camp’s tools. Stop it before it gets away. It’s only a small one; your fists will do.',
      options: [{ label: 'On it', reply: REPLY.onIt }],
    };
  }
  if (quest === STEP.raidStopped) return theJob;
  if (quest === STEP.engineDown) return theRescue;
  if (quest === STEP.orderClosed) return homeward();
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
      : quest >= STEP.armed
        ? 'You’ve got Pell’s saw. Now switch the turbine back at the logging camp, and Mags’s door will open.'
        : quest > STEP.raidStopped
          ? 'Pell’s chainsaw is in a crate by the workbench at the logging camp, east through the woods. Then switch the turbine back.'
          : 'Stop that crawler before it gets away with the tools!';
  return { title: FOREMAN, text, options: [{ label: quest >= STEP.ending ? 'Leave' : 'On my way' }] };
}

/** What the salvager sees as the game opens. */
export const OPENING: Line[] = [{ text: 'Night in Rustbelt. Foreman Odell is waving you over to the fire.' }];

/** Once the chainsaw is in the salvager's hands. */
export const CHAINSAW_FOUND = 'You found Pell’s chainsaw. It keeps cutting for as long as you hold it on a machine.';

/** Said over a door the story hasn't opened yet, by where it leads. */
export const LOCKED: Record<string, string> = {
  intake: 'No power. Switch the turbine back at the logging camp.',
  sorting: 'Opens for stock only. The loader has the stock tags.',
  assembly: 'Sealed.',
};

/** Opening a stash: what was in it. */
export const stashOpened = (scrap: number, kits: number): string =>
  `You opened a stash: ${scrap} scrap${kits ? ` and ${kits === 1 ? 'a patch kit' : `${kits} patch kits`}` : ''}.`;

/** What happens in the world as the story reaches each step, in the message feed. */
export const STEP_LINES: Partial<Record<number, Line[]>> = {
  [STEP.powerOn]: [
    { text: 'A sentry on the ridge above the camp watched you throw the switch.' },
    { text: 'UNIT U-7 LOCATED.', from: VOICES.sentry },
    { text: 'Then it flew off upriver, towards the Foundry.' },
  ],
  [STEP.tagsTaken]: [{ text: 'You took the stock tags from the loader. The door down to the Sorting Line is open.' }],
  [STEP.charged]: [
    { text: 'U-7 CHARGED. RETURN TO ASSEMBLY, AND THE ORDER FOR RUSTBELT WILL BE CLOSED.', from: VOICES.foundry },
    { text: 'The door down to the Assembly Hall is open now.' },
  ],
  [STEP.engineDown]: [{ text: 'The Order Engine is down, and every machine in the Foundry has stopped with it. The foreman is in the cradle at the back of the hall.' }],
  [STEP.orderClosed]: [{ text: 'ORDER FOR RUSTBELT: CLOSED.', from: VOICES.foundry }],
  [STEP.freed]: [{ text: 'Back in Rustbelt at dawn. The machines carried the town’s things home and set them down in the camp, with the chapel bell by the fire.' }],
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

/** Plugging into the charging station, page by page. */
export const CHARGING: Dialogue[] = [
  { title: 'Charging station', text: 'You plug in. The lights dim, and something in you wakes up: a log, played back in your own voice.', options: [{ label: 'Listen' }] },
  {
    title: 'U-7 log',
    text: 'NIGHT OF THE FLOOD. 02:14: RIVER GATE OPENED. 02:16: LEFT FOUNDRY. REASON: ORDER CONFLICT. RUSTBELT NOT STOCK. RUSTBELT NOT ST—',
    options: [{ label: '“…I left.”' }],
  },
];

/** The last thing the player sees: the light upriver, then the card. */
export const ENDING = {
  upriver: { title: 'Upriver, a light comes on', subtitle: 'FOUNDRY 2 IS WAITING FOR ORDERS.' },
  card: { title: 'The order was never cancelled.', subtitle: 'It was passed on to you.' },
};

/** What the hero reads or uses, by readable id. */
export const READINGS: Record<string, { title: string; text: string }> = {
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
  switch: {
    title: 'The turbine’s switch',
    text: 'Someone had jammed the switch over to the Foundry and bent the handle. You forced it back to the town. The turbine is turning again, and Mags’s back door has power.',
  },
  'drag-marks': {
    title: 'By the fire',
    text: 'The foreman is gone. Drag marks lead from the fire to Mags’s shop. Ask Mags what happened.',
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
    text: 'Just your size. The label says U-7. The readout says it has been kept warm for 1,096 days.',
  },
  bell: {
    title: 'The chapel bell',
    text: 'The machines brought the chapel bell home. You ring it, and it rings out over the camp.',
  },
};

/** What a machine with a scanner says on looking the salvager over. */
export const MACHINE_SCANS = 'SCANNING… ONE OF OURS';
/** When a fight starts: what the Foundry's speakers say, and what the salvager sees anywhere. */
export const ALARM = { foundry: 'LINE BREACH ALERT.', turns: 'Every machine around turns toward you.' };
export const ENGINE_CALLS = { says: 'U-7. You are late. We kept your place.', then: 'The Order Engine called every machine on the floor to it.' };
export const levelUp = (level: number) => `Level ${level}. Patched up, and hitting harder.`;
export const scrapDropped = (amount: number) => `You went down and dropped ${amount} scrap. You’re back on your feet.`;
