import { describe, expect, it } from 'vitest';
import { mapFromRows } from '../world/testing';
import { GoalGuide } from './goal-guide';

// A wall between the hero (left) and the goal (right), open only at the bottom.
const MAP = mapFromRows([
  '...#...',
  '...#...',
  '...#...',
  '...#...',
  '.......',
]);

describe('GoalGuide', () => {
  it('aims along the walk round a wall, not straight through it', () => {
    const aim = new GoalGuide().aim(MAP, 1.5, 0.5, { x: 5.5, y: 0.5 }, { x: 0, y: 0 });
    expect(aim.y).toBeGreaterThan(2);
    expect(aim.x).toBeLessThan(3);
  });

  it('aims straight at a goal in the open, and at the goal itself once close', () => {
    const guide = new GoalGuide();
    expect(guide.aim(MAP, 0.5, 4.5, { x: 6.5, y: 4.5 }, { x: 0, y: 0 }).y).toBe(4.5);
    expect(guide.aim(MAP, 5.5, 4.5, { x: 6.5, y: 4.5 }, { x: 0, y: 0 })).toEqual({ x: 6.5, y: 4.5 });
  });

  it('aims straight at a goal no walk reaches', () => {
    const walled = mapFromRows(['..#..', '..#..']);
    expect(new GoalGuide().aim(walled, 0.5, 0.5, { x: 4.5, y: 0.5 }, { x: 0, y: 0 })).toEqual({ x: 4.5, y: 0.5 });
  });
});
