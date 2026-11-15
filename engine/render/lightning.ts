import * as THREE from 'three';

/** Strokes that can show at once; when all are busy, the one furthest through its life is reused. */
const CAPACITY = 320;
/** Kinks along each stroke. */
const SEGMENTS = 12;
/** A stroke of width 1 has a core this many tiles wide, inside a glow this many times wider. */
const CORE_WIDTH = 0.03;
const GLOW_SCALE = 4;
const GLOW_ALPHA = 0.3;
/** Four ribbons per stroke (core and glow, each flat and upright), two vertices per kink. */
const RIBBONS = 4;
const VERTICES = (SEGMENTS + 1) * 2 * RIBBONS;

interface Stroke {
  from: THREE.Vector3;
  to: THREE.Vector3;
  /** Below 0 while the stroke waits to strike. */
  age: number;
  life: number;
  /** How far its middle wanders from a straight line, as a share of its length. */
  wander: number;
  width: number;
  colour: THREE.Color;
  /** Whether its vertices hold anything, so a finished stroke is collapsed once and then left alone. */
  drawn: boolean;
}

/**
 * Lightning: strokes between two points, each a bright core inside a soft glow, along a zig-zag laid out afresh every
 * frame so it crackles and flickers until it fades. Every stroke lives in one mesh, so any number cost one draw call.
 */
export class Lightning {
  private readonly strokes: Stroke[] = [];
  private readonly positions: THREE.BufferAttribute;
  private readonly colours: THREE.BufferAttribute;
  private busy = false;

  constructor(scene: THREE.Scene) {
    const geometry = new THREE.BufferGeometry();
    this.positions = new THREE.BufferAttribute(new Float32Array(CAPACITY * VERTICES * 3), 3);
    this.colours = new THREE.BufferAttribute(new Float32Array(CAPACITY * VERTICES * 4), 4);
    this.positions.setUsage(THREE.DynamicDrawUsage);
    this.colours.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('position', this.positions);
    geometry.setAttribute('color', this.colours);
    geometry.setIndex(strokeIndices());
    const material = new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    scene.add(mesh);
    for (let i = 0; i < CAPACITY; i++) {
      this.strokes.push({
        from: new THREE.Vector3(), to: new THREE.Vector3(), age: 0, life: 0, wander: 0, width: 1, colour: new THREE.Color(), drawn: false,
      });
    }
  }

  /**
   * A stroke from one point to another, `fromHeight` and `toHeight` tiles above the ground, crackling for `seconds`
   * after waiting `delay` seconds. `width` scales it, for thinner branches.
   */
  strike(
    fromX: number, fromY: number, fromHeight: number, toX: number, toY: number, toHeight: number,
    colour: number, seconds: number, delay = 0, width = 1,
  ): void {
    let s = this.strokes[0]!;
    for (const candidate of this.strokes) {
      if (candidate.age >= candidate.life) {
        s = candidate;
        break;
      }
      if (candidate.age / candidate.life > s.age / s.life) s = candidate;
    }
    s.from.set(fromX, fromHeight, fromY);
    s.to.set(toX, toHeight, toY);
    s.age = -delay;
    s.life = seconds;
    s.wander = 0.15 + Math.random() * 0.3;
    s.width = width;
    s.colour.set(colour);
    this.busy = true;
  }

  update(frameSeconds: number): void {
    if (!this.busy) return;
    this.busy = false;
    // Only the strokes that changed are sent to the GPU; new strokes take the first free slots, so they sit together.
    let first = CAPACITY;
    let last = -1;
    const touched = (i: number) => {
      first = Math.min(first, i);
      last = Math.max(last, i);
    };
    for (let i = 0; i < CAPACITY; i++) {
      const s = this.strokes[i]!;
      if (s.age >= s.life) {
        if (s.drawn) {
          this.collapse(i, s);
          touched(i);
        }
        continue;
      }
      this.busy = true;
      s.age += frameSeconds;
      if (s.age < 0) continue;
      touched(i);
      if (s.age >= s.life) this.collapse(i, s);
      // Lightning flickers rather than fading smoothly.
      else this.lay(i, s, (1 - s.age / s.life) * (0.55 + Math.random() * 0.45));
    }
    if (last < 0) return;
    for (const [attribute, size] of [[this.positions, 3], [this.colours, 4]] as const) {
      attribute.clearUpdateRanges();
      attribute.addUpdateRange(first * VERTICES * size, (last - first + 1) * VERTICES * size);
      attribute.needsUpdate = true;
    }
  }

  /** Lays a stroke out along a fresh zig-zag between its ends, at `brightness`. */
  private lay(index: number, s: Stroke, brightness: number): void {
    along.subVectors(s.to, s.from);
    const length = along.length();
    across.crossVectors(along, UP);
    if (across.lengthSq() < 1e-6) across.set(1, 0, 0);
    across.normalize();
    // The core is whitened, as the hottest part of a real bolt is.
    core.copy(s.colour).lerp(WHITE, 0.6);
    const base = index * VERTICES;
    for (let k = 0; k <= SEGMENTS; k++) {
      const t = k / SEGMENTS;
      const end = k === 0 || k === SEGMENTS;
      const wander = end ? 0 : (Math.random() - 0.5) * length * s.wander * Math.sin(Math.PI * t);
      point.copy(s.from).addScaledVector(along, t).addScaledVector(across, wander);
      if (!end) point.y += (Math.random() - 0.5) * length * s.wander * 0.5 * Math.sin(Math.PI * t);
      // Strokes taper towards their tip.
      const taper = 1 - t * 0.6;
      for (let ribbon = 0; ribbon < RIBBONS; ribbon++) {
        const glow = ribbon >= 2;
        const half = CORE_WIDTH * s.width * taper * (glow ? GLOW_SCALE : 1);
        const flat = ribbon % 2 === 0;
        const v = base + ribbon * (SEGMENTS + 1) * 2 + k * 2;
        if (flat) {
          this.positions.setXYZ(v, point.x + across.x * half, point.y, point.z + across.z * half);
          this.positions.setXYZ(v + 1, point.x - across.x * half, point.y, point.z - across.z * half);
        } else {
          this.positions.setXYZ(v, point.x, point.y + half, point.z);
          this.positions.setXYZ(v + 1, point.x, point.y - half, point.z);
        }
        const c = glow ? s.colour : core;
        const alpha = brightness * (glow ? GLOW_ALPHA : 1);
        this.colours.setXYZW(v, c.r, c.g, c.b, alpha);
        this.colours.setXYZW(v + 1, c.r, c.g, c.b, alpha);
      }
    }
    s.drawn = true;
  }

  /** Folds a finished stroke to nothing, so it costs no drawing. */
  private collapse(index: number, s: Stroke): void {
    const base = index * VERTICES;
    for (let v = base; v < base + VERTICES; v++) {
      this.positions.setXYZ(v, 0, -10, 0);
      this.colours.setXYZW(v, 0, 0, 0, 0);
    }
    s.drawn = false;
  }
}

function strokeIndices(): number[] {
  const indices: number[] = [];
  for (let stroke = 0; stroke < CAPACITY; stroke++) {
    for (let ribbon = 0; ribbon < RIBBONS; ribbon++) {
      const base = stroke * VERTICES + ribbon * (SEGMENTS + 1) * 2;
      for (let k = 0; k < SEGMENTS; k++) {
        const a = base + k * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
  }
  return indices;
}

const along = new THREE.Vector3();
const across = new THREE.Vector3();
const point = new THREE.Vector3();
const core = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);
const WHITE = new THREE.Color(0xffffff);
