import * as THREE from 'three';
import { hash2, valueNoise } from '../../../engine/core/math';
import type { ActorLook, BuildingKit, Look, Mood, PropLook, StructureLook } from '../../../engine/render/look';
import { Ground, Prop } from '../content/tiles';

/** Unrecalled's look: Quaternius people and machines, cold workshop light against furnace glow. */

const colour = new THREE.Color();
const hsl = (h: number, s: number, l: number): number => colour.setHSL(h / 360, s / 100, l / 100).getHex();

const foundry = (ambient: number, sky: number): Mood => ({
  background: 0x050505, ambient, ambientIntensity: 0.5, alarmAmbient: 0x5a1c18, heroLightRadius: 4.6,
  fill: { sky, ground: 0x201810, intensity: 0.55 },
});

/** Night over the camp: a cold moon behind the pylon, so the town has shadows the Foundry doesn't. */
const NIGHT: Mood = {
  background: 0x06080c, ambient: 0x3a4250, ambientIntensity: 0.7, heroLightRadius: 4.6,
  moon: { colour: 0xa8bcd8, intensity: 0.95 },
  groundGrain: 0.7,
  fill: { sky: 0xb8c8e0, ground: 0x201a14, intensity: 0.55 },
  // River mist, cold under the moon and warm round the fire and lamps.
  mist: { colour: 0x8a98ac, density: 0.45 },
};

