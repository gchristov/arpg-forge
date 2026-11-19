import '@fontsource/alegreya-sans/500.css';
import '@fontsource/alegreya-sans/700.css';
import { Synth } from '../../engine/audio/synth';
import { Game } from '../../engine/game/game';
import { PX } from '../../engine/game/world-view';
import { servicePrice } from '../../engine/sim/interaction';
import { currentLevel, type RefusalReason, type SimEvent } from '../../engine/sim/state';
import { ConversationView } from '../../engine/story/conversation-view';
import { read, talkTo } from '../../engine/story/talk';
import { DialogBox } from '../../engine/ui/dialog-box';
import { PRINTING, SPEAKING } from '../../engine/ui/typewriter';
import { MODEL_URLS, unrecalledLook } from './art/look';
import { chainsawEngine } from './audio/chainsaw';
import { unrecalledSounds } from './audio/sounds';
import {
  AFTER_READING, ALARM, ARRIVAL, CHARGED, CHARGING, ENDING, ENGINE_SAYS, GIVING_THE_ORDER, HOMECOMING, levelUp, LOCKED,
  MACHINE_SCANS, ON_ENTERING, ON_NEARING, scrapDropped, STEP_LINES,
} from './story/lines';
import { NPCS, PEOPLE } from './story/people';
import { BY_THE_FIRE, REPLY, STEP, UPRIVER } from './story/quest';
import { THINGS } from './story/things';
import { VOICES, type Line } from './story/voices';
import { placeOf, type Place } from './content/places';
import { unrecalledContent } from './content/world';
import { until } from './ui/beats';
import { Ending } from './ui/ending';
import { Homecoming } from './ui/homecoming';
import { EMP, Hud } from './ui/hud';
import { Portraits } from './ui/portraits';

const game = new Game({
  canvas: document.querySelector<HTMLCanvasElement>('#game')!,
  saveKey: 'unrecalled',
  content: unrecalledContent(),
  look: unrecalledLook,
  models: MODEL_URLS,
});
const { state, labels, view, platform } = game;
const $ = (id: string): HTMLElement => document.getElementById(id)!;
const dialog = new DialogBox({ root: $('dialog'), title: $('dlgT'), text: $('dlgP'), choices: $('dlgO') }, SPEAKING);
const portraits = new Portraits((sitters) => game.portraits(sitters));
const hud = new Hud(
  (command) => {
    if (command.type === 'attackNearest') dialog.close();
    game.send(command);
  },
  {
    portraitOf: (from) => portraits.of(from),
    // Machines print their words, as a terminal does.
    paceOf: (from) => (from?.voice === 'foundry' ? PRINTING : SPEAKING),
  },
);

const synth = new Synth();
// Sound starts off until the player turns it on.
synth.muted = platform.load('muted') !== 'false';
const sfx = unrecalledSounds(synth);
const chainsaw = chainsawEngine(synth);
let playing = false;
const showMuted = (): void => {
  $('mute').classList.toggle('off', synth.muted);
  $('mute').setAttribute('aria-pressed', String(!synth.muted));
};
showMuted();
$('mute').addEventListener('pointerdown', (e) => {
  e.preventDefault();
  e.stopPropagation();
  synth.unlock();
  synth.muted = !synth.muted;
  platform.save('muted', String(synth.muted));
  showMuted();
});
// Browsers only let sound start from a tap or click.
document.addEventListener('pointerdown', () => synth.unlock(), { capture: true });

$('title').addEventListener('pointerdown', (e) => {
  e.preventDefault();
  void game.start();
});
const goLabel = document.querySelector<HTMLElement>('#title .go')!;
const ready = goLabel.textContent;
goLabel.textContent = 'Loading…';
void game.modelsLoaded.then(() => (goLabel.textContent = ready));

const REFUSALS: Record<RefusalReason, string> = {
  noResource: 'No charge',
  noHealingItems: 'No patch kits',
  fullHealth: 'Already patched up',
};

