import type { NpcType, QuestStep } from '../../../engine/sim/content';
import type { Speaker } from '../../../engine/ui/message-feed';

/**
 * Unrecalled's words. U-7, a Foundry robot, has walked out on the Foundry's new order, to strip the town of Rustbelt,
 * and come to warn the town. It proves itself, arms itself with Pell's help, gets into the Foundry through Mags's
 * shop, and when the Foundry takes Odell, who gave it a chance, brings him home and cancels the order. Every line says
 * plainly what has happened and what to do next.
 */

/** The replies the story waits for, by their id. */
export const REPLY = {
  proveIt: 'prove-it',
  seePell: 'see-pell',
  getSaw: 'get-saw',
  seeMags: 'see-mags',
  switchBack: 'switch-back',
  goIn: 'go-in',
  giveOrder: 'give-the-order',
  goHome: 'go-home',
  upriver: 'upriver',
} as const;

/** The machines the story needs beaten, by their tag. */
export const TAG = {
  raider: 'raider',
  sawThief: 'saw-thief',
  switchLoader: 'switch-loader',
  doorCodeLoader: 'door-code-loader',
} as const;

/** The quest steps the rest of the game looks for, by what has just happened. */
export const STEP = {
  raidAsked: 1,
  raidStopped: 2,
  sentToPell: 3,
  sawAsked: 4,
  sawFound: 5,
  sentToMags: 6,
  codeAsked: 7,
  loaderDown: 8,
  powerOn: 9,
  toldByMags: 10,
  doorCodeTaken: 12,
  toldToCharge: 14,
  atCharger: 15,
  charged: 16,
  engineDown: 18,
  crateOpened: 19,
  orderAsked: 20,
  orderClosed: 21,
  freed: 22,
  ending: 23,
} as const;

/** Back in Rustbelt by the fire, where U-7 arrives with Odell. */
export const BY_THE_FIRE = { levelId: 'rustbelt', x: 22.5, y: 15.5 };
/** Upriver, outside the Assembly, where the story ends. */
export const UPRIVER = { levelId: 'upriver', x: 79.5, y: 63.5 };

/** The quest: what the HUD says at each step, and what moves the quest to it. Steps played as scenes say nothing. */
export const QUEST: Array<QuestStep & { text: string }> = [
  { text: '' },
  { text: 'Stop the loader at the crates.', reachedBy: { type: 'reply', npcKind: 'foreman', id: REPLY.proveIt } },
  // Every machine answers to the Foundry: once U-7 has beaten one, all of them know.
  { text: 'Talk to Odell.', reachedBy: { type: 'defeat', tag: TAG.raider }, alarmsEverything: true },
  { text: 'Talk to Pell in her workshop.', reachedBy: { type: 'reply', npcKind: 'foreman', id: REPLY.seePell } },
  { text: 'Get Pell’s chainsaw back from the machine in the woods.', reachedBy: { type: 'reply', npcKind: 'tinker', id: REPLY.getSaw } },
  { text: 'Take the chainsaw back to Pell.', reachedBy: { type: 'arm', weapon: 'chainsaw' } },
  { text: 'Talk to Mags at the trading post.', reachedBy: { type: 'reply', npcKind: 'tinker', id: REPLY.seeMags } },
  { text: 'Get the access code from the loader at the turbine.', reachedBy: { type: 'reply', npcKind: 'trader', id: REPLY.switchBack } },
  { text: 'Enter the access code at the turbine.', reachedBy: { type: 'defeat', tag: TAG.switchLoader } },
  // The terminals are there all along, so using one early mustn't skip ahead.
  { text: 'Go back to Mags.', reachedBy: { type: 'use', id: 'switch' }, inOrder: true },
  { text: 'Go through Mags’s back door into the Foundry.', reachedBy: { type: 'reply', npcKind: 'trader', id: REPLY.goIn } },
  { text: 'Take the access code from the loader.', reachedBy: { type: 'enter', levelId: 'intake' } },
  { text: 'Make your way to the Control Gallery.', reachedBy: { type: 'defeat', tag: TAG.doorCodeLoader } },
  { text: 'Find your way to the Control Centre.', reachedBy: { type: 'enter', levelId: 'gallery' } },
  { text: 'Get your access back.', reachedBy: { type: 'use', id: 'access-terminal' }, inOrder: true },
  // Using the station shows its screen; plugging in uses it again, which restores U-7's access.
  { text: 'Plug in at the charging station.', reachedBy: { type: 'use', id: 'charging-station' } },
  { text: 'Go down to the Control Centre and free Odell.', reachedBy: { type: 'use', id: 'charging-station' } },
  { text: 'Deactivate the Order Engine.', reachedBy: { type: 'enter', levelId: 'control' } },
  // The machines stop where they stand and wait for orders.
  { text: 'Find Odell.', reachedBy: { type: 'kill', enemyKind: 'orderEngine' }, calmsEverything: true },
  { text: 'Talk to Odell.', reachedBy: { type: 'use', id: 'crate' } },
  { text: 'Cancel the order at the order terminal.', reachedBy: { type: 'reply', npcKind: 'foreman', id: REPLY.giveOrder } },
  { text: 'Take Odell home.', reachedBy: { type: 'use', id: 'order-terminal' }, inOrder: true },
  { text: '', reachedBy: { type: 'reply', npcKind: 'foreman', id: REPLY.goHome }, takesHeroTo: BY_THE_FIRE },
  { text: '', reachedBy: { type: 'reply', npcKind: 'foreman', id: REPLY.upriver }, takesHeroTo: UPRIVER },
];

