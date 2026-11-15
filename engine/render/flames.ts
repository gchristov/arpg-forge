import * as THREE from 'three';

/** Where a fire burns: on top of a prop, `height` tiles up, with flames about `size` tiles tall. */
export interface FlameSpot {
  x: number;
  y: number;
  height: number;
  size: number;
  colour: number;
}

/** Nested tongues of each fire, from the outer, deepest colour to the hot inner core. */
const TONGUES = [
  { scale: 1, brightness: 1, toWhite: 0, offset: 0 },
  { scale: 0.55, brightness: 0.9, toWhite: 0.1, offset: 0.28 },
  { scale: 0.5, brightness: 0.9, toWhite: 0.1, offset: 0.28 },
  { scale: 0.7, brightness: 0.9, toWhite: 0.35, offset: 0 },
  { scale: 0.42, brightness: 0.8, toWhite: 0.75, offset: 0 },
];
const EMBERS_PER_FIRE = 6;

interface Tongue {
  mesh: THREE.Mesh;
  spot: FlameSpot;
  scale: number;
  /** How far from the fire's middle the tongue licks up, as a share of the fire's size, and in which direction. */
  offset: number;
  angle: number;
  phase: number;
}

interface Ember {
  mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  spot: FlameSpot;
  age: number;
  life: number;
  vx: number;
  vy: number;
  vz: number;
}

/**
 * Fires on top of props, such as a burning barrel: nested tongues of flame that stretch, squash and sway every frame,
 * and embers drifting up out of them. Built with a level and freed with it.
 */
export class Flames {
  readonly group = new THREE.Group();
  private readonly tongues: Tongue[] = [];
  private readonly embers: Ember[] = [];

  constructor(spots: readonly FlameSpot[]) {
    const tongue = new THREE.ConeGeometry(0.55, 1, 8, 1, true).translate(0, 0.5, 0);
    const ember = new THREE.SphereGeometry(1, 5, 4);
    const white = new THREE.Color(0xffffff);
    for (const spot of spots) {
      for (const t of TONGUES) {
        const colour = new THREE.Color(spot.colour).lerp(white, t.toWhite).multiplyScalar(t.brightness);
        const mesh = new THREE.Mesh(tongue, new THREE.MeshBasicMaterial({
          color: colour, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending,
        }));
        mesh.position.set(spot.x, spot.height, spot.y);
        this.group.add(mesh);
        this.tongues.push({ mesh, spot, scale: t.scale, offset: t.offset, angle: Math.random() * Math.PI * 2, phase: Math.random() * 10 });
      }
      for (let k = 0; k < EMBERS_PER_FIRE; k++) {
        const mesh = new THREE.Mesh(ember, new THREE.MeshBasicMaterial({
          color: spot.colour, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        }));
        mesh.scale.setScalar(0.025);
        this.group.add(mesh);
        // Staggered, so a fire starts with embers already in the air.
        const e: Ember = { mesh, spot, age: 0, life: 0, vx: 0, vy: 0, vz: 0 };
        this.relight(e);
        e.age = Math.random() * e.life;
        this.embers.push(e);
      }
    }
  }

  update(seconds: number, frameSeconds: number): void {
    for (const t of this.tongues) {
      const { size } = t.spot;
      // Two wobbles at different speeds plus a little noise, so no two frames or fires match.
      const flicker = 1 + Math.sin(seconds * 11 + t.phase) * 0.18 + Math.sin(seconds * 23 + t.phase * 2) * 0.1 + (Math.random() - 0.5) * 0.12;
      t.mesh.scale.set(size * t.scale * (0.9 + Math.random() * 0.15), size * t.scale * 1.3 * flicker, size * t.scale * (0.9 + Math.random() * 0.15));
      // Side tongues wander around the fire's edge as they burn.
      const angle = t.angle + Math.sin(seconds * 1.7 + t.phase) * 0.8;
      t.mesh.position.set(t.spot.x + Math.cos(angle) * t.offset * size, t.spot.height, t.spot.y + Math.sin(angle) * t.offset * size);
      t.mesh.rotation.set(Math.sin(seconds * 3 + t.phase) * 0.12, seconds * 2 + t.phase, Math.cos(seconds * 2.6 + t.phase) * 0.12);
    }
    for (const e of this.embers) {
      e.age += frameSeconds;
      if (e.age >= e.life) this.relight(e);
      e.mesh.position.x += e.vx * frameSeconds;
      e.mesh.position.y += e.vy * frameSeconds;
      e.mesh.position.z += e.vz * frameSeconds;
      e.mesh.material.opacity = 1 - e.age / e.life;
    }
  }

  /** Sends an ember up again from the fire's heart. */
  private relight(e: Ember): void {
    const { spot } = e;
    e.age = 0;
    e.life = 0.7 + Math.random() * 0.9;
    e.vx = (Math.random() - 0.5) * 0.25;
    e.vy = 0.5 + Math.random() * 0.6;
    e.vz = (Math.random() - 0.5) * 0.25;
    e.mesh.position.set(spot.x + (Math.random() - 0.5) * spot.size * 0.4, spot.height + spot.size * 0.3, spot.y + (Math.random() - 0.5) * spot.size * 0.4);
  }
}
