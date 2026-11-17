import '@fontsource/alegreya-sans/500.css';
import '@fontsource/alegreya-sans/700.css';
import { Synth } from '../../engine/audio/synth';
import { Game } from '../../engine/game/game';
import { PX } from '../../engine/game/world-view';
import { servicePrice } from '../../engine/sim/interaction';
import { currentLevel, type RefusalReason, type SimEvent } from '../../engine/sim/state';
import { DialogBox } from '../../engine/ui/dialog-box';
import { MODEL_URLS, unrecalledLook } from './art/look';
import { chainsawEngine } from './audio/chainsaw';
import { unrecalledSounds } from './audio/sounds';
import {
  ALARM, CHAINSAW_FOUND, CHARGING, dialogueFor, ENDING, ENGINE_CALLS, ENGINE_FALLS, levelUp, LOCKED, MACHINE_SCANS, NPCS, ON_ENTERING,
  ORDER_CLOSED, RAID_STOPPED, READINGS, scrapDropped, STEP, STEP_LINES, VOICES, type Dialogue, type Line,
} from './content/story';
import { placeOf, type Place } from './content/places';
import { unrecalledContent } from './content/world';
import { Hud } from './ui/hud';

const game = new Game({
  canvas: document.querySelector<HTMLCanvasElement>('#game')!,
  saveKey: 'unrecalled',
  content: unrecalledContent(),
  look: unrecalledLook,
  models: MODEL_URLS,
});
const { state, labels, view, platform } = game;
const $ = (id: string): HTMLElement => document.getElementById(id)!;
const dialog = new DialogBox({ root: $('dialog'), title: $('dlgT'), text: $('dlgP'), choices: $('dlgO') });
const hud = new Hud((command) => {
  if (command.type === 'attackNearest') dialog.close();
  game.send(command);
});

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

/** Times the salvager has gone down, for the trader to remark on. */
let deaths = 0;

/** Opens a townsperson's dialogue; when they're done talking, `then` runs, for a step of the story that follows. */
function showDialogue(npcId: number, questBefore: number): void {
  const npc = currentLevel(state).npcs.find((n) => n.id === npcId);
  const d = npc && dialogueFor(npc.kind, questBefore, state.quest, deaths, state.hero.weapon);
  if (!npc || !d) return;
  const ending = npc.kind === 'foreman' && questBefore < STEP.ending && state.quest >= STEP.ending;
  present(d, { npcId, kind: npc.kind }, ending ? playEnding : undefined);
}

/**
 * Shows a page of dialogue, with each service's price and whether the salvager can afford it. A reply leads to the
 * next page; the last closes it and runs `then`.
 */
function present(d: Dialogue, npc?: { npcId: number; kind: string }, then?: () => void): void {
  const services = npc ? NPCS[npc.kind]?.services ?? [] : [];
  dialog.open(
    d.title,
    d.text,
    d.options.map((o) => {
      const service = o.service === undefined ? undefined : services[o.service];
      const price = service ? servicePrice(state.hero, service) : 0;
      return {
        label: o.label,
        ...(o.tag ? { tag: o.tag(price) } : {}),
        disabled: state.hero.gold < price,
        onChoose: () => {
          if (o.service !== undefined && npc) game.send({ type: 'useService', npcId: npc.npcId, service: o.service });
          else if (o.next) present(o.next, npc, then);
          else {
            dialog.close();
            then?.();
          }
        },
      };
    }),
    npc?.npcId ?? null,
  );
}

/** Pages of dialogue one after another, then `then`. */
function playScene(pages: Dialogue[], then?: () => void): void {
  const [first, ...rest] = pages;
  if (first) present(first, undefined, () => playScene(rest, then));
  else then?.();
}

const say = (lines: Line[] | undefined): void => {
  for (const line of lines ?? []) hud.say(line.text, line.from);
};

