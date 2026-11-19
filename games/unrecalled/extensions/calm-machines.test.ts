import { describe, expect, it } from 'vitest';
import { useAbilities } from '../../../engine/sim/abilities';
import { currentLevel, type GameState } from '../../../engine/sim/state';
import { useStepActions } from '../../../engine/sim/step-actions';
import { arena, ofType, OPEN_ROOM, run } from '../../../engine/sim/testing';
import { TAG } from '../story/quest';
import { ALARM_MARK, CALM, STEP_ACTIONS } from './calm-machines';

const WIDE = Array.from({ length: 6 }, () => '.'.repeat(40));

/** An arena whose brutes are calm machines, with the calm machines' step actions available. */
function calmArena(...args: Parameters<typeof arena>): GameState {
  useAbilities({ calm: CALM });
  useStepActions(STEP_ACTIONS);
  const state = arena(...args);
  state.rules.enemies = { ...state.rules.enemies, brute: { ...state.rules.enemies.brute!, abilities: { calm: {} } } };
  return state;
}

const machinesOf = (state: GameState) => currentLevel(state).enemies;
const alarmed = (state: GameState) => Boolean(currentLevel(state).memory[ALARM_MARK]);
const signals = (events: ReturnType<typeof run>, name: string) => ofType(events, 'Signal').filter((s) => s.name === name);

describe('calm machines', () => {
  it('go about their work beside U-7, recognising it once', () => {
    const state = calmArena(OPEN_ROOM, { x: 5.5, y: 5.5 }, [{ kind: 'brute', x: 7.5, y: 5.5 }]);
    const events = run(state, 5);
    expect(signals(events, 'recognised')).toHaveLength(1);
    expect(ofType(events, 'HeroHurt')).toHaveLength(0);
    expect(machinesOf(state)[0]!.mode).toBe('idle');
  });

  it('stop, turn to U-7 and look it over when they first see it, then go back to work', () => {
    const state = calmArena(OPEN_ROOM, { x: 5.5, y: 5.5 }, [{ kind: 'brute', x: 8.5, y: 5.5 }]);
    const machine = machinesOf(state)[0]!;
    machine.facingX = 1;
    machine.facingY = 0;
    run(state, 0.6);
    expect(machine.memory.scan).toBeGreaterThan(0);
    expect([machine.x, machine.y]).toEqual([8.5, 5.5]);
    expect(machine.facingX).toBeLessThan(-0.9);
    run(state, 1);
    expect(machine.memory.scan).toBeUndefined();
  });

  it('turn on U-7 together once one of them is hit, near ones in its sight at once, and the rest on sight from then on', () => {
    const state = calmArena(WIDE, { x: 3.5, y: 2.5 }, [
      { kind: 'brute', x: 4.5, y: 2.5 }, { kind: 'brute', x: 9.5, y: 2.5 }, { kind: 'brute', x: 36.5, y: 2.5 },
    ]);
    const [struck, near, far] = machinesOf(state);
    const events = run(state, 0.5, [{ type: 'attack', enemyId: struck!.id }]);
    expect(signals(events, 'alarm')).toHaveLength(1);
    expect(alarmed(state)).toBe(true);
    expect([struck!.mode, near!.mode, far!.mode]).toEqual(['chase', 'chase', 'idle']);
    struck!.dead = near!.dead = true;
    state.hero.x = state.hero.prevX = 33.5;
    const later = run(state, 1);
    expect(far!.mode).toBe('chase');
    expect(signals(later, 'recognised')).toHaveLength(0);
    expect(alarmed(state)).toBe(true);
    expect(signals(later, 'alarm')).toHaveLength(0);
  });

  it('keep taking U-7 for one of their own while it fights the raider, which sounds no alarm', () => {
    const state = calmArena(WIDE, { x: 3.5, y: 2.5 }, [{ kind: 'brute', x: 4.5, y: 2.5 }, { kind: 'brute', x: 36.5, y: 2.5 }]);
    const [raider, far] = machinesOf(state);
    raider!.tag = TAG.raider;
    const events = run(state, 1, [{ type: 'attack', enemyId: raider!.id }]);
    expect(raider!.mode).toBe('chase');
    expect(signals(events, 'alarm')).toHaveLength(0);
    raider!.dead = true;
    state.hero.x = state.hero.prevX = 33.5;
    run(state, 1);
    expect(far!.mode).toBe('idle');
  });

  it('keep working behind a wall while the room next door fights, then come for U-7 once they see it', () => {
    const rows = ['.....#.....', '.....#.....', '...........'];
    const state = calmArena(rows, { x: 1.5, y: 1.5 }, [{ kind: 'brute', x: 2.5, y: 1.5 }, { kind: 'brute', x: 7.5, y: 1.5 }]);
    const [struck, nextDoor] = machinesOf(state);
    run(state, 0.5, [{ type: 'attack', enemyId: struck!.id }]);
    expect([struck!.mode, nextDoor!.mode]).toEqual(['chase', 'idle']);
    struck!.dead = true;
    state.hero.x = state.hero.prevX = 7.5;
    state.hero.y = state.hero.prevY = 2.5;
    run(state, 0.5);
    expect(nextDoor!.mode).toBe('chase');
  });

  it('leave other enemies as they were, without sounding the alarm', () => {
    const state = calmArena(OPEN_ROOM, { x: 5.5, y: 5.5 }, [{ kind: 'dummy', x: 6.5, y: 5.5 }]);
    const events = run(state, 0.5, [{ type: 'attack', enemyId: machinesOf(state)[0]!.id }]);
    expect(ofType(events, 'EnemyDamaged').length).toBeGreaterThan(0);
    expect(signals(events, 'alarm')).toHaveLength(0);
  });
});

