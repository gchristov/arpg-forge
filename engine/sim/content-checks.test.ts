import { describe, expect, it } from 'vitest';
import type { Level } from '../world/level';
import { mapFromRows } from '../world/testing';
import type { GameContent, LevelContent } from './content';
import { checkContent } from './content-checks';
import { TEST_ENEMIES, TEST_HERO } from './testing';

/** Two rooms joined both ways: "home" with a wall splitting off its right side, and "cellar". */
function rooms(): GameContent {
  const level = (id: string, rows: string[], to: string, portal: { tx: number; ty: number }): LevelContent => {
    const l: Level = {
      id, name: id, subtitle: '', outdoor: false, map: mapFromRows(rows), start: { x: 1.5, y: 1.5 },
      portals: [{ ...portal, to, stepOut: { x: 0, y: -1 } }], lights: [], structures: [],
    };
    return { level: l, spawns: [], camps: [], npcs: [] };
  };
  return {
    levels: [
      level('home', ['....#..', '....#..', '....#..', '....#..'], 'cellar', { tx: 1, ty: 3 }),
      level('cellar', ['....', '....', '....'], 'home', { tx: 2, ty: 2 }),
    ],
    startLevel: 'home',
    hero: TEST_HERO,
    enemies: TEST_ENEMIES,
    npcRadius: 0.32,
    npcs: { elder: { services: [] } },
    quest: [{}],
  };
}

const home = (c: GameContent) => c.levels[0]!;

describe('checkContent', () => {
  it('passes sound content', () => {
    expect(checkContent(rooms())).toEqual([]);
  });

  it('finds a missing start level and a portal to nowhere', () => {
    const c = rooms();
    c.startLevel = 'attic';
    home(c).level.portals[0]!.to = 'attic';
    expect(checkContent(c)).toEqual(expect.arrayContaining([
      `the start level "attic" doesn't exist`,
      `home: the portal at (1, 3) leads to "attic", which doesn't exist`,
    ]));
  });

  it('finds a level no portal leads to', () => {
    const c = rooms();
    c.levels[1]!.level.portals = [];
    home(c).level.portals = [];
    expect(checkContent(c)).toContain(`no portal leads to level "cellar"`);
  });

  it('finds spawns inside walls, out of reach or of unknown kinds', () => {
    const c = rooms();
    home(c).spawns.push({ kind: 'brute', x: 4.5, y: 1.5 }, { kind: 'brute', x: 5.5, y: 1.5 }, { kind: 'dragon', x: 2.5, y: 1.5 });
    expect(checkContent(c)).toEqual([
      'home: the brute spawn at (4, 1) is inside something solid',
      `home: the brute spawn at (5, 1) can't be reached from the start`,
      'home: a spawn uses unknown enemy kind "dragon"',
    ]);
  });

  it('finds NPCs of unknown kinds, and chests and notices that can\'t be used because the tile in front is out of reach', () => {
    const c = rooms();
    home(c).npcs.push({ kind: 'ghost', name: 'Ghost', x: 2.5, y: 0.5 });
    home(c).containers = [{ tx: 6, ty: 0, gold: 1, healingItems: 0 }, { tx: 2, ty: 3, gold: 1, healingItems: 0 }, { tx: 2, ty: 1, gold: 1, healingItems: 0 }];
    home(c).readables = [{ tx: 5, ty: 2, id: 'notice' }, { tx: 1, ty: 1, id: 'sign' }];
    expect(checkContent(c)).toEqual([
      'home: NPC "Ghost" has unknown kind "ghost"',
      `home: a container at (6, 0) can't be opened: the tile in front of it can't be reached from the start`,
      `home: a container at (2, 3) can't be opened: the tile in front of it can't be reached from the start`,
      `home: "notice" at (5, 2) can't be read: the tile in front of it can't be reached from the start`,
    ]);
  });

  it('accepts a camp around a solid centre, but not one walled off', () => {
    const c = rooms();
    home(c).camps.push({ kind: 'brute', tx: 4, ty: 1 });
    expect(checkContent(c)).toEqual([]);
    home(c).level.map.solid.fill(1);
    expect(checkContent(c)).toEqual(expect.arrayContaining([
      `home: the brute camp at (4, 1) has no open ground around it that can be reached from the start`,
    ]));
  });

  it('finds quest steps nothing can reach', () => {
    const c = rooms();
    c.quest = [{}, { reachedBy: { type: 'talk', npcKind: 'elder' } }, { reachedBy: { type: 'kill', enemyKind: 'lord' } }];
    expect(checkContent(c)).toEqual([
      `quest step 1 needs talking to "elder", who isn't in any level`,
      `quest step 2 needs killing a "lord", which never appears`,
    ]);
  });
});
