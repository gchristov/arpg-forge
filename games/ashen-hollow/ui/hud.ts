import { currentLevel, type Command, type GameState } from '../../../engine/sim/state';
import { QUEST } from '../content/story';

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;

/** Ashen Hollow's HUD: the prototype's orbs, skill buttons, gold, level, XP bar, boss bar and banners. */
export class Hud {
  private readonly shown = new Map<string, string | number | boolean>();
  private bannerTimer = 0;

  constructor(onCommand: (command: Command) => void) {
    const bind = (id: string, command: Command): void => {
      $(id).addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        onCommand(command);
      });
    };
    bind('bAttack', { type: 'attackNearest' });
    bind('bFire', { type: 'blast' });
    bind('bPotion', { type: 'heal' });
  }

  update(state: GameState): void {
    const { hero } = state;
    const blast = state.rules.hero.blast;
    this.set('hp', `${Math.ceil(hero.hp)}/${hero.maxHp}`, () => {
      $('hpTxt').textContent = String(Math.ceil(hero.hp));
      $('hpFill').style.height = `${(hero.hp / hero.maxHp) * 100}%`;
    });
    this.set('mp', `${Math.floor(hero.resource)}/${hero.maxResource}`, () => {
      $('mpTxt').textContent = String(Math.floor(hero.resource));
      $('mpFill').style.height = `${(hero.resource / hero.maxResource) * 100}%`;
    });
    this.set('gold', hero.gold, () => ($('goldN').textContent = String(hero.gold)));
    this.set('potions', hero.healingItems, () => {
      $('potN').textContent = String(hero.healingItems);
      $('bPotion').classList.toggle('off', hero.healingItems <= 0);
    });
    this.set('level', hero.level, () => ($('lvl').textContent = `Level ${hero.level}`));
    this.set('xp', Math.round((hero.xp / hero.xpNext) * 100), (v) => ($('xpFill').style.width = `${v}%`));
    this.set('fireCooldown', Math.round((hero.blastCooldown / blast.cooldown) * 100), (v) =>
      $('fireCd').style.setProperty('--p', `${v}%`),
    );
    this.set('fireOff', hero.resource < blast.cost, (v) => $('bFire').classList.toggle('off', Boolean(v)));
    this.set('quest', QUEST[state.quest]?.text ?? '', (v) => ($('quest').textContent = String(v)));
    const ls = currentLevel(state);
    this.set('location', ls.level.name, (v) => ($('locName').textContent = String(v)));
    const boss = ls.enemies.find((e) => state.rules.enemies[e.kind]?.boss && !e.dead && e.mode === 'chase');
    this.set('bossShown', Boolean(boss), (v) => ($('bossbar').hidden = !v));
    if (boss) this.set('boss', Math.round((boss.hp / boss.maxHp) * 100), (v) => ($('bossFill').style.width = `${v}%`));
  }

  /** A title and subtitle across the middle of the screen. Shown until replaced when `seconds` is Infinity. */
  banner(title: string, subtitle = '', seconds = 2.4): void {
    $('bannerT').textContent = title;
    $('bannerS').textContent = subtitle;
    $('banner').classList.add('show');
    clearTimeout(this.bannerTimer);
    if (Number.isFinite(seconds)) this.bannerTimer = window.setTimeout(() => this.hideBanner(), seconds * 1000);
  }

  hideBanner(): void {
    $('banner').classList.remove('show');
  }

  /** The red edge that flashes when the hero is hurt. */
  flashHurt(): void {
    const h = $('hurt');
    h.style.transition = 'none';
    h.style.opacity = '0.8';
    requestAnimationFrame(() => {
      h.style.transition = 'opacity .45s';
      h.style.opacity = '0';
    });
  }

  /** Updates an element only when its value changed, so the DOM isn't touched every frame. */
  private set<T extends string | number | boolean>(key: string, value: T, apply: (value: T) => void): void {
    if (this.shown.get(key) === value) return;
    this.shown.set(key, value);
    apply(value);
  }
}
