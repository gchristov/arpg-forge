import { describe, expect, it } from 'vitest';
import { questGoal } from '../../engine/sim/quest-goal';
import { createGameState } from '../../engine/sim/setup';
import { currentLevel, type Command, type GameState, type SimEvent } from '../../engine/sim/state';
import { step } from '../../engine/sim/step';
import { unrecalledContent } from './content/world';
import { ENDING_STEP, ENGINE_DOWN_STEP } from './content/story';
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

/** Destroys every machine on the current floor, for tests about what comes after. */
function silenceFloor(state: GameState): void {
  for (const e of currentLevel(state).enemies) e.dead = true;
}

/** Walks onto the current floor's portal to `to`, first silencing the floor if that door is sealed. */
function takeDoor(state: GameState, to: string): void {
  const door = currentLevel(state).level.portals.find((p) => p.to === to)!;
  if (door.sealed) silenceFloor(state);
  play(state, 25, [{ type: 'walkInto', tx: door.tx, ty: door.ty }]);
  play(state, 1);
}

/** Talks to someone in the current level by kind, walking up to them first. */
function talkTo(state: GameState, kind: string): SimEvent[] {
  const npc = currentLevel(state).npcs.find((n) => n.kind === kind)!;
  return play(state, 15, [{ type: 'talk', npcId: npc.id }]);
}

/** Goes from Rustbelt into the Foundry, through Mags's depot and its loading door. */
function intoFoundry(state: GameState): void {
  const depot = currentLevel(state).level.structures.findIndex((s) => s.kind === 'tradingPost');
  play(state, 25, [{ type: 'enterStructure', index: depot }]);
  play(state, 1);
  takeDoor(state, 'intake');
}

/** The way back up from the deepest floor to Rustbelt, through every floor and the depot. */
const WAY_BACK = [...[...FLOOR_ORDER].reverse().slice(1), 'tradingPost', 'rustbelt'];

/** A new game, already through the depot into Intake. */
function inIntake(): GameState {
  const state = untouchable(createGameState(content, 1));
  intoFoundry(state);
  return state;
}

