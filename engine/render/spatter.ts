import * as THREE from 'three';

/** Droplets and splats in flight or on the ground at once; the oldest give way to new ones. */
const DROPLETS = 96;
const SPLATS = 192;
/** Tiles a second squared that droplets fall at. */
const GRAVITY = 9.8;
/** A splat spreads to its size over this long, lies this long, then dries away over this long. */
const SPREAD_SECONDS = 0.15;
const LIE_SECONDS = 25;
const DRY_SECONDS = 6;
/** Splats lie just above the ground and its marks, so they show over them. */
const SPLAT_HEIGHT = 0.015;
const UP = new THREE.Vector3(0, 1, 0);

interface Droplet {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  colour: THREE.Color;
  flying: boolean;
}

interface Splat {
  x: number;
  y: number;
  size: number;
  /** Smeared this many times longer along the way the droplet was flying, which `facing` turns it to. */
  stretch: number;
  facing: THREE.Quaternion;
  colour: THREE.Color;
  age: number;
  lying: boolean;
}

/**
 * Liquid thrown off an actor, such as oil from a machine being cut: droplets fly out, fall and splat where they land,
 * and the splats lie a while before drying away. Drawn as two instanced meshes, so a whole spill costs two draw calls,
 * and made up front, so nothing is allocated while it plays.
 */
export class Spatter {
  private readonly droplets: Droplet[] = [];
  private readonly splats: Splat[] = [];
  private readonly dropletMesh: THREE.InstancedMesh;
  private readonly splatMesh: THREE.InstancedMesh;
  private nextDroplet = 0;
  private nextSplat = 0;
  private readonly matrix = new THREE.Matrix4();
  private readonly turn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  private readonly position = new THREE.Vector3();
  private readonly scale = new THREE.Vector3();
  private readonly still = new THREE.Quaternion();
  private readonly yaw = new THREE.Quaternion();
  /** Stands in for a droplet when a puddle's blobs are laid down, giving each its colour and the way it's smeared. */
  private readonly flat: Droplet = { x: 0, y: 0, z: 0, vx: 1, vy: 0, vz: 0, size: 0, colour: new THREE.Color(), flying: false };

