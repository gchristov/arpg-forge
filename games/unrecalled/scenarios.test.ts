import { describe, expect, it } from 'vitest';
import { gainXp } from '../../engine/sim/combat';
import { questGoal } from '../../engine/sim/quest-goal';
import { createGameState } from '../../engine/sim/setup';
import { currentLevel, type Command, type GameState, type SimEvent } from '../../engine/sim/state';
import { step } from '../../engine/sim/step';
import { EMP } from './content/hero';
import { unrecalledContent } from './content/world';
import { jumpToStep } from '../../engine/sim/shortcuts';
import { REPLY, STEP, TAG } from './content/story';
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

/** Walks onto the current level's portal to `to`. */
function takeDoor(state: GameState, to: string): void {
  const door = currentLevel(state).level.portals.find((p) => p.to === to)!;
  play(state, 25, [{ type: 'walkInto', tx: door.tx, ty: door.ty }]);
  play(state, 1);
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

/** Opens the current level's container holding `weapon`, walking up to it first. */
function openCrateWith(state: GameState, weapon: string): SimEvent[] {
  const index = currentLevel(state).containers.findIndex((c) => c.weapon === weapon);
  return play(state, 30, [{ type: 'open', index }]);
}

/** Uses the current level's readable `id`, walking up to it first. */
function use(state: GameState, id: string): SimEvent[] {
  const index = currentLevel(state).readables.findIndex((r) => r.id === id);
  return play(state, 30, [{ type: 'read', index }]);
}

/** Beats the enemy with `tag` on the current level, walking up to it first, with whatever the salvager has in hand. */
function defeat(state: GameState, tag: string): SimEvent[] {
  const enemy = currentLevel(state).enemies.find((e) => e.tag === tag)!;
  const events: SimEvent[] = [];
  for (let i = 0; i < 60 && !enemy.dead; i++) events.push(...play(state, 1, [{ type: 'attack', enemyId: enemy.id }]));
  return events;
}

/** A salvager nothing stops and every machine falls to at once, for tests about the story rather than the fights. */
function unstoppable(state: GameState): GameState {
  untouchable(state).hero.damage = [1000, 1000];
  return state;
}

/** Out through the woods to the logging camp: Pell's saw, the loader at the switch, and the switch. */
function throughWoods(state: GameState): void {
  openCrateWith(state, 'chainsaw');
  defeat(state, TAG.switchLoader);
  use(state, 'switch');
}

/**
 * Goes from Rustbelt into the Foundry, through Mags's depot and its back door; with the story moved on to where every
 * door down is open first, if it isn't yet, for tests about what lies beyond.
 */
function intoFoundry(state: GameState): void {
  if (state.quest < STEP.charged) jumpToStep(state, STEP.charged);
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
  it('opens on the foreman, who points the salvager at the crawler making off with the tools, then gives them the job', () => {
    const state = untouchable(createGameState(content, 1));
    expect(state.levelId).toBe('rustbelt');
    const foreman = currentLevel(state).npcs.find((n) => n.kind === 'foreman')!;
    expect(questGoal(state)?.actorId).toBe(foreman.id);
    talkTo(state, 'foreman');
    expect(state.quest).toBe(0);
    answer(state, 'foreman', REPLY.onIt);
    const raider = currentLevel(state).enemies.find((e) => e.tag === TAG.raider)!;
    expect(questGoal(state)?.actorId).toBe(raider.id);
    defeat(state, TAG.raider);
    expect(state.quest).toBe(STEP.raidStopped);
    expect(questGoal(state)?.actorId).toBe(foreman.id);
    talkTo(state, 'foreman');
    expect(state.quest).toBe(STEP.raidStopped);
    answer(state, 'foreman', REPLY.howIn);
    expect(state.quest).toBe(STEP.raidStopped + 1);
  });

  it('plays the whole story by following where the guide points, from the raid to the bell and the foreman at dawn', () => {
    const state = unstoppable(createGameState(content, 1));
    const done: string[] = [];
    for (let goal = questGoal(state); goal && done.length < 60; goal = questGoal(state)) {
      const at = (t: { tx: number; ty: number }) => t.tx + 0.5 === goal!.x && t.ty + 0.5 === goal!.y;
      const ls = currentLevel(state);
      const enemy = ls.enemies.find((e) => e.id === goal!.actorId);
      const npc = ls.npcs.find((n) => n.id === goal!.actorId);
      const crate = ls.containers.find(at);
      const readable = ls.readables.find(at);
      if (enemy) {
        done.push(enemy.tag ?? enemy.kind);
        for (let i = 0; i < 60 && !enemy.dead; i++) play(state, 1, [{ type: 'attack', enemyId: enemy.id }]);
      } else if (npc) {
        done.push(`${npc.kind} in ${state.levelId}`);
        talkTo(state, npc.kind);
        const waitsFor = state.rules.quest[state.quest + 1]?.reachedBy;
        if (waitsFor?.type === 'reply') answer(state, npc.kind, waitsFor.id);
      } else if (crate?.weapon) {
        done.push(crate.weapon);
        openCrateWith(state, crate.weapon);
      } else if (readable) {
        done.push(readable.id);
        use(state, readable.id);
      } else {
        const door = ls.level.portals.find(at)!;
        takeDoor(state, door.to);
      }
    }
    expect(done).toEqual([
      'foreman in rustbelt', TAG.raider, 'foreman in rustbelt', 'chainsaw', TAG.switchLoader, 'switch', 'drag-marks',
      'trader in tradingPost', TAG.tagsLoader, 'charging-station', 'orderEngine', 'foreman in assembly', 'foreman in assembly',
      'bell', 'foreman in rustbelt',
    ]);
    expect(state.quest).toBe(STEP.ending);
  });

  it('takes the foreman from the fire once the turbine is switched back, shows him in the Assembly Hall once the Order Engine is down, and brings him home', () => {
    const state = createGameState(content, 1);
    const foremen = () => Object.entries(state.levels).flatMap(([id, ls]) => ls.npcs.filter((n) => n.kind === 'foreman').map(() => id));
    expect(foremen()).toEqual(['rustbelt']);
    jumpToStep(state, STEP.powerOn);
    expect(foremen()).toEqual([]);
    expect(currentLevel(state).readables.map((r) => r.id)).toContain('drag-marks');
    jumpToStep(state, STEP.charged);
    expect(foremen()).toEqual([]);
    jumpToStep(state, STEP.engineDown);
    expect(foremen()).toEqual(['assembly']);
    expect(currentLevel(state).readables.map((r) => r.id)).not.toContain('bell');
    jumpToStep(state, STEP.freed);
    expect(foremen()).toEqual(['rustbelt']);
    expect(currentLevel(state).readables.map((r) => r.id)).toContain('bell');
  });

  it('keeps each door shut until the story opens it: Mags\'s for the power, Intake\'s for the stock tags, the Gallery\'s for the charging station', () => {
    const state = untouchable(createGameState(content, 1));
    const depot = currentLevel(state).level.structures.findIndex((s) => s.kind === 'tradingPost');
    play(state, 25, [{ type: 'enterStructure', index: depot }]);
    play(state, 1);
    const tryDoor = (to: string) => {
      const door = currentLevel(state).level.portals.find((p) => p.to === to)!;
      return play(state, 25, [{ type: 'walkInto', tx: door.tx, ty: door.ty }]).filter((e) => e.type === 'PortalLocked').length;
    };
    expect(tryDoor('intake')).toBeGreaterThan(0);
    jumpToStep(state, STEP.taken);
    takeDoor(state, 'intake');
    expect(state.levelId).toBe('intake');
    expect(tryDoor('sorting')).toBeGreaterThan(0);
    state.hero.damage = [1000, 1000];
    defeat(state, TAG.tagsLoader);
    expect(state.quest).toBe(STEP.tagsTaken);
    takeDoor(state, 'sorting');
    takeDoor(state, 'gallery');
    expect(tryDoor('assembly')).toBeGreaterThan(0);
    use(state, 'charging-station');
    expect(state.quest).toBe(STEP.charged);
    takeDoor(state, 'assembly');
    expect(state.levelId).toBe('assembly');
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
    takeDoor(state, 'depotOffice');
    expect(state.levelId).toBe('depotOffice');
    const read = play(state, 15, [{ type: 'read', index: 0 }]);
    expect(read.filter((e) => e.type === 'Read').map((e) => (e.type === 'Read' ? e.id : ''))).toEqual(['depot-ledger']);
    takeDoor(state, 'tradingPost');
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

  it('lets the salvager walk up to a working machine until it\'s hit, which puts the whole Foundry on alert', () => {
    const state = inIntake();
    const hp = state.hero.hp;
    const loader = currentLevel(state).enemies.find((e) => e.tag === TAG.tagsLoader)!;
    play(state, 15, [{ type: 'walk', x: loader.x, y: loader.y + 1.2 }]);
    expect([state.hero.hp, loader.mode]).toEqual([hp, 'idle']);
    const events = play(state, 2, [{ type: 'attack', enemyId: loader.id }]);
    expect(events.map((e) => e.type)).toContain('LevelAlarmed');
    expect(loader.mode).toBe('chase');
    expect(FLOOR_ORDER.every((id) => state.levels[id]!.alarmed)).toBe(true);
    expect(state.levels.rustbelt!.alarmed).toBe(false);
  });

  it('places only the machines the story needs, and nothing on the floors between Intake and the Order Engine', () => {
    const state = createGameState(content, 1);
    const machines = Object.entries(state.levels)
      .filter(([id]) => id !== 'arena')
      .flatMap(([, ls]) => ls.enemies.map((e) => e.tag ?? e.kind));
    expect(machines.sort()).toEqual(['orderEngine', TAG.raider, TAG.switchLoader, TAG.tagsLoader].sort());
  });

  it('starts the salvager without the EMP, since it\'s to be earned', () => {
    const state = createGameState(content, 1);
    expect(state.rules.hero.skills).toEqual([]);
    const events = play(state, 1 / 60, [{ type: 'useSkill', slot: 0 }]);
    expect(events.map((e) => e.type)).not.toContain('SkillUsed');
  });

  it('sets off an EMP, once the salvager has it, among a pack of crawlers, hitting them all and sounding the alarm', () => {
    const state = untouchable(createGameState({ ...content, hero: { ...content.hero, skills: [EMP] } }, 1, 'arena'));
    const pack = currentLevel(state).enemies.filter((e) => e.kind === 'crawler').slice(0, 3);
    const middle = { x: pack.reduce((s, e) => s + e.x, 0) / 3, y: pack.reduce((s, e) => s + e.y, 0) / 3 };
    state.hero.x = state.hero.prevX = middle.x;
    state.hero.y = state.hero.prevY = middle.y + 0.6;
    const events = play(state, 1 / 60, [{ type: 'useSkill', slot: 0 }]);
    const hit = new Set(events.flatMap((e) => (e.type === 'EnemyDamaged' ? [e.enemyId] : [])));
    expect(pack.filter((e) => hit.has(e.id)).length).toBeGreaterThanOrEqual(2);
    expect(events.map((e) => e.type)).toContain('LevelAlarmed');
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

  it('calms every machine once the Order Engine falls', () => {
    const state = unstoppable(createGameState(content, 1));
    intoFoundry(state);
    for (const next of FLOOR_ORDER.slice(1)) takeDoor(state, next);
    const engine = currentLevel(state).enemies.find((e) => e.kind === 'orderEngine')!;
    for (let i = 0; i < 60 && !engine.dead; i++) play(state, 1, [{ type: 'attack', enemyId: engine.id }]);
    expect(state.quest).toBe(STEP.engineDown);
    const machines = Object.values(state.levels).flatMap((ls) => ls.enemies.filter((e) => !e.dead));
    expect(machines.every((e) => e.mode === 'idle')).toBe(true);
    expect(Object.values(state.levels).some((ls) => ls.alarmed)).toBe(false);
  });

  it('never skips to the ending for walking back into Rustbelt early, such as out of Pell\'s workshop or away from the Order Engine', () => {
    const state = untouchable(createGameState(content, 1));
    jumpToStep(state, STEP.raidStopped + 1);
    const workshop = currentLevel(state).level.structures.findIndex((s) => s.kind === 'workshop');
    play(state, 25, [{ type: 'enterStructure', index: workshop }]);
    play(state, 1);
    takeDoor(state, 'rustbelt');
    expect(state.quest).toBe(STEP.raidStopped + 1);

    intoFoundry(state);
    for (const next of FLOOR_ORDER.slice(1)) takeDoor(state, next);
    for (const previous of WAY_BACK) takeDoor(state, previous);
    expect([state.levelId, state.quest]).toEqual(['rustbelt', STEP.charged + 1]);
  });

  it('waits for the salvager\'s reply, so walking away from the foreman before it doesn\'t move the story on', () => {
    const state = unstoppable(createGameState(content, 1));
    defeat(state, TAG.raider);
    talkTo(state, 'foreman');
    talkTo(state, 'foreman');
    expect(state.quest).toBe(STEP.raidStopped);
    answer(state, 'foreman', REPLY.howIn);
    answer(state, 'foreman', REPLY.howIn);
    expect(state.quest).toBe(STEP.raidStopped + 1);
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

  it('fights with fists, then finds Pell\'s chainsaw in the woods and cuts with it', () => {
    const state = untouchable(createGameState(content, 1));
    expect(state.hero.weapon).toBeNull();
    jumpToStep(state, STEP.raidStopped + 1);
    const events = openCrateWith(state, 'chainsaw');
    expect(events.map((e) => e.type)).toContain('Armed');
    expect([state.hero.weapon, state.quest]).toEqual(['chainsaw', STEP.armed]);

    const cut = defeat(state, TAG.switchLoader);
    expect(state.quest).toBe(STEP.switchFreed);
    expect(cut.some((e) => e.type === 'Swung' && e.actorId === state.hero.id)).toBe(false);
  });

  it('lets the loader at the switch be broken on fists, and leaves the saw in its crate for later', () => {
    const state = unstoppable(createGameState(content, 1));
    jumpToStep(state, STEP.raidStopped + 1);
    defeat(state, TAG.switchLoader);
    expect([state.quest, state.hero.weapon]).toEqual([STEP.switchFreed, null]);
    use(state, 'switch');
    expect(state.quest).toBe(STEP.powerOn);
    openCrateWith(state, 'chainsaw');
    expect([state.hero.weapon, state.quest]).toEqual(['chainsaw', STEP.powerOn]);
  });

  it('lets Pell toughen the salvager\'s fists for scrap before they find a weapon', () => {
    const state = untouchable(createGameState(content, 1));
    const workshop = currentLevel(state).level.structures.findIndex((s) => s.kind === 'workshop');
    play(state, 25, [{ type: 'enterStructure', index: workshop }]);
    play(state, 1);
    talkTo(state, 'tinker');
    const pell = currentLevel(state).npcs.find((n) => n.kind === 'tinker')!;
    state.hero.gold = 50;
    play(state, 0.1, [{ type: 'useService', npcId: pell.id, service: 0 }]);
    expect([state.hero.bonusDamage, state.hero.gold, state.hero.weapon]).toEqual([3, 10, null]);
  });

  it('makes the machines tougher on every floor down, and keeps pace as the salvager levels up', () => {
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
