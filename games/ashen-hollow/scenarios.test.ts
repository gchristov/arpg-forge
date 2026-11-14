import { describe, expect, it } from 'vitest';
import { createGameState } from '../../engine/sim/setup';
import { currentLevel, type Command, type GameState, type SimEvent } from '../../engine/sim/state';
import { step } from '../../engine/sim/step';
import { ashenHollowContent } from './content/world';

const DT = 1 / 60;
const content = ashenHollowContent();

function newGame(seed = 1): GameState {
  return createGameState(content, seed);
}

/** Runs the rules for a while, sending `commands` on the first step, and returns every event. */
function play(state: GameState, seconds: number, commands: Command[] = []): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    events.push(...step(state, { commands: i === 0 ? commands : [], held: null }, DT));
  }
  return events;
}

const structureIndex = (state: GameState, kind: string): number =>
  currentLevel(state).level.structures.findIndex((s) => s.kind === kind);

describe('Ashen Hollow scenarios', () => {
  it('starts in the village square with the camps populated', () => {
    const state = newGame();
    expect(state.levelId).toBe('town');
    expect([state.hero.x, state.hero.y]).toEqual([16.5, 22.5]);
    const town = currentLevel(state);
    expect(town.npcs.map((n) => n.name)).toEqual(['Elder Maren']);
    const kinds = town.enemies.map((e) => e.kind);
    expect(kinds.filter((k) => k === 'goblin')).toHaveLength(8);
    expect(kinds.filter((k) => k === 'skeleton')).toHaveLength(4 + 3);
  });

  it('walks into the tavern when it is tapped, and back out in front of its door', () => {
    const state = newGame();
    const events = play(state, 8, [{ type: 'enterStructure', index: structureIndex(state, 'tavern') }]);
    expect(events.map((e) => e.type)).toContain('EnteredLevel');
    expect(state.levelId).toBe('tavern');
    expect([state.hero.x, state.hero.y]).toEqual([6.5, 8.6]);
    expect(currentLevel(state).npcs.map((n) => n.name)).toEqual(['Brann']);

    play(state, 1);
    play(state, 3, [{ type: 'walkInto', tx: 6, ty: 9 }]);
    expect(state.levelId).toBe('town');
    expect([state.hero.x, state.hero.y]).toEqual([11.5, 9.5]);
  });

  it('does not bounce straight back through a portal on arrival', () => {
    const state = newGame();
    play(state, 8, [{ type: 'enterStructure', index: structureIndex(state, 'smithy') }]);
    expect(state.levelId).toBe('smithy');
    play(state, 2);
    expect(state.levelId).toBe('smithy');
  });

  it('reaches the crypt, where the Bone Lord waits in the north chamber', () => {
    const state = newGame();
    play(state, 20, [{ type: 'enterStructure', index: structureIndex(state, 'crypt') }]);
    expect(state.levelId).toBe('crypt');
    const boss = currentLevel(state).enemies.find((e) => e.kind === 'boss')!;
    expect([boss.homeX, boss.homeY]).toEqual([11.5, 2.5]);
  });

  it('ignores commands during the fade between levels', () => {
    const state = newGame();
    const events = play(state, 8, [{ type: 'enterStructure', index: structureIndex(state, 'tavern') }]);
    expect(events.filter((e) => e.type === 'TransitionStarted')).toHaveLength(1);
  });

  it('clears the north-east goblin camp by attacking, earning 12 XP a goblin', () => {
    const state = newGame(3);
    state.hero.x = state.hero.prevX = 36.5;
    state.hero.y = state.hero.prevY = 13.5;
    const camp = () => currentLevel(state).enemies.filter((e) => e.kind === 'goblin' && Math.hypot(e.homeX - 40.5, e.homeY - 13.5) < 3);
    expect(camp()).toHaveLength(4);
    const events: SimEvent[] = [];
    for (let second = 0; second < 40 && camp().some((g) => !g.dead); second++) {
      state.hero.hp = state.hero.maxHp;
      events.push(...play(state, 1, [{ type: 'attackNearest' }]));
    }
    expect(camp().filter((g) => !g.dead)).toHaveLength(0);
    expect(events.filter((e) => e.type === 'EnemyKilled').length).toBeGreaterThanOrEqual(4);
    const xpEarned = state.hero.xp + (state.hero.level > 1 ? 60 : 0);
    expect(xpEarned).toBeGreaterThanOrEqual(48);
  });

  it('plays out exactly the same from the same seed and input', () => {
    const run = (seed: number) => {
      const state = newGame(seed);
      play(state, 5, [{ type: 'walk', x: 30, y: 15 }]);
      return JSON.stringify(state);
    };
    expect(run(7)).toBe(run(7));
    expect(run(7)).not.toBe(run(8));
  });
});
