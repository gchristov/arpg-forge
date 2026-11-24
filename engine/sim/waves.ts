import { dist } from '../core/math';
import { pick } from '../core/rng';
import { spawnCamp } from './spawning';
import { currentLevel, type GameState, type SimEvent } from './state';

/** Sends the level's next wave once every enemy on it is down and the pause after the last has passed. */
export function updateWaves(state: GameState, dt: number, events: SimEvent[]): void {
  const ls = currentLevel(state);
  const waves = ls.waves;
  if (!waves || state.hero.dead || ls.enemies.some((e) => !e.dead)) return;
  ls.waveTimer -= dt;
  if (ls.waveTimer > 0) return;
  ls.wave++;
  ls.waveTimer = waves.pause;
  const { hero } = state;
  const far = waves.points.filter((p) => dist(hero.x, hero.y, p.tx + 0.5, p.ty + 0.5) >= waves.minHeroDistance);
  const strength = ls.enemyStrength * (1 + waves.strengthEachWave * (ls.wave - 1));
  const first = ls.enemies.length;
  for (let g = 0; g < waves.groups + waves.moreEachWave * (ls.wave - 1); g++) {
    const at = pick(state.rng, far.length > 0 ? far : waves.points);
    spawnCamp(state, ls, pick(state.rng, waves.kinds), { ...at, kind: '', strength });
  }
  for (const e of ls.enemies.slice(first)) {
    e.hunting = true;
    e.mode = 'chase';
  }
  events.push({ type: 'WaveArrived', wave: ls.wave });
}