describe('Unrecalled scenarios', () => {
  it('starts in Rustbelt, where the foreman sends the salvager into the Foundry through the depot', () => {
    const state = createGameState(content, 1);
    expect(state.levelId).toBe('rustbelt');
    expect(currentLevel(state).npcs.map((n) => n.kind)).toEqual(['foreman']);
    const events = talkTo(state, 'foreman');
    expect(events.map((e) => e.type)).toContain('Talked');
    expect(state.quest).toBe(1);
    expect(currentLevel(state).level.portals.map((p) => p.to)).not.toContain('intake');
    intoFoundry(state);
    expect(state.levelId).toBe('intake');
  });

  it('walks into each of Rustbelt\'s buildings, finds who works there, and back out of the same door', () => {
    const state = untouchable(createGameState(content, 1));
    for (const [index, building] of currentLevel(state).level.structures.entries()) {
      play(state, 25, [{ type: 'enterStructure', index }]);
      play(state, 1);
      expect(state.levelId).not.toBe('rustbelt');
      const inside = state.levelId;
      expect({ workshop: ['tinker'], tradingPost: ['trader'], pumphouse: [] }[inside]).toEqual(currentLevel(state).npcs.map((n) => n.kind));
      takeDoor(state, 'rustbelt');
      expect(state.levelId).toBe('rustbelt');
      expect(Math.floor(state.hero.y)).toBe(building.door.ty + 1);
    }
  });

  it('climbs the depot\'s stairs to its office, reads the ledger and comes back down to the stairs', () => {
    const state = untouchable(createGameState(content, 1));
    const depot = currentLevel(state).level.structures.findIndex((s) => s.kind === 'tradingPost');
    play(state, 25, [{ type: 'enterStructure', index: depot }]);
    play(state, 1);
    expect(state.levelId).toBe('tradingPost');
    takeDoor(state, 'depotOffice');
    expect(state.levelId).toBe('depotOffice');
    const read = play(state, 15, [{ type: 'read', index: 0 }]);
    expect(read.filter((e) => e.type === 'Read').map((e) => (e.type === 'Read' ? e.id : ''))).toEqual(['depot-ledger']);
    takeDoor(state, 'tradingPost');
    expect(state.levelId).toBe('tradingPost');
    const stairs = currentLevel(state).level.portals.find((p) => p.to === 'depotOffice')!;
    expect(Math.hypot(state.hero.x - (stairs.tx + 0.5), state.hero.y - (stairs.ty + 0.5))).toBeLessThan(1.5);
  });

  it('goes down through every floor to the Assembly Hall, and back up through the depot to Rustbelt', () => {
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

  it('lets the salvager walk among the working machines until one is hit, then turns its pack but not the next room', () => {
    const state = createGameState(content, 1);
    intoFoundry(state);
    const hp = state.hero.hp;
    const crawler = currentLevel(state).enemies.find((e) => e.kind === 'crawler')!;
    play(state, 12, [{ type: 'walk', x: crawler.x, y: crawler.y + 1 }]);
    expect(state.hero.hp).toBe(hp);
    expect(currentLevel(state).enemies.every((e) => e.mode === 'idle')).toBe(true);
    const events = play(state, 2, [{ type: 'attack', enemyId: crawler.id }]);
    expect(events.map((e) => e.type)).toContain('LevelAlarmed');
    expect(currentLevel(state).enemies.filter((e) => e.mode === 'chase').length).toBeGreaterThan(1);
    expect(currentLevel(state).enemies.filter((e) => e.mode === 'idle').length).toBeGreaterThan(10);
  });

  it('sets off an EMP among a pack of crawlers, hitting them all and sounding the alarm', () => {
    const state = inIntake();
    const pack = currentLevel(state).enemies.filter((e) => e.kind === 'crawler').slice(0, 3);
    const middle = { x: pack.reduce((s, e) => s + e.x, 0) / 3, y: pack.reduce((s, e) => s + e.y, 0) / 3 };
    state.hero.x = state.hero.prevX = middle.x;
    state.hero.y = state.hero.prevY = middle.y + 0.6;
    const events = play(state, 1 / 60, [{ type: 'useSkill', slot: 1 }]);
    const hit = new Set(events.flatMap((e) => (e.type === 'EnemyDamaged' ? [e.enemyId] : [])));
    expect(pack.filter((e) => hit.has(e.id)).length).toBeGreaterThanOrEqual(2);
    expect(events.map((e) => e.type)).toContain('LevelAlarmed');
  });

  it('keeps the door to the Assembly Hall sealed until the Control Gallery is silenced', () => {
    const state = inIntake();
    takeDoor(state, 'sorting');
    takeDoor(state, 'gallery');
    const door = currentLevel(state).level.portals.find((p) => p.to === 'assembly')!;
    const events = play(state, 25, [{ type: 'walkInto', tx: door.tx, ty: door.ty }]);
    expect(state.levelId).toBe('gallery');
    expect(events.map((e) => e.type)).toContain('PortalSealed');
    takeDoor(state, 'assembly');
    expect(state.levelId).toBe('assembly');
  });

  it('hides a salvage cache on every floor that pays out scrap and a patch kit', () => {
    const state = inIntake();
    for (const [i, floor] of FLOOR_ORDER.entries()) {
      if (i > 0) takeDoor(state, floor);
      // Whatever the hero hasn't picked up yet is still on the floor.
      const held = (kind: 'gold' | 'healingItem') =>
        (kind === 'gold' ? state.hero.gold : state.hero.healingItems) +
        currentLevel(state).items.filter((item) => item.kind === kind).reduce((sum, item) => sum + item.amount, 0);
      const before = { gold: held('gold'), kits: held('healingItem') };
      const events = play(state, 25, [{ type: 'open', index: 0 }]);
      expect(events.map((e) => e.type)).toContain('ContainerOpened');
      expect(held('gold') - before.gold).toBeGreaterThanOrEqual(30);
      expect(held('healingItem') - before.kits).toBeGreaterThanOrEqual(1);
    }
  });

  it('plays the whole story: the job, the Order Engine, every machine standing down, and the foreman', () => {
    const state = untouchable(createGameState(content, 1));
    state.hero.damage = [1000, 1000];
    talkTo(state, 'foreman');
    intoFoundry(state);
    for (const next of FLOOR_ORDER.slice(1)) takeDoor(state, next);
    expect(state.quest).toBe(4);
    const engine = currentLevel(state).enemies.find((e) => e.kind === 'orderEngine')!;
    for (let i = 0; i < 20 && !engine.dead; i++) play(state, 1, [{ type: 'attack', enemyId: engine.id }]);
    expect(engine.dead).toBe(true);
    expect(state.quest).toBe(ENGINE_DOWN_STEP);
    const machines = Object.values(state.levels).flatMap((ls) => ls.enemies.filter((e) => !e.dead));
    expect(machines.every((e) => e.mode === 'idle')).toBe(true);
    expect(Object.values(state.levels).some((ls) => ls.alarmed)).toBe(false);

    for (const previous of WAY_BACK) takeDoor(state, previous);
    talkTo(state, 'foreman');
    expect(state.quest).toBe(ENDING_STEP);
  });

  it('never skips to the end for chatting with the foreman again on the way', () => {
    const state = createGameState(content, 1);
    talkTo(state, 'foreman');
    play(state, 1);
    talkTo(state, 'foreman');
    expect(state.quest).toBe(1);
  });

  it('gets the salvager back up at the entrance of the floor they fell on', () => {
    const state = inIntake();
    takeDoor(state, 'sorting');
    state.hero.hp = 0;
    state.hero.dead = true;
    play(state, 0.1, [{ type: 'respawn' }]);
    expect(state.levelId).toBe('sorting');
    expect(state.hero.dead).toBe(false);
  });

  it('points the way from the foreman down to the Order Engine, one door at a time', () => {
    const state = untouchable(createGameState(content, 1));
    const foreman = currentLevel(state).npcs.find((n) => n.kind === 'foreman')!;
    expect(questGoal(state)?.actorId).toBe(foreman.id);
    talkTo(state, 'foreman');

    const route: string[] = [];
    const keepersOn: string[] = [];
    for (let goal = questGoal(state); goal && route.length < 10; goal = questGoal(state)) {
      if (goal.actorId !== undefined) {
        if (state.levelId === 'assembly') break;
        // A machine still standing keeps the way on sealed, so the guide points at it first.
        keepersOn.push(state.levelId);
        silenceFloor(state);
        continue;
      }
      const door = currentLevel(state).level.portals.find((p) => p.tx + 0.5 === goal!.x && p.ty + 0.5 === goal!.y)!;
      takeDoor(state, door.to);
      route.push(state.levelId);
    }
    expect(route).toEqual(['tradingPost', ...FLOOR_ORDER]);
    expect(keepersOn).toEqual(['gallery']);
    const engine = currentLevel(state).enemies.find((e) => e.kind === 'orderEngine')!;
    expect(questGoal(state)?.actorId).toBe(engine.id);
  });
});
