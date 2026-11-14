import * as THREE from 'three';

/** Heights above the ground, in tiles. */
const PROJECTILE_HEIGHT = 0.52;
const POOL_SIZE = 24;

export interface ProjectileView {
  kind: string;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
}

export interface TelegraphView {
  x: number;
  y: number;
  radius: number;
  elapsed: number;
  delay: number;
}

export interface ItemView {
  kind: string;
  x: number;
  y: number;
  z: number;
}

export interface EffectColours {
  blast: number;
  shot: number;
  telegraph: number;
  /** Item colours by kind, such as gold or a healing item. */
  items: Record<string, number>;
}

interface Flash {
  mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  age: number;
  life: number;
  radius: number;
}

/**
 * Projectiles, warning circles and explosion flashes, drawn from pools of meshes made up front, so nothing is
 * created during play.
 */
export class Effects {
  private readonly blasts: THREE.Mesh[] = [];
  private readonly shots: THREE.Mesh[] = [];
  private readonly circles: Array<THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>> = [];
  private readonly flashes: Flash[] = [];
  private readonly items = new Map<string, THREE.Mesh[]>();
  private readonly itemsUsed = new Map<string, number>();

  constructor(scene: THREE.Scene, colours: EffectColours) {
    const blastGeometry = new THREE.SphereGeometry(0.15, 12, 8);
    const blastMaterial = new THREE.MeshBasicMaterial({ color: colours.blast });
    const shotGeometry = new THREE.CylinderGeometry(0.025, 0.025, 0.55, 6).rotateX(Math.PI / 2);
    const shotMaterial = new THREE.MeshBasicMaterial({ color: colours.shot });
    const circleGeometry = new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2);
    const flashGeometry = new THREE.SphereGeometry(1, 16, 10);
    const itemGeometry = new THREE.CylinderGeometry(0.12, 0.12, 0.06, 14);
    for (const [kind, colour] of Object.entries(colours.items)) {
      const material = new THREE.MeshLambertMaterial({ color: colour, emissive: colour, emissiveIntensity: 0.35 });
      const pool: THREE.Mesh[] = [];
      for (let i = 0; i < POOL_SIZE; i++) pool.push(hidden(scene, new THREE.Mesh(itemGeometry, material)));
      this.items.set(kind, pool);
    }
    for (let i = 0; i < POOL_SIZE; i++) {
      this.blasts.push(hidden(scene, new THREE.Mesh(blastGeometry, blastMaterial)));
      this.shots.push(hidden(scene, new THREE.Mesh(shotGeometry, shotMaterial)));
      this.circles.push(
        hidden(scene, new THREE.Mesh(circleGeometry, new THREE.MeshBasicMaterial({
          color: colours.telegraph, transparent: true, depthWrite: false,
        }))),
      );
      this.flashes.push({
        mesh: hidden(scene, new THREE.Mesh(flashGeometry, new THREE.MeshBasicMaterial({
          transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        }))),
        age: 0, life: 0, radius: 0,
      });
    }
  }

  showProjectiles(projectiles: readonly ProjectileView[], alpha: number): void {
    let blast = 0;
    let shot = 0;
    for (const p of projectiles) {
      const mesh = p.kind === 'blast' ? this.blasts[blast++] : this.shots[shot++];
      if (!mesh) continue;
      mesh.visible = true;
      mesh.position.set(p.prevX + (p.x - p.prevX) * alpha, PROJECTILE_HEIGHT, p.prevY + (p.y - p.prevY) * alpha);
      mesh.rotation.y = Math.atan2(p.vx, p.vy);
    }
    for (let i = blast; i < POOL_SIZE; i++) this.blasts[i]!.visible = false;
    for (let i = shot; i < POOL_SIZE; i++) this.shots[i]!.visible = false;
  }

  /** Items lying on the ground, bobbing gently so they catch the eye. */
  showItems(items: readonly ItemView[], seconds: number): void {
    const used = this.itemsUsed;
    used.clear();
    for (const item of items) {
      const pool = this.items.get(item.kind);
      const n = used.get(item.kind) ?? 0;
      const mesh = pool?.[n];
      if (!mesh) continue;
      used.set(item.kind, n + 1);
      mesh.visible = true;
      const bob = item.z > 0 ? 0 : Math.sin(seconds * 3 + item.x * 7) * 0.03;
      mesh.position.set(item.x, 0.08 + item.z + bob, item.y);
      mesh.rotation.y = seconds * 1.5 + item.y;
    }
    for (const [kind, pool] of this.items) {
      for (let i = used.get(kind) ?? 0; i < POOL_SIZE; i++) pool[i]!.visible = false;
    }
  }

  /** Warning circles darken as the moment they land gets closer. */
  showTelegraphs(telegraphs: readonly TelegraphView[]): void {
    for (let i = 0; i < POOL_SIZE; i++) {
      const circle = this.circles[i]!;
      const t = telegraphs[i];
      circle.visible = Boolean(t);
      if (!t) continue;
      circle.position.set(t.x, 0.03, t.y);
      circle.scale.setScalar(t.radius);
      circle.material.opacity = 0.15 + 0.4 * Math.min(1, t.elapsed / t.delay);
    }
  }

  flash(x: number, y: number, radius: number, colour: number, seconds: number): void {
    const f = this.flashes.find((candidate) => candidate.age >= candidate.life) ?? this.flashes[0]!;
    f.age = 0;
    f.life = seconds;
    f.radius = radius;
    f.mesh.material.color.set(colour);
    f.mesh.position.set(x, 0.4, y);
    f.mesh.visible = true;
  }

  update(frameSeconds: number): void {
    for (const f of this.flashes) {
      if (f.age >= f.life) {
        f.mesh.visible = false;
        continue;
      }
      f.age += frameSeconds;
      const k = Math.min(1, f.age / f.life);
      f.mesh.scale.setScalar(f.radius * (0.4 + 0.6 * k));
      f.mesh.material.opacity = 0.6 * (1 - k);
    }
  }
}

function hidden<T extends THREE.Object3D>(scene: THREE.Scene, object: T): T {
  object.visible = false;
  scene.add(object);
  return object;
}
