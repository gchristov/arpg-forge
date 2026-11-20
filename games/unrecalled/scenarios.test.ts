import { describe, expect, it } from 'vitest';
import { gainXp } from '../../engine/sim/combat';
import { questGoal } from '../../engine/sim/quest-goal';
import { createGameState } from '../../engine/sim/setup';
import { currentLevel, type Command, type GameState, type SimEvent } from '../../engine/sim/state';
import { step } from '../../engine/sim/step';
import { unrecalledContent } from './content/world';
import { jumpToStep } from '../../engine/sim/shortcuts';
import { stepIndex } from '../../engine/sim/story-steps';
import { FLOOR_ORDER } from './levels/foundry';

const DT = 1 / 60;
const content = unrecalledContent();

/** Runs the rules for a while, sending `commands` on the first step, and returns every event. */
function play(state: GameState, seconds: number, commands: Command[] = []): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    events.push(...step(state, { commands: i === 0 ? commands : [], held: null }, DT));
  }
  return events;
}

/** A hero nothing can stop, so a test can walk the Foundry without fighting its way through. */
function untouchable(state: GameState): GameState {
  state.hero.hp = state.hero.maxHp = 1e9;
  return state;
}

/** Walks onto the current level's portal to `to`, and returns every event on the way. */
function takeDoor(state: GameState, to: string): SimEvent[] {
  const door = currentLevel(state).level.portals.find((p) => p.to === to)!;
  return [...play(state, 25, [{ type: 'walkInto', tx: door.tx, ty: door.ty }]), ...play(state, 1)];
}

/** Talks to someone in the current level by kind, walking up to them first. */
function talkTo(state: GameState, kind: string): SimEvent[] {
  const npc = currentLevel(state).npcs.find((n) => n.kind === kind)!;
  return play(state, 15, [{ type: 'talk', npcId: npc.id }]);
}

/** Chooses a reply in a conversation with someone in the current level, by their kind. */
function answer(state: GameState, kind: string, id: string): SimEvent[] {
  const npc = currentLevel(state).npcs.find((n) => n.kind === kind)!;
  return play(state, 1, [{ type: 'reply', npcId: npc.id, id }]);
}

/** Uses the current level's readable `id`, walking up to it first. */
function use(state: GameState, id: string): SimEvent[] {
  const index = currentLevel(state).readables.findIndex((r) => r.id === id);
  return play(state, 30, [{ type: 'read', index }]);
}

/** Walks over to a weapon lying on the current level's ground, which picks it up. */
function pickUp(state: GameState, weapon: string): SimEvent[] {
  const item = currentLevel(state).items.find((i) => i.weapon === weapon)!;
  return play(state, 15, [{ type: 'walk', x: item.x, y: item.y }]);
}

/** U-7 with nothing able to stop it and every machine falling to it at once, for following the story without the fights. */
function unstoppable(state: GameState): GameState {
  untouchable(state).hero.damage = [1000, 1000];
  return state;
}

/** The way back up from the deepest floor to Rustbelt, through every floor and the depot. */
const WAY_BACK = [...[...FLOOR_ORDER].reverse().slice(1), 'tradingPost', 'rustbelt'];

/**
 * A new game with the story at its end, so every door it keeps locked is open, already through Mags's depot and its
 * back door into Intake.
 */
function inIntake(): GameState {
  const state = untouchable(createGameState(content, 1));
  jumpToStep(state, content.quest.length - 1);
  const depot = currentLevel(state).level.structures.findIndex((s) => s.kind === 'tradingPost');
  play(state, 25, [{ type: 'enterStructure', index: depot }]);
  play(state, 1);
  takeDoor(state, 'intake');
  return state;
}

