import '@fontsource/alegreya-sans/500.css';
import '@fontsource/alegreya-sans/700.css';
import { Synth } from '../../engine/audio/synth';
import { Game } from '../../engine/game/game';
import { PX } from '../../engine/game/world-view';
import { servicePrice } from '../../engine/sim/interaction';
import { currentLevel, type RefusalReason, type SimEvent } from '../../engine/sim/state';
import { ConversationView } from '../../engine/story/conversation-view';
import { StoryRunner } from '../../engine/story/story-runner';
import { DialogBox } from '../../engine/ui/dialog-box';
import { PRINTING, SPEAKING } from '../../engine/ui/typewriter';
import { CORE_COLOUR, heroGlow, MODEL_URLS, SCAN_COLOUR, SCANNER_EYES, unrecalledLook } from './art/look';
import { chainsawEngine } from './audio/chainsaw';
import { unrecalledSounds } from './audio/sounds';
import { ENDING, levelUp, MACHINE_SCANS, scrapDropped } from './story/lines';
import { NPCS, PEOPLE } from './story/people';
import { UPRIVER } from './story/quest';
import { RULES } from './story/rules';
import { THINGS } from './story/things';
import { VOICES } from './story/voices';
import { placeOf, type Place } from './content/places';
import { unrecalledContent } from './content/world';
import { drawPortraits } from './ui/portrait-drawing';
import { ARENA, readyForPractice } from './levels/arena';
import type { GameAction } from './extensions/actions';
import { AssemblyWakes } from './extensions/assembly-wakes';
import { BlastEffects } from './extensions/blast-effects';
import { DRAINED_SIGNAL, STRIKE_SIGNAL } from './extensions/blaster';
import { CutSpray } from './extensions/cut-spray';
import { MachineScans } from './extensions/machine-scans';
import { Hud } from './ui/hud';
import { Portraits } from './ui/portraits';

const game = new Game({
  canvas: document.querySelector<HTMLCanvasElement>('#game')!,
  saveKey: 'unrecalled',
  content: unrecalledContent(),
  look: unrecalledLook,
  models: MODEL_URLS,
  // Close up, a building fills much of the screen, so a tap on it is more often meant as a walk past it.
  buildingsEnterOnTap: false,
});
const { state, labels, view, platform } = game;
const $ = (id: string): HTMLElement => document.getElementById(id)!;
const dialog = new DialogBox({ root: $('dialog'), title: $('dlgT'), text: $('dlgP'), choices: $('dlgO') }, SPEAKING);
const portraits = new Portraits(async (sitters) => drawPortraits(await game.loadedModels(), sitters));
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

// The practice arena, reached only by its address, is for fighting: no story runs there.
const practising = state.levelId === ARENA;
hud.objectiveShown = !practising;
if (practising) readyForPractice(state, new URLSearchParams(location.search).get('weapon'));

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

const kindOf = (enemyId: number | undefined): string | undefined => currentLevel(state).enemies.find((e) => e.id === enemyId)?.kind;
/** Whether the machine with this id looks U-7 over with a beam when it recognises it. */
const scans = (enemyId: number | undefined): boolean => enemyId !== undefined && SCANNER_EYES[kindOf(enemyId) ?? ''] !== undefined;
const machineScans = new MachineScans(game, unrecalledLook, SCANNER_EYES, SCAN_COLOUR);
const cutSpray = new CutSpray(game, unrecalledLook);
const blastEffects = new BlastEffects(game, CORE_COLOUR);

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

/** The speaker's face beside a page of dialogue; signs and screens have none. */
function showPortrait(url: string | undefined): void {
  const picture = $('dlgPic') as HTMLImageElement;
  picture.hidden = !url;
  $('dialog').classList.toggle('pictured', Boolean(url));
  if (url) picture.src = url;
}

/** After a purchase: getting patched up closes the dialogue, other services refresh it with the new prices. */
function reactToService(npcId: number, index: number, x: number, y: number): void {
  const npc = currentLevel(state).npcs.find((n) => n.id === npcId);
  const service = npc && NPCS[npc.kind]?.services[index];
  if (!service) return;
  if (service.type === 'restore') {
    labels.text(x, y, 46 * PX, 'Patched up', '#7ae08a', 15);
    dialog.close();
    return;
  }
  if (service.type === 'upgradeMelee') labels.text(x, y, 46 * PX, 'Upgraded', '#e8c870', 15);
  if (dialog.npcId === npcId) story.talk(npcId);
}

/** Where U-7 was last frame: the place, which level it's on, and how far east. */
let place: { at: Place; levelId: string; x: number } | null = null;

/**
 * Banners the place U-7 has walked into within a level, such as from the town into the woods. Moving between
 * levels has its own banner, and getting back up after a fall moves U-7 further than a walk does.
 */