const kindOf = (enemyId: number): string | undefined => currentLevel(state).enemies.find((e) => e.id === enemyId)?.kind;

/** The floors whose speakers have already greeted the salvager. */
const greeted = new Set<string>();

/** Whether the Foundry has announced the line breach. */
let breachAnnounced = false;

/** Shows conversations and readings in the dialogue box, with a portrait for people and every page kept in the log. */
const conversation = new ConversationView(dialog, {
  send: (command) => game.send(command),
  price: (npcId, index) => {
    const npc = currentLevel(state).npcs.find((n) => n.id === npcId);
    const service = npc && NPCS[npc.kind]?.services[index];
    return service ? servicePrice(state.hero, service) : 0;
  },
  money: () => state.hero.gold,
  pace: (talk) => (talk.screen ? PRINTING : talk.written ? null : SPEAKING),
  onPage: (talk, text) => {
    hud.remember(text, { name: talk.title, voice: 'page' });
    showPortrait(talk.screen || talk.written ? undefined : portraits.ofName(talk.title));
    $('dialog').classList.toggle('screen', Boolean(talk.screen));
  },
});

/** Opens what a townsperson says, by their kind. */
function showDialogue(npcId: number, kind: string): void {
  const person = PEOPLE[kind];
  const talk = person && talkTo(person, state);
  if (talk) conversation.show(talk, npcId);
}

/** The speaker's face beside a page of dialogue; signs and screens have none. */
function showPortrait(url: string | undefined): void {
  const picture = $('dlgPic') as HTMLImageElement;
  picture.hidden = !url;
  $('dialog').classList.toggle('pictured', Boolean(url));
  if (url) picture.src = url;
}

/** How long after the last locked-door event a new one counts as walking into the door again. */
const LOCKED_AGAIN_MS = 2500;
let lastLocked = -Infinity;

const say = (lines: Line[] | undefined): void => {
  for (const line of lines ?? []) hud.say(line.text, line.from);
};

/** Opens what Odell has to say, wherever he is. */
function talkToOdell(): void {
  const foreman = currentLevel(state).npcs.find((n) => n.kind === 'foreman');
  if (foreman) showDialogue(foreman.id, foreman.kind);
}

/** What reading something says, or the scene it starts: the charging station, the crate and the order terminal. */
function showReading(id: string, events: SimEvent[]): void {
  const reached = events.flatMap((e) => (e.type === 'QuestAdvanced' ? [e.step] : []));
  // Opening the crate lets Odell out, and he speaks at once.
  if (reached.includes(STEP.crateOpened)) {
    talkToOdell();
    return;
  }
  const thing = THINGS[id];
  if (!thing) return;
  // Worded as it was when it was used, before using it moved the story on.
  const before = Math.min(state.quest, ...reached.map((step) => step - 1));
  if (reached.includes(STEP.atCharger)) {
    // The EMP is the charge's gift, so it shows once the scene is over. The screen waits for the salvager's thought on
    // coming near, which a page opening at once would put away. Plugging in uses the station again, which authorises
    // U-7 and opens the door down.
    hud.empWithheld = true;
    const station = currentLevel(state).readables.findIndex((r) => r.id === id);
    const plugIn = read(thing, state, before, 'Plug in');
    const plugInAgain = () => game.send({ type: 'read', index: station });
    void until(() => hud.quiet).then(() => plugIn && conversation.show(plugIn, null, plugInAgain));
  } else if (reached.includes(STEP.charged)) conversation.show(CHARGING, null, () => void chargeUp());
  else if (reached.includes(STEP.orderClosed)) conversation.show(GIVING_THE_ORDER, null, talkToOdell);
  else {
    const reading = read(thing, state, before);
    if (reading) conversation.show(reading);
  }
  const thought = AFTER_READING[id];
  if (thought && !thoughtsHad.has(id)) say([{ text: thought }]);
  thoughtsHad.add(id);
}

/** Things the salvager has already had their thought about. */
const thoughtsHad = new Set<string>();