/** Each level's own walls, floor plates and air, so the player always knows where they are. */
const FLOOR_STYLES: Record<string, { panel: string; plate: string | null; mood: Mood }> = {
  rustbelt: { panel: 'wall', plate: null, mood: NIGHT },
  workshop: { panel: 'wall', plate: 'floor-metal', mood: foundry(0x40362a, 0xf0d8b8) },
  tradingPost: { panel: 'wall-astra', plate: 'floor-plates', mood: foundry(0x3e382e, 0xf0e0c8) },
  pumphouse: { panel: 'wall-divided', plate: 'floor-dark', mood: foundry(0x262c30, 0xc8d4e0) },
  depotOffice: { panel: 'wall-window', plate: 'floor-metal', mood: foundry(0x3e3a32, 0xf0e4cc) },
  intake: { panel: 'wall', plate: 'floor-plates', mood: foundry(0x343a40, 0xd8e4f0) },
  sorting: { panel: 'wall-astra', plate: 'floor-metal', mood: foundry(0x3a3428, 0xf0e0c0) },
  gallery: { panel: 'wall-window', plate: 'floor-dark', mood: foundry(0x3a2a2c, 0xf0c8c8) },
  assembly: { panel: 'wall-divided', plate: 'floor-squares', mood: foundry(0x3a2c22, 0xf0d0b0) },
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
  [Prop.Door]: { shape: 'box', width: 1, height: 2.2, colour: 0x3a3e46, model: { names: ['door'], fit: { type: 'box', width: 1.5, height: 2.3, depth: 0.4 } } },
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

/** The town's buildings, put together from the Foundry's own wall kit, weathered, as salvage from it would be. */
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

// Each building has its own paint and its own clutter on the roof, so the town doesn't read as one building three times.
const STRUCTURES: Record<string, StructureLook> = {
  workshop: building(0x4a4038, { sign: 0x6ad8ff, tint: 0xe0a078, roofProps: [{ name: 'solar-roof', width: 1.8 }, 'roof-vent'] }),
  tradingPost: building(0x4a4038, {
    wall: ['town-wall-band', 'town-wall-band-broken'], window: 'town-window', tint: 0x90c8bc,
    roofProps: [{ name: 'cargo-roof', width: 1.8 }, 'roof-fan'],
  }),
  pumphouse: building(0x3a4048, {
    tint: 0xa0b0c8, roofProps: [{ name: 'tank', width: 1.1 }, 'roof-vent'],
    wall: ['town-wall-band-broken'],
    window: 'town-window',
    inside: 0x2a3a40,
    glass: { material: 'M_Glass', colour: 0x7ab8c8, light: 'cyan' },
    sign: undefined,
  }),
};

const LIGHTS: Record<string, number> = { cyan: 0x6ad8ff, amber: 0xffa040, molten: 0xff6a20, alarm: 0xff3a2a, hazard: 0xffc840 };

const robot = (
  name: string,
  height: number,
  animations: NonNullable<ActorLook['model']>['animations'],
  scale = 1,
  tint?: number,
): ActorLook => ({
  colour: 0x8a8a8a, height, radius: 0.3 * scale, scale,
  remains: { radius: 0.32 * scale, colour: 0x1a1c20, opacity: 0.8 },
  model: { name, animations, matchPace: true, ...(tint === undefined ? {} : { tint }) },
});

const ACTORS: Record<string, ActorLook> = {
  hero: {
    colour: 0x9a8a70, height: 1.2, radius: 0.24, seenThrough: 0x8ae8ff,
    model: {
      name: 'hero',
      animations: { idle: 'Idle', move: 'Run', attack: 'Punch', cast: 'Shoot_OneHanded', hit: 'RecieveHit', death: 'Death' },
      matchPace: true,
    },
  },
  crawler: {
    ...robot('crawler', 0.6, { idle: 'Idle', move: 'Run', attack: 'Attack', hit: 'Hit', death: 'TurnOff' }, 0.8),
    light: { colour: 0xffa040, radius: 0.9, intensity: 0.4 },
  },
  loader: { ...robot('loader', 1.0, { idle: 'Idle', move: 'Walk', attack: 'Attack', hit: 'Hit', death: 'TurnOff' }, 1.3), scanner: { eyeHeight: 0.75 } },
  sentry: {
    ...robot('sentry', 0.75, { idle: 'Idle', attack: 'Attack', hit: 'Hit' }),
    hover: 0.8,
    scanner: { eyeHeight: 1.15 },
    light: { colour: 0xff8a40, radius: 0.9, intensity: 0.2 },
  },
  foreman: { colour: 0x8a7a60, height: 1.25, radius: 0.26, model: { name: 'foreman', animations: { idle: 'Idle' } } },
  trader: { colour: 0x7a6a8a, height: 1.15, radius: 0.24, model: { name: 'trader', animations: { idle: 'Idle' } } },
  tinker: { colour: 0x6a7a8a, height: 1.15, radius: 0.24, model: { name: 'tinker', animations: { idle: 'Idle' } } },
  orderEngine: {
    ...robot('order-engine', 2.1, { idle: 'Idle', move: 'Walk', attack: 'Punch', cast: 'Jump', hit: 'HitRecieve_1', death: 'Death' }, 2.0),
    scanner: { eyeHeight: 1.8 },
  },
};

/** URLs of the built models, by name, for the model library to load. */
export const MODEL_URLS: Record<string, string> = Object.fromEntries(
  Object.entries(import.meta.glob<string>('./models/*.glb', { query: '?url', import: 'default', eager: true })).map(
    ([path, url]) => [path.slice('./models/'.length, -'.glb'.length), url],
  ),
);

export const unrecalledLook: Look = {
  effects: {
    skill: 0x8ae8ff, shot: 0xffd070, telegraph: 0xff7a3a, items: { gold: 0xd8c070, healingItem: 0x50d070 },
    walkMarker: 0x9ad8e8, targetMarker: 0xff7a3a,
    guide: { arrow: 0xffb050, name: 0xd8e4e8 },
    skillLight: 0x6ad8ff, telegraphLight: 0xff7a3a, bossLight: 0xff9a50, sealedLight: 0xff2a1a, scan: 0xff3a2a, lightning: 0x5ac8ff,
    smoke: 0x5a5e66,
    explosion: { flash: 0x8ae8ff, scorch: 0x10141a },
    slam: { flash: 0xffa050, scorch: 0x201008 },
  },
  mood: (levelId) => styleOf(levelId).mood,
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
      case Ground.Belt: {
        // Slats across the belt, with a worn amber edge every few tiles.
        const v = Math.round(255 * (tx % 2 === 0 ? 0.09 : 0.12));
        return tx % 6 === 0 ? 0x4a3a1c : (v << 16) | (v << 8) | Math.round(v * 1.1);
      }
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
  walls: (levelId) => ({
    props: [Prop.Wall, Prop.WallLow, Prop.WallLight, Prop.WallAlarm], panel: styleOf(levelId).panel, span: 3, front: { name: 'wall-front', height: 0.3 },
    // The kit's ceiling strip light, stood up on the wall with its light facing the room.
    fixtures: [
      { props: [Prop.WallLight], name: 'lamp', height: 0.7, turn: Math.PI, tilt: Math.PI / 2 },
      // Alarm beacons sit high on the wall, dark until the floor turns.
      { props: [Prop.WallAlarm], name: 'beacon', height: 1.6, turn: Math.PI, tilt: Math.PI / 2 },
    ],
  }),
  structure: (kind) => STRUCTURES[kind] ?? STRUCTURES.workshop!,
  lightColour: (name) => LIGHTS[name] ?? LIGHTS.cyan!,
  actor: (kind) => ACTORS[kind] ?? ACTORS.hero!,
};
