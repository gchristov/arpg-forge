import type { Level } from '../../../engine/world/level';
import { createTileMap, setProp, tileIndex } from '../../../engine/world/tile-map';
import { Ground, Prop } from '../content/tiles';
import type { Spawn } from './village';

const LAYOUTS = {
  tavern: [
    '####L###L####',
    '#...........#',
    '#.tt...bb...#',
    '#.tt........#',
    'L.......n...#',
    '#.tt........#',
    '#.tt....t.b.#',
    '#...........#',
    '#.x.........#',
    '######D######',
  ],
  smithy: [
    '###L###L###',
    '#.........#',
    '#.a..f..xx#',
    '#.........#',
    'L...n.....#',
    '#.......b.#',
    '#.xx......#',
    '#.........#',
    '#####D#####',
  ],
  cottage: [
    '##L###L##',
    '#.......#',
    '#kk...C.#',
    '#.......#',
    '#..tt...#',
    '#..tt.b.#',
    '#.......#',
    '#.......#',
    '####D####',
  ],
  crypt: [
    '#####L#####L#####L#####',
    '#.....#.........#.....#',
    '#..r..#....B....#..r..#',
    '#.....#..f...f..#.....#',
    '#..g..#.........#..g..#',
    '###.#####.....#####.###',
    '#.....p.........p.....#',
    'L..s.............s....#',
    '#.........g...........#',
    '#.....p.........p.....#',
    '######...#######...####',
    '#........#.....#......#',
    'L..s.....#..s..#...s..#',
    '#........#.....#......#',
    '#...g.......f.......r.#',
    '#........#.....#......#',
    '####...###########...##',
    '#.....................#',
    'L..g...p.......p..g...#',
    '#.....................#',
    '#....s...........s....#',
    '#.......f.....f.......#',
    '#.....................#',
    '###########D###########',
  ],
};

export type InteriorId = keyof typeof LAYOUTS;

interface InteriorSpec {
  name: string;
  subtitle: string;
  floor: number;
  npc?: { kind: string; name: string };
}

const INTERIORS: Record<InteriorId, InteriorSpec> = {
  tavern: { name: 'The Sleeping Boar', subtitle: 'Warm ale, cold stew', floor: Ground.Wood, npc: { kind: 'innkeeper', name: 'Brann' } },
  smithy: { name: 'The Smithy', subtitle: 'Hilde’s forge', floor: Ground.Stone, npc: { kind: 'smith', name: 'Hilde' } },
  cottage: { name: 'Maren’s Cottage', subtitle: 'Someone left a chest unlocked', floor: Ground.Wood },
  crypt: { name: 'The Old Crypt', subtitle: 'The air smells of dust and grave-moss', floor: Ground.Crypt },
};

export interface Interior {
  level: Level;
  spawns: Spawn[];
  npcs: Array<{ kind: string; name: string; x: number; y: number }>;
}

const ENEMY_SPAWNS: Record<string, string> = { s: 'skeleton', r: 'archer', B: 'boss' };
const SOLID_PROPS: Record<string, number> = {
  t: Prop.Table, b: Prop.Barrel, x: Prop.Crate, a: Prop.Anvil, k: Prop.Bed, C: Prop.Chest, p: Prop.Pillar,
};

/** A room built from its text grid. The legend is in `LAYOUTS`' characters: see the cases below. */
export function buildInterior(id: InteriorId): Interior {
  const rows = LAYOUTS[id];
  const spec = INTERIORS[id];
  const width = rows[0]!.length;
  const height = rows.length;
  const map = createTileMap(width, height);
  map.ground.fill(spec.floor);
  const level: Level = {
    id, name: spec.name, subtitle: spec.subtitle, outdoor: false, map,
    start: { x: 0, y: 0 }, portals: [], lights: [], structures: [],
  };
  const interior: Interior = { level, spawns: [], npcs: [] };
  const fireColour = id === 'crypt' ? 'purple' : 'warm';

  rows.forEach((row, y) => {
    for (let x = 0; x < width; x++) {
      const ch = row[x]!;
      const i = tileIndex(map, x, y);
      const atFront = x === width - 1 || y === height - 1;
      if (ch === '#') setProp(map, x, y, atFront ? Prop.WallLow : Prop.Wall, true);
      else if (ch === 'L') {
        setProp(map, x, y, Prop.WallTorch, true);
        level.lights.push({
          x: x + (x === 0 ? 1.2 : 0.5), y: y + (y === 0 ? 1.2 : 0.5),
          radius: 3.4, intensity: 0.9, colour: 'warm', flicker: 1, seed: i,
        });
      } else if (ch === 'D') {
        setProp(map, x, y, Prop.Doorway, false);
        level.portals.push({ tx: x, ty: y, to: 'town', stepOut: { x: 0, y: -0.9 } });
        level.start = { x: x + 0.5, y: y - 0.4 };
        level.lights.push({ x: x + 0.5, y: y - 0.2, radius: 1.8, intensity: 0.5, colour: 'cold', flicker: 0, seed: 0 });
      } else if (ch === 'f') {
        setProp(map, x, y, Prop.Brazier, true);
        level.lights.push({ x: x + 0.5, y: y + 0.5, radius: 3.6, intensity: 1, colour: fireColour, flicker: 1.2, seed: i });
      } else if (ch === 'g') setProp(map, x, y, Prop.Bones, false);
      else if (SOLID_PROPS[ch] !== undefined) setProp(map, x, y, SOLID_PROPS[ch]!, true);
      else if (ENEMY_SPAWNS[ch]) interior.spawns.push({ kind: ENEMY_SPAWNS[ch]!, x: x + 0.5, y: y + 0.5 });
      else if (ch === 'n' && spec.npc) interior.npcs.push({ ...spec.npc, x: x + 0.5, y: y + 0.5 });
    }
  });
  return interior;
}

export const INTERIOR_IDS = Object.keys(LAYOUTS) as InteriorId[];
