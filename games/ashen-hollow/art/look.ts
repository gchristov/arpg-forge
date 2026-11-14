import * as THREE from 'three';
import { hash2, valueNoise } from '../../../engine/core/math';
import type { ActorLook, Look, Mood, PropLook, StructureLook } from '../../../engine/render/look';
import { Ground, Prop } from '../content/tiles';

/** Simple shapes in the prototype's palette. */

const colour = new THREE.Color();
const hsl = (h: number, s: number, l: number): number => colour.setHSL(h / 360, s / 100, l / 100).getHex();

const MOODS: Record<string, Mood> = {
  town: {
    background: 0x050407, ambient: 0x3a4a78, ambientIntensity: 0.9,
    moon: { colour: 0x8fa6e0, intensity: 0.9 }, heroLightRadius: 5.4,
    fill: { sky: 0x9ab0e8, ground: 0x2a2418, intensity: 0.9 },
  },
  tavern: {
    background: 0x050407, ambient: 0x6a4a32, ambientIntensity: 0.55, heroLightRadius: 4.5,
    fill: { sky: 0xffd2a0, ground: 0x302010, intensity: 0.7 },
  },
  smithy: {
    background: 0x050407, ambient: 0x5a4636, ambientIntensity: 0.5, heroLightRadius: 4.5,
    fill: { sky: 0xffd2a0, ground: 0x302010, intensity: 0.6 },
  },
  cottage: {
    background: 0x050407, ambient: 0x4a3a30, ambientIntensity: 0.38, heroLightRadius: 4.5,
    fill: { sky: 0xffd2a0, ground: 0x302010, intensity: 0.5 },
  },
  crypt: {
    background: 0x030206, ambient: 0x2a2040, ambientIntensity: 0.2, heroLightRadius: 4.4,
    fill: { sky: 0xb8a0ff, ground: 0x100818, intensity: 0.5 },
  },
};

const tall = (names: string[], height: number, turn: number | 'random' = 'random'): PropLook['model'] => ({
  names, fit: { type: 'height', height }, turn,
});
const wide = (names: string[], width: number, turn: number | 'random' = 0): PropLook['model'] => ({
  names, fit: { type: 'width', width }, turn,
});

/** KayKit models (CC0, see CREDITS.md), with simple shapes as the fallback. */
const PROPS: Partial<Record<number, PropLook>> = {
  [Prop.Tree]: { shape: 'cone', width: 1.1, height: 1.9, colour: 0x2b4426, model: tall(['tree-a', 'tree-b'], 1.9) },
  [Prop.DeadTree]: { shape: 'cylinder', width: 0.2, height: 1.4, colour: 0x4a3c2c, model: tall(['dead-tree'], 1.7) },
  [Prop.Rock]: { shape: 'sphere', width: 0.7, height: 0.5, colour: 0x6b6862, model: tall(['rock-a', 'rock-c'], 0.55) },
  [Prop.Bush]: { shape: 'sphere', width: 0.7, height: 0.5, colour: 0x2c4528 },
  [Prop.Lamp]: { shape: 'cylinder', width: 0.12, height: 1.5, colour: 0x2a2724, emissive: 0x3a2008, model: tall(['lamp'], 1.6, 0) },
  [Prop.Well]: { shape: 'cylinder', width: 0.95, height: 0.55, colour: 0x6d6a66, model: wide(['well'], 1.15) },
  [Prop.Brazier]: { shape: 'cylinder', width: 0.5, height: 0.45, colour: 0x3a3030, emissive: 0x552200, model: tall(['brazier'], 0.95, 0) },
  [Prop.Grave]: { shape: 'box', width: 0.45, height: 0.6, colour: 0x7a7a80, model: tall(['grave-a', 'grave-b', 'gravestone'], 0.75, 0) },
  [Prop.Table]: { shape: 'box', width: 0.9, height: 0.55, colour: 0x5a3d26, model: wide(['table'], 0.95) },
  [Prop.Barrel]: { shape: 'cylinder', width: 0.6, height: 0.75, colour: 0x6b4a2b, model: tall(['barrel'], 0.8) },
  [Prop.Crate]: { shape: 'box', width: 0.75, height: 0.7, colour: 0x7a5a36, model: wide(['crate'], 0.85) },
  [Prop.Anvil]: { shape: 'box', width: 0.6, height: 0.45, colour: 0x3a3a3e },
  [Prop.Bed]: { shape: 'box', width: 0.9, height: 0.4, colour: 0x6a3030, model: wide(['bed'], 1.0, Math.PI / 2) },
  [Prop.Chest]: { shape: 'box', width: 0.7, height: 0.5, colour: 0x7a5420, emissive: 0x1a1000, model: wide(['chest'], 0.75) },
  [Prop.Pillar]: { shape: 'cylinder', width: 0.6, height: 1.6, colour: 0x56545e, model: tall(['pillar'], 1.7, 0) },
  [Prop.Bones]: { shape: 'sphere', width: 0.6, height: 0.12, colour: 0xd8d0b8, model: wide(['bones', 'skull'], 0.45, 'random') },
};