/** How near, in tiles, the salvager comes to something before thinking about it. */
const NEARING = 2.5;

/** The salvager's thought on first coming near something that has one. */
function thinkNearby(): void {
  for (const r of currentLevel(state).readables) {
    const thought = ON_NEARING[r.id];
    if (!thought || thoughtsHad.has(r.id)) continue;
    if (Math.hypot(state.hero.x - (r.tx + 0.5), state.hero.y - (r.ty + 0.5)) > NEARING) continue;
    thoughtsHad.add(r.id);
    say([{ text: thought }]);
  }
}

/**
 * After plugging in: U-7 lets the Foundry believe it has come back, then the charge kept for it bursts out of its own
 * accord as the EMP, before its button appears, so the player sees what it does rather than reads it.
 */
async function chargeUp(): Promise<void> {
  say([CHARGED.believed, CHARGED.overcharged]);
  await until(() => hud.quiet);
  game.send({ type: 'useSkill', slot: EMP });
  hud.empWithheld = false;
  say([CHARGED.burst]);
}

/** Steps whose lines wait for the scene that reaches them. */
const AFTER_SCENE: number[] = [STEP.ending];

/** What happens in the world as the story moves on. */
function reachStep(step: number): void {
  if (step === STEP.freed) void homecoming.play(HOMECOMING);
  if (!AFTER_SCENE.includes(step)) say(STEP_LINES[step]);
}

/** Where the camera rests while the town welcomes the foreman home: on the fire and the people round it. */
const AROUND_THE_FIRE = { x: 22.5, y: 15 };

/** Home at dawn, from leaving the Foundry until the Assembly upriver, played with no input from the player. */
const homecoming = new Homecoming({
  begin: () => {
    dialog.close();
    document.body.classList.add('cinematic');
  },
  home: () => state.levelId === BY_THE_FIRE.levelId && !state.transition,
  frame: () => game.cutTo(AROUND_THE_FIRE),
  say,
  quiet: () => hud.quiet,
  fadeOut: () => $('curtain').classList.add('closing'),
  answer: () => {
    const foreman = currentLevel(state).npcs.find((n) => n.kind === 'foreman');
    if (foreman) game.send({ type: 'reply', npcId: foreman.id, id: REPLY.upriver });
  },
});

/** Whether U-7's arrival in the town is playing, with no input from the player. */
let arriving = false;

/**
 * U-7 walks into the town at night and warns Odell, played as a scene; offering to prove itself on the loader at the
 * crates starts the game proper.
 */
async function arrive(): Promise<void> {
  arriving = true;
  document.body.classList.add('cinematic');
  say(ARRIVAL);
  await until(() => hud.quiet);
  document.body.classList.remove('cinematic');
  arriving = false;
  const foreman = currentLevel(state).npcs.find((n) => n.kind === 'foreman');
  if (foreman) game.send({ type: 'reply', npcId: foreman.id, id: REPLY.proveIt });
}

/** Whether the Order Engine has greeted the salvager yet. */
let engineSpoke = false;

/** The Order Engine speaks the moment the salvager walks into its hall, if it's still standing. */
function greetFromEngine(): void {
  if (engineSpoke || !currentLevel(state).enemies.some((e) => e.kind === 'orderEngine' && !e.dead)) return;
  engineSpoke = true;
  say([ENGINE_SAYS]);
}

/** After a purchase: getting patched up closes the dialogue, other services refresh it with the new prices. */
function reactToService(npcId: number, index: number, x: number, y: number): void {
  const npc = currentLevel(state).npcs.find((n) => n.id === npcId);
  const service = npc && NPCS[npc.kind]?.services[index];
  if (!service) return;
  if (service.type === 'restore') {
    labels.text(x, y, 46 * PX, 'Patched up', '#7ae08a', 15);
    game.send({ type: 'setFlag', flag: 'wentDown', on: false });
    dialog.close();
    return;
  }
  if (service.type === 'upgradeMelee') labels.text(x, y, 46 * PX, 'Upgraded', '#e8c870', 15);
  if (dialog.npcId === npcId) showDialogue(npcId, npc.kind);
}

