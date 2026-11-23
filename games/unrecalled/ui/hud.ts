import { reached } from '../../../engine/sim/story-steps';
import { currentLevel, type Command, type GameState } from '../../../engine/sim/state';
import { Banner } from '../../../engine/ui/banner';
import { bindCommand } from '../../../engine/ui/command-button';
import { type FeedOptions, MessageFeed, type Speaker } from '../../../engine/ui/message-feed';
import { ShownValues } from '../../../engine/ui/shown-values';
import { ENEMIES } from '../content/enemies';
import { QUEST } from '../story/quest';

/** The EMP's and the repel's skill slots. */
const EMP = 0;
const REPEL = 1;

const $ = (id: string): HTMLElement => document.getElementById(id)!;

/**
 * Unrecalled's HUD: the objective at the top left, scrap, level and sound at the top right, the story's lines one at a
 * time above the buttons (where dialogue opens too, so the lines wait for it), health, charge and XP with the buttons
 * along the bottom, the boss bar, and banners for places.
 */
export class Hud {
  private readonly shown = new ShownValues();
  private readonly bannerBox = new Banner({ root: $('banner'), title: $('bannerT'), subtitle: $('bannerS') });
  private readonly feed: MessageFeed;
  /** Keeps the EMP's button hidden even once U-7 has it, while the scene that gives it plays. */
  empWithheld = false;
  /** Whether the objective shows at the top left: not in the practice arena, where no story runs. */
  objectiveShown = true;

  constructor(send: (command: Command) => void, feed: FeedOptions) {
    this.feed = new MessageFeed($('feed'), feed);
    // The log lists every line and page so far, for one missed or closed too soon.
    $('logOpen').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.showLog();
    });
    // Taps on the list itself scroll it; anywhere else closes the log.
    $('log').addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (!(e.target as HTMLElement).closest('#logLines')) $('log').hidden = true;
    });
    bindCommand($('bAttack'), { type: 'attackNearest' }, send);
    bindCommand($('bEmp'), { type: 'useSkill', slot: EMP }, send);
    bindCommand($('bRepel'), { type: 'useSkill', slot: REPEL }, send);
    bindCommand($('bPatch'), { type: 'heal' }, send);
  }

  /** `place` names where U-7 is: its level, or the named part of it. */
  update(state: GameState, place: string): void {
    const { hero } = state;
    const { shown } = this;
    shown.set('hp', `${Math.ceil(hero.hp)}/${hero.maxHp}`, (v) => {
      $('hpFill').style.transform = `scaleX(${hero.hp / hero.maxHp})`;
      $('hpTxt').textContent = v.replace('/', ' / ');
    });
    shown.set('charge', Math.floor(hero.resource), (v) => {
      $('chargeFill').style.transform = `scaleX(${hero.resource / hero.maxResource})`;
      $('chargeTxt').textContent = `${v} charge`;
    });
    shown.set('xp', Math.round((hero.xp / hero.xpNext) * 100), (v) => ($('xpFill').style.width = `${v}%`));
    shown.set('scrap', hero.gold, (v) => ($('scrap').textContent = `${v} scrap`));
    shown.set('level', hero.level, (v) => ($('lvl').textContent = `Level ${v}`));
    shown.set('patches', hero.healingItems, (v) => {
      $('patchN').textContent = String(v);
      $('bPatch').classList.toggle('off', v <= 0);
    });
    const skill = state.rules.hero.skills[EMP];
    const emp = skill && (skill.fromStep === undefined || reached(state, skill.fromStep)) && !this.empWithheld ? skill : undefined;
    shown.set('hasEmp', Boolean(emp), (v) => ($('bEmp').hidden = !v));
    const repel = state.rules.hero.skills[REPEL]!;
    const repelling = hero.skillCooldowns[REPEL]! / repel.cooldown;
    shown.set('repelOff', repelling > 0 || hero.resource < repel.cost, (v) => $('bRepel').classList.toggle('off', v));
    shown.set('repelCharge', Math.round((1 - repelling) * 20), (v) => ($('repelCd').style.transform = `scaleX(${v / 20})`));
    if (emp) {
      const recharging = hero.skillCooldowns[EMP]! / emp.cooldown;
      shown.set('empOff', recharging > 0 || hero.resource < emp.cost, (v) => $('bEmp').classList.toggle('off', v));
      // The bar along the button's foot fills back up as the EMP recharges.
      shown.set('empCharge', Math.round((1 - recharging) * 20), (v) => ($('empCd').style.transform = `scaleX(${v / 20})`));
    }
    shown.set('quest', QUEST[state.quest]?.text ?? '', (v) => {
      $('quest').textContent = v;
      // A new objective lights up for a moment, so it's noticed without a banner.
      $('quest').classList.remove('new');
      void $('quest').offsetWidth;
      $('quest').classList.add('new');
    });
    const ls = currentLevel(state);
    shown.set('location', place, (v) => ($('loc').textContent = v));
    const boss = ls.enemies.find((e) => ENEMIES[e.kind]?.boss && !e.dead && e.mode === 'chase');
    // The boss bar takes the top of the screen while the fight lasts; the objective is the boss anyway.
    shown.set('bossShown', Boolean(boss), (v) => {
      $('bossbar').hidden = !v;
      ($('top').querySelector('.objective') as HTMLElement).hidden = v || !this.objectiveShown;
    });
    if (boss) {
      shown.set('bossName', ENEMIES[boss.kind]!.name, (v) => ($('bossName').textContent = v));
      shown.set('boss', Math.round((boss.hp / boss.maxHp) * 100), (v) => ($('bossFill').style.transform = `scaleX(${v / 100})`));
    }
    shown.set('fallen', hero.dead, (v) => ($('fallen').hidden = !v));
    this.feed.hold(!$('dialog').hidden || !$('log').hidden);
    this.feed.update(performance.now());
  }

  /** A title and subtitle across the screen. Shown until replaced when `seconds` is Infinity. */
  banner(title: string, subtitle = '', seconds = 2.4): void {
    this.bannerBox.show(title, subtitle, seconds);
  }

  /** A line of the story, shown in its turn: what someone says, or with no speaker, U-7's own thought. */
  say(text: string, from?: Speaker): void {
    this.feed.add(text, from);
  }

  /** Every line said has had its turn in the feed. */
  get quiet(): boolean {
    return this.feed.idle;
  }

  /** Keeps something read elsewhere, such as a page of dialogue, in the log without showing it in the feed. */
  remember(text: string, from?: Speaker): void {
    this.feed.remember(text, from);
  }

  private showLog(): void {
    const lines = this.feed.history().map(({ text, from }) => {
      const line = document.createElement('div');
      line.className = from ? `line ${from.voice}` : 'line own';
      if (from) {
        const name = document.createElement('b');
        name.textContent = from.name;
        line.append(name, ' ');
      }
      line.append(text);
      return line;
    });
    $('logLines').replaceChildren(...lines);
    $('log').hidden = false;
    $('logLines').scrollTop = $('logLines').scrollHeight;
  }

  hideBanner(): void {
    this.bannerBox.hide();
  }
}
