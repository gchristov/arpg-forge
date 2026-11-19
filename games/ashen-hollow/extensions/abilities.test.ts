import { describe, expect, it } from 'vitest';
import { useAbilities } from '../../../engine/sim/abilities';
import { currentLevel } from '../../../engine/sim/state';
import { arena, ofType, OPEN_ROOM, run } from '../../../engine/sim/testing';
import { ABILITIES } from './abilities';
import type { SlamSettings } from './slam';
import type { SummonSettings } from './summon';

const SLAM: SlamSettings = { everySeconds: [5, 7], reach: 6, radius: 1.7, delay: 1.0, damage: [16, 24] };
const SUMMON: SummonSettings = { belowHealthShare: 0.5, kind: 'brute', count: 3, distance: 1.6 };

/** A boss with the Bone Lord's abilities, the hero five tiles off, and the slam due at once. */
function bossFight(abilities: Record<string, unknown>) {
  useAbilities(ABILITIES);
  const state = arena(OPEN_ROOM, { x: 5.5, y: 5.5 }, [{ kind: 'lord', x: 10.5, y: 5.5 }]);
  state.rules.enemies.lord = { ...state.rules.enemies.lord!, abilities };
  const lord = currentLevel(state).enemies[0]!;
  lord.memory.slamIn = 0;
  return { state, lord };
}

describe('the Bone Lord\'s abilities', () => {
  it('slams a circle under the hero that hurts if they stay in it', () => {
    const { state } = bossFight({ slam: SLAM });
    state.hero.hp = state.hero.maxHp = 1000;
    expect(ofType(run(state, 0.1), 'SlamWarned')).toHaveLength(1);
    const events = run(state, 1.0);
    const landed = events.findIndex((e) => e.type === 'SlamLanded');
    expect(landed).toBeGreaterThanOrEqual(0);
    const hurt = events[landed + 1];
    expect(hurt?.type).toBe('HeroHurt');
    if (hurt?.type === 'HeroHurt') expect(hurt.amount).toBeGreaterThanOrEqual(16), expect(hurt.amount).toBeLessThanOrEqual(24);
  });

  it('lets the hero dodge the circle', () => {
    const { state, lord } = bossFight({ slam: SLAM });
    lord.mode = 'chase';
    run(state, 1 / 60);
    expect(state.telegraphs).toHaveLength(1);
    state.hero.x = state.hero.prevX = 5.5;
    state.hero.y = state.hero.prevY = 12.5;
    const events = run(state, 1.1);
    expect(ofType(events, 'SlamLanded')).toHaveLength(1);
    expect(ofType(events, 'HeroHurt').filter((h) => h.amount >= 16)).toHaveLength(0);
  });

  it('summons three chasing helpers once, below half health', () => {
    const { state, lord } = bossFight({ summon: SUMMON });
    lord.mode = 'chase';
    lord.hp = 150;
    const events = run(state, 0.5);
    const summoned = ofType(events, 'Summoned');
    expect(summoned).toHaveLength(1);
    expect(summoned[0]!.summonedIds).toHaveLength(3);
    const helpers = currentLevel(state).enemies.filter((e) => e.kind === 'brute');
    expect(helpers.every((h) => h.mode === 'chase')).toBe(true);
    run(state, 0.5);
    expect(currentLevel(state).enemies.filter((e) => e.kind === 'brute')).toHaveLength(3);
  });
});
