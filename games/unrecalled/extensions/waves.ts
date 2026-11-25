import { dist } from '../../../engine/core/math';
import { pick, range } from '../../../engine/core/rng';
import type { EnemyAbility } from '../../../engine/sim/abilities';
import { makeEnemy } from '../../../engine/sim/spawning';
import type { GameState, LevelState, SimEvent } from '../../../engine/sim/state';
import { isBlocked } from '../../../engine/world/collision';

/**
 * Machines coming at U-7 in waves: once every machine on the level is down, the next wave arrives after `pause`
 * seconds, its groups (each one of `kinds`, at random, as many as the kind's `groupSize`) gathering round places in
 * `points` at least `minHeroDistance` tiles from U-7 where there are any. The first wave has `groups` groups, each wave
 * after `moreEachWave` more, and each is stronger than the last by `strengthEachWave` of the level's strength.
 */
export interface WaveSettings {
  pause: number;
  groups: number;
  moreEachWave: number;
  strengthEachWave: number;
  kinds: string[];
  points: { tx: number; ty: number }[];
  minHeroDistance: number;
}

/** The signal sent as a wave arrives, for the HUD; the level's memory holds its number under `WAVE_MARK`. */
export const WAVE_SIGNAL = 'waveArrived';
export const WAVE_MARK = 'wave';
/** How far round its gathering place a wave's machines are spread, and how far clear of walls each stands, in tiles. */
const GATHER_SPREAD = 1.8;
const WALL_CLEARANCE = 0.5;
/** The level's memory holds the game time the next wave comes at under this. */
const NEXT_WAVE_AT = 'nextWaveAt';

/**
 * Sends waves on the levels in `byLevel`, by their ids. It's an ability so it can run once a step on U-7's level,
 * even with no machine alive there; the machines list it, with no settings, so it runs. A wave's machines hunt U-7
 * down wherever it is and never give up. See EXTENSIONS.md.
 */
export function waves(byLevel: Record<string, WaveSettings>): EnemyAbility {
  return {
    afterEnemies(state, level, events) {
      const settings = byLevel[level.level.id];
      if (settings) sendWave(state, level, settings, events);
    },
    bringsIn: () => Object.values(byLevel).flatMap((s) => s.kinds),
  };
}

function sendWave(state: GameState, level: LevelState, settings: WaveSettings, events: SimEvent[]): void {
  const { hero } = state;
  const { memory } = level;
  // The pause runs from the last machine falling, or from U-7 first being here.
  if (hero.dead || level.enemies.some((e) => !e.dead) || memory[NEXT_WAVE_AT] === undefined) {
    memory[NEXT_WAVE_AT] = state.time + settings.pause;
    return;
  }
  if (state.time < memory[NEXT_WAVE_AT]) return;
  delete memory[NEXT_WAVE_AT];
  const wave = (memory[WAVE_MARK] ?? 0) + 1;
  memory[WAVE_MARK] = wave;
  const far = settings.points.filter((p) => dist(hero.x, hero.y, p.tx + 0.5, p.ty + 0.5) >= settings.minHeroDistance);
  const strength = level.enemyStrength * (1 + settings.strengthEachWave * (wave - 1));
  for (let g = 0; g < settings.groups + settings.moreEachWave * (wave - 1); g++) {
    const at = pick(state.rng, far.length > 0 ? far : settings.points);
    const kind = pick(state.rng, settings.kinds);
    for (let k = 0; k < (state.rules.enemies[kind]?.groupSize ?? 1); k++) placeHunter(state, level, kind, at.tx + 0.5, at.ty + 0.5, strength);
  }
  events.push({ type: 'Signal', name: WAVE_SIGNAL, x: hero.x, y: hero.y });
}

/**
 * Puts one machine near (x, y), clear of walls by `WALL_CLEARANCE` tiles past its own size, so none starts pressed
 * into one, where it would stick; hunting U-7 from the start.
 */
function placeHunter(state: GameState, level: LevelState, kind: string, x: number, y: number, strength: number): void {
  const r = (state.rules.enemies[kind]?.radius ?? 0.3) + WALL_CLEARANCE;
  for (let tries = 0; tries < 20; tries++) {
    const ex = x + range(state.rng, -GATHER_SPREAD, GATHER_SPREAD);
    const ey = y + range(state.rng, -GATHER_SPREAD, GATHER_SPREAD);
    if (isBlocked(level.level.map, ex, ey, r)) continue;
    const e = makeEnemy(state, kind, ex, ey, strength);
    e.hunting = true;
    e.mode = 'chase';
    level.enemies.push(e);
    return;
  }
}
