/**
 * How a game looks, supplied by the game. The renderer asks it for colours, shapes and moods by kind, so the
 * engine draws any game without knowing its names.
 */
export interface PropLook {
  shape: 'box' | 'cylinder' | 'cone' | 'sphere';
  width: number;
  height: number;
  colour: number;
  emissive?: number;
}

export interface StructureLook {
  wall: number;
  roof: number;
  wallHeight: number;
  roofHeight: number;
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
}

export interface Look {
  /** Colours of projectiles and warning circles. */
  effects: { blast: number; shot: number; telegraph: number; items: Record<string, number> };
  mood(levelId: string): Mood;
  groundColour(kind: number, tx: number, ty: number, levelId: string): number;
  /** Null for prop kinds that aren't drawn as a prop, such as building tiles. */
  prop(kind: number, levelId: string): PropLook | null;
  structure(kind: string): StructureLook;
  lightColour(name: string): number;
  actor(kind: string): ActorLook;
}
