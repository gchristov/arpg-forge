import { describe, expect, it } from 'vitest';
import { mapFromRows } from '../world/testing';
import { kitWalls, wallFaces, wallPanels } from './wall-panels';

/** `#` is wall, anything else floor; the tests read panels as text so the layout is easy to check. */
function panels(rows: string[], span: number) {
  const map = mapFromRows(rows);
  const isWall = (tx: number, ty: number) => rows[ty]![tx] === '#';
  return wallPanels(map, isWall, span).map((p) => `${p.front ? 'front' : 'back'} ${p.x},${p.y} ×${p.length} facing ${p.facing.x},${p.facing.y}`);
}

describe('wallPanels', () => {
  it('lines a room with panels on the edges facing the floor, front ones marked', () => {
    expect(panels(['#####', '#...#', '#...#', '#####'], 3)).toEqual([
      'back 1,2 ×2 facing 1,0',
      'back 2.5,1 ×3 facing 0,1',
      'front 4,2 ×2 facing -1,0',
      'front 2.5,3 ×3 facing 0,-1',
    ]);
  });

  it('splits long runs into spans, finishing with a shorter piece', () => {
    expect(panels(['#######', '#.....#', '#######'], 3).filter((p) => p.includes('facing 0,1'))).toEqual([
      'back 2.5,1 ×3 facing 0,1',
      'back 5,1 ×2 facing 0,1',
    ]);
  });

  it('breaks a run at a doorway', () => {
    expect(panels(['#######', '#.....#', '###.###'], 3).filter((p) => p.startsWith('front') && p.includes('0,-1'))).toEqual([
      'front 2,2 ×2 facing 0,-1',
      'front 5,2 ×2 facing 0,-1',
    ]);
  });

  it('draws the sides of a doorway like the outer wall it is in', () => {
    const sides = (rows: string[]) => panels(rows, 3).filter((p) => p.includes('facing 1,0') || p.includes('facing -1,0'));
    expect(sides(['###.###', '#.....#', '#.....#', '#######']).filter((p) => p.includes(',0.5 '))).toEqual([
      'back 3,0.5 ×1 facing 1,0',
      'back 4,0.5 ×1 facing -1,0',
    ]);
    expect(sides(['#######', '#.....#', '#.....#', '###.###']).filter((p) => p.includes(',3.5 '))).toEqual([
      'front 3,3.5 ×1 facing 1,0',
      'front 4,3.5 ×1 facing -1,0',
    ]);
  });

  it('draws walls inside the room low on every side, so they never hide the floor behind them', () => {
    const block = panels(['.....', '..#..', '.....'], 3);
    expect(block).toHaveLength(4);
    expect(block.every((p) => p.startsWith('front'))).toBe(true);
  });

  it('stands the back walls of a corridor cut through rock full height, and its front walls low', () => {
    const corridor = panels(['#######', '#######', '#######', '#######', '##...##', '##...##', '#######'], 3);
    expect(corridor.filter((p) => p.includes('facing 0,1'))).toEqual(['back 3.5,4 ×3 facing 0,1']);
    expect(corridor.filter((p) => p.includes('facing 0,-1'))).toEqual(['front 3.5,6 ×3 facing 0,-1']);
  });

  it('keeps a thin wall between two rooms low, so it never hides the room behind it', () => {
    const rooms = panels(['#####', '#...#', '#####', '#...#', '#####'], 3);
    expect(rooms.filter((p) => p.includes(',3 ') && p.includes('facing 0,1'))).toEqual(['front 2.5,3 ×3 facing 0,1']);
  });
});

describe('kitWalls', () => {
  const walls = (rows: string[]) => kitWalls(mapFromRows(rows), (x, y) => rows[y]![x] === '#', 3);

  it('lays a piece at each corner of a room on the grid, and whole panels along the walls between them', () => {
    // A room three cells wide and two deep, walled a cell thick all round.
    const rows = ['###############', '###############', '###############',
      ...Array.from({ length: 6 }, () => '###.........###'),
      '###############', '###############', '###############'];
    const { panels, corners } = walls(rows);
    expect(corners.map((c) => `${c.x},${c.y} ${c.inner ? 'inner' : 'outer'} ${c.arms.x},${c.arms.y}`).sort()).toEqual([
      '12,3 inner -1,1', '12,9 inner -1,-1', '3,3 inner 1,1', '3,9 inner 1,-1',
    ]);
    // Each corner takes a cell of both walls it joins, so only the middle cell of the long walls is left.
    expect(panels.map((p) => `${p.x},${p.y} facing ${p.facing.x},${p.facing.y}`).sort()).toEqual(['7.5,3 facing 0,1', '7.5,9 facing 0,-1']);
  });

  it('cuts away only the walls between the room and the camera: south and east, and the corner joining the two', () => {
    const rows = ['###############', '###############', '###############',
      ...Array.from({ length: 6 }, () => '###.........###'),
      '###############', '###############', '###############'];
    const { panels, corners } = walls(rows);
    expect(panels.map((p) => `${p.y} ${p.front ? 'front' : 'back'}`).sort()).toEqual(['3 back', '9 front']);
    expect(corners.filter((c) => c.front).map((c) => `${c.x},${c.y}`)).toEqual(['12,9']);
  });

  it('turns outer corners round a pillar standing in a room', () => {
    const rows = ['###############', '###############', '###############',
      '###.........###', '###.........###', '###.........###',
      '###...###...###', '###...###...###', '###...###...###',
      '###.........###', '###.........###', '###.........###',
      '###############', '###############', '###############'];
    const outer = walls(rows).corners.filter((c) => !c.inner);
    expect(outer.map((c) => `${c.x},${c.y} ${c.arms.x},${c.arms.y}`).sort()).toEqual(['6,6 1,1', '6,9 1,-1', '9,6 -1,1', '9,9 -1,-1']);
  });

  it('leaves a doorway\'s cell open, without turning corners round it', () => {
    const rows = ['###############', '###############', '#######D#######',
      ...Array.from({ length: 6 }, () => '###.........###'),
      '###############', '###############', '###############'];
    const { panels, corners } = kitWalls(mapFromRows(rows), (x, y) => rows[y]![x] === '#', 3, (x, y) => rows[y]![x] === 'D');
    expect(panels.filter((p) => p.y === 3)).toEqual([]);
    expect(corners).toHaveLength(4);
  });

  it('leaves a cell only partly walled open', () => {
    const rows = ['###############', '###############', '#######.#######',
      ...Array.from({ length: 6 }, () => '###.........###'),
      '###############', '###############', '###############'];
    expect(walls(rows).panels.filter((p) => p.y === 3)).toEqual([]);
  });
});

describe('wallFaces', () => {
  const faces = (rows: string[], tx: number, ty: number) => {
    const isWall = (x: number, y: number) => rows[y]![x] === '#';
    return wallFaces(mapFromRows(rows), isWall, tx, ty).map((f) => `${f.front ? 'front' : 'back'} ${f.x},${f.y} facing ${f.facing.x},${f.facing.y}`);
  };

  it('finds the faces of a wall tile that look onto the floor', () => {
    expect(faces(['#####', '#...#', '#####'], 2, 0)).toEqual(['back 2.5,1 facing 0,1']);
    expect(faces(['#####', '#...#', '#####'], 4, 1)).toEqual(['front 4,1.5 facing -1,0']);
  });

  it('finds every face of a wall standing in the open, and none on a buried one', () => {
    expect(faces(['...', '.#.', '...'], 1, 1)).toHaveLength(4);
    expect(faces(['###', '###', '###'], 1, 1)).toEqual([]);
  });
});
