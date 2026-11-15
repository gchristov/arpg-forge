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
      { part: 'door', x: 12.5, y: 24, length: 1, facing: { x: 0, y: 1 }, storey: 0, seen: true },
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
    expect(corners.map((c) => [c.x, c.y])).toEqual([[10, 20], [16, 20], [10, 24], [16, 24]]);
    expect(corners.every((c) => c.storey === 0 && c.top)).toBe(true);
  });

  describe('with blocks of several storeys', () => {
    // A two-storey hall with a one-storey wing on its right, the door in the hall's front.
    const DEPOT: Structure = {
      ...LOT, width: 8, door: { tx: 12, ty: 23 },
      parts: [{ x: 10, y: 20, width: 6, depth: 4, floors: 2 }, { x: 16, y: 22, width: 2, depth: 2, floors: 1 }],
    };
    const layout = buildingLayout(DEPOT, 2, 0);

    it('walls the upper storey round the tall block only, with windows in every seen piece', () => {
      const upper = layout.walls.filter((w) => w.storey === 1);
      expect(upper.reduce((sum, w) => sum + w.length, 0)).toBe(20);
      expect(upper.filter((w) => w.seen).every((w) => w.part === 'window')).toBe(true);
      expect(layout.walls.filter((w) => w.part === 'door').map((w) => w.storey)).toEqual([0]);
    });

    it('leaves no wall between the blocks on the ground, where they join', () => {
      expect(layout.walls.filter((w) => w.storey === 0 && w.facing.y === 0 && w.x === 16 && w.y > 22)).toEqual([]);
    });

    it('tops each block with its band, and roofs each at its own height', () => {
      expect(new Set(layout.bands.map((b) => b.storey))).toEqual(new Set([0, 1]));
      expect(layout.roof.filter((p) => p.floors === 1).map((p) => [p.x, p.y])).toEqual([[17, 23]]);
    });

    it('rails the lower roof where it drops away, but not against the taller wall', () => {
      expect(layout.rails.length).toBeGreaterThan(0);
      expect(layout.rails.every((r) => r.storey === 1 && r.facing.x !== -1)).toBe(true);
    });

    it('stands columns where the outline turns, including the inside corner', () => {
      expect(layout.corners.filter((c) => c.storey === 0).map((c) => [c.x, c.y])).toContainEqual([16, 22]);
    });
  });

  it('stands things on the roof only when the kit has some, and the same ones every time', () => {
    expect(buildingLayout(LOT, 2, 0).roofProps).toEqual([]);
    const props = buildingLayout(LOT, 2, 2).roofProps;
    expect(props.length).toBeGreaterThan(0);
    expect(props.every((p) => p.variant === 0 || p.variant === 1)).toBe(true);
    expect(buildingLayout(LOT, 2, 2).roofProps).toEqual(props);
  });
});