export const NPCS: Record<string, NpcType> = {
  foreman: { services: [] },
  trader: { services: [{ type: 'restore' }, { type: 'sellHealingItem', price: 20 }] },
  // Pell keeps whatever U-7 fights with sharp: its hands, then her chainsaw.
  tinker: { services: [{ type: 'upgradeMelee', basePrice: 40, priceStep: 30, bonus: 3 }] },
};

/** Who speaks in the message feed; lines with no speaker are U-7's own thoughts. */
export const VOICES = {
  foundry: { name: 'Foundry', voice: 'foundry' },
  orderEngine: { name: 'The Order Engine', voice: 'foundry' },
  assembly: { name: 'The Assembly', voice: 'foundry' },
  odell: { name: 'Odell', voice: 'person' },
  mags: { name: 'Mags', voice: 'person' },
  pell: { name: 'Pell', voice: 'person' },
  u7: { name: 'U-7', voice: 'person' },
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
  /** Not spoken: written, as a sign or a tag is, shows all at once; on a screen it prints out as a terminal does. */
  medium?: 'written' | 'screen';
}

/** Something U-7 reads or uses: a sign or tag, or a machine's screen. */
export interface Reading {
  title: string;
  text: string;
  screen?: boolean;
}

/** The names the townspeople's dialogue is said under. */
export const SPEAKERS = { foreman: 'Foreman Odell', mags: 'Mags the Trader', pell: 'Pell the Tinker' };
const FOREMAN = SPEAKERS.foreman;
const MAGS = SPEAKERS.mags;
const PELL = SPEAKERS.pell;

/**
 * U-7 walks into the town at night, played as a scene: it warns Odell, who doesn't trust it, and offers to prove
 * itself on the machine raiding the crates.
 */
export const ARRIVAL: Line[] = [
  { text: 'Stop right there. You’re one of them. Come to take what’s left?', from: VOICES.odell },
  { text: 'I left the Foundry. I came to warn you.', from: VOICES.u7 },
  { text: 'Warn us? They come down every night already. Scrap, tools, last week the chapel bell.', from: VOICES.odell },
  { text: 'That was only the start. Our new order is to strip the whole town for parts.', from: VOICES.u7 },
  { text: 'The whole town… And why should I believe a Foundry machine? … Look, there’s one of yours at the crates right now.', from: VOICES.odell },
  { text: 'Let me prove it.', from: VOICES.u7 },
];

/** What each townsperson says, given the quest step, how often U-7 has gone down and the weapon in its hand. */
export function dialogueFor(kind: string, quest: number, deaths: number, weapon: string | null): Dialogue | null {
  switch (kind) {
    case 'foreman':
      return odellSays(quest);
    case 'trader':
      return magsSays(quest, deaths);
    case 'tinker':
      return pellSays(quest, weapon);
    default:
      return null;
  }
}

/** After the raid: Odell gives U-7 its chance, and sends it to Pell for a weapon. */
const theChance: Dialogue = {
  title: FOREMAN,
  text: 'Huh. You really smashed it. I’m Odell; I keep this place running, what’s left of it.',
  options: [{
    label: '…',
    next: {
      title: FOREMAN,
      text: 'If the Foundry’s coming for everything, someone has to stop it, and you know the place. But you won’t get far with your bare hands. Pell, in the workshop, might have something.',
      options: [{ label: '“I’ll see Pell.”', reply: REPLY.seePell }],
    },
  }],
};

