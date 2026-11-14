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

export interface ActorLook {
  colour: number;
  height: number;
  radius: number;
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
  mood(levelId: string): Mood;
  groundColour(kind: number, tx: number, ty: number, levelId: string): number;
  /** Null for prop kinds that aren't drawn as a prop, such as building tiles. */
  prop(kind: number, levelId: string): PropLook | null;
  structure(kind: string): StructureLook;
  lightColour(name: string): number;
  actor(kind: string): ActorLook;
}
