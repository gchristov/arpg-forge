import '@fontsource/alegreya-sans/400.css';
import '@fontsource/alegreya-sans/500.css';
import '@fontsource/alegreya-sans/700.css';
import '@fontsource/cinzel/500.css';
import '@fontsource/cinzel/700.css';
import { Synth } from '../../engine/audio/synth';
import { Game } from '../../engine/game/game';
import { PX } from '../../engine/game/world-view';
import { servicePrice } from '../../engine/sim/interaction';
import { currentLevel, type SimEvent } from '../../engine/sim/state';
import { DialogBox } from '../../engine/ui/dialog-box';
import { ashenHollowLook, MODEL_URLS } from './art/look';
import { ashenHollowSounds } from './audio/sounds';
import { BOSS_DEFEATED_STEP, dialogueFor, NPCS } from './content/story';
import { ashenHollowContent } from './content/world';
import { Hud } from './ui/hud';

const game = new Game({
  canvas: document.querySelector<HTMLCanvasElement>('#game')!,
  saveKey: 'ashen-hollow',
  content: ashenHollowContent(),
  look: ashenHollowLook,
  models: MODEL_URLS,
});
const { state, labels, platform, view } = game;
const synth = new Synth();
synth.muted = platform.load('muted') === 'true';
const sfx = ashenHollowSounds(synth);
const $ = (id: string): HTMLElement => document.getElementById(id)!;
const dialog = new DialogBox({ root: $('dialog'), title: $('dlgT'), text: $('dlgP'), choices: $('dlgO') });
const hud = new Hud((c) => {
  if (c.type === 'attackNearest') dialog.close();
  game.send(c);
});


$('title').addEventListener('pointerdown', (e) => {
  e.preventDefault();
  void game.start();
});
const goLabel = document.querySelector<HTMLElement>('#title .go');
if (goLabel) {
  const ready = goLabel.textContent;
  goLabel.textContent = 'Loading…';
  void game.modelsLoaded.then(() => (goLabel.textContent = ready));
}
$('mute').addEventListener('pointerdown', (e) => {
  e.preventDefault();
  e.stopPropagation();
  synth.unlock();
  synth.muted = !synth.muted;
  platform.save('muted', String(synth.muted));
  showMuted();
});
function showMuted(): void {
  $('waves').style.display = synth.muted ? 'none' : '';
}
showMuted();
document.addEventListener('pointerdown', () => synth.unlock(), { capture: true });

const REFUSALS = {
  noResource: ['Not enough mana', '#8fb0ff'],
  noHealingItems: ['No potions', '#ff8a7a'],
  fullHealth: ['Already healthy', '#e0d3b5'],
} as const;

/** Ashen Hollow's sounds for the rules' events. */
function playSounds(events: SimEvent[]): void {
  const heroHurt = events.some((e) => e.type === 'HeroHurt');
  for (const e of events) {
    switch (e.type) {
      case 'Swung':
        if (e.actorId === state.hero.id || !heroHurt) sfx.swing();
        break;
      case 'EnemyDamaged': {
        const kind = currentLevel(state).enemies.find((en) => en.id === e.enemyId)?.kind;
        if (kind === 'goblin') sfx.hit();
        else sfx.bone();
        break;
      }
      case 'HeroHurt':
        sfx.hurt();
        break;
      case 'SkillUsed':
        if (e.skill === 'fireball') sfx.fire();
        break;
      case 'Exploded':
        sfx.boom();
        break;
      case 'PickedUp':
        sfx.coin();
        break;
      case 'Healed':
        sfx.potion();
        break;
      case 'LevelUp':
        sfx.level();
        break;
      case 'TransitionStarted':
        sfx.door();
        break;
      case 'HeroDied':
        sfx.die();
        break;
      case 'ShotFired':
        sfx.arrow();
        break;
      case 'EnemyAlerted':
        sfx.alert();
        break;
      case 'SlamLanded':
        sfx.slam();
        break;
      case 'ContainerOpened':
        sfx.chest();
        break;
      case 'Refused':
        if (e.reason !== 'fullHealth') sfx.deny();
        break;
      case 'ServiceUsed': {
        const npc = currentLevel(state).npcs.find((n) => n.id === e.npcId);
        const service = npc && NPCS[npc.kind]?.services[e.service];
        if (service?.type === 'restore') sfx.potion();
        else if (service?.type === 'sellHealingItem') sfx.coin();
        else sfx.chest();
        break;
      }
      case 'QuestAdvanced':
        if (e.step === BOSS_DEFEATED_STEP) sfx.level();
        break;
    }
  }
}

