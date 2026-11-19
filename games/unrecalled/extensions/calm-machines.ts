import { dist, lerp } from '../../../engine/core/math';
import type { EnemyAbility } from '../../../engine/sim/abilities';
import { type GameState, type LevelState, type SimEvent } from '../../../engine/sim/state';
import type { StepAction } from '../../../engine/sim/step-actions';
import { hasLineOfSight } from '../../../engine/world/line-of-sight';
import { TAG } from '../story/quest';

/**
 * The Foundry's machines start calm, going about their work: they take U-7 for one of their own, however close, and
 * only look it over the first time they see it. Hitting one turns it, and the calm machines in sight of it nearby, on
 * U-7. That sounds the floor's alarm, on every floor of its building, and from then on every machine there comes for
 * U-7 as soon as it sees it. The story sounds the alarm everywhere, or calms everything, with the step actions below.
 * See EXTENSIONS.md.
 */

/** What the machines signal: `recognised` when one first looks U-7 over, `alarm` when an alarm sounds. */
export const SIGNALS = ['recognised', 'alarm'] as const;

/** A calm machine that recognises U-7 stops and looks it over for this long. */
const SCAN_SECONDS = 1.2;
/** Calm machines this close to one hit, and in sight of it, come for U-7 at once. */
const ALARM_CALL_RADIUS = 8;
/**
 * Fighting these doesn't sound the alarm, so the calm machines around them keep taking U-7 for one of their own: the
 * raider at the crates, which the story sounds the alarm for itself once it's beaten.
 */
const QUIET_TAGS: readonly string[] = [TAG.raider];

/** The mark in a floor's memory while its alarm sounds, which its alarm lights and air wait for. */
export const ALARM_MARK = 'alarmed';

const isAlarmed = (level: LevelState): boolean => Boolean(level.memory[ALARM_MARK]);

/**
 * What a calm machine keeps in its memory: whether it has `recognised` U-7 yet, whether it's been `provoked` (hit,
 * called by one hit nearby, or seeing U-7 during an alarm) so it no longer takes U-7 for one of its own, and its
 * `scan`, the progress through looking U-7 over from 0 to 1, while it's doing so.
 */
export const CALM: EnemyAbility = {
  idle({ state, level, enemy, sees, distance, dt, events, memory }) {
    if (sees && !memory.provoked && !isAlarmed(level)) {
      if (!memory.recognised) {
        events.push({ type: 'Signal', name: 'recognised', enemyId: enemy.id, x: enemy.x, y: enemy.y });
        memory.scan = 0;
      }
      memory.recognised = 1;
    } else if (sees) {
      delete memory.scan;
      memory.provoked = 1;
      return 'asUsual';
    }
    if (memory.scan !== undefined) {
      memory.scan += dt / SCAN_SECONDS;
      if (memory.scan >= 1) delete memory.scan;
      const { hero } = state;
      enemy.facingX = lerp(enemy.facingX, (hero.x - enemy.x) / (distance || 1), 0.2);
      enemy.facingY = lerp(enemy.facingY, (hero.y - enemy.y) / (distance || 1), 0.2);
      return 'busy';
    }
    return sees ? 'unseeing' : 'asUsual';
  },

  hurt({ state, level, enemy, events, memory }) {
    delete memory.scan;
    memory.provoked = 1;
    for (const e of level.enemies) {
      if (e.dead || e.memory.provoked || !isCalm(state, e.kind)) continue;
      if (dist(e.x, e.y, enemy.x, enemy.y) > ALARM_CALL_RADIUS) continue;
      if (!hasLineOfSight(level.level.map, enemy.x, enemy.y, e.x, e.y)) continue;
      e.memory.provoked = 1;
      delete e.memory.scan;
      e.mode = 'chase';
      events.push({ type: 'EnemyAlerted', enemyId: e.id, boss: Boolean(state.rules.enemies[e.kind]!.boss) });
    }
  },

  // The alarm sounds once a provoked machine first hunts U-7, and then stays on, on the floor and on every other floor
  // of its building. Only the story calming everything puts it out.
  afterEnemies(state, level, events) {
    if (isAlarmed(level)) return;
    if (!level.enemies.some((e) => !e.dead && e.memory.provoked && e.mode === 'chase' && !QUIET_TAGS.includes(e.tag ?? ''))) return;
    const { building } = level.level;
    for (const other of Object.values(state.levels)) {
      if (other === level || (building !== undefined && other.level.building === building)) other.memory[ALARM_MARK] = 1;
    }
    signalAlarm(state, events);
  },
};

const isCalm = (state: GameState, kind: string): boolean => Boolean(state.rules.enemies[kind]?.abilities?.calm);

function signalAlarm(state: GameState, events: SimEvent[]): void {
  events.push({ type: 'Signal', name: 'alarm', x: state.hero.x, y: state.hero.y });
}


/** The names of the step actions, for quest steps' `does`. */
export type StepActionName = 'alarmEverything' | 'calmEverything';

/** The step actions: sounding the alarm on every floor, and calming everything, by the names quest steps use. */
export const STEP_ACTIONS: Record<StepActionName, StepAction> = {
  // From then on every calm machine everywhere comes for U-7 on sight. Signals once, however many floors it reaches.
  alarmEverything(state, events) {
    if (Object.values(state.levels).every(isAlarmed)) return;
    for (const ls of Object.values(state.levels)) ls.memory[ALARM_MARK] = 1;
    signalAlarm(state, events);
  },
  // Ends every floor's alarm and sends the calm machines everywhere back to their work.
  calmEverything(state) {
    for (const ls of Object.values(state.levels)) {
      delete ls.memory[ALARM_MARK];
      for (const e of ls.enemies) {
        if (e.dead || !isCalm(state, e.kind)) continue;
        e.mode = 'idle';
        e.path = null;
        e.windUp = -1;
        delete e.memory.provoked;
        delete e.memory.scan;
      }
    }
  },
};

