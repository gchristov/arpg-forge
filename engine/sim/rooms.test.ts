import { describe, expect, it } from 'vitest';
import { tileIndex } from '../world/tile-map';
import { roomFromRows, type RoomSpec } from './rooms';

const WALL = 1;
const LOW_WALL = 2;
const TORCH = 3;
const CRATE = 4;

const spec = (rows: string[]): RoomSpec => ({
  id: 'hall', name: 'Hall', subtitle: '', floor: 7, rows,
  key: {
    '.': {},
    '#': { prop: WALL, frontProp: LOW_WALL, solid: true },
    L: { prop: TORCH, solid: true, light: { radius: 3, intensity: 1, colour: 'warm', flicker: 1, lean: 0.7 } },
    D: { portal: { to: 'outside', stepOut: { x: 0, y: -1 }, start: { x: 0, y: -0.9 } } },
    x: { prop: CRATE, solid: true, container: { gold: 5, healingItems: 1 } },
    s: { spawn: 'ghoul' },
    n: { npc: { kind: 'keeper', name: 'Keeper' } },
    '@': { heroStart: true },
  },
});

describe('roomFromRows', () => {
  const room = roomFromRows(spec(['#L###', 'L.sn#', '#.x.#', '##D##']));
  const { map } = room.level;
  const propAt = (x: number, y: number) => map.prop[tileIndex(map, x, y)];
  const solidAt = (x: number, y: number) => map.solid[tileIndex(map, x, y)];

  it('lays the floor and each character\'s prop, with front-edge props on the bottom and right', () => {
    expect([...map.ground].every((g) => g === 7)).toBe(true);
    expect([propAt(0, 0), propAt(4, 1), propAt(0, 3)]).toEqual([WALL, LOW_WALL, LOW_WALL]);
    expect([solidAt(1, 1), solidAt(2, 2)]).toEqual([0, 1]);
  });

  it('pulls lights on the room\'s edge into the room', () => {
    expect(room.level.lights.map((l) => [l.x, l.y])).toEqual([[1.5, 1.2], [1.2, 1.5]]);
  });

  it('places portals, the start in front of them, spawns, NPCs and containers', () => {
    expect(room.level.portals).toEqual([{ tx: 2, ty: 3, to: 'outside', stepOut: { x: 0, y: -1 } }]);
    expect(room.level.start).toEqual({ x: 2.5, y: 2.6 });
    expect(room.spawns).toEqual([{ kind: 'ghoul', x: 2.5, y: 1.5 }]);
    expect(room.npcs).toEqual([{ kind: 'keeper', name: 'Keeper', x: 3.5, y: 1.5 }]);
    expect(room.containers).toEqual([{ tx: 2, ty: 2, gold: 5, healingItems: 1 }]);
  });

  it('gives a tile its own ground where the key says', () => {
    const rows = ['###', '#=#', '###'];
    const room = roomFromRows({ ...spec(rows), key: { ...spec(rows).key, '=': { ground: 9 } } });
    expect(room.level.map.ground[tileIndex(room.level.map, 1, 1)]).toBe(9);
    expect(room.level.map.ground[tileIndex(room.level.map, 0, 0)]).toBe(7);
  });

  it('starts the hero on a marked tile', () => {
    expect(roomFromRows(spec(['###', '#@#', '###'])).level.start).toEqual({ x: 1.5, y: 1.5 });
  });

  it('refuses characters missing from the key and uneven rows', () => {
    expect(() => roomFromRows(spec(['#?#']))).toThrow('nothing in the key for "?" at (1, 0)');
    expect(() => roomFromRows(spec(['###', '##']))).toThrow('row 1 is 2 wide, not 3');
  });
});