/** The prototype's wall colours per room, and its wall heights converted from pixels to tiles. */
const PIXELS_PER_TILE_OF_HEIGHT = 39.2;
const WALL_COLOURS: Record<string, number> = { tavern: 0x6e5137, smithy: 0x5d5954, cottage: 0x7a6246, crypt: 0x46444f };
/** Walls stay plain blocks: the packs' wall pieces are thin slabs, and stretching one into a block squashes its bricks. */
const wallLook = (levelId: string, heightPx: number, emissive = 0): PropLook => ({
  shape: 'box', width: 1, height: heightPx / PIXELS_PER_TILE_OF_HEIGHT, colour: WALL_COLOURS[levelId] ?? 0x5d5954, emissive,
});

const structure = (wall: number, roof: number, wallPx: number, roofPx: number): StructureLook => ({
  wall, roof, wallHeight: wallPx / PIXELS_PER_TILE_OF_HEIGHT, roofHeight: roofPx / PIXELS_PER_TILE_OF_HEIGHT,
});
const STRUCTURES: Record<string, StructureLook> = {
  tavern: { ...structure(0xa8916c, 0x7b3527, 46, 34), model: { name: 'tavern', rotation: 0 } },
  smithy: { ...structure(0x77736d, 0x46505e, 40, 28), model: { name: 'smithy', rotation: 0 } },
  cottage: { ...structure(0xb39e78, 0x8a7340, 36, 30), model: { name: 'cottage', rotation: 0 } },
  crypt: { ...structure(0x5d5c66, 0x2e2c36, 44, 18), model: { name: 'crypt', rotation: 0 } },
};

/** Interior floors are tiled with dungeon floor pieces; the village keeps its painted ground. */
const FLOORS: Partial<Record<number, string>> = {
  [Ground.Wood]: 'floor-wood',
  [Ground.Stone]: 'floor-stone',
  [Ground.Crypt]: 'floor-stone',
};

const LIGHTS: Record<string, number> = { warm: 0xff9b3c, purple: 0xaa5aff, cold: 0x82aaff };