/** Where the salvager was last frame: the place, which level it's on, and how far east. */
let place: { at: Place; levelId: string; x: number } | null = null;

/**
 * Banners the place the salvager has walked into within a level, such as from the town into the woods. Moving between
 * levels has its own banner, and getting back up after a fall moves the salvager further than a walk does.
 */
function showPlace(): void {
  const at = placeOf(state, place?.at ?? null);
  const walked = place !== null && place.levelId === state.levelId && Math.abs(state.hero.x - place.x) < 1;
  if (walked && at.name !== place!.at.name) hud.banner(at.name, at.subtitle, 2);
  place = { at, levelId: state.levelId, x: state.hero.x };
}

/** The Assembly waking upriver and reaching further upriver, then the card that closes the demo. */
const ending = new Ending(game, {
  begin: () => {
    dialog.close();
    document.body.classList.add('cinematic');
    // Up from black: shut at once, then let the curtain's own transition lift it.
    $('curtain').classList.remove('closing');
    $('curtain').classList.add('shut');
    requestAnimationFrame(() => requestAnimationFrame(() => $('curtain').classList.remove('shut')));
  },
  light: () => {
    sfx.clank();
    sfx.slam();
  },
  awake: () => {
    sfx.slam();
    sfx.siren();
  },
  online: () => say(STEP_LINES[STEP.ending]),
  quiet: () => hud.quiet,
  card: () => {
    $('endT').textContent = ENDING.title;
    $('endS').textContent = ENDING.subtitle;
    $('endThanks').textContent = ENDING.thanks;
    $('end').hidden = false;
  },
});

// Tapping the closing card starts the game again from the beginning.
$('end').addEventListener('pointerdown', (e) => {
  e.preventDefault();
  e.stopPropagation();
  location.assign(location.pathname);
});

/** Unrecalled's sounds for the rules' events. */
function playSounds(events: SimEvent[]): void {
  for (const e of events) {
    switch (e.type) {
      case 'Swung':
        if (e.actorId === state.hero.id) sfx.rev();
        break;
      case 'EnemyDamaged':
        sfx.clank();
        break;
      case 'HeroHurt':
        sfx.hurt();
        break;
      case 'SkillUsed':
        if (e.skill === 'emp') sfx.emp();
        else sfx.zap();
        break;
      case 'Exploded':
        sfx.crackle();
        break;
      case 'PickedUp':
        if (e.kind === 'gold') sfx.scrap();
        else if (e.kind === 'healingItem') sfx.patch();
        break;
      case 'Healed':
        sfx.patch();
        break;
      case 'LevelUp':
        sfx.level();
        break;
      case 'TransitionStarted':
        sfx.door();
        break;
      case 'HeroDied':
        sfx.powerDown();
        break;
      case 'ShotFired':
        sfx.pew();
        break;
      case 'EnemyRecognised':
        if (kindOf(e.enemyId) && unrecalledLook.actor(kindOf(e.enemyId)!).scanner) sfx.scan();
        break;
      case 'EnemyAlerted':
        sfx.beep();
        break;
      case 'LevelAlarmed':
        sfx.siren();
        break;
      case 'SlamLanded':
        sfx.slam();
        break;
      case 'ContainerOpened':
        sfx.cache();
        break;
      case 'Read':
        sfx.read();
        break;
      case 'PortalLocked':
        sfx.sealed();
        break;
      case 'Refused':
        if (e.reason !== 'fullHealth') sfx.deny();
        break;
      case 'ServiceUsed':
        sfx.cache();
        break;
    }
  }
}

