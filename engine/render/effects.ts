import * as THREE from 'three';

/** Heights above the ground, in tiles. */
const PROJECTILE_HEIGHT = 0.52;
const POOL_SIZE = 24;
const ARC_POOL = 64;
/** Kinks along each lightning arc, and how wide its ribbons are, in tiles. */
const ARC_SEGMENTS = 8;
const ARC_WIDTH = 0.04;
/** At most this many machines scan the hero at once. */
const SCAN_POOL = 6;
const scanTarget = new THREE.Vector3();

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

/** A beam from an eye to a ring around a body, sweeping down it as `progress` goes from 0 to 1. */
export interface ScanView {
  fromX: number;
  fromY: number;
  fromHeight: number;
  x: number;
  y: number;
  /** The height of the body being scanned, and the ring's radius around it. */
  height: number;
  radius: number;
  progress: number;
}

export interface EffectColours {
  /** The hero's skill projectiles. */
  skill: number;
  shot: number;
  telegraph: number;
  /** Item colours by kind, such as gold or a healing item. */
  items: Record<string, number>;
  scan?: number;
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

/** A lightning arc between two points, re-jittered every frame so it crackles until it fades. */
interface Arc {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  from: THREE.Vector3;
  to: THREE.Vector3;
  /** Below 0 while the arc waits to strike. */
  age: number;
  life: number;
  /** How far the arc's middle wanders from a straight line, as a share of its length. */
  wander: number;
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
  private readonly skillShots: THREE.Mesh[] = [];
  private readonly shots: THREE.Mesh[] = [];
  private readonly circles: Array<THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>> = [];
  private readonly flashes: Flash[] = [];
  private readonly arcs: Arc[] = [];
  private readonly items = new Map<string, THREE.Mesh[]>();
  private readonly itemsUsed = new Map<string, number>();
  private readonly decals: Decal[] = [];
  private readonly puffs: Puff[] = [];
  private readonly scanBeams: THREE.Mesh[] = [];
  private readonly scanRings: THREE.Mesh[] = [];

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
    // A beam one tile long along z, from its start, stretched to reach; a thin ring laid flat around the body.
    const beamGeometry = new THREE.CylinderGeometry(0.022, 0.022, 1, 5).rotateX(Math.PI / 2).translate(0, 0, 0.5);
    const ringGeometry = new THREE.RingGeometry(0.85, 1, 32).rotateX(-Math.PI / 2);
    const scanMaterial = new THREE.MeshBasicMaterial({
      color: colours.scan ?? colours.skill, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    for (let i = 0; i < SCAN_POOL; i++) {
      this.scanBeams.push(hidden(scene, new THREE.Mesh(beamGeometry, scanMaterial)));
      this.scanRings.push(hidden(scene, new THREE.Mesh(ringGeometry, scanMaterial)));
    }
    for (let i = 0; i < ARC_POOL; i++) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array((ARC_SEGMENTS + 1) * 4 * 3), 3));
      geometry.setIndex(arcIndices());
      const material = new THREE.MeshBasicMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      });
      const mesh = hidden(scene, new THREE.Mesh(geometry, material));
      mesh.frustumCulled = false;
      this.arcs.push({ mesh, from: new THREE.Vector3(), to: new THREE.Vector3(), age: 0, life: 0, wander: 0 });
    }
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
  /** Machines scanning a body: each beam reaches a ring that sweeps from the head down to the feet. */
  showScans(scans: readonly ScanView[], count: number): void {
    for (let i = 0; i < SCAN_POOL; i++) {
      const beam = this.scanBeams[i]!;
      const ring = this.scanRings[i]!;
      const s = i < count ? scans[i] : undefined;
      beam.visible = ring.visible = Boolean(s);
      if (!s) continue;
      const h = s.height * (1 - s.progress);
      ring.position.set(s.x, h, s.y);
      ring.scale.setScalar(s.radius);
      beam.position.set(s.fromX, s.fromHeight, s.fromY);
      scanTarget.set(s.x, h, s.y);
      beam.lookAt(scanTarget);
      beam.scale.set(1, 1, beam.position.distanceTo(scanTarget));
    }
  }

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
   * A lightning arc from one point to another, `fromHeight` and `toHeight` tiles above the ground, crackling for
   * `seconds` after waiting `delay` seconds. When every arc is busy, the one furthest through its life is reused.
   */
  arc(
    fromX: number, fromY: number, fromHeight: number, toX: number, toY: number, toHeight: number,
    colour: number, seconds: number, delay = 0,
  ): void {
    let a = this.arcs[0]!;
    for (const candidate of this.arcs) {
      if (candidate.age >= candidate.life) {
        a = candidate;
        break;
      }
      if (candidate.age / candidate.life > a.age / a.life) a = candidate;
    }
    a.from.set(fromX, fromHeight, fromY);
    a.to.set(toX, toHeight, toY);
    a.age = -delay;
    a.life = seconds;
    a.wander = 0.2 + Math.random() * 0.35;
    a.mesh.material.color.set(colour);
    a.mesh.visible = delay <= 0;
    if (a.mesh.visible) jitterArc(a);
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
    for (const d of this.decals) d.mesh.visible = visible;
    for (const p of this.puffs) p.mesh.visible = visible;
    for (const pool of this.items.values()) for (const m of pool) m.visible = visible;
  }

  update(frameSeconds: number): void {
    for (const a of this.arcs) {
      if (a.age >= a.life) continue;
      a.age += frameSeconds;
      if (a.age >= a.life) {
        a.mesh.visible = false;
        continue;
      }
      if (a.age < 0) continue;
      a.mesh.visible = true;
      jitterArc(a);
      // Lightning flickers rather than fading smoothly.
      a.mesh.material.opacity = (1 - a.age / a.life) * (0.55 + Math.random() * 0.45);
    }
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

/**
 * Each arc is two crossed ribbons, one flat and one upright, so it reads from any angle; the quads of each ribbon run
 * along the arc's kinks.
 */
function arcIndices(): number[] {
  const indices: number[] = [];
  for (let ribbon = 0; ribbon < 2; ribbon++) {
    const base = ribbon * (ARC_SEGMENTS + 1) * 2;
    for (let k = 0; k < ARC_SEGMENTS; k++) {
      const a = base + k * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  return indices;
}

const along = new THREE.Vector3();
const across = new THREE.Vector3();
const point = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/** Lays the arc out afresh along a new zig-zag between its ends, so it flickers from frame to frame. */
function jitterArc(a: Arc): void {
  const positions = a.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
  along.subVectors(a.to, a.from);
  const length = along.length();
  across.crossVectors(along, UP).normalize();
  if (across.lengthSq() === 0) across.set(1, 0, 0);
  for (let k = 0; k <= ARC_SEGMENTS; k++) {
    const t = k / ARC_SEGMENTS;
    // The ends stay put; the middle wanders most.
    const wander = k === 0 || k === ARC_SEGMENTS ? 0 : (Math.random() - 0.5) * length * a.wander * Math.sin(Math.PI * t);
    point.copy(a.from).addScaledVector(along, t).addScaledVector(across, wander);
    point.y += k === 0 || k === ARC_SEGMENTS ? 0 : (Math.random() - 0.5) * 0.25;
    const flat = k * 2;
    positions.setXYZ(flat, point.x + across.x * ARC_WIDTH, point.y, point.z + across.z * ARC_WIDTH);
    positions.setXYZ(flat + 1, point.x - across.x * ARC_WIDTH, point.y, point.z - across.z * ARC_WIDTH);
    const upright = (ARC_SEGMENTS + 1) * 2 + k * 2;
    positions.setXYZ(upright, point.x, point.y + ARC_WIDTH, point.z);
    positions.setXYZ(upright + 1, point.x, point.y - ARC_WIDTH, point.z);
  }
  positions.needsUpdate = true;
}
