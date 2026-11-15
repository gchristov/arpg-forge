import { describe, expect, it } from 'vitest';
import { mapFromRows } from '../world/testing';
import { wallPanels } from './wall-panels';

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

  it('puts panels on every face of a free-standing block of wall', () => {
    expect(panels(['.....', '..#..', '.....'], 3)).toHaveLength(4);
  });
});
