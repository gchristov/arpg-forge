import { describe, it } from 'vitest';
import { dist } from '../../engine/core/math';
import { gainXp } from '../../engine/sim/combat';
import { createGameState } from '../../engine/sim/setup';
import { currentLevel, type Command, type GameState, type SimEvent } from '../../engine/sim/state';
import { step } from '../../engine/sim/step';
import { unrecalledContent } from './content/world';
import { readyForPractice } from './levels/arena';

/**
 * Plays U-7 in the practice arena on its own, as a player holding attack would, wave after wave until it falls, and
 * prints how far it gets, for tuning combat by numbers. It decides nothing, so it's skipped unless asked for:
 * `BALANCE=1 ./tools/node/run.sh npx vitest run games/unrecalled/arena-balance.test.ts`.
 */

const DT = 1 / 60;
const THINK_SECONDS = 0.1;
const SECONDS = 600;
const SEEDS = [1, 2, 3, 4, 5];
/** It heals below this share of its health, and uses the EMP once this many machines are this close, or a loader is. */
const HEAL_BELOW = 0.4;
const CROWD = { count: 2, within: 3 };
const LOADER_WITHIN = 2;

interface Run {
  survived: number;
  /** Waves it saw off, and the seconds each took from arriving to its last machine falling. */
  cleared: number;
  clearSeconds: number[];
  picked: number;
  hurt: number;
  dealt: number;
  kills: Record<string, number>;
  emps: number;
  heals: number;
}

function playArena(seed: number, level: number): Run {
  const state = createGameState(unrecalledContent(), seed, 'arena');
  readyForPractice(state, 'blaster');
  while (state.hero.level < level) gainXp(state, state.hero.xpNext, []);
  state.hero.hp = state.hero.maxHp;
  state.hero.resource = state.hero.maxResource;
  const emp = state.rules.hero.skills.findIndex((s) => s.id === 'emp');
  const run: Run = { survived: SECONDS, cleared: 0, clearSeconds: [], picked: 0, hurt: 0, dealt: 0, kills: {}, emps: 0, heals: 0 };
  let waveFrom = -1;
  const kinds = new Map<number, string>();
  let untilThink = 0;
  for (let t = 0; t < SECONDS; t += DT) {
    untilThink -= DT;
    const commands = untilThink <= 0 ? think(state, emp) : [];
    if (untilThink <= 0) untilThink = THINK_SECONDS;
    for (const e of currentLevel(state).enemies) kinds.set(e.id, e.kind);
    const events: SimEvent[] = step(state, { commands, held: null }, DT);
    for (const e of events) {
      if (e.type === 'HeroHurt') run.hurt += e.amount;
      if (e.type === 'EnemyDamaged') run.dealt += e.amount;
      if (e.type === 'EnemyKilled') run.kills[kinds.get(e.enemyId)!] = (run.kills[kinds.get(e.enemyId)!] ?? 0) + 1;
      if (e.type === 'SkillUsed' && e.skill === 'emp') run.emps++;
      if (e.type === 'PickedUp' && e.kind === 'healingItem') run.picked++;
      if (e.type === 'WaveArrived') waveFrom = t;
      if (e.type === 'HeroDied') {
        run.survived = t;
        return run;
      }
    }
    if (commands.some((c) => c.type === 'heal')) run.heals++;
    if (waveFrom >= 0 && currentLevel(state).enemies.every((e) => e.dead)) {
      run.cleared++;
      run.clearSeconds.push(t - waveFrom);
      waveFrom = -1;
    }
  }
  return run;
}

/** What a player holding attack would do next. */
function think(state: GameState, emp: number): Command[] {
  const { hero } = state;
  if (hero.hp < hero.maxHp * HEAL_BELOW && hero.healingItems > 0) return [{ type: 'heal' }];
  const near = currentLevel(state).enemies.filter((e) => !e.dead && e.stunnedFor <= 0);
  const close = near.filter((e) => dist(hero.x, hero.y, e.x, e.y) < CROWD.within);
  const loaderOnUs = near.some((e) => e.kind === 'loader' && dist(hero.x, hero.y, e.x, e.y) < LOADER_WITHIN);
  const empReady = emp >= 0 && hero.resource >= state.rules.hero.skills[emp]!.cost && (hero.skillCooldowns[emp] ?? 0) <= 0;
  if (empReady && (close.length >= CROWD.count || loaderOnUs)) return [{ type: 'useSkill', slot: emp }];
  const target = currentLevel(state).enemies.find((e) => e.id === hero.targetId);
  if (target && !target.dead) return [];
  // Machines beyond their notice stay put, so it walks over to the nearest, as a player would.
  const alive = currentLevel(state).enemies.filter((e) => !e.dead);
  const nearest = alive.sort((a, b) => dist(hero.x, hero.y, a.x, a.y) - dist(hero.x, hero.y, b.x, b.y))[0];
  return nearest ? [{ type: 'attack', enemyId: nearest.id }] : [];
}

function report(level: number, runs: Run[]): string {
  const mean = (f: (r: Run) => number) => runs.reduce((sum, r) => sum + f(r), 0) / runs.length;
  const clears = runs.flatMap((r) => r.clearSeconds.slice(0, 3));
  const cells = [
    `level ${level}`,
    runs.map((r) => r.cleared).join(', '),
    `${Math.round(mean((r) => r.survived))}s`,
    clears.length ? `${(clears.reduce((x, y) => x + y, 0) / clears.length).toFixed(0)}s` : '–',
    mean((r) => r.dealt / r.survived).toFixed(0),
    mean((r) => r.hurt / r.survived).toFixed(1),
    mean((r) => (r.emps / r.survived) * 60).toFixed(1),
    `${mean((r) => r.heals).toFixed(1)} (${mean((r) => r.picked).toFixed(1)} picked up)`,
  ];
  return `| ${cells.join(' | ')} |`;
}

describe.skipIf(!process.env.BALANCE)('arena balance', () => {
  it('prints how far U-7 gets through the arena\'s waves at each level', () => {
    const rows = [
      '| U-7 | waves cleared, each run | survived | first 3 waves, s each | damage dealt /s | damage taken /s | EMPs /min | kits used |',
      '|---|---|---|---|---|---|---|---|',
    ];
    for (const level of [1, 3, 5]) rows.push(report(level, SEEDS.map((seed) => playArena(seed, level))));
    console.log(rows.join('\n'));
  }, 120_000);
});
