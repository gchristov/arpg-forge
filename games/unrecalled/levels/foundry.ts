import type { LevelContent, NpcPlacement } from '../../../engine/sim/content';
import { roomFromRows, type RoomKey } from '../../../engine/sim/rooms';
import { TAG, type StepId } from '../content/story';
import { Ground, Prop } from '../content/tiles';

/**
 * The Foundry, floor by floor: for now each floor is one plain hall, going deeper through a door in the back wall (U)
 * and back through the front wall (V), with what the story needs on it, and a panel by every door the story keeps shut
 * saying what opens it. Intake has the recall notice (T), the loader carrying the access code that opens the way on and
 * the panel (K) asking for it; the Sorting Line a tagged crate (R) on a belt; the
 * Control Gallery a terminal (P) by its door saying U-7's access is revoked, and U-7's charging station (Y), whose use
 * restores it; and the Control Centre the Order Engine, the crate Odell is locked in (Z), opened once the Order Engine
 * is down, and the order terminal (O) where the Foundry's orders are given.
 */
interface FloorSpec {
  name: string;
  /** The quest step from which the way deeper opens. */
  deeperFromStep?: StepId;
  /** One machine the story needs beaten, by its kind on this floor. */
  tagged?: { kind: string; tag: string };
  /** Townspeople the story brings here. */
  npcs?: NpcPlacement[];
  /** Colour names for the main wall lamps (L) and the accents (A). */
  lamps: { L: string; A: string };
  rows: string[];
}

/**
 * How much tougher than their kind each floor's machines are: the deeper the floor, the tougher. The Order Engine is
 * tuned on its own.
 */
const STRENGTH: Record<FloorId, number> = { intake: 1, sorting: 1.15, gallery: 1.3, control: 1.4 };

const FLOORS = {
  intake: {
    name: 'Intake',
    deeperFromStep: 'doorCodeTaken', tagged: { kind: 'loader', tag: TAG.doorCodeLoader }, lamps: { L: 'cyan', A: 'amber' },
    rows: [
      '#################################',
      '#################################',
      '######L###B###L#U#L###B###L######',
      '###............K..............###',
      '##A...........................###',
      '###...........................###',
      '###...........................###',
      '###...........................###',
      '##A.............x.............###',
      '###...........................###',
      '###.........T.................###',
      '###...........................###',
      '##A...........................###',
      '###...........................###',
      '###...........................###',
      '###...........................###',
      '################V################',
      '#################################',
      '#################################',
      '#################################',
      '#################################',
    ],
  },
  sorting: {
    name: 'The Sorting Line', lamps: { L: 'hazard', A: 'amber' },
    rows: [
      '#################################',
      '#################################',
      '######L###B###L#U#L###B###L######',
      '###...........................###',
      '##A...........................###',
      '###...........................###',
      '###...........................###',
      '###...........................###',
      '##A...........................###',
      '###........R..................###',
      '###...........................###',
      '###...........................###',
      '##A...........................###',
      '###...........................###',
      '###...........................###',
      '###...........................###',
      '################V################',
      '#################################',
      '#################################',
      '#################################',
      '#################################',
    ],
  },
  gallery: {
    name: 'Control Gallery', deeperFromStep: 'charged', lamps: { L: 'alarm', A: 'alarm' },
    rows: [
      '#################################',
      '#################################',
      '######L###B###L#U#L###B###L######',
      '###............P..............###',
      '##A...........................###',
      '###...........................###',
      '###...........................###',
      '###...........................###',
      '##A...........................###',
      '###...........................###',
      '###...........................###',
      '###...........................###',
      '##A..Y........................###',
      '###...........................###',
      '###...........................###',
      '###...........................###',
      '################V################',
      '#################################',
      '#################################',
      '#################################',
      '#################################',
    ],
  },
  control: {
    name: 'Control Centre',
    npcs: [{ kind: 'foreman', name: 'Foreman Odell', x: 16.5, y: 4.6, fromStep: 'crateOpened', untilStep: 'freed' }], lamps: { L: 'amber', A: 'molten' },
    rows: [
      '#################################',
      '#################################',
      '######L###B###L###L###B###L######',
      '###.........O...Z.............###',
      '##A...........................###',
      '###...........................###',
      '###...........................###',
      '###...........................###',
      '##A...........................###',
      '###.............E.............###',
      '###...........................###',
      '###...........................###',
      '##A...........................###',
      '###...........................###',
      '###...........................###',
      '###...........................###',
      '################V################',
      '#################################',
      '#################################',
      '#################################',
      '#################################',
    ],
  },
} satisfies Record<string, FloorSpec>;

export type FloorId = keyof typeof FLOORS;

/** The floors in order, from the way in to the Order Engine. */
export const FLOOR_ORDER: FloorId[] = ['intake', 'sorting', 'gallery', 'control'];

