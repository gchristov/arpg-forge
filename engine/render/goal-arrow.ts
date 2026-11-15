import * as THREE from 'three';
import type { Vec2 } from '../core/math';
import { ELEVATION } from './camera-angle';

/** How far the arrow lies from the middle of the hero's body on screen, in tiles at zoom 1; and its length. */
const RING = 0.85;
const LENGTH = 0.6;
/** Drawn after the level, so floor models laid over the ground don't hide it. */
const DRAW_ORDER = 5;
/** The arrow breathes between these opacities, this many times a second. */
const OPACITY = [0.45, 0.85] as const;
const PULSES_PER_SECOND = 0.7;
/** How quickly the arrow swings round to a new heading: most of the way in about this many seconds. */
const TURN_SECONDS = 0.3;

/** Ground directions up the screen (away from the camera) and to its right, and how much the camera squashes the first. */
const UP = { x: -Math.SQRT1_2, y: -Math.SQRT1_2 };
const RIGHT = { x: Math.SQRT1_2, y: -Math.SQRT1_2 };
const UP_SQUASH = Math.sin(ELEVATION);

/**
 * Where on the ground, from the hero's feet, the arrow lies for a heading: on a circle round the middle of a body
 * `height` tall as the camera sees it, so it sits as far from the hero whichever way it points, never under them.
 */
export function ringOffset(heading: number, height: number, out: Vec2): Vec2 {
  const right = Math.cos(heading) * RIGHT.x + Math.sin(heading) * RIGHT.y;
  const up = (Math.cos(heading) * UP.x + Math.sin(heading) * UP.y) * UP_SQUASH;
  const length = Math.hypot(right, up);
  const screenRight = (RING * right) / length;
  const screenUp = (height / 2) * Math.cos(ELEVATION) + (RING * up) / length;
  const groundUp = screenUp / UP_SQUASH;
  out.x = screenRight * RIGHT.x + groundUp * UP.x;
  out.y = screenRight * RIGHT.y + groundUp * UP.y;
  return out;
}

/** A chevron flat on the ground beside the hero, pointing the way to the quest's next goal. */
export class GoalArrow {
  private readonly mesh: THREE.Mesh<THREE.ShapeGeometry, THREE.MeshBasicMaterial>;
  private heading = 0;
  private readonly offset = { x: 0, y: 0 };

  constructor(scene: THREE.Scene, colour: number) {
    const half = LENGTH / 2;
    const shape = new THREE.Shape()
      .moveTo(half, 0)
      .lineTo(-half, half * 0.85)
      .lineTo(-half * 0.45, 0)
      .lineTo(-half, -half * 0.85)
      .closePath();
    this.mesh = new THREE.Mesh(
      new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2),
      // Over everything, as it lies by the hero, who is always in view: floor plates stand higher than the ground.
      new THREE.MeshBasicMaterial({ color: colour, transparent: true, depthWrite: false, depthTest: false }),
    );
    this.mesh.renderOrder = DRAW_ORDER;
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  /**
   * Lays the arrow round the hero at `x`, `y`, a body `height` tall, swinging round towards `dirX`, `dirY` (at once if
   * it was hidden); `seconds` drives its pulse.
   */
  show(x: number, y: number, height: number, dirX: number, dirY: number, seconds: number, frameSeconds: number): void {
    if (Math.hypot(dirX, dirY) < 1e-6) return this.hide();
    const target = Math.atan2(dirY, dirX);
    if (!this.mesh.visible) this.heading = target;
    else {
      const turn = Math.atan2(Math.sin(target - this.heading), Math.cos(target - this.heading));
      this.heading += turn * (1 - Math.exp(-frameSeconds / TURN_SECONDS));
    }
    const offset = ringOffset(this.heading, height, this.offset);
    this.mesh.position.set(x + offset.x, 0.04, y + offset.y);
    this.mesh.rotation.y = -this.heading;
    const pulse = 0.5 + 0.5 * Math.sin(seconds * PULSES_PER_SECOND * Math.PI * 2);
    this.mesh.material.opacity = OPACITY[0] + (OPACITY[1] - OPACITY[0]) * pulse;
    this.mesh.visible = true;
  }

  hide(): void {
    this.mesh.visible = false;
  }

  setVisible(visible: boolean): void {
    this.mesh.visible = visible;
  }
}