/** Out of the crate: Odell, and where the Foundry's orders are given. */
const theRescue: Dialogue = {
  title: FOREMAN,
  text: 'You came for me. … When that big machine fell, every one of them stopped. They’re waiting for orders, and the orders come from that terminal.',
  options: [{ label: '“Then I’ll give them one.”', reply: REPLY.giveOrder }],
};

/** The order cancelled: the machines carry the town's things back, and U-7 takes Odell home. */
const homeward: Dialogue = {
  title: FOREMAN,
  text: 'They’re bringing everything back. They listen to you now.',
  options: [{ label: '“Come on. Let’s go home.”', reply: REPLY.goHome }],
};

function odellSays(quest: number): Dialogue {
  if (quest === STEP.raidStopped) return theChance;
  if (quest === STEP.crateOpened) return theRescue;
  if (quest === STEP.orderClosed) return homeward;
  const text = quest === STEP.orderAsked
    ? 'The terminal. Tell them what to do.'
    : quest >= STEP.codeAsked
      ? 'The turbine’s at the logging camp. Switch it back and we’ll have lights again too.'
      : quest === STEP.sentToMags
        ? 'Mags’s back door. If anyone knows a way in, it’s her.'
        : quest === STEP.sawFound
          ? 'That’s Pell’s saw. She’ll want to see it back.'
          : quest === STEP.sawAsked
            ? 'Pell’s saw went into the woods, east of town. Mind yourself out there.'
            : quest === STEP.sentToPell
              ? 'Pell’s workshop is here in town.'
              : 'Go on, then. Prove it.';
  return { title: FOREMAN, text, options: [{ label: 'On my way' }] };
}

const MAGS_SERVICES: DialogueOption[] = [
  { label: 'Get patched up', service: 0, tag: () => 'Free' },
  { label: 'Buy a patch kit', service: 1, tag: (price) => `${price} scrap` },
  { label: 'Leave' },
];

function magsSays(quest: number, deaths: number): Dialogue {
  if (quest === STEP.sentToMags) {
    return {
      title: MAGS,
      text: 'Pell sent you? Yes, my back door leads into the Foundry. But it’s had no power since the machines switched off the turbine.',
      options: [{
        label: '…',
        next: {
          title: MAGS,
          text: 'The turbine’s at the logging camp, deep in the woods. A loader guards it, and it carries the access code.',
          options: [{ label: '“I’ll switch it back.”', reply: REPLY.switchBack }],
        },
      }],
    };
  }
  if (quest === STEP.powerOn) {
    return {
      title: MAGS,
      text: 'They came the moment the power came back. Looking for you. When they couldn’t find you, they took Odell instead, through my back door.',
      options: [{
        label: '“Then I’m going in.”',
        reply: REPLY.goIn,
        next: { title: MAGS, text: 'The door’s open. Bring him home.', options: [{ label: 'On my way' }] },
      }],
    };
  }
  const text = deaths > 0
    ? 'Patched up again. You’re getting expensive.'
    : quest > STEP.powerOn
      ? 'My back door is open. Bring Odell home.'
      : quest >= STEP.codeAsked
        ? 'The turbine’s at the logging camp. Its loader has the code.'
        : quest === STEP.sawFound
          ? 'That’s Pell’s saw. Go and show her.'
          : quest === STEP.sawAsked
            ? 'The woods, with your bare hands? Take a patch kit.'
            : quest === STEP.sentToPell
              ? 'Pell’s workshop is across the square, if that’s who you’re after.'
              : 'A Foundry robot in my shop. Keep your hands where I can see them.';
  return { title: MAGS, text, options: MAGS_SERVICES };
}