// These cover how the game's places and mechanics fit together, not its story, which is still changing: the story's
// names and links are checked by the story checks in content.test.ts, and the one playthrough below only asks that
// following the guide reaches the end.
describe('Unrecalled scenarios', () => {
  it('can be played to the end by following where the guide points', () => {
    const state = unstoppable(createGameState(content, 1));
    for (let goal = questGoal(state), moves = 0; goal && moves < 100; goal = questGoal(state), moves++) {
      const at = (t: { tx: number; ty: number }) => t.tx + 0.5 === goal!.x && t.ty + 0.5 === goal!.y;
      const ls = currentLevel(state);
      const enemy = ls.enemies.find((e) => e.id === goal!.actorId);
      const npc = ls.npcs.find((n) => n.id === goal!.actorId);
      const readable = ls.readables.find(at);
      const dropped = ls.items.find((i) => i.x === goal!.x && i.y === goal!.y);
      if (enemy) {
        for (let i = 0; i < 60 && !enemy.dead; i++) play(state, 1, [{ type: 'attack', enemyId: enemy.id }]);
      } else if (npc) {
        talkTo(state, npc.kind);
        const waitsFor = state.rules.quest[state.quest + 1]?.reachedBy;
        if (waitsFor?.type === 'reply') answer(state, npc.kind, waitsFor.id);
      } else if (dropped?.weapon) {
        pickUp(state, dropped.weapon);
      } else if (readable) {
        use(state, readable.id);
      } else {
        const door = ls.level.portals.find(at)!;
        takeDoor(state, door.to);
      }
    }
    expect(state.quest).toBe(content.quest.length - 1);
  });

  it('walks into each of Rustbelt\'s buildings and back out of the same door', () => {
    const state = untouchable(createGameState(content, 1));
    for (const [index, building] of currentLevel(state).level.structures.entries()) {
      play(state, 25, [{ type: 'enterStructure', index }]);
      play(state, 1);
      expect(state.levelId).not.toBe('rustbelt');
      takeDoor(state, 'rustbelt');
      expect(state.levelId).toBe('rustbelt');
      expect(Math.floor(state.hero.y)).toBe(building.door.ty + 1);
    }
  });

  it('climbs the depot\'s stairs to its office and comes back down to the stairs', () => {
    const state = untouchable(createGameState(content, 1));
    const depot = currentLevel(state).level.structures.findIndex((s) => s.kind === 'tradingPost');
    play(state, 25, [{ type: 'enterStructure', index: depot }]);
    play(state, 1);
    takeDoor(state, 'depotOffice');
    expect(state.levelId).toBe('depotOffice');
    takeDoor(state, 'tradingPost');
    const stairs = currentLevel(state).level.portals.find((p) => p.to === 'depotOffice')!;
    expect(Math.hypot(state.hero.x - (stairs.tx + 0.5), state.hero.y - (stairs.ty + 0.5))).toBeLessThan(1.5);
  });

  it('goes down through every floor of the Foundry, and back up through the depot to Rustbelt', () => {
    const state = inIntake();
    for (const next of FLOOR_ORDER.slice(1)) {
      takeDoor(state, next);
      expect(state.levelId).toBe(next);
    }
    for (const previous of WAY_BACK) {
      takeDoor(state, previous);
      expect(state.levelId).toBe(previous);
    }
  });

  it('gets U-7 back up at the entrance of the floor it fell on', () => {
    const state = inIntake();
    takeDoor(state, FLOOR_ORDER[1]!);
    state.hero.hp = 0;
    state.hero.dead = true;
    play(state, 0.1, [{ type: 'respawn' }]);
    expect(state.levelId).toBe(FLOOR_ORDER[1]);
    expect(state.hero.dead).toBe(false);
  });

  it('sets off the EMP among a pack of crawlers, hitting them all and turning them on U-7', () => {
    const state = untouchable(createGameState(content, 1, 'arena'));
    const emp = content.hero.skills[0]!;
    jumpToStep(state, emp.fromStep ? stepIndex(content.quest, emp.fromStep) : 0);
    const pack = currentLevel(state).enemies.filter((e) => e.kind === 'crawler').slice(0, 3);
    const middle = { x: pack.reduce((s, e) => s + e.x, 0) / 3, y: pack.reduce((s, e) => s + e.y, 0) / 3 };
    state.hero.x = state.hero.prevX = middle.x;
    state.hero.y = state.hero.prevY = middle.y + 0.6;
    const events = play(state, 1 / 60, [{ type: 'useSkill', slot: 0 }]);
    const hit = new Set(events.flatMap((e) => (e.type === 'EnemyDamaged' ? [e.enemyId] : [])));
    expect(pack.filter((e) => hit.has(e.id)).length).toBeGreaterThanOrEqual(2);
    play(state, 0.5);
    expect(pack.filter((e) => hit.has(e.id)).every((e) => e.mode === 'chase')).toBe(true);
  });

  it('sends the practice arena\'s machines straight at U-7, without looking it over', () => {
    const state = createGameState(content, 1, 'arena');
    const events = play(state, 6);
    expect(events.some((e) => e.type === 'Signal' && e.name === 'recognised')).toBe(false);
    expect(events.some((e) => e.type === 'HeroHurt')).toBe(true);
  });

  it('cuts with the chainsaw rather than swinging', () => {
    const state = untouchable(createGameState(content, 1, 'arena'));
    state.hero.weapon = 'chainsaw';
    const machine = currentLevel(state).enemies[0]!;
    const events = play(state, 3, [{ type: 'attack', enemyId: machine.id }]);
    expect(events.some((e) => e.type === 'EnemyDamaged' && e.enemyId === machine.id)).toBe(true);
    expect(events.some((e) => e.type === 'Swung' && e.actorId === state.hero.id)).toBe(false);
  });

  it('makes the machines tougher on every floor down, and keeps pace as U-7 levels up', () => {
    const state = createGameState(content, 1);
    const strengths = FLOOR_ORDER.map((id) => state.levels[id]!.enemyStrength);
    expect(strengths).toEqual([...strengths].sort((a, b) => a - b));
    expect(new Set(strengths).size).toBe(strengths.length);

    const loader = state.levels.intake!.enemies.find((e) => e.kind === 'loader')!;
    const before = loader.maxHp;
    gainXp(state, state.hero.xpNext, []);
    expect(state.hero.level).toBe(2);
    // Five percent stronger, give or take rounding.
    expect(Math.abs(loader.maxHp - before * 1.05)).toBeLessThanOrEqual(1);
  });
});
