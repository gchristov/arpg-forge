import { describe, expect, it } from 'vitest';
import type { Structure } from '../world/level';
import { buildingLayout } from './building-layout';

const LOT: Structure = { kind: 'shed', name: 'Shed', x: 10, y: 20, width: 6, depth: 4, door: { tx: 12, ty: 23 } };

describe('buildingLayout', () => {
  it('walls the whole lot, leaving one tile for the door on the front', () => {
    const { walls } = buildingLayout(LOT, 2, 0);
    const length = (facing: { x: number; y: number }) =>
      walls.filter((w) => w.facing.x === facing.x && w.facing.y === facing.y).reduce((sum, w) => sum + w.length, 0);
    expect(length({ x: 0, y: 1 })).toBe(6);
    expect(length({ x: 0, y: -1 })).toBe(6);
    expect(length({ x: 1, y: 0 })).toBe(4);
    expect(length({ x: -1, y: 0 })).toBe(4);
    expect(walls.filter((w) => w.part === 'door')).toEqual([
      { part: 'door', x: 12.5, y: 24, length: 1, facing: { x: 0, y: 1 }, seen: true },
    ]);
  });

  it('splits the front around the door into whole pieces where it can, finishing with a shorter one', () => {
    const front = buildingLayout(LOT, 2, 0).walls.filter((w) => w.facing.y === 1);
    expect(front.map((w) => [w.x, w.length])).toEqual([[11, 2], [12.5, 1], [14, 2], [15.5, 1]]);
  });

  it('puts windows in every other whole piece on the sides the camera sees, and none at the back', () => {
    const { walls } = buildingLayout(LOT, 2, 0);
    const windows = walls.filter((w) => w.part === 'window');
    expect(windows.every((w) => w.seen && w.length === 2)).toBe(true);
    expect(windows.map((w) => [w.x, w.y])).toEqual([[11, 24], [16, 21]]);
  });

  it('puts a door on a corner tile in the front only', () => {
    const corner = { ...LOT, door: { tx: 15, ty: 23 } };
    expect(buildingLayout(corner, 2, 0).walls.filter((w) => w.part === 'door').map((w) => w.facing)).toEqual([{ x: 0, y: 1 }]);
  });

  it('roofs the whole lot and stands a column at each corner', () => {
    const { roof, corners } = buildingLayout(LOT, 2, 0);
    expect(roof.reduce((area, p) => area + p.width * p.depth, 0)).toBe(24);
    expect(corners).toEqual([{ x: 10, y: 20 }, { x: 16, y: 20 }, { x: 10, y: 24 }, { x: 16, y: 24 }]);
  });

  it('stands things on the roof only when the kit has some, and the same ones every time', () => {
    expect(buildingLayout(LOT, 2, 0).roofProps).toEqual([]);
    const props = buildingLayout(LOT, 2, 2).roofProps;
    expect(props.length).toBeGreaterThan(0);
    expect(props.every((p) => p.variant === 0 || p.variant === 1)).toBe(true);
    expect(buildingLayout(LOT, 2, 2).roofProps).toEqual(props);
  });
});