describe('the step actions', () => {
  it('alarmEverything sounds the alarm on every floor once, so calm machines anywhere come for U-7 on sight', () => {
    const state = calmArena(OPEN_ROOM, { x: 5.5, y: 5.5 }, [{ kind: 'brute', x: 6.5, y: 5.5 }, { kind: 'brute', x: 9.5, y: 5.5 }]);
    state.rules.quest = [{}, { reachedBy: { type: 'defeat', tag: TAG.raider }, does: ['alarmEverything'] }];
    const here = currentLevel(state);
    const elsewhere = { ...here, enemies: [], memory: {} as Record<string, number>, level: { ...here.level, id: 'elsewhere' } };
    state.levels.elsewhere = elsewhere;
    const [raider, other] = here.enemies;
    raider!.tag = TAG.raider;
    raider!.hp = 1;
    const events = run(state, 1, [{ type: 'attack', enemyId: raider!.id }]);
    expect(state.quest).toBe(1);
    expect([here.memory[ALARM_MARK], elsewhere.memory[ALARM_MARK]]).toEqual([1, 1]);
    expect(signals(events, 'alarm')).toHaveLength(1);
    run(state, 1);
    expect(other!.mode).toBe('chase');
  });

  it('calmEverything ends every alarm and sends calm machines back to work', () => {
    const state = calmArena(OPEN_ROOM, { x: 5.5, y: 5.5 }, [{ kind: 'brute', x: 6.5, y: 5.5 }, { kind: 'brute', x: 9.5, y: 5.5 }]);
    state.rules.quest = [{}, { reachedBy: { type: 'kill', enemyKind: 'brute' }, does: ['calmEverything'] }];
    const [first, second] = machinesOf(state);
    first!.hp = 1;
    run(state, 1, [{ type: 'attack', enemyId: first!.id }]);
    expect(state.quest).toBe(1);
    expect(alarmed(state)).toBe(false);
    expect(second!.mode).toBe('idle');
    const events = run(state, 3);
    expect(ofType(events, 'HeroHurt')).toHaveLength(0);
  });
});