  constructor(scene: THREE.Scene) {
    this.dropletMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshBasicMaterial(), DROPLETS);
    this.splatMesh = new THREE.InstancedMesh(
      new THREE.CircleGeometry(1, 10),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.88, depthWrite: false }),
      SPLATS,
    );
    for (const mesh of [this.dropletMesh, this.splatMesh]) {
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(mesh.instanceMatrix.count * 3), 3);
      scene.add(mesh);
    }
    for (let i = 0; i < DROPLETS; i++) this.droplets.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size: 0, colour: new THREE.Color(), flying: false });
    for (let i = 0; i < SPLATS; i++) {
      this.splats.push({ x: 0, y: 0, size: 0, stretch: 1, facing: new THREE.Quaternion(), colour: new THREE.Color(), age: 0, lying: false });
    }
  }

  /**
   * Throws `count` droplets of `colour` from `x`, `y`, `height` tiles up, mostly towards `dirX`, `dirY` along the
   * ground (a unit vector), spread wider by `spread`.
   */
  spray(x: number, y: number, height: number, dirX: number, dirY: number, colour: number, count: number, spread = 0.6): void {
    for (let k = 0; k < count; k++) {
      const d = this.droplets[this.nextDroplet]!;
      this.nextDroplet = (this.nextDroplet + 1) % DROPLETS;
      // Mostly a fine spray, now and then a fat drop thrown further.
      const fat = Math.random() < 0.15;
      const speed = 0.5 + Math.random() * (fat ? 3.2 : 2.2);
      const sideways = (Math.random() * 2 - 1) * spread;
      d.x = x;
      d.y = y;
      d.z = height;
      d.vx = (dirX - dirY * sideways) * speed;
      d.vy = (dirY + dirX * sideways) * speed;
      d.vz = 0.4 + Math.random() * 2.4;
      d.size = fat ? 0.035 + Math.random() * 0.02 : 0.01 + Math.random() * 0.02;
      d.colour.set(colour);
      d.flying = true;
    }
  }

  /** Leaves an uneven puddle of `colour` about `radius` tiles across, as of liquid leaked from something broken. */
  puddle(x: number, y: number, radius: number, colour: number): void {
    this.flat.colour.set(colour);
    const blobs = 4 + Math.floor(Math.random() * 3);
    for (let k = 0; k < blobs; k++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * radius * 0.5;
      this.flat.vx = Math.cos(a);
      this.flat.vy = Math.sin(a);
      this.splat(this.flat, x + Math.cos(a) * r, y + Math.sin(a) * r, radius * (0.35 + Math.random() * 0.3), 1 + Math.random() * 0.5);
    }
  }

  update(frameSeconds: number): void {
    let flying = 0;
    for (const d of this.droplets) {
      if (!d.flying) continue;
      d.vz -= GRAVITY * frameSeconds;
      d.x += d.vx * frameSeconds;
      d.y += d.vy * frameSeconds;
      d.z += d.vz * frameSeconds;
      if (d.z <= 0) {
        d.flying = false;
        this.land(d);
        continue;
      }
      this.matrix.compose(this.position.set(d.x, d.z, d.y), this.still, this.scale.setScalar(d.size));
      this.dropletMesh.setMatrixAt(flying, this.matrix);
      this.dropletMesh.setColorAt(flying, d.colour);
      flying++;
    }
    this.dropletMesh.count = flying;
    this.dropletMesh.instanceMatrix.needsUpdate = true;
    this.dropletMesh.instanceColor!.needsUpdate = true;

    let lying = 0;
    for (const s of this.splats) {
      if (!s.lying) continue;
      s.age += frameSeconds;
      const drying = s.age - SPREAD_SECONDS - LIE_SECONDS;
      if (drying >= DRY_SECONDS) {
        s.lying = false;
        continue;
      }
      const grown = Math.min(1, s.age / SPREAD_SECONDS) * (drying > 0 ? 1 - drying / DRY_SECONDS : 1);
      const size = s.size * grown;
      this.matrix.compose(this.position.set(s.x, SPLAT_HEIGHT, s.y), s.facing, this.scale.set(size * s.stretch, size, 1));
      this.splatMesh.setMatrixAt(lying, this.matrix);
      this.splatMesh.setColorAt(lying, s.colour);
      lying++;
    }
    this.splatMesh.count = lying;
    this.splatMesh.instanceMatrix.needsUpdate = true;
    this.splatMesh.instanceColor!.needsUpdate = true;
  }

  /** Where liquid can land, by tile; droplets that come down anywhere else, such as on a wall, are lost. */
  private landsOn: (tx: number, ty: number) => boolean = () => true;

  /** Clears every droplet and splat, for moving to another level whose ground `landsOn` says where liquid can lie. */
  clear(landsOn: (tx: number, ty: number) => boolean = () => true): void {
    this.landsOn = landsOn;
    for (const d of this.droplets) d.flying = false;
    for (const s of this.splats) s.lying = false;
    this.dropletMesh.count = 0;
    this.splatMesh.count = 0;
  }

  /** Shows one of each, so their shaders compile before play rather than mid-fight; then hides them again. */
  setAllVisible(visible: boolean): void {
    this.dropletMesh.count = visible ? 1 : 0;
    this.splatMesh.count = visible ? 1 : 0;
  }

  /** A droplet splats where it lands, and a fast one scatters a few tiny drops on ahead of it. */
  private land(d: Droplet): void {
    const speed = Math.hypot(d.vx, d.vy);
    // Faster droplets smear further.
    this.splat(d, d.x, d.y, d.size * (1.4 + Math.random() * 2), 1 + Math.min(1.8, speed * (0.25 + Math.random() * 0.3)));
    const satellites = speed > 1.5 ? Math.floor(Math.random() * 3) : 0;
    for (let k = 0; k < satellites; k++) {
      const ahead = 0.06 + Math.random() * 0.16;
      const aside = (Math.random() * 2 - 1) * 0.06;
      const x = d.x + (d.vx * ahead - d.vy * aside) / speed;
      const y = d.y + (d.vy * ahead + d.vx * aside) / speed;
      this.splat(d, x, y, d.size * (0.4 + Math.random() * 0.5), 1 + Math.random() * 0.6);
    }
  }

  private splat(d: Droplet, x: number, y: number, size: number, stretch: number): void {
    if (!this.landsOn(Math.floor(x), Math.floor(y))) return;
    const s = this.splats[this.nextSplat]!;
    this.nextSplat = (this.nextSplat + 1) % SPLATS;
    s.x = x;
    s.y = y;
    s.size = size;
    s.stretch = stretch;
    this.yaw.setFromAxisAngle(UP, Math.atan2(-d.vy, d.vx));
    s.facing.multiplyQuaternions(this.yaw, this.turn);
    s.colour.copy(d.colour);
    s.age = 0;
    s.lying = true;
  }
}
