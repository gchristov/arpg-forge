import * as THREE from 'three';

/** How far out from the hero's feet the arrow lies, and how long it is, in tiles. */
const REACH = 1.1;
const LENGTH = 0.6;
/** Drawn after the level, so floor models laid over the ground don't hide it. */
const DRAW_ORDER = 5;
/** The arrow breathes between these opacities, this many times a second. */
const OPACITY = [0.45, 0.85] as const;
const PULSES_PER_SECOND = 0.7;

/** A chevron flat on the ground beside the hero, pointing the way to the quest's next goal. */
export class GoalArrow {
  private readonly mesh: THREE.Mesh<THREE.ShapeGeometry, THREE.MeshBasicMaterial>;

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

  /** Lays the arrow by the hero at `x`, `y`, pointing along `dirX`, `dirY`; `seconds` drives its pulse. */
  show(x: number, y: number, dirX: number, dirY: number, seconds: number): void {
    const length = Math.hypot(dirX, dirY);
    if (length < 1e-6) return this.hide();
    const dx = dirX / length;
    const dy = dirY / length;
    this.mesh.position.set(x + dx * REACH, 0.04, y + dy * REACH);
    this.mesh.rotation.y = Math.atan2(-dy, dx);
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
