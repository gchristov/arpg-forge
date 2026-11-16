import type { Level } from '../world/level';
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
  /** Flames burning on top, such as a fire in a barrel: `height` tiles up, about `size` tiles tall. */
  flame?: { height: number; size: number; colour: number };
}

export interface StructureLook {
  wall: number;
  roof: number;
  wallHeight: number;
  roofHeight: number;
  /** A model fitted onto the structure's lot, turned `rotation` radians so its door faces the right way. */
  model?: { name: string; rotation: number };
  /** Pieces to build the structure from, wall by wall, in place of one model. */
  kit?: BuildingKit;
}

/**
 * A kit of models a building is put together from. Wall pieces lie along z with their face towards +x, as wall panels
 * do (`WallLook.panel`), and are all scaled as `wall[0]` is to span `span` tiles, so parts of one kit fit together.
 */
export interface BuildingKit {
  span: number;
  /** Plain wall pieces; each piece picks one. */
  wall: string[];
  /** A wall piece with windows, on the sides the camera sees: every other piece on the ground, every one above. */
  window?: string;
  /** A band laid along the top of each block's walls. */
  top?: string;
  /** A railing round the roofs of blocks lower than the tallest. */
  rail?: string;
  /** A door frame lying along x, fitted to `width` by `height` tiles around the door. */
  door: { name: string; width: number; height: number };
  /** A column standing wherever the walls turn a corner, on every storey. */
  corner?: string;
  /**
   * Plates laid over the roof, and things standing on it, such as vents and fans: scaled like the kit's pieces, or
   * fitted `width` tiles across, for models from elsewhere.
   */
  roof: string;
  roofProps?: Array<string | { name: string; width: number }>;
  /** The light inside, seen through the door. */
  inside: number;
  /** Lit windows: the window piece's glass, by material name, glows `colour` and casts the light `light` outside. */
  glass?: { material: string; colour: number; light: string };
  /** A lit sign over the door. */
  sign?: number;
  /** A colour the walls, columns, bands and door are multiplied by, so buildings from one kit can each have their own paint. */
  tint?: number;
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
  /** Drawn as a faint outline of this colour wherever something nearer hides it, so the player never loses it. */
  seenThrough?: number;
  /** Colour and size of the simple shape drawn when there's no model, or while it loads. */
  colour: number;
  height: number;
  radius: number;
  /** Body size relative to an ordinary actor, 1 if not given: taps reach further and labels sit higher on bigger ones. */
  scale?: number;
  /** Tiles above the ground the model floats, for flying machines and spirits. */
  hover?: number;
  /** For calm machines that look the hero over: the height of the eye the scanning beam comes from, in tiles. */
  scanner?: { eyeHeight: number };
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
    /**
     * Plays the move animation faster or slower to match how fast the actor moves, so its feet stay planted. Leave
     * it off for animations meant to play at their own pace whatever the speed.
     */
    matchPace?: boolean;
  };
}

export interface Mood {
  background: number;
  ambient: number;
  ambientIntensity: number;
  /** The ambient colour while the level is alarmed, so the whole room shows it. */
  alarmAmbient?: number;
  /** A directional light that casts shadows, for outdoor levels. */
  moon?: { colour: number; intensity: number };
  /** The light the hero carries, so the area around them is always visible. */
  heroLightRadius: number;
  /** Soft light from above and below that keeps figures readable in the dark without lighting the ground much. */
  fill?: { sky: number; ground: number; intensity: number };
  /**
   * Blends the ground's tiles into each other and lays a grain of grit and cracks this strong (0 to 1) over it, for
   * natural ground such as earth outdoors. Without it, each tile is one flat colour, which suits floors.
   */
  groundGrain?: number;
  /** Mist drifting low over the ground, for weather outdoors. */
  mist?: MistLook;
  /**
   * How far the hero sees enemies, in tiles, when nothing stands between them; enemies out of sight stay hidden until
   * found. Without it, every enemy on the level shows.
   */
  sightRange?: number;
  /** Moving water drawn over the ground of one kind, such as a river. */
  water?: WaterLook;
}

export interface WaterLook {
  /** The ground kind the water lies over. */
  ground: number;
  /** Which way, and how fast, the water runs, in tiles a second. */
  flow: { x: number; y: number };
  /** The water's colour in its troughs and on its ripples, and the light glinting off its crests. */
  deep: number;
  shallow: number;
  glint: number;
}

export interface MistLook {
  colour: number;
  /** How thick the mist is where it gathers, from 0 to 1. */
  density: number;
}

/**
 * Walls drawn the way isometric action games draw them: thin panels standing on the edges where wall tiles meet the
 * floor, rather than blocks filling the wall tiles. Only a room's back walls, along its top and left edges, stand
 * full height. The walls between the floor and the camera, and walls inside the room, would hide the floor behind
 * them, so they get a low piece instead, or nothing. The rules still treat wall tiles as solid.
 */
export interface WallLook {
  /** Prop kinds that are walls. Their tiles draw no prop of their own. */
  props: number[];
  /** A straight wall panel model, lying along z with its face towards +x. */
  panel: string;
  /** Tiles one panel spans; it's scaled evenly to that length, and runs of wall are split into pieces this long. */
  span: number;
  /** The low piece for every wall that isn't a back wall, facing the camera, stretched to `height` tiles tall. */
  front?: { name: string; height: number };
  /**
   * Models fixed to walls of these prop kinds, such as lamps: one on each face that looks onto the floor, except on
   * front walls. Each is scaled as the panel is, so parts of one kit fit together, with its origin on the face `height`
   * tiles up. `turn` rotates it about the vertical, then `tilt` about the line of the wall, to face it into the room
   * (+x). Both are in radians.
   */
  fixtures?: WallFixture[];
}

export interface WallFixture {
  props: number[];
  name: string;
  height: number;
  turn?: number;
  tilt?: number;
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
  /** Light over a door sealed until its level is cleared. Without it, sealed doors look like any other. */
  sealedLight?: number;
  /** The beam of a machine scanning the hero. Needed by looks with scanners. */
  scan?: number;
  /**
   * Lightning of this colour for the hero's skills: bursts arc to every enemy they hit and fork outwards, and skill
   * projectiles crackle as they fly, and bursts swell into a dome of energy in place of their flash. Without it, skills
   * show only their flash.
   */
  lightning?: number;
  /**
   * Guidance to the quest's next goal: an `arrow` on the ground by the hero pointing the way, with a "!" of the same
   * colour over the townsperson to talk to, and townspeople's names in `name` when the hero is near. Without it, the
   * game gives no guidance in the world.
   */
  guide?: { arrow: number; name: number };
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
  /** What lies past a level's playable world; without it, the level ends where its map does. */
  surroundings?(level: Level): Surroundings | null;
  lightColour(name: string): number;
  actor(kind: string): ActorLook;
}

/**
 * What lies past a level's playable world, fading into darkness away from it, so the player never sees where the map
 * stops: ground under its walls and on past its edges, and scenery standing in the dark.
 */
export interface Surroundings {
  /** How many tiles past the map's edges the ground carries on. Past an edge, it's the ground at the nearest edge tile. */
  margin: number;
  /**
   * The ground kind drawn where the map has none, such as under its walls. Without it, the ground stops at the walls,
   * as indoors, where what lies past them is only hinted at.
   */
  ground?: number;
  /** How many tiles past the playable world it takes to fade into darkness; 10 when not set. */
  fade?: number;
  /** Things standing in the dark, drawn like props of their kind at these points; they're only ever seen. */
  scenery: Array<{ prop: number; x: number; y: number }>;
}