/** What reading something says, and for the charging station, the scene that follows. */
function showReading(id: string): void {
  const reading = READINGS[id];
  if (!reading) return;
  const page: Dialogue = { title: reading.title, text: reading.text, options: [{ label: id === 'charging-station' ? 'Plug in' : 'Close' }] };
  if (id === 'charging-station') playScene([page, ...CHARGING], () => say(STEP_LINES[STEP.charged]));
  else present(page);
}

/** What happens in the world as the story moves on. */
function reachStep(step: number): void {
  if (step === STEP.raidStopped) present(RAID_STOPPED);
  else if (step === STEP.engineDown) present(ENGINE_FALLS, undefined, () => say([ORDER_CLOSED]));
  // The charging station's lines follow its scene.
  else if (step !== STEP.charged) say(STEP_LINES[step]);
}

/** After a purchase: getting patched up closes the dialogue, other services refresh it with the new prices. */
function reactToService(npcId: number, index: number, x: number, y: number): void {
  const npc = currentLevel(state).npcs.find((n) => n.id === npcId);
  const service = npc && NPCS[npc.kind]?.services[index];
  if (!service) return;
  if (service.type === 'restore') {
    labels.text(x, y, 46 * PX, 'Patched up', '#7ae08a', 15);
    deaths = 0;
    dialog.close();
    return;
  }
  if (service.type === 'upgradeMelee') labels.text(x, y, 46 * PX, 'Upgraded', '#e8c870', 15);
  if (dialog.npcId === npcId) showDialogue(npcId, state.quest);
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

/** The light upriver, then the card that closes the demo on its question. */
function playEnding(): void {
  hud.banner(ENDING.upriver.title, ENDING.upriver.subtitle, 4);
  setTimeout(() => {
    $('endT').textContent = ENDING.card.title;
    $('endS').textContent = ENDING.card.subtitle;
    $('end').hidden = false;
  }, 4200);
}

$('endGo').addEventListener('click', (e) => {
  e.stopPropagation();
  $('end').hidden = true;
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
        else sfx.patch();
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
        if (!state.hero.dead && events.every((other) => other.type !== 'HeroRespawned')) {
          hud.banner(level.name, level.subtitle, 2);
          say(ON_ENTERING[e.levelId] && [ON_ENTERING[e.levelId]!]);
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
      case 'LevelAlarmed':
        if (currentLevel(state).level.building) hud.say(ALARM.foundry, VOICES.foundry);
        hud.say(ALARM.turns);
        break;
      case 'PortalLocked':
        labels.text(e.x, e.y, 60 * PX, LOCKED[e.to] ?? 'Locked', '#ff7a62', 14);
        break;
      case 'Armed':
        hud.say(CHAINSAW_FOUND);
        break;
      case 'HeroHurt':
        labels.text(e.x, e.y, 46 * PX, `-${e.amount}`, '#ff7a5a', 15);
        break;
      case 'Healed':
        labels.text(e.x, e.y, 46 * PX, `+${e.amount}`, '#7ae08a', 16);
        break;
      case 'Refused':
        labels.text(e.x, e.y, 50 * PX, REFUSALS[e.reason], '#8a98a6', 13);
        break;
      case 'Summoned':
        hud.say(ENGINE_CALLS.says, VOICES.orderEngine);
        hud.say(ENGINE_CALLS.then);
        break;
      case 'LevelUp':
        hud.say(levelUp(e.level));
        break;
      case 'PickedUp':
        if (e.kind === 'gold') labels.text(e.x, e.y, 30 * PX, `+${e.amount} scrap`, '#e8c870', 13);
        else labels.text(e.x, e.y, 30 * PX, '+1 patch kit', '#7ae08a', 13);
        break;
      case 'Read':
        showReading(e.id);
        break;
      case 'QuestAdvanced':
        reachStep(e.step);
        break;
      case 'HeroDied':
        deaths++;
        dialog.close();
        hud.hideBanner();
        break;
      case 'Talked':
        showDialogue(e.npcId, e.questBefore);
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
  },
  onStart() {
    synth.unlock();
    playing = true;
    $('title').hidden = true;
    const { level } = currentLevel(state);
    hud.banner(level.name, level.subtitle, 3);
  },
  onWorldTap: () => dialog.close(),
});
