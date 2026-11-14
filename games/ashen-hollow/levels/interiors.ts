import type { Container, LevelContent } from '../../../engine/sim/content';
import { roomFromRows, type RoomKey } from '../../../engine/sim/rooms';
import { Ground, Prop } from '../content/tiles';

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

/** What the cottage chest holds. */
const CHEST: Pick<Container, 'gold' | 'healingItems'> = { gold: 45, healingItems: 2 };

/** What each character in `LAYOUTS` means. Braziers burn purple in the crypt. */
function roomKey(id: InteriorId, npc: InteriorSpec['npc']): Record<string, RoomKey> {
  const solid = (prop: number): RoomKey => ({ prop, solid: true });
  return {
    '.': {},
    '#': { prop: Prop.Wall, frontProp: Prop.WallLow, solid: true },
    L: { prop: Prop.WallTorch, solid: true, light: { radius: 3.4, intensity: 0.9, colour: 'warm', flicker: 1, lean: 0.7 } },
    D: {
      prop: Prop.Doorway,
      portal: { to: 'town', stepOut: { x: 0, y: -0.9 }, start: { x: 0, y: -0.9 } },
      light: { radius: 1.8, intensity: 0.5, colour: 'cold', flicker: 0, offset: { x: 0, y: -0.7 } },
    },
    f: { prop: Prop.Brazier, solid: true, light: { radius: 3.6, intensity: 1, colour: id === 'crypt' ? 'purple' : 'warm', flicker: 1.2 } },
    g: { prop: Prop.Bones },
    t: solid(Prop.Table), b: solid(Prop.Barrel), x: solid(Prop.Crate), a: solid(Prop.Anvil), k: solid(Prop.Bed), p: solid(Prop.Pillar),
    C: { ...solid(Prop.Chest), container: CHEST },
    s: { spawn: 'skeleton' }, r: { spawn: 'archer' }, B: { spawn: 'boss' },
    n: npc ? { npc } : {},
  };
}

export function buildInterior(id: InteriorId): LevelContent {
  const spec = INTERIORS[id];
  return roomFromRows({ id, ...spec, rows: LAYOUTS[id], key: roomKey(id, spec.npc) });
}

export const INTERIOR_IDS = Object.keys(LAYOUTS) as InteriorId[];
