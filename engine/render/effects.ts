import * as THREE from 'three';
import { EnergyDomes } from './energy-domes';
import { GoalArrow } from './goal-arrow';
import { Lightning } from './lightning';

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
  /** The hero's skill projectiles. */
  skill: number;
  shot: number;
  telegraph: number;
  /** Item colours by kind, such as gold or a healing item. */
  items: Record<string, number>;
  guide?: { arrow: number };
}

interface Decal {
  mesh: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  age: number;
  life: number;
}

interface Puff {
  mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  age: number;
  life: number;
  vx: number;
  vy: number;
  vz: number;
}

/** Marks on the ground fade over their last few seconds. */
const DECAL_FADE_SECONDS = 3;
const DECAL_POOL = 48;
const PUFF_POOL = 32;

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
  private readonly skillShots: THREE.Mesh[] = [];
  private readonly shots: THREE.Mesh[] = [];
  private readonly circles: Array<THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>> = [];
  private readonly flashes: Flash[] = [];
  private readonly lightning: Lightning;
  private readonly domes: EnergyDomes;
  /** The way to the quest's next goal, if the look guides the player. */
  readonly goalArrow: GoalArrow | null;
  private readonly items = new Map<string, THREE.Mesh[]>();
  private readonly itemsUsed = new Map<string, number>();
  private readonly decals: Decal[] = [];
  private readonly puffs: Puff[] = [];

  constructor(scene: THREE.Scene, colours: EffectColours) {
    const skillGeometry = new THREE.SphereGeometry(0.15, 12, 8);
    const skillMaterial = new THREE.MeshBasicMaterial({ color: colours.skill });
    const shotGeometry = new THREE.CylinderGeometry(0.025, 0.025, 0.55, 6).rotateX(Math.PI / 2);
    const shotMaterial = new THREE.MeshBasicMaterial({ color: colours.shot });
    const circleGeometry = new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2);
    const flashGeometry = new THREE.SphereGeometry(1, 16, 10);
    const itemGeometry = new THREE.CylinderGeometry(0.12, 0.12, 0.06, 14);
    for (let i = 0; i < DECAL_POOL; i++) {
      this.decals.push({
        mesh: hidden(scene, new THREE.Mesh(circleGeometry, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }))),
        age: 0, life: 0,
      });
    }
    const puffGeometry = new THREE.SphereGeometry(1, 10, 8);
    for (let i = 0; i < PUFF_POOL; i++) {
      this.puffs.push({
        mesh: hidden(scene, new THREE.Mesh(puffGeometry, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }))),
        age: 0, life: 0, vx: 0, vy: 0, vz: 0,
      });
    }
    for (const [kind, colour] of Object.entries(colours.items)) {
      const material = new THREE.MeshLambertMaterial({ color: colour, emissive: colour, emissiveIntensity: 0.35 });
      const pool: THREE.Mesh[] = [];
      for (let i = 0; i < POOL_SIZE; i++) pool.push(hidden(scene, new THREE.Mesh(itemGeometry, material)));
      this.items.set(kind, pool);
    }
    this.lightning = new Lightning(scene);
    this.domes = new EnergyDomes(scene);
    this.goalArrow = colours.guide ? new GoalArrow(scene, colours.guide.arrow) : null;
    for (let i = 0; i < POOL_SIZE; i++) {
      this.skillShots.push(hidden(scene, new THREE.Mesh(skillGeometry, skillMaterial)));
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
    let skill = 0;
    let shot = 0;
    for (const p of projectiles) {
      const mesh = p.kind === 'skill' ? this.skillShots[skill++] : this.shots[shot++];
      if (!mesh) continue;
      mesh.visible = true;
      mesh.position.set(p.prevX + (p.x - p.prevX) * alpha, PROJECTILE_HEIGHT, p.prevY + (p.y - p.prevY) * alpha);
      mesh.rotation.y = Math.atan2(p.vx, p.vy);
    }
    for (let i = skill; i < POOL_SIZE; i++) this.skillShots[i]!.visible = false;
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

  /**
   * A lightning stroke from one point to another, `fromHeight` and `toHeight` tiles above the ground, crackling for
   * `seconds` after waiting `delay` seconds; `width` scales it, for thinner branches.
   */
  arc(
    fromX: number, fromY: number, fromHeight: number, toX: number, toY: number, toHeight: number,
    colour: number, seconds: number, delay = 0, width = 1,
  ): void {
    this.lightning.strike(fromX, fromY, fromHeight, toX, toY, toHeight, colour, seconds, delay, width);
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

  /** A dome of energy `radius` tiles across, standing in glowing mist, for a burst of lightning. */
  dome(x: number, y: number, radius: number, colour: number, seconds: number): void {
    this.domes.show(x, y, 0.4, radius, colour, seconds);
  }

  /** A mark on the ground, such as blood or a scorch, that lasts `seconds`. */
  decal(x: number, y: number, radius: number, colour: number, opacity: number, seconds: number): void {
    const d = this.decals.find((candidate) => candidate.age >= candidate.life) ?? this.decals[0]!;
    d.age = 0;
    d.life = seconds;
    d.mesh.position.set(x, 0.01, y);
    d.mesh.scale.setScalar(radius);
    d.mesh.material.color.set(colour);
    d.mesh.material.userData.opacity = opacity;
    d.mesh.material.opacity = opacity;
    d.mesh.visible = true;
  }

  /** Removes every mark, for example when a different level is shown. */
  clearDecals(): void {
    for (const d of this.decals) {
      d.age = d.life;
      d.mesh.visible = false;
    }
  }

  /** A puff of smoke rising from a point `height` tiles up, drifting with the given velocity in tiles a second. */
  smoke(x: number, y: number, height: number, vx: number, vy: number, vz: number, colour: number, seconds: number): void {
    const p = this.puffs.find((candidate) => candidate.age >= candidate.life) ?? this.puffs[0]!;
    p.age = 0;
    p.life = seconds;
    p.vx = vx;
    p.vy = vy;
    p.vz = vz;
    p.mesh.position.set(x, height, y);
    p.mesh.material.color.set(colour);
    p.mesh.visible = true;
  }

  /** Shows or hides every pooled mesh at once, so their shaders can be compiled before they're needed. */
  setAllVisible(visible: boolean): void {
    for (const list of [this.skillShots, this.shots, this.circles]) for (const m of list) m.visible = visible;
    for (const f of this.flashes) f.mesh.visible = visible;
    this.domes.setAllVisible(visible);
    this.goalArrow?.setVisible(visible);
    for (const d of this.decals) d.mesh.visible = visible;
    for (const p of this.puffs) p.mesh.visible = visible;
    for (const pool of this.items.values()) for (const m of pool) m.visible = visible;
  }

  update(frameSeconds: number): void {
    this.lightning.update(frameSeconds);
    this.domes.update(frameSeconds);
    for (const d of this.decals) {
      if (d.age >= d.life) continue;
      d.age += frameSeconds;
      if (d.age >= d.life) d.mesh.visible = false;
      else d.mesh.material.opacity = (d.mesh.material.userData.opacity as number) * Math.min(1, (d.life - d.age) / DECAL_FADE_SECONDS);
    }
    for (const p of this.puffs) {
      if (p.age >= p.life) continue;
      p.age += frameSeconds;
      if (p.age >= p.life) {
        p.mesh.visible = false;
        continue;
      }
      const k = p.age / p.life;
      p.mesh.position.x += p.vx * frameSeconds;
      p.mesh.position.z += p.vy * frameSeconds;
      p.mesh.position.y += p.vz * frameSeconds;
      p.mesh.scale.setScalar(0.12 + 0.3 * k);
      p.mesh.material.opacity = 0.35 * (1 - k);
    }
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
