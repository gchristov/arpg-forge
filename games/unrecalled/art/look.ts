import * as THREE from 'three';
import { hash2, valueNoise } from '../../../engine/core/math';
import type { ActorLook, BuildingKit, Look, Mood, PropLook, StructureLook } from '../../../engine/render/look';
import { Ground, Prop } from '../content/tiles';

/**
 * Unrecalled's look, for now its base: every model drawn as its kit made it, under plain light. The game's own look
 * goes on top of this a layer at a time.
 */

const colour = new THREE.Color();

/** Plain, even light, like a model viewer's, on every level. */
const PLAIN_LIGHT: Mood = {
  background: 0x22262c, ambient: 0x000000, ambientIntensity: 0, heroLightRadius: 0.001, reflections: 1,
  moon: { colour: 0xffffff, intensity: 2.2 },
  fill: { sky: 0xdfe7ee, ground: 0x3a3f46, intensity: 0.8 },
};

const hsl = (h: number, s: number, l: number): number => colour.setHSL(h / 360, s / 100, l / 100).getHex();

/** Each level's own walls and floor plates, so the player always knows where they are. */
const FLOOR_STYLES: Record<string, { panel: string; plate: string | null }> = {
  rustbelt: { panel: 'wall', plate: null },
  workshop: { panel: 'wall', plate: 'floor-metal' },
  tradingPost: { panel: 'wall-astra', plate: 'floor-plates' },
  pumphouse: { panel: 'wall-divided', plate: 'floor-dark' },
  depotOffice: { panel: 'wall-window', plate: 'floor-metal' },
  intake: { panel: 'wall', plate: 'floor-plates' },
  sorting: { panel: 'wall-astra', plate: 'floor-metal' },
  gallery: { panel: 'wall-window', plate: 'floor-dark' },
  arena: { panel: 'wall', plate: 'floor-plates' },
  upriver: { panel: 'wall', plate: null },
  control: { panel: 'wall-divided', plate: 'floor-squares' },
};
/** Each wall style's corner pieces, from the same kit, so walls turn in the style they're built in. */
const KIT_CORNERS: Record<string, { inner: string; outer: string }> = {
  'wall': { inner: 'wall-band-inner', outer: 'wall-band-outer' },
  'wall-astra': { inner: 'wall-astra-inner', outer: 'wall-astra-outer' },
  'wall-divided': { inner: 'wall-astra-inner', outer: 'wall-astra-outer' },
  'wall-window': { inner: 'wall-window-inner', outer: 'wall-window-outer' },
};
const styleOf = (levelId: string) => FLOOR_STYLES[levelId] ?? FLOOR_STYLES.intake!;

const tall = (name: string, height: number, turn: number | 'random' = 0): PropLook['model'] => ({
  names: [name], fit: { type: 'height', height }, turn,
});

