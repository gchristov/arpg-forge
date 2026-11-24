import { describe, expect, it } from 'vitest';
import type { Waves } from './content';
import { arena, OPEN_ROOM, ofType, run } from './testing';

const WAVES: Waves = {
  pause: 2, groups: 1, moreEachWave: 1, strengthEachWave: 0.5, kinds: ['brute'], points: [{ tx: 16, ty: 16 }], minHeroDistance: 5,
};

function withWaves() {
  const state = arena(OPEN_ROOM, { x: 2, y: 2 });
  state.hero.hp = state.hero.maxHp = 1e9;
  const ls = state.levels.testRoom!;
  ls.waves = WAVES;
  ls.waveTimer = WAVES.pause;
  return { state, ls };
}

function downEveryone(ls: ReturnType<typeof withWaves>['ls']): void {
  for (const e of ls.enemies) e.dead = true;
}

describe('waves', () => {
  it('sends the first wave after the pause, and the next only once the last is down', () => {
    const { state, ls } = withWaves();
    expect(ofType(run(state, 1.9), 'WaveArrived')).toEqual([]);
    expect(ofType(run(state, 0.2), 'WaveArrived')).toEqual([{ type: 'WaveArrived', wave: 1 }]);
    expect(ofType(run(state, 5), 'WaveArrived')).toEqual([]);
    downEveryone(ls);
    expect(ofType(run(state, 2.1), 'WaveArrived')).toEqual([{ type: 'WaveArrived', wave: 2 }]);
  });

  it('brings more groups each wave, each stronger than the last', () => {
    const { state, ls } = withWaves();
    run(state, 2.1);
    const first = ls.enemies.filter((e) => !e.dead);
    downEveryone(ls);
    run(state, 2.1);
    const second = ls.enemies.filter((e) => !e.dead);
    expect(second.length).toBe(first.length * 2);
    expect(second[0]!.maxHp).toBeGreaterThan(first[0]!.maxHp);
  });

  it('hunts the hero down from across the level, never giving up', () => {
    const { state, ls } = withWaves();
    run(state, 2.1);
    const hunter = ls.enemies[0]!;
    const from = Math.hypot(hunter.x - state.hero.x, hunter.y - state.hero.y);
    run(state, 4);
    expect(hunter.mode).toBe('chase');
    expect(Math.hypot(hunter.x - state.hero.x, hunter.y - state.hero.y)).toBeLessThan(from - 5);
  });
});
