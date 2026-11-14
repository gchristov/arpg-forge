import type { Vec2 } from '../core/math';
import type { Level, LevelLight } from '../world/level';
import { createTileMap, setProp, tileIndex } from '../world/tile-map';
import type { Container, LevelContent } from './content';

/** What one character in a room's rows puts on its tile. Characters missing from the key are an error. */
export interface RoomKey {
  prop?: number;
  solid?: boolean;
  /** The prop used instead on the room's front edges (bottom and right), such as a low wall the camera sees over. */
  frontProp?: number;
  /**
   * A light at the tile's centre, moved by `offset`. `lean` pulls it that far into the room when the tile is on the
   * room's edge, such as a torch on a wall.
   */
  light?: Omit<LevelLight, 'x' | 'y' | 'seed'> & { offset?: Vec2; lean?: number };
  /** A way out to another level. The hero starts the room at the tile's centre plus `start`. */
  portal?: { to: string; stepOut: Vec2; start: Vec2 };
  /** The hero starts here, for a room that's the first level rather than one entered through a portal. */
  heroStart?: boolean;
  /** An enemy of this kind spawns here. */
  spawn?: string;
  npc?: { kind: string; name: string };
  /** A container, such as a chest, holding this much. */
  container?: Pick<Container, 'gold' | 'healingItems'>;
}

export interface RoomSpec {
  id: string;
  name: string;
  subtitle: string;
  /** Ground kind for every tile. */
  floor: number;
  /** One string per row of tiles, every row the same length; each character is looked up in `key`. */
  rows: readonly string[];
  key: Readonly<Record<string, RoomKey>>;
}

/** An indoor level drawn as text: a game writes its rooms as rows of characters and says what each one means. */
export function roomFromRows(spec: RoomSpec): LevelContent {
  const { rows } = spec;
  const width = rows[0]!.length;
  const height = rows.length;
  const map = createTileMap(width, height);
  map.ground.fill(spec.floor);
  const level: Level = {
    id: spec.id, name: spec.name, subtitle: spec.subtitle, outdoor: false, map,
    start: { x: 0, y: 0 }, portals: [], lights: [], structures: [],
  };
  const room: LevelContent = { level, spawns: [], camps: [], npcs: [], containers: [] };

  rows.forEach((row, y) => {
    if (row.length !== width) throw new Error(`${spec.id}: row ${y} is ${row.length} wide, not ${width}`);
    for (let x = 0; x < width; x++) {
      const ch = row[x]!;
      const key = spec.key[ch];
      if (!key) throw new Error(`${spec.id}: nothing in the key for "${ch}" at (${x}, ${y})`);
      const i = tileIndex(map, x, y);
      const atFront = x === width - 1 || y === height - 1;
      const prop = atFront && key.frontProp !== undefined ? key.frontProp : key.prop;
      if (prop !== undefined || key.solid) setProp(map, x, y, prop ?? 0, Boolean(key.solid));
      if (key.light) {
        const { offset, lean = 0, ...light } = key.light;
        const leanX = x === 0 ? lean : x === width - 1 ? -lean : 0;
        const leanY = y === 0 ? lean : y === height - 1 ? -lean : 0;
        level.lights.push({ ...light, x: x + 0.5 + (offset?.x ?? 0) + leanX, y: y + 0.5 + (offset?.y ?? 0) + leanY, seed: i });
      }
      if (key.portal) {
        level.portals.push({ tx: x, ty: y, to: key.portal.to, stepOut: key.portal.stepOut });
        level.start = { x: x + 0.5 + key.portal.start.x, y: y + 0.5 + key.portal.start.y };
      }
      if (key.heroStart) level.start = { x: x + 0.5, y: y + 0.5 };
      if (key.spawn) room.spawns.push({ kind: key.spawn, x: x + 0.5, y: y + 0.5 });
      if (key.npc) room.npcs.push({ ...key.npc, x: x + 0.5, y: y + 0.5 });
      if (key.container) room.containers!.push({ tx: x, ty: y, ...key.container });
    }
  });
  return room;
}
