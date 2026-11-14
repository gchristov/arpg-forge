import '@fontsource/alegreya-sans/500.css';
import '@fontsource/alegreya-sans/700.css';
import { Game } from '../../engine/game/game';
import { PX } from '../../engine/game/world-view';
import type { Command, GameState, SimEvent } from '../../engine/sim/state';
import { MODEL_URLS, unrecalledLook } from './art/look';
import { unrecalledContent } from './content/world';

const game = new Game({
  canvas: document.querySelector<HTMLCanvasElement>('#game')!,
  saveKey: 'unrecalled',
  content: unrecalledContent(),
  look: unrecalledLook,
  models: MODEL_URLS,
});
const { labels, view } = game;
const $ = (id: string): HTMLElement => document.getElementById(id)!;

$('title').addEventListener('pointerdown', (e) => {
  e.preventDefault();
  void game.start();
});
const goLabel = document.querySelector<HTMLElement>('#title .go')!;
const ready = goLabel.textContent;
goLabel.textContent = 'Loading…';
void game.modelsLoaded.then(() => (goLabel.textContent = ready));

const bind = (id: string, command: Command): void => {
  $(id).addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    game.send(command);
  });
};
bind('bAttack', { type: 'attackNearest' });
bind('bBolt', { type: 'useSkill', slot: 0 });

/** Damage numbers; the rest of the HUD comes once the look is settled. */
function react(events: SimEvent[]): void {
  for (const e of events) {
    if (e.type === 'EnemyDamaged') {
      const kind = game.state.levels[game.state.levelId]!.enemies.find((en) => en.id === e.enemyId)?.kind;
      labels.text(e.x, e.y, 40 * PX * (kind ? view.scaleOf(kind) : 1), String(e.amount), e.crit ? '#ffd070' : '#dfe7ee', e.crit ? 20 : 15);
    } else if (e.type === 'HeroHurt') {
      labels.text(e.x, e.y, 46 * PX, `-${e.amount}`, '#ff7a5a', 15);
    }
  }
}

function update(state: GameState): void {
  const { hero } = state;
  $('hpFill').style.transform = `scaleX(${hero.hp / hero.maxHp})`;
  $('hpTxt').textContent = `${Math.ceil(hero.hp)} / ${hero.maxHp}`;
  $('chargeFill').style.transform = `scaleX(${hero.resource / hero.maxResource})`;
  $('chargeTxt').textContent = `${Math.floor(hero.resource)} charge`;
}

game.run({
  react,
  update,
  onStart: () => ($('title').hidden = true),
});
