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
  CHAINSAW_FOUND, dialogueFor, LOCKED, ENDING, ENDING_STEP, ENGINE_CALLS, ENGINE_DOWN_STEP, ENGINE_FALLS, LINE_ALERT, MACHINE_SCANS, NPCS, READINGS,
  stillRunning, UNSEALED,
} from './content/story';
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

/** Opens a townsperson's dialogue, with each service's price and whether the salvager can afford it. */
function showDialogue(npcId: number, questBefore: number): void {
  const npc = currentLevel(state).npcs.find((n) => n.id === npcId);
  const d = npc && dialogueFor(npc.kind, questBefore, state.quest, deaths, state.hero.weapon);
  if (!npc || !d) return;
  const services = NPCS[npc.kind]?.services ?? [];
  const ending = npc.kind === 'foreman' && questBefore < ENDING_STEP && state.quest >= ENDING_STEP;
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
          if (o.service !== undefined) game.send({ type: 'useService', npcId, service: o.service });
          else {
            dialog.close();
            if (ending) playEnding();
          }
        },
      };
    }),
    npcId,
  );
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
      case 'PortalSealed':
      case 'PortalLocked':
        sfx.sealed();
        break;
      case 'LevelCleared':
        if (currentLevel(state).level.portals.some((p) => p.sealed)) sfx.unsealed();
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
        if (!state.hero.dead && events.every((other) => other.type !== 'HeroRespawned')) hud.banner(level.name, level.subtitle, 2);
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
        hud.banner(LINE_ALERT.title, LINE_ALERT.subtitle, 2.2);
        break;
      case 'PortalSealed': {
        const running = currentLevel(state).enemies.filter((en) => !en.dead).length;
        labels.text(e.x, e.y, 60 * PX, stillRunning(running), '#ff7a62', 14);
        break;
      }
      case 'PortalLocked':
        labels.text(e.x, e.y, 60 * PX, LOCKED, '#ff7a62', 14);
        break;
      case 'Armed':
        hud.banner(CHAINSAW_FOUND.title, CHAINSAW_FOUND.subtitle, 2.6);
        break;
      case 'LevelCleared':
        if (currentLevel(state).level.portals.some((p) => p.sealed)) hud.banner(UNSEALED.title, UNSEALED.subtitle, 2.6);
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
        hud.banner(ENGINE_CALLS.title, ENGINE_CALLS.subtitle, 2.6);
        break;
      case 'LevelUp':
        hud.banner(`Level ${e.level}`, 'Patched up, and hitting harder.');
        break;
      case 'PickedUp':
        if (e.kind === 'gold') labels.text(e.x, e.y, 30 * PX, `+${e.amount} scrap`, '#e8c870', 13);
        else labels.text(e.x, e.y, 30 * PX, '+1 patch kit', '#7ae08a', 13);
        break;
      case 'Read': {
        const reading = READINGS[e.id];
        if (reading) dialog.open(reading.title, reading.text, [{ label: 'Close', onChoose: () => dialog.close() }]);
        break;
      }
      case 'QuestAdvanced':
        if (e.step === ENGINE_DOWN_STEP) setTimeout(() => hud.banner(ENGINE_FALLS.title, ENGINE_FALLS.subtitle, 5), 600);
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
        if (e.goldLost) setTimeout(() => hud.banner('Back on your feet', `You dropped ${e.goldLost} scrap in the scramble.`), 400);
        break;
    }
  }
}

game.run({
  react,
  update: (s) => {
    hud.update(s);
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