/** Unrecalled's words and banners for the rules' events; the engine shows the rest in the world. */
function react(events: SimEvent[]): void {
  playSounds(events);
  for (const e of events) {
    switch (e.type) {
      case 'EnteredLevel': {
        const { level } = currentLevel(state);
        if (e.levelId === UPRIVER.levelId) ending.play(performance.now());
        else if (!state.hero.dead && events.every((other) => other.type !== 'HeroRespawned')) {
          hud.banner(level.name, level.subtitle, 2);
          greetFromEngine();
          // The speakers greet each floor once, on the way down.
          if (!greeted.has(e.levelId)) say(ON_ENTERING[e.levelId] && [ON_ENTERING[e.levelId]!]);
          greeted.add(e.levelId);
        }
        break;
      }
      case 'EnemyDamaged': {
        const kind = kindOf(e.enemyId);
        labels.text(e.x, e.y, 40 * PX * (kind ? view.scaleOf(kind) : 1), String(e.amount), e.crit ? '#ffd070' : '#dfe7ee', e.crit ? 20 : 15);
        break;
      }
      case 'EnemyRecognised': {
        const kind = kindOf(e.enemyId);
        if (kind && unrecalledLook.actor(kind).scanner) labels.text(e.x, e.y, 70 * PX * view.scaleOf(kind), MACHINE_SCANS, '#ff8a6a', 15);
        break;
      }
      // The line is breached once, when U-7 beats its first machine; every machine hears it at once.
      case 'LevelAlarmed':
        if (!breachAnnounced) hud.say(ALARM, VOICES.foundry);
        breachAnnounced = true;
        break;
      case 'PortalLocked': {
        // Standing in a locked doorway repeats the event; the thought comes once each time the salvager walks into it.
        const now = performance.now();
        if (now - lastLocked > LOCKED_AGAIN_MS) hud.say(LOCKED);
        lastLocked = now;
        break;
      }
      case 'HeroHurt':
        labels.text(e.x, e.y, 46 * PX, `-${e.amount}`, '#ff7a5a', 15);
        break;
      case 'Healed':
        labels.text(e.x, e.y, 46 * PX, `+${e.amount}`, '#7ae08a', 16);
        break;
      case 'Refused':
        labels.text(e.x, e.y, 50 * PX, REFUSALS[e.reason], '#8a98a6', 13);
        break;
      case 'LevelUp':
        labels.text(state.hero.x, state.hero.y, 70 * PX, levelUp(e.level), '#e8c870', 18);
        break;
      case 'PickedUp':
        if (e.kind === 'gold') labels.text(e.x, e.y, 30 * PX, `+${e.amount} scrap`, '#e8c870', 13);
        else if (e.kind === 'healingItem') labels.text(e.x, e.y, 30 * PX, '+1 patch kit', '#7ae08a', 13);
        break;
      case 'Read':
        showReading(e.id, events);
        break;
      case 'QuestAdvanced':
        reachStep(e.step);
        break;
      case 'HeroDied':
        // Mags remarks on it until she next patches U-7 up.
        game.send({ type: 'setFlag', flag: 'wentDown', on: true });
        dialog.close();
        hud.hideBanner();
        break;
      case 'Talked':
        showDialogue(e.npcId, e.kind);
        break;
      case 'ServiceUsed':
        reactToService(e.npcId, e.service, e.x, e.y);
        break;
      case 'HeroRespawned':
        if (e.goldLost) hud.say(scrapDropped(e.goldLost));
        break;
    }
  }
}

game.run({
  react,
  update: (s) => {
    showPlace();
    thinkNearby();
    hud.update(s, place!.at.name);
    chainsaw.update(s, playing);
    ending.update(performance.now());
  },
  onStart() {
    synth.unlock();
    playing = true;
    $('title').hidden = true;
    const { level } = currentLevel(state);
    hud.banner(level.name, level.subtitle, 3);
    if (state.quest === 0) void arrive();
  },
  // Tapping the world walks away from a conversation, which can be picked up again by talking. Things read and scenes
  // stay until their own button closes them, and the tap is dropped, so a line can't be lost to a stray tap.
  onWorldTap: () => {
    if (arriving || ending.playing || homecoming.playing) return false;
    if ($('dialog').hidden) return true;
    if (dialog.npcId === null) return false;
    dialog.close();
    return true;
  },
});