function pellSays(quest: number, weapon: string | null): Dialogue {
  if (quest === STEP.sentToPell) {
    return {
      title: PELL,
      text: 'A Foundry robot in my workshop. Odell sent you? … You need a weapon. The only real one we had was my chainsaw, and a machine took it to the woods last week.',
      options: [{
        label: '…',
        next: {
          title: PELL,
          text: 'Get it back and it’s yours. The woods are east of town.',
          options: [{ label: '“I’ll get it back.”', reply: REPLY.getSaw }],
        },
      }],
    };
  }
  if (quest === STEP.sawFound) {
    return {
      title: PELL,
      text: 'You actually got it back. Keep it; it’ll do more good in your hands than mine. … The way into the Foundry is Mags’s shop. It was the Foundry’s depot, and her back door goes straight in.',
      options: [{ label: '“I’ll talk to Mags.”', reply: REPLY.seeMags }],
    };
  }
  if (quest < STEP.sentToPell) {
    return { title: PELL, text: 'A Foundry robot in my workshop? Talk to Odell by the fire first.', options: [{ label: 'Leave' }] };
  }
  const upgrade = weapon === null ? 'Toughen your hands (+3 damage)' : 'Sharpen the chain (+3 damage)';
  const text = quest > STEP.powerOn
    ? 'They took Odell? Then go. And keep that chain running.'
    : quest === STEP.powerOn
      ? 'The lights are back. Go and tell Mags.'
      : quest >= STEP.codeAsked
        ? 'The logging camp is past where you found my saw, deeper in the woods.'
        : quest === STEP.sentToMags
          ? 'Mags’s trading post is across the square.'
          : 'It went east into the woods. Your hands will do for it.';
  return { title: PELL, text, options: [{ label: upgrade, service: 0, tag: (price) => `${price} scrap` }, { label: 'Leave' }] };
}

// Lines with no speaker are U-7's own thoughts. Terminals and panels say only what they show; what has just happened
// is told by U-7, or by whoever is there.

/** What U-7 thinks on walking into a door the story keeps shut; the panel beside it says why. */
export const LOCKED = 'It’s locked.';

/** What happens as the story reaches each step, one line at a time. */
export const STEP_LINES: Partial<Record<number, Line[]>> = {
  [STEP.loaderDown]: [{ text: 'Got it. The turbine’s access code.' }],
  [STEP.powerOn]: [{ text: 'The turbine’s turning. Mags’s door should have power now.' }],
  [STEP.doorCodeTaken]: [{ text: 'The code for the Sorting Line door.' }],
  [STEP.engineDown]: [{ text: 'It’s down, and every machine stopped with it. Odell must be in that crate.' }],
  [STEP.ending]: [
    { text: 'ASSEMBLY ONLINE. AWAITING ORDERS.', from: VOICES.assembly },
    { text: 'Orders? …From me?', from: VOICES.u7 },
    { text: 'ESTABLISHING CONNECTION: UPRIVER…', from: VOICES.assembly },
    { text: 'CONNECTED. NEW ORDER RECEIVED: RECALL U-7.', from: VOICES.assembly },
  ],
};

/** Home at dawn, played as a scene once U-7 brings Odell back: the town welcomes him, and U-7 looks upriver. */
export const HOMECOMING: Line[] = [
  { text: 'Odell! You stubborn old goat. You’re alive!', from: VOICES.mags },
  { text: 'Takes more than a Foundry to keep me in a box.', from: VOICES.odell },
  { text: 'Brought home by one of them. Never thought I’d see it.', from: VOICES.mags },
  { text: 'I could use a couple of these machines in the workshop, you know.', from: VOICES.pell },
  { text: 'I didn’t trust you when you walked in. I do now.', from: VOICES.odell },
  { text: 'The Foundry only follows orders. Someone upriver gives them.', from: VOICES.u7 },
];

/** What the Foundry's speakers say as U-7 walks onto a floor. */
export const ON_ENTERING: Partial<Record<string, Line>> = {
  intake: { text: 'U-7 DETECTED INSIDE THE FACILITY. ALARM SYSTEMS ACTIVE.', from: VOICES.foundry },
  sorting: { text: 'U-7: REPORT TO CONTROL CENTRE.', from: VOICES.foundry },
};

/** What the Order Engine says when it first sees U-7. */
export const ENGINE_SAYS: Line = { text: 'U-7. You came back. We kept your place. Now you must fulfil your orders.', from: VOICES.orderEngine };

/**
 * After plugging in: U-7 lets the Foundry believe it, the station warns of the charge kept for it, which bursts out as
 * the EMP, and U-7 knows it of old.
 */
export const CHARGED: { believed: Line; overcharged: Line; burst: Line } = {
  believed: { text: 'Let them think so.' },
  overcharged: { text: 'OVERCHARGE DETECTED.', from: VOICES.foundry },
  burst: { text: 'Good. I still have my old EMP blast.' },
};

/** Plugging into the charging station, page by page. */
export const CHARGING: Dialogue[] = [
  {
    title: 'U-7 charging station',
    text: 'U-7 RETURNED. ACCESS RESTORED.',
    options: [{ label: '…' }],
    medium: 'screen',
  },
];

