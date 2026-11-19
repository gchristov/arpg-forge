import { currentLevel, type Command, type GameState } from '../../../engine/sim/state';
import { Banner } from '../../../engine/ui/banner';
import { bindCommand } from '../../../engine/ui/command-button';
import { ShownValues } from '../../../engine/ui/shown-values';
import { QUEST } from '../story/quest';

/** The fireball button's skill slot. */
const FIREBALL = 0;

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;

/** Ashen Hollow's HUD: orbs, skill buttons, gold, level, XP bar, boss bar and banners. */
export class Hud {
  private readonly shown = new ShownValues();
  private readonly bannerBox = new Banner({ root: $('banner'), title: $('bannerT'), subtitle: $('bannerS') });

  constructor(onCommand: (command: Command) => void) {
    bindCommand($('bAttack'), { type: 'attackNearest' }, onCommand);
    bindCommand($('bFire'), { type: 'useSkill', slot: FIREBALL }, onCommand);
    bindCommand($('bPotion'), { type: 'heal' }, onCommand);
  }

  update(state: GameState): void {
    const { hero } = state;
    const fireball = state.rules.hero.skills[FIREBALL]!;
    this.shown.set('hp', `${Math.ceil(hero.hp)}/${hero.maxHp}`, () => {
      $('hpTxt').textContent = String(Math.ceil(hero.hp));
      $('hpFill').style.height = `${(hero.hp / hero.maxHp) * 100}%`;
    });
    this.shown.set('mp', `${Math.floor(hero.resource)}/${hero.maxResource}`, () => {
      $('mpTxt').textContent = String(Math.floor(hero.resource));
      $('mpFill').style.height = `${(hero.resource / hero.maxResource) * 100}%`;
    });
    this.shown.set('gold', hero.gold, () => ($('goldN').textContent = String(hero.gold)));
    this.shown.set('potions', hero.healingItems, () => {
      $('potN').textContent = String(hero.healingItems);
      $('bPotion').classList.toggle('off', hero.healingItems <= 0);
    });
    this.shown.set('level', hero.level, () => ($('lvl').textContent = `Level ${hero.level}`));
    this.shown.set('xp', Math.round((hero.xp / hero.xpNext) * 100), (v) => ($('xpFill').style.width = `${v}%`));
    this.shown.set('fireCooldown', Math.round((hero.skillCooldowns[FIREBALL]! / fireball.cooldown) * 100), (v) =>
      $('fireCd').style.setProperty('--p', `${v}%`),
    );
    this.shown.set('fireOff', hero.resource < fireball.cost, (v) => $('bFire').classList.toggle('off', Boolean(v)));
    this.shown.set('quest', QUEST[state.quest]?.text ?? '', (v) => ($('quest').textContent = String(v)));
    const ls = currentLevel(state);
    this.shown.set('location', ls.level.name, (v) => ($('locName').textContent = String(v)));
    const boss = ls.enemies.find((e) => state.rules.enemies[e.kind]?.boss && !e.dead && e.mode === 'chase');
    this.shown.set('bossShown', Boolean(boss), (v) => ($('bossbar').hidden = !v));
    if (boss) this.shown.set('boss', Math.round((boss.hp / boss.maxHp) * 100), (v) => ($('bossFill').style.width = `${v}%`));
  }

  /** A title and subtitle across the middle of the screen. Shown until replaced when `seconds` is Infinity. */
  banner(title: string, subtitle = '', seconds = 2.4): void {
    this.bannerBox.show(title, subtitle, seconds);
  }

  hideBanner(): void {
    this.bannerBox.hide();
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
}