/** KayKit characters (CC0, see CREDITS.md); `models.json` lists which parts and animations each keeps. */
const ACTORS: Record<string, ActorLook> = {
  hero: {
    colour: 0x9a8a70, height: 1.15, radius: 0.24,
    model: {
      name: 'hero',
      animations: { idle: 'Idle', move: 'Running_A', attack: '1H_Melee_Attack_Slice_Diagonal', cast: 'Spellcast_Shoot', hit: 'Hit_A', death: 'Death_A' },
    },
  },
  goblin: {
    colour: 0x5d7a3a, height: 0.95, radius: 0.25,
    model: {
      name: 'goblin', tint: 0x9fd07a,
      animations: { idle: 'Idle', move: 'Running_A', attack: '1H_Melee_Attack_Stab', hit: 'Hit_A', death: 'Death_A' },
    },
  },
  skeleton: {
    colour: 0xd8d0b8, height: 1.15, radius: 0.26,
    model: {
      name: 'skeleton', weapon: 'skeleton-blade',
      animations: { idle: 'Idle', move: 'Walking_A', attack: '1H_Melee_Attack_Chop', hit: 'Hit_A', death: 'Death_A' },
    },
  },
  archer: {
    colour: 0xb8b090, height: 1.15, radius: 0.26,
    model: {
      name: 'archer', weapon: 'skeleton-crossbow',
      animations: { idle: 'Idle', move: 'Walking_A', attack: '1H_Ranged_Shoot', hit: 'Hit_A', death: 'Death_A' },
    },
  },
  boss: {
    colour: 0x8a7ab0, height: 1.8, radius: 0.42,
    model: {
      name: 'boss', weapon: 'skeleton-axe', tint: 0xcbb8e8,
      animations: { idle: 'Idle', move: 'Walking_A', attack: '2H_Melee_Attack_Chop', cast: 'Spellcast_Shoot', hit: 'Hit_A', death: 'Death_A' },
    },
  },
  elder: { colour: 0x7a6a9a, height: 1.1, radius: 0.26, model: { name: 'elder', animations: { idle: 'Idle' } } },
  innkeeper: { colour: 0x8a5a3a, height: 1.15, radius: 0.28, model: { name: 'innkeeper', animations: { idle: 'Idle' } } },
  smith: { colour: 0x5a5a6a, height: 1.1, radius: 0.28, model: { name: 'smith', animations: { idle: 'Idle' } } },
};

/** URLs of the built models, by name, for the model library to load. */
export const MODEL_URLS: Record<string, string> = Object.fromEntries(
  Object.entries(import.meta.glob<string>('./models/*.glb', { query: '?url', import: 'default', eager: true })).map(
    ([path, url]) => [path.slice('./models/'.length, -'.glb'.length), url],
  ),
);

export const ashenHollowLook: Look = {
  effects: { blast: 0xffa040, shot: 0xe8e1cc, telegraph: 0xb46bff, items: { gold: 0xe8b84a, healingItem: 0xd2303a } },
  mood: (levelId) => MOODS[levelId] ?? MOODS.town!,
  groundColour(kind, tx, ty, levelId) {
    const n = valueNoise(tx * 0.18 + (levelId === 'town' ? 0 : 50), ty * 0.18);
    const h = hash2(tx, ty, 5);
    switch (kind) {
      case Ground.Grass:
        return hsl(88 + n * 22, 26 + n * 12, 21 + n * 8 + h * 3);
      case Ground.DeadGrass:
        return hsl(38 + n * 10, 16 + n * 6, 20 + n * 6 + h * 3);
      case Ground.Path:
        return hsl(30 + n * 6, 22 + n * 6, 26 + n * 6 + h * 3);
      case Ground.Stone:
        return hsl(30 + h * 15, 5 + h * 4, 33 + n * 5 + h * 5);
      case Ground.Water:
        return hsl(205 + n * 8, 45, 16 + n * 5);
      case Ground.Wood:
        return hsl(26 + h * 6, 36 + n * 6, 22 + n * 4 + h * 4);
      case Ground.Crypt:
        return hsl(250 + h * 20, 5 + h * 4, 18 + n * 5 + h * 4);
      default:
        return 0x000000;
    }
  },
  floorModel: (kind, levelId) => (levelId === 'town' ? null : FLOORS[kind] ?? null),
  prop(kind, levelId) {
    if (kind === Prop.Wall) return wallLook(levelId, levelId === 'crypt' ? 58 : 70);
    if (kind === Prop.WallTorch) return wallLook(levelId, levelId === 'crypt' ? 58 : 70, 0x2a1200);
    if (kind === Prop.WallLow) return wallLook(levelId, 14);
    return PROPS[kind] ?? null;
  },
  structure: (kind) => STRUCTURES[kind] ?? STRUCTURES.cottage!,
  lightColour: (name) => LIGHTS[name] ?? LIGHTS.warm!,
  actor: (kind) => ACTORS[kind] ?? ACTORS.hero!,
};