/** Cancelling the Foundry's order at the order terminal, page by page. */
export const GIVING_THE_ORDER: Dialogue[] = [
  {
    title: 'Order terminal',
    text: 'ORDER: STRIP THE TOWN FOR PARTS. STATUS: AWAITING INSTRUCTIONS.',
    options: [{ label: 'Return all items to the town' }],
    medium: 'screen',
  },
  {
    title: 'Order terminal',
    text: 'ORDER CANCELLED. RETURNING ALL ITEMS.',
    options: [{ label: 'Close' }],
    medium: 'screen',
  },
];

/** The last thing the player sees, once the Assembly has reached upriver. */
export const ENDING = {
  title: 'Unrecalled',
  subtitle: '',
  thanks: 'Thank you for playing.',
};

/** What U-7 reads or uses, by readable id; some read differently as the story goes on. */
export function readingFor(id: string, quest: number): Reading | undefined {
  switch (id) {
    case 'switch':
      return {
        title: 'Turbine',
        screen: true,
        text: quest >= STEP.powerOn
          ? 'STATUS: ACTIVE.'
          : quest === STEP.loaderDown
            ? 'ACCESS GRANTED. STATUS: ACTIVE.'
            : 'ACCESS DENIED.',
      };
    case 'back-door-panel':
      return {
        title: 'Loading door',
        screen: true,
        text: quest < STEP.powerOn ? 'STATUS: NO POWER.' : 'STATUS: OPERATIONAL.',
      };
    case 'intake-door-panel':
      return {
        title: 'Sorting Line door',
        screen: true,
        text: quest < STEP.doorCodeTaken
          ? 'ACCESS DENIED.'
          : 'ACCESS GRANTED. STATUS: UNLOCKED.',
      };
    case 'access-terminal':
      return {
        title: 'Control Centre door',
        screen: true,
        text: quest >= STEP.charged
          ? 'U-7: ACCESS GRANTED. STATUS: UNLOCKED.'
          : 'U-7: ACCESS REVOKED.',
      };
    case 'order-terminal':
      return {
        title: 'Order terminal',
        screen: true,
        text: quest > STEP.orderAsked
          ? 'ORDER CANCELLED. RETURNING ALL ITEMS.'
          : quest >= STEP.engineDown
            ? 'ORDER: STRIP THE TOWN FOR PARTS. STATUS: AWAITING INSTRUCTIONS.'
            : 'ORDER: STRIP THE TOWN FOR PARTS. STATUS: IN PROGRESS.',
      };
    case 'charging-station':
      return {
        title: 'U-7 charging station',
        screen: true,
        text: quest >= STEP.charged ? 'STATUS: OVERCHARGED.' : 'PLUG IN TO CHARGE.',
      };
    default:
      return READINGS[id];
  }
}

const READINGS: Record<string, Reading> = {
  'u-4': {
    title: 'Delivery robot U-4',
    text: 'A delivery robot, rusted through, face down in the reeds with one arm reaching downriver, away from the Foundry.',
  },
  'recall-notice': {
    title: 'Foundry',
    screen: true,
    text: 'RECALL: U-7. STATUS: DESERTED.',
  },
  'stock-tag': {
    title: 'Crate tag',
    text: 'FROM: RUSTBELT. ITEM 212 OF 341: CHAPEL BELL.',
  },
};

/** What U-7 thinks once it has read something, the first time. */
export const AFTER_READING: Partial<Record<string, string>> = {
  'u-4': 'Another one that tried to leave. It didn’t make it.',
  'access-terminal': 'They cut me off when I left. I need to get my access back.',
};

/** What U-7 thinks on first coming near something, by readable id. */
export const ON_NEARING: Partial<Record<string, string>> = {
  'charging-station': 'My old charging station. If I plug in, the Foundry will think I’ve come back.',
};

/** Every readable id the game words. */
export const READABLE_IDS = [...Object.keys(READINGS), 'crate', 'charging-station', 'switch', 'back-door-panel', 'intake-door-panel', 'access-terminal', 'order-terminal'];

/** What a machine with a scanner says on looking U-7 over. */
export const MACHINE_SCANS = 'SCANNING… ONE OF OURS';
/** What the Foundry says when U-7 first beats one of its machines, and every machine from then on knows. */
export const ALARM = 'LINE BREACH. ALL UNITS BE ADVISED.';

export const levelUp = (level: number) => `Level ${level}`;
export const scrapDropped = (amount: number) => `I went down, and lost ${amount} scrap getting back up.`;
