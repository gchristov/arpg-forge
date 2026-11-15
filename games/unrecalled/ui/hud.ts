import { currentLevel, type Command, type GameState } from '../../../engine/sim/state';
import { Banner } from '../../../engine/ui/banner';
import { bindCommand } from '../../../engine/ui/command-button';
import { ShownValues } from '../../../engine/ui/shown-values';
import { ENEMIES } from '../content/enemies';
import { QUEST, stillRunning } from '../content/story';

/** Skill slots: the arc bolt and the EMP. */
const ARC_BOLT = 0;
const EMP = 1;

const $ = (id: string): HTMLElement => document.getElementById(id)!;

/** Unrecalled's HUD: health, charge and XP, the objective, scrap and level, the skill buttons, the boss bar and banners. */
export class Hud {
  private readonly shown = new ShownValues();
  private readonly bannerBox = new Banner({ root: $('banner'), title: $('bannerT'), subtitle: $('bannerS') });

  constructor(send: (command: Command) => void) {
    bindCommand($('bAttack'), { type: 'attackNearest' }, send);
    bindCommand($('bBolt'), { type: 'useSkill', slot: ARC_BOLT }, send);
    bindCommand($('bEmp'), { type: 'useSkill', slot: EMP }, send);
    bindCommand($('bPatch'), { type: 'heal' }, send);
  }

  update(state: GameState): void {
    const { hero } = state;
    const { shown } = this;
    const bolt = state.rules.hero.skills[ARC_BOLT]!;
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
    shown.set('boltOff', hero.resource < bolt.cost, (v) => $('bBolt').classList.toggle('off', v));
    const emp = state.rules.hero.skills[EMP]!;
    const recharging = hero.skillCooldowns[EMP]! / emp.cooldown;
    shown.set('empOff', recharging > 0 || hero.resource < emp.cost, (v) => $('bEmp').classList.toggle('off', v));
    // The bar along the button's foot fills back up as the EMP recharges.
    shown.set('empCharge', Math.round((1 - recharging) * 20), (v) => ($('empCd').style.transform = `scaleX(${v / 20})`));
    shown.set('quest', QUEST[state.quest]?.text ?? '', (v) => ($('quest').textContent = v));
    const ls = currentLevel(state);
    shown.set('location', ls.level.name, (v) => ($('loc').textContent = v));
    const running = ls.level.portals.some((p) => p.sealed) ? ls.enemies.filter((e) => !e.dead).length : 0;
    shown.set('stillRunning', running, (v) => {
      $('sealedNote').hidden = v === 0;
      $('sealedNote').textContent = stillRunning(v);
    });
    const boss = ls.enemies.find((e) => ENEMIES[e.kind]?.boss && !e.dead && e.mode === 'chase');
    // The boss bar takes the top of the screen while the fight lasts; the objective is the boss anyway.
    shown.set('bossShown', Boolean(boss), (v) => {
      $('bossbar').hidden = !v;
      ($('top').querySelector('.objective') as HTMLElement).hidden = v;
    });
    if (boss) {
      shown.set('bossName', ENEMIES[boss.kind]!.name, (v) => ($('bossName').textContent = v));
      shown.set('boss', Math.round((boss.hp / boss.maxHp) * 100), (v) => ($('bossFill').style.transform = `scaleX(${v / 100})`));
    }
    shown.set('fallen', hero.dead, (v) => ($('fallen').hidden = !v));
  }

  /** A title and subtitle across the screen. Shown until replaced when `seconds` is Infinity. */
  banner(title: string, subtitle = '', seconds = 2.4): void {
    this.bannerBox.show(title, subtitle, seconds);
  }

  hideBanner(): void {
    this.bannerBox.hide();
  }
}
