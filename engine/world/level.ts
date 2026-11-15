import type { Vec2 } from '../core/math';
import type { TileMap } from './tile-map';

/** A light in the level. `colour` names an entry in the game's look, such as "warm". */
export interface LevelLight {
  x: number;
  y: number;
  radius: number;
  intensity: number;
  colour: string;
  /** How strongly it flickers, 0 for steady. */
  flicker: number;
  seed: number;
}

/**
 * Stepping onto the tile leads to another level. Arriving the other way, through this portal, puts you at the
 * tile's centre plus `stepOut`, just clear of the doorway.
 */
export interface Portal {
  tx: number;
  ty: number;
  to: string;
  stepOut: Vec2;
  /** Shut while any enemy on its level is still standing, so the way on has to be fought for. */
  sealed?: boolean;
}

/** A building or other large block on the map, with a door the player walks to when it's tapped. */
export interface Structure {
  kind: string;
  name: string;
  x: number;
  y: number;
  width: number;
  depth: number;
  door: { tx: number; ty: number };
  /** Where smoke rises, if anywhere. */
  chimney?: { tx: number; ty: number };
}

export interface Level {
  id: string;
  name: string;
  subtitle: string;
  outdoor: boolean;
  map: TileMap;
  start: Vec2;
  portals: Portal[];
  lights: LevelLight[];
  structures: Structure[];
}
