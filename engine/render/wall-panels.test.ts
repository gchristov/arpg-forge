import { describe, expect, it } from 'vitest';
import { mapFromRows } from '../world/testing';
import { wallFaces, wallPanels } from './wall-panels';

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

  it('puts panels on every face of a free-standing block of wall', () => {
    expect(panels(['.....', '..#..', '.....'], 3)).toHaveLength(4);
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
