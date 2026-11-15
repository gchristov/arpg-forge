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
  /** Body size relative to an ordinary actor, 1 if not given: taps reach further and labels sit higher on bigger ones. */
  scale?: number;
  /** Tiles above the ground the model floats, for flying machines and spirits. */
  hover?: number;
  /** A light the actor carries, such as a lantern or a glowing eye, which fades as it dies. */
  light?: { colour: number; radius: number; intensity: number };
  /** The mark a killed enemy leaves on the ground, such as blood or bone dust. */
  remains?: { radius: number; colour: number; opacity: number };
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

/**
 * Walls drawn the way isometric action games draw them: thin panels standing on the edges where wall tiles meet the
 * floor, rather than blocks filling the wall tiles. The walls between the floor and the camera would hide the room,
 * so they get a low piece instead, or nothing. The rules still treat wall tiles as solid.
 */
export interface WallLook {
  /** Prop kinds that are walls. Their tiles draw no prop of their own. */
  props: number[];
  /** A straight wall panel model, lying along z with its face towards +x. */
  panel: string;
  /** Tiles one panel spans; it's scaled evenly to that length, and runs of wall are split into pieces this long. */
  span: number;
  /** The low piece along walls between the floor and the camera, facing the camera, stretched to `height` tiles tall. */
  front?: { name: string; height: number };
}

/** A burst: the flash it makes and the scorch it leaves on the ground. */
export interface BurstLook {
  flash: number;
  scorch: number;
}

/** Colours of combat effects and markers. */
export interface EffectsLook {
  /** The hero's skill projectiles, and enemies' shots. */
  skill: number;
  shot: number;
  telegraph: number;
  items: Record<string, number>;
  /** Rings where the hero was sent to walk, and under an enemy picked to attack. */
  walkMarker: number;
  targetMarker: number;
  /** Light cast by a flying skill projectile, by a warning circle and around a boss. */
  skillLight: number;
  telegraphLight: number;
  bossLight: number;
  /** Chimney smoke. */
  smoke: number;
  explosion: BurstLook;
  slam: BurstLook;
}

export interface Look {
  effects: EffectsLook;
  mood(levelId: string): Mood;
  groundColour(kind: number, tx: number, ty: number, levelId: string): number;
  /** A floor model laid over ground tiles of this kind, if any. */
  floorModel?(kind: number, levelId: string): string | null;
  /** Null for prop kinds that aren't drawn as a prop, such as building tiles. */
  prop(kind: number, levelId: string): PropLook | null;
  structure(kind: string): StructureLook;
  /** How walls are drawn on a level; without it, or if the models don't load, wall props are drawn as props. */
  walls?(levelId: string): WallLook | null;
  lightColour(name: string): number;
  actor(kind: string): ActorLook;
}