/** Ashen Hollow's text, banners and dialogue for the rules' events; the engine shows the rest in the world. */
function react(events: SimEvent[]): void {
  playSounds(events);
  for (const e of events) {
    switch (e.type) {
      case 'EnteredLevel': {
        const { level } = currentLevel(state);
        if (!state.hero.dead && events.every((other) => other.type !== 'HeroRespawned')) hud.banner(level.name, level.subtitle, 1.8);
        break;
      }
      case 'EnemyDamaged': {
        const kind = currentLevel(state).enemies.find((en) => en.id === e.enemyId)?.kind;
        const scale = kind ? view.scaleOf(kind) : 1;
        labels.text(e.x, e.y, 40 * PX * scale, String(e.amount), e.crit ? '#ffd25a' : '#f3ead6', e.crit ? 20 : 15);
        break;
      }
      case 'HeroHurt':
        labels.text(e.x, e.y, 46 * PX, `-${e.amount}`, '#ff5a4a', 15);
        hud.flashHurt();
        break;
      case 'Healed':
        labels.text(e.x, e.y, 46 * PX, `+${e.amount}`, '#7dff8a', 16);
        break;
      case 'Refused': {
        const [text, colour] = REFUSALS[e.reason];
        labels.text(e.x, e.y, 50 * PX, text, colour, 13);
        break;
      }
      case 'SlamWarned':
        labels.text(e.x, e.y, 70 * PX, '!', '#c77dff', 24);
        break;
      case 'Summoned':
        hud.banner('The dead answer his call', '', 2.2);
        break;
      case 'LevelUp':
        hud.banner(`Level ${e.level}`, 'Stronger, and fully healed.');
        break;
      case 'Talked':
        showDialogue(e.npcId, e.questBefore);
        break;
      case 'ServiceUsed':
        reactToService(e.npcId, e.service, e.x, e.y);
        break;
      case 'PickedUp':
        if (e.kind === 'gold') labels.text(e.x, e.y, 30 * PX, `+${e.amount} gold`, '#ffd25a', 13);
        else labels.text(e.x, e.y, 30 * PX, '+1 potion', '#ff8a96', 13);
        break;
      case 'QuestAdvanced':
        if (e.step === BOSS_DEFEATED_STEP) {
          setTimeout(() => hud.banner('The Bone Lord is destroyed', 'Ashen Hollow is safe. The wilds still stir.', 4.5), 600);
        }
        break;
      case 'HeroDied':
        dialog.close();
        hud.banner('You have fallen', 'Tap to rise again in the village.', Infinity);
        break;
      case 'HeroRespawned':
        hud.hideBanner();
        if (e.goldLost) setTimeout(() => hud.banner('Ashen Hollow', `${e.goldLost} gold lost.`), 400);
        break;
    }
  }
}

/** Opens an NPC's dialogue, with each service's price and whether the hero can afford it. */
function showDialogue(npcId: number, questBefore: number): void {
  const npc = currentLevel(state).npcs.find((n) => n.id === npcId);
  const d = npc && dialogueFor(npc.kind, questBefore, state.quest);
  if (!npc || !d) return;
  const services = NPCS[npc.kind]?.services ?? [];
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
          if (o.service === undefined) dialog.close();
          else game.send({ type: 'useService', npcId, service: o.service });
        },
      };
    }),
    npcId,
  );
}

/** After a purchase: resting closes the dialogue, other services refresh it with the new prices. */
function reactToService(npcId: number, index: number, x: number, y: number): void {
  const npc = currentLevel(state).npcs.find((n) => n.id === npcId);
  const service = npc && NPCS[npc.kind]?.services[index];
  if (!service) return;
  if (service.type === 'restore') {
    labels.text(x, y, 46 * PX, 'Rested', '#7dff8a', 15);
    dialog.close();
    return;
  }
  if (service.type === 'upgradeMelee') labels.text(x, y, 46 * PX, 'Blade honed', '#ffd25a', 15);
  if (dialog.npcId === npcId) showDialogue(npcId, state.quest);
}

game.run({
  react,
  update: (s) => hud.update(s),
  onStart() {
    synth.unlock();
    $('title').hidden = true;
    hud.banner('Ashen Hollow', 'Speak to Elder Maren in the square.', 3);
  },
  onWorldTap: () => dialog.close(),
});