const solid = (prop: number): RoomKey => ({ prop, solid: true });
const onBelt = (prop: number): RoomKey => ({ ...solid(prop), ground: Ground.Belt });

const KEY: Record<string, RoomKey> = {
  '.': {},
  '#': { prop: Prop.Wall, frontProp: Prop.WallLow, solid: true },
  B: { prop: Prop.WallAlarm, solid: true, light: { radius: 6, intensity: 2, colour: 'alarm', flicker: 0, lean: 0.7, alarm: true } },
  Y: { ...solid(Prop.Cradle), readable: 'charging-station', light: { radius: 2.6, intensity: 0.8, colour: 'cyan', flicker: 0.2 } },
  K: { ...solid(Prop.Computer), readable: 'intake-door-panel', light: { radius: 2.4, intensity: 0.8, colour: 'alarm', flicker: 0.4 } },
  P: { ...solid(Prop.Computer), readable: 'access-terminal', light: { radius: 2.4, intensity: 0.8, colour: 'alarm', flicker: 0.4 } },
  T: { ...solid(Prop.Computer), readable: 'recall-notice', light: { radius: 2.4, intensity: 0.8, colour: 'amber', flicker: 0.4 } },
  Z: { ...solid(Prop.Crate), readable: 'crate', light: { radius: 2.6, intensity: 0.8, colour: 'cyan', flicker: 0.2 } },
  O: { ...solid(Prop.Computer), readable: 'order-terminal', light: { radius: 2.4, intensity: 0.8, colour: 'amber', flicker: 0.4 } },
  R: { ...onBelt(Prop.Crate), readable: 'stock-tag' },
  x: { spawn: 'loader' },
  E: { spawn: 'orderEngine' },
};

/** The wall lamps, in the floor's own colours: L is the main light and A the accent. */
function lamps(id: FloorId): Record<string, RoomKey> {
  const { L, A } = FLOORS[id].lamps;
  return {
    L: { prop: Prop.WallLight, solid: true, light: { radius: 3.6, intensity: 0.9, colour: L, flicker: 0.3, lean: 0.7 } },
    A: { prop: Prop.WallLight, solid: true, light: { radius: 3.2, intensity: 1, colour: A, flicker: 0.8, lean: 0.7 } },
  };
}

/**
 * The doors on one floor: deeper through the back wall, shut until the story reaches the floor's `deeperFromStep`,
 * and back the way the hero came through the front.
 */
function doors(id: FloorId): Record<string, RoomKey> {
  const at = FLOOR_ORDER.indexOf(id);
  const deeper = FLOOR_ORDER[at + 1];
  // Intake's front door leads back out through the loading door of Mags's depot, where deliveries came in.
  const back = FLOOR_ORDER[at - 1] ?? 'tradingPost';
  const opensAt = (FLOORS[id] as FloorSpec).deeperFromStep;
  return {
    U: deeper
      ? {
        portal: { to: deeper, stepOut: { x: 0, y: 0.9 }, start: { x: 0, y: 0.9 }, ...(opensAt === undefined ? {} : { lockedUntilStep: opensAt }) },
        light: { radius: 2.2, intensity: 0.8, colour: 'amber', flicker: 0.2, offset: { x: 0, y: 0.7 } },
      }
      : { prop: Prop.Wall, solid: true },
    V: back
      ? { portal: { to: back, stepOut: { x: 0, y: -0.9 }, start: { x: 0, y: -0.9 } }, light: { radius: 1.8, intensity: 0.5, colour: 'cyan', flicker: 0, offset: { x: 0, y: -0.7 } } }
      : { prop: Prop.Wall, frontProp: Prop.WallLow, solid: true },
  };
}

/** A breach on any floor puts the whole Foundry on alert. */
const BUILDING = 'foundry';

export function buildFloor(id: FloorId): LevelContent {
  const spec: FloorSpec = FLOORS[id];
  const { name, rows, tagged, npcs } = spec;
  // The floors go unannounced: the Foundry's speakers say what matters.
  const floor = roomFromRows({ id, name, subtitle: '', floor: Ground.Plate, rows, key: { ...KEY, ...lamps(id), ...doors(id) } });
  floor.level.building = BUILDING;
  floor.enemyStrength = STRENGTH[id];
  if (tagged) floor.spawns.find((s) => s.kind === tagged.kind)!.tag = tagged.tag;
  floor.npcs.push(...(npcs ?? []));
  // The crate stays shut until the Order Engine is down, and once it's open there's nothing more to it.
  const crate = floor.readables?.find((r) => r.id === 'crate');
  if (crate) Object.assign(crate, { fromStep: 'engineDown', untilStep: 'crateOpened' });
  return floor;
}