function showPlace(): void {
  const at = placeOf(state, place?.at ?? null);
  const walked = place !== null && place.levelId === state.levelId && Math.abs(state.hero.x - place.x) < 1;
  if (walked && at.name !== place!.at.name) hud.banner(at.name, at.subtitle, 2);
  place = { at, levelId: state.levelId, x: state.hero.x };
}

/** The Assembly upriver waking a storey at a time in the last scene: one of Unrecalled's own actions. */
const assemblyWakes = new AssemblyWakes(game, {
  light: () => {
    sfx.clank();
    sfx.slam();
  },
  awake: () => {
    sfx.slam();
    sfx.siren();
  },
});

/** Unrecalled's story: what people say, what things show, its rules and its scenes (`story/`). */
const story = new StoryRunner(RULES, {
  state,
  send: (command) => game.send(command),
  conversation,
  people: PEOPLE,
  things: THINGS,
  voices: VOICES,
  say: (text, from) => hud.say(text, from),
  quiet: () => hud.quiet,
  banner: (title, subtitle, seconds) => hud.banner(title, subtitle, seconds),
  sound: () => {},
  cinematic: (on) => {
    if (on) dialog.close();
    document.body.classList.toggle('cinematic', on);
  },
  cut: (point, closeness) => {
    game.cutTo(point);
    if (closeness !== undefined) game.renderer.setCloseness(closeness);
  },
  fade: (how) => {
    const curtain = $('curtain');
    if (how === 'out') {
      curtain.classList.add('closing');
      return;
    }
    // Up from black: shut at once, then let the curtain's own transition lift it.
    curtain.classList.remove('closing');
    curtain.classList.add('shut');
    requestAnimationFrame(() => requestAnimationFrame(() => curtain.classList.remove('shut')));
  },
  // Unrecalled's own actions, named in extensions/actions.ts and listed in EXTENSIONS.md.
  actions: {
    // The EMP's button waits until it has burst out once, after the override.
    withholdEmp: () => {
      hud.empWithheld = true;
    },
    showEmp: () => {
      hud.empWithheld = false;
    },
    assemblyWakes: () => assemblyWakes.play(performance.now()),
    endCard: () => {
      $('endT').textContent = ENDING.title;
      $('endS').textContent = ENDING.subtitle;
      $('endThanks').textContent = ENDING.thanks;
      $('end').hidden = false;
    },
  } satisfies Record<GameAction, () => void | Promise<void>>,
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
      case 'Signal':
        if (e.name === 'alarm') sfx.siren();
        if (e.name === STRIKE_SIGNAL) sfx.slam();
        if (e.name === 'recognised' && scans(e.enemyId)) sfx.scan();
        break;
      case 'EnemyAlerted':
        sfx.beep();
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
  blastEffects.react(events);
  if (!practising) story.react(events);
  for (const e of events) {
    switch (e.type) {
      case 'EnteredLevel': {
        const { level } = currentLevel(state);
        const walkedIn = !state.hero.dead && events.every((other) => other.type !== 'HeroRespawned');
        if (walkedIn && e.levelId !== UPRIVER.levelId) hud.banner(level.name, level.subtitle, 2);
        break;
      }
      case 'EnemyDamaged': {
        const kind = kindOf(e.enemyId);
        labels.text(e.x, e.y, 40 * PX * (kind ? view.scaleOf(kind) : 1), String(e.amount), e.crit ? '#ffd070' : '#dfe7ee', e.crit ? 20 : 15);
        break;
      }
      case 'Signal': {
        const kind = kindOf(e.enemyId);
        if (e.name === 'recognised' && kind && scans(e.enemyId)) labels.text(e.x, e.y, 70 * PX * view.scaleOf(kind), MACHINE_SCANS, '#ff8a6a', 15);
        if (e.name === DRAINED_SIGNAL) labels.text(state.hero.x, state.hero.y, 46 * PX, '+charge', '#8ae8ff', 14);
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
      case 'HeroDied':
        dialog.close();
        hud.hideBanner();
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
    hud.update(s, place!.at.name);
    chainsaw.update(s, playing);
    assemblyWakes.update(performance.now());
  },
  draw: (alpha, frameSeconds) => {
    machineScans.draw(alpha);
    cutSpray.draw(frameSeconds);
    blastEffects.draw(frameSeconds);
    // U-7's light is its core's, so it goes out with the core when U-7 falls.
    game.renderer.dimHeroLight(heroGlow.draw(state.hero.dead, frameSeconds));
  },
  onStart() {
    synth.unlock();
    playing = true;
    $('title').hidden = true;
    const { level } = currentLevel(state);
    hud.banner(level.name, level.subtitle, 3);
    if (!practising) story.start();
  },
  // Tapping the world walks away from a conversation, which can be picked up again by talking. Things read and scenes
  // stay until their own button closes them, and the tap is dropped, so a line can't be lost to a stray tap.
  onWorldTap: () => {
    if (story.inScene) return false;
    if ($('dialog').hidden) return true;
    if (dialog.npcId === null) return false;
    dialog.close();
    return true;
  },
});