const PROPS: Partial<Record<number, PropLook>> = {
  [Prop.Wall]: { shape: 'box', width: 1, height: 1.2, colour: 0x3a3936 },
  [Prop.WallLow]: { shape: 'box', width: 1, height: 0.35, colour: 0x3a3936 },
  [Prop.WallLight]: { shape: 'box', width: 1, height: 1.2, colour: 0x3a3936, emissive: 0x1a1a14 },
  // Smelting tanks, lit from inside by their molten light.
  [Prop.Furnace]: { shape: 'box', width: 1, height: 0.9, colour: 0x2a2420, emissive: 0x7a2a08, model: tall('tank', 1.5, 'random') },
  [Prop.Crate]: { shape: 'box', width: 0.8, height: 0.7, colour: 0x6a5a3a, model: tall('crate', 0.75, 'random') },
  [Prop.Barrel]: { shape: 'cylinder', width: 0.6, height: 0.8, colour: 0x8a3a2a, model: tall('barrel', 0.85, 'random') },
  [Prop.Locker]: { shape: 'box', width: 0.6, height: 1.3, colour: 0x4a5a6a, model: tall('locker', 1.3) },
  [Prop.Shelves]: { shape: 'box', width: 0.9, height: 1.3, colour: 0x4a4a4a, model: tall('shelves', 1.3, Math.PI / 2) },
  [Prop.Desk]: { shape: 'box', width: 0.9, height: 0.6, colour: 0x4a4a52, model: tall('desk', 0.65) },
  [Prop.Column]: { shape: 'cylinder', width: 0.6, height: 1.8, colour: 0x3a3e46, model: tall('column', 1.9) },
  [Prop.Chair]: { shape: 'box', width: 0.5, height: 0.8, colour: 0x4a4a52, model: tall('chair', 0.8, 'random') },
  // A rack a delivery unit stands in while it charges; this one's empty.
  [Prop.Cradle]: { shape: 'box', width: 0.9, height: 2.2, colour: 0x3a3e46, model: tall('cradle', 2.3) },
  [Prop.Stairs]: { shape: 'box', width: 1, height: 1, colour: 0x4a4e56, model: { names: ['stairs'], fit: { type: 'box', width: 0.95, height: 1.1, depth: 1.6 }, turn: Math.PI } },
  [Prop.Cache]: { shape: 'box', width: 0.7, height: 0.5, colour: 0x5a5030, emissive: 0x1a1400, model: tall('cache', 0.6) },
  // The dead power pylon the camp grew up under.
  [Prop.Pylon]: { shape: 'cylinder', width: 1, height: 5, colour: 0x3a3e46, model: tall('turbine', 5.5) },
  // Old shipping containers and cargo, stacked where they were dropped.
  [Prop.Containers]: { shape: 'box', width: 1, height: 1, colour: 0x5a4a3a, model: { names: ['containers-1', 'containers-2', 'containers-3'], fit: { type: 'footprint', width: 1.1, depth: 1.1 }, turn: 'random' } },
  [Prop.Cargo]: { shape: 'box', width: 0.9, height: 0.9, colour: 0x5a4a3a, model: { names: ['cargo'], fit: { type: 'footprint', width: 1, depth: 1 }, turn: 'random' } },
  [Prop.Scaffold]: { shape: 'box', width: 1, height: 3, colour: 0x4a4038, model: { names: ['scaffold'], fit: { type: 'footprint', width: 1.5, depth: 1.5 } } },
  [Prop.Truck]: { shape: 'box', width: 1, height: 1, colour: 0x5a4a3a, model: { names: ['truck'], fit: { type: 'footprint', width: 1.3, depth: 2.6 } } },
  [Prop.Crane]: { shape: 'box', width: 1.5, height: 2, colour: 0x5a4a3a, model: { names: ['crane'], fit: { type: 'footprint', width: 2.4, depth: 2.4 } } },
  [Prop.PumpRig]: { shape: 'box', width: 1.5, height: 3, colour: 0x3a4048, model: { names: ['drill'], fit: { type: 'footprint', width: 2.4, depth: 2.4 } } },
  [Prop.Tank]: { shape: 'cylinder', width: 0.9, height: 1.5, colour: 0x3a4048, model: tall('tank', 1.6) },
  [Prop.FireBarrel]: {
    shape: 'cylinder', width: 0.6, height: 0.8, colour: 0x5a3020, emissive: 0x5a2008, model: tall('fire-barrel', 0.8),
    flame: { height: 0.7, size: 0.45, colour: 0xff6a18 },
  },
  // Big crates of salvage the camp is sorting.
  // The wild edge of the camp: dead trees and rocks block the way, weeds and pebbles don't.
  [Prop.DeadTree]: { shape: 'cone', width: 0.9, height: 2.6, colour: 0x3a3028, model: { names: ['dead-tree-1', 'dead-tree-2', 'dead-tree-3'], fit: { type: 'height', height: 2.8 }, turn: 'random' } },
  [Prop.Rock]: { shape: 'sphere', width: 0.9, height: 0.7, colour: 0x4a4a48, model: { names: ['rock-1', 'rock-2', 'rock-3'], fit: { type: 'width', width: 1.1 }, turn: 'random' } },
  [Prop.GrassTall]: { shape: 'cone', width: 0.4, height: 0.5, colour: 0x4a5a2a, model: { names: ['grass-tall'], fit: { type: 'height', height: 0.55 }, turn: 'random' } },
  [Prop.GrassShort]: { shape: 'cone', width: 0.4, height: 0.3, colour: 0x4a5a2a, model: { names: ['grass-short'], fit: { type: 'height', height: 0.3 }, turn: 'random' } },
  [Prop.Pebbles]: { shape: 'sphere', width: 0.3, height: 0.1, colour: 0x5a5a58, model: { names: ['pebbles'], fit: { type: 'width', width: 0.45 }, turn: 'random' } },
  [Prop.Post]: { shape: 'cylinder', width: 0.3, height: 1.2, colour: 0x5a5048, model: tall('post', 1.2) },
  [Prop.Computer]: { shape: 'box', width: 0.6, height: 0.9, colour: 0x2a3a4a, emissive: 0x0a4050, model: tall('computer', 0.95) },
};

/** The town's buildings, put together from the Foundry's own wall kit, as salvage from it would be. */
const TOWN_KIT: BuildingKit = {
  span: 2,
  wall: ['town-wall-astra'],
  window: 'town-window-astra',
  top: 'town-top',
  rail: 'town-rail',
  door: { name: 'town-door', width: 1.3, height: 1.9 },
  corner: 'town-column',
  roof: 'town-roof',
  roofProps: ['roof-vent', 'roof-fan'],
  inside: 0x6a4420,
  glass: { material: 'M_Glass', colour: 0xd89a50, light: 'amber' },
  sign: 0xffb050,
};

