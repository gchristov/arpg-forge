import '@fontsource/alegreya-sans/500.css';
import '@fontsource/alegreya-sans/700.css';
import { Game } from '../../engine/game/game';
import { PX } from '../../engine/game/world-view';
import { currentLevel, type RefusalReason, type SimEvent } from '../../engine/sim/state';
import { DialogBox } from '../../engine/ui/dialog-box';
import { MODEL_URLS, unrecalledLook } from './art/look';
import { ENGINE_CALLS, ENGINE_DOWN_STEP, ENGINE_FALLS, LINE_ALERT, READINGS, MACHINE_SCANS, stillRunning, UNSEALED } from './content/story';
import { unrecalledContent } from './content/world';
import { Hud } from './ui/hud';

const game = new Game({
  canvas: document.querySelector<HTMLCanvasElement>('#game')!,
  saveKey: 'unrecalled',
  content: unrecalledContent(),
  look: unrecalledLook,
  models: MODEL_URLS,
});
const { state, labels, view } = game;
const $ = (id: string): HTMLElement => document.getElementById(id)!;
const dialog = new DialogBox({ root: $('dialog'), title: $('dlgT'), text: $('dlgP'), choices: $('dlgO') });
const hud = new Hud((command) => {
  if (command.type === 'attackNearest') dialog.close();
  game.send(command);
});

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

/** Unrecalled's words and banners for the rules' events; the engine shows the rest in the world. */
function react(events: SimEvent[]): void {
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
        dialog.close();
        hud.hideBanner();
        break;
      case 'HeroRespawned':
        if (e.goldLost) setTimeout(() => hud.banner('Back on your feet', `You dropped ${e.goldLost} scrap in the scramble.`), 400);
        break;
    }
  }
}

game.run({
  react,
  update: (s) => hud.update(s),
  onStart() {
    $('title').hidden = true;
    const { level } = currentLevel(state);
    hud.banner(level.name, level.subtitle, 3);
  },
  onWorldTap: () => dialog.close(),
});
