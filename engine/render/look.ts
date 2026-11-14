import type { Fit } from './model-instancing';

/**
 * How a game looks, supplied by the game. The renderer asks it for colours, shapes and moods by kind, so the
 * engine draws any game without knowing its names.
 */
export interface PropLook {
  /** The simple shape drawn when there's no model, or it didn't load. */
  shape: 'box' | 'cylinder' | 'cone' | 'sphere';
  width: number;
  height: number;
  colour: number;
  emissive?: number;
  /** Models from the game's library; each tile picks one of `names`, and turns by `turn` radians or at random. */
  model?: { names: string[]; fit: Fit; turn?: number | 'random' };
}

export interface StructureLook {
  wall: number;
  roof: number;
  wallHeight: number;
  roofHeight: number;
  /** A model fitted onto the structure's lot, turned `rotation` radians so its door faces the right way. */
  model?: { name: string; rotation: number };
}

/** Names of a model's animations for each thing an actor does. Missing ones fall back to `idle`. */
export interface ActorAnimations {
  idle: string;
  move?: string;
  attack?: string;
  cast?: string;
  hit?: string;
  death?: string;
}

export interface ActorLook {
  /** Colour and size of the simple shape drawn when there's no model, or while it loads. */
  colour: number;
  height: number;
  radius: number;
  /** A model from the game's model library, scaled to `height`. */
  model?: {
    name: string;
    animations: ActorAnimations;
    /** Multiplies the model's colours, for example to turn a rogue into a goblin. */
    tint?: number;
    /** A separate weapon model held in the right hand. */
    weapon?: string;
  };
}

export interface Mood {
  background: number;
  ambient: number;
  ambientIntensity: number;
  /** A directional light that casts shadows, for outdoor levels. */
  moon?: { colour: number; intensity: number };
  /** The light the hero carries, so the area around them is always visible. */
  heroLightRadius: number;
  /** Soft light from above and below that keeps figures readable in the dark without lighting the ground much. */
  fill?: { sky: number; ground: number; intensity: number };
}

export interface Look {
  /** Colours of projectiles and warning circles. */
  effects: { blast: number; shot: number; telegraph: number; items: Record<string, number> };
  mood(levelId: string): Mood;
  groundColour(kind: number, tx: number, ty: number, levelId: string): number;
  /** A floor model laid over ground tiles of this kind, if any. */
  floorModel?(kind: number, levelId: string): string | null;
  /** Null for prop kinds that aren't drawn as a prop, such as building tiles. */
  prop(kind: number, levelId: string): PropLook | null;
  structure(kind: string): StructureLook;
  lightColour(name: string): number;
  actor(kind: string): ActorLook;
}