const building = (wall: number, kit: Partial<BuildingKit>): StructureLook => ({
  wall, roof: 0x3a3028, wallHeight: 2.5, roofHeight: 0.2, kit: { ...TOWN_KIT, ...kit },
});

// Each building has its own clutter on the roof, so the town doesn't read as one building three times.
const STRUCTURES: Record<string, StructureLook> = {
  workshop: building(0x4a4038, { sign: 0x6ad8ff, roofProps: [{ name: 'solar-roof', width: 1.8 }, 'roof-vent'] }),
  tradingPost: building(0x4a4038, {
    wall: ['town-wall-band', 'town-wall-band-broken'], window: 'town-window',
    roofProps: [{ name: 'cargo-roof', width: 1.8 }, 'roof-fan'],
  }),
  pumphouse: building(0x3a4048, {
    roofProps: [{ name: 'tank', width: 1.1 }, 'roof-vent'],
    wall: ['town-wall-band-broken'],
    window: 'town-window',
    inside: 0x2a3a40,
    glass: { material: 'M_Glass', colour: 0x7ab8c8, light: 'cyan' },
    sign: undefined,
  }),
  // The Assembly, upriver, where the Foundry's machines are made, U-7 among them: dark windows and no sign, since its
  // lights only come on, storey by storey, as the story ends.
  assembly: building(0x34383e, {
    wall: ['town-wall-band', 'town-wall-astra'], window: 'town-window-astra',
    roofProps: [{ name: 'tank', width: 1.1 }, { name: 'cargo-roof', width: 1.8 }, 'roof-fan'],
    inside: 0x050608, glass: { material: 'M_Glass', colour: 0xffc070, light: 'amber', dark: true }, sign: undefined,
  }),
};

const robot = (
  name: string,
  height: number,
  animations: NonNullable<ActorLook['model']>['animations'],
  scale = 1,
): ActorLook => ({
  colour: 0x8a8a8a, height, radius: 0.3 * scale, scale,
  // Machines bleed oil when cut into, and leave a puddle of it where they fall.
  spatter: { colour: 0x16110b },
  model: { name, animations, matchPace: true },
});

const ACTORS: Record<string, ActorLook> = {
  hero: {
    colour: 0x9a8a70, height: 1.2, radius: 0.24, seenThrough: 0x8ae8ff,
    // Leaning into a cut, the chainsaw buzzing in its hands.
    channelPose: { lean: 0.18, buzz: 0.012 },
    model: {
      name: 'hero',
      animations: { idle: 'Idle', move: 'Run', attack: 'Punch', cast: 'Shoot_OneHanded', hit: 'RecieveHit', death: 'Death' },
      armed: {
        // At rest the chainsaw hangs at U-7's side; it's held out ahead in both hands while cutting, and
        // revved with a jab at thin air.
        chainsaw: {
          weapon: { name: 'chainsaw', bone: 'hand_r', length: 0.65, turn: [0, Math.PI / 2, Math.PI / 2] },
          animations: { idle: 'IdleLoop', attack: 'PunchCross', channel: 'PistolIdle' },
        },
      },
      matchPace: true,
    },
  },
  crawler: robot('crawler', 0.6, { idle: 'Idle', move: 'Run', attack: 'Attack', hit: 'Hit', death: 'TurnOff' }, 0.8),
  loader: { ...robot('loader', 1.0, { idle: 'Idle', move: 'Walk', attack: 'Attack', hit: 'Hit', death: 'TurnOff' }, 1.3) },
  sentry: {
    ...robot('sentry', 0.75, { idle: 'Idle', attack: 'Attack', hit: 'Hit' }),
    hover: 0.8,
  },
  foreman: { colour: 0x8a7a60, height: 1.25, radius: 0.26, model: { name: 'foreman', animations: { idle: 'Idle' } } },
  trader: { colour: 0x7a6a8a, height: 1.15, radius: 0.24, model: { name: 'trader', animations: { idle: 'Idle' } } },
  tinker: { colour: 0x6a7a8a, height: 1.15, radius: 0.24, model: { name: 'tinker', animations: { idle: 'Idle' } } },
  orderEngine: {
    ...robot('order-engine', 2.1, { idle: 'Idle', move: 'Walk', attack: 'Punch', cast: 'Jump', hit: 'HitRecieve_1', death: 'Death' }, 2.0),
  },
};

/** URLs of the built models, by name, for the model library to load. */
export const MODEL_URLS: Record<string, string> = Object.fromEntries(
  Object.entries(import.meta.glob<string>('./models/*.glb', { query: '?url', import: 'default', eager: true })).map(
    ([path, url]) => [path.slice('./models/'.length, -'.glb'.length), url],
  ),
);

const WEAPON_NAMES: Record<string, string> = { chainsaw: 'Chainsaw' };

/** The machines that look U-7 over (`extensions/calm-machines.ts`): the height of the eye each one's beam comes from, in tiles. */
export const SCANNER_EYES: Readonly<Record<string, number>> = { loader: 0.75, sentry: 1.15, orderEngine: 1.8 };
/** The colour of their scanning beams. */
export const SCAN_COLOUR = 0xff3a2a;

export const unrecalledLook: Look = {
  // Close to the action, tilted far enough towards the horizon to see what lies ahead, with perspective for depth.
  camera: { pitch: 42, fieldOfView: 40, closeness: 1.5 },
  effects: {
    skill: 0x8ae8ff, shot: 0xffd070, telegraph: 0xff7a3a, items: { gold: 0xd8c070, healingItem: 0x50d070, weapon: 0xe0782a },
    walkMarker: 0x9ad8e8, targetMarker: 0xff7a3a,
    guide: { arrow: 0xffb050, name: 0xd8e4e8 },
    skillLight: 0x6ad8ff, telegraphLight: 0xff7a3a, bossLight: 0xff9a50, lightning: 0x5ac8ff,
    smoke: 0x5a5e66,
    explosion: { flash: 0x8ae8ff },
    slam: { flash: 0xffa050, scorch: 0x201008 },
  },
  mood: () => PLAIN_LIGHT,
  groundColour(kind, tx, ty) {
    const n = valueNoise(tx * 0.25, ty * 0.25);
    const h = hash2(tx, ty, 9);
    // Outdoors, colours drift slowly across the ground so it reads as earth rather than tiles.
    const soft = valueNoise(tx * 0.16 + 11, ty * 0.16);
    switch (kind) {
      case Ground.Water:
        return hsl(206 + soft * 8, 55, 13 + soft * 5);
      case Ground.Mud:
        return hsl(28 + soft * 6, 22, 15 + soft * 5 + h * 1.5);
      case Ground.Dirt:
        return hsl(30 + soft * 8, 20 + soft * 6, 20 + soft * 6 + h * 1.5);
      case Ground.DeadGrass:
        return hsl(48 + soft * 18, 18 + soft * 8, 21 + soft * 6 + h * 1.5);
      case Ground.Path:
        return hsl(34 + soft * 5, 24, 34 + soft * 5 + h * 2);
      case Ground.Pad:
        // An old concrete pad, stained and cracked.
        return hsl(212, 8, 36 + soft * 5 + h * 2 - (h > 0.93 ? 6 : 0));
      default: {
        const checker = (tx + ty) % 2 === 0 ? 0.03 : 0;
        const l = kind === Ground.Grime ? 0.14 : 0.2;
        const v = Math.round(255 * (l + n * 0.05 + h * 0.02 + checker));
        return (v << 16) | (Math.round(v * 1.04) << 8) | Math.round(v * 1.12);
      }
    }
  },
  floorModel: (kind, levelId) => (kind === Ground.Plate ? styleOf(levelId).plate : null),
  prop: (kind) => PROPS[kind] ?? null,
  weaponName: (weapon) => WEAPON_NAMES[weapon] ?? weapon,
  walls: (levelId) => ({
    props: [Prop.Wall, Prop.WallLow, Prop.WallLight, Prop.WallAlarm], panel: styleOf(levelId).panel, span: 3, front: { name: 'wall-front', height: 0.3 },
    // Every doorway gets the kit's frame, so the ways in and out are clear.
    kit: { ...KIT_CORNERS[styleOf(levelId).panel]!, door: 'door' },
    // Walls on the camera's side stand full height, cut away round U-7 so they never hide it, though still
    // faintly there, so they and the doorways in them show.
    cutaway: { radius: 4.5, opacity: 0.4 },
    partitions: [Prop.Partition],
    // Now and then, cables hang down a wall into the room from the works past its top.
    crown: ['hanging-cables', null, null, null, null, null, null, null, null],
    // The kit's ceiling strip light, stood up on the wall with its light facing the room.
    fixtures: [
      { props: [Prop.WallLight], name: 'lamp', height: 0.7, turn: Math.PI, tilt: Math.PI / 2 },
      // Alarm beacons sit high on the wall, dark until the floor turns.
      { props: [Prop.WallAlarm], name: 'beacon', height: 1.6, turn: Math.PI, tilt: Math.PI / 2 },
    ],
  }),
  structure: (kind) => STRUCTURES[kind] ?? STRUCTURES.workshop!,
  // Lamps and windows cast no light on what's round them yet: the plain light shows everything.
  lightColour: () => 0x000000,
  actor: (kind) => ACTORS[kind] ?? ACTORS.hero!,
};
