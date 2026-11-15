import * as THREE from 'three';

/** At most this many machines scan the hero at once. */
const POOL = 6;
/** The beam's cone spreads this many times the scanned body's radius by the time it reaches the ground. */
const SPREAD = 2.4;
/** The beam fades in over this share of a scan, and out over this share at its end, rather than switching on and off. */
const FADE_IN_SHARE = 0.2;
const FADE_OUT_SHARE = 0.25;

/** What one machine's scan of a body looks like this frame. */
export interface ScanView {
  fromX: number;
  fromY: number;
  fromHeight: number;
  x: number;
  y: number;
  /** The radius of the body being scanned. */
  radius: number;
  progress: number;
}

interface Beam {
  cone: THREE.Mesh<THREE.CylinderGeometry, THREE.ShaderMaterial>;
  pool: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
}

/**
 * Machines looking a body over: a cone of light from the eye down over the body like a spotlight, brightest at the
 * eye and soft at its edges, with a pool of light on the ground at its foot. Drawn from a pool made up front.
 */
export class ScanBeams {
  private readonly beams: Beam[] = [];
  private readonly target = new THREE.Vector3();

  constructor(scene: THREE.Scene, colour: number) {
    // Open at both ends, its tip at the origin and its base one tile along z, so it can be aimed with lookAt.
    const coneGeometry = new THREE.CylinderGeometry(0.02, 1, 1, 24, 1, true).translate(0, -0.5, 0).rotateX(-Math.PI / 2);
    const plane = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
    for (let i = 0; i < POOL; i++) {
      const cone = new THREE.Mesh(coneGeometry, material(CONE_VERTEX, CONE_FRAGMENT, colour, THREE.DoubleSide));
      const pool = new THREE.Mesh(plane, material(POOL_VERTEX, POOL_FRAGMENT, colour, THREE.FrontSide));
      cone.visible = pool.visible = false;
      scene.add(cone, pool);
      this.beams.push({ cone, pool });
    }
  }

  /** Shows the first `count` of `scans`, and hides the rest of the pool. */
  show(scans: readonly ScanView[], count: number): void {
    for (let i = 0; i < POOL; i++) {
      const { cone, pool } = this.beams[i]!;
      const s = i < count ? scans[i] : undefined;
      cone.visible = pool.visible = Boolean(s);
      if (!s) continue;
      const strength = scanStrength(s.progress);
      const reach = s.radius * SPREAD;
      cone.position.set(s.fromX, s.fromHeight, s.fromY);
      this.target.set(s.x, 0, s.y);
      cone.lookAt(this.target);
      cone.scale.set(reach, reach, cone.position.distanceTo(this.target));
      cone.material.uniforms.strength!.value = strength;
      pool.position.set(s.x, 0.03, s.y);
      pool.scale.setScalar(reach * 1.2);
      pool.material.uniforms.strength!.value = strength;
    }
  }

  setAllVisible(visible: boolean): void {
    for (const { cone, pool } of this.beams) cone.visible = pool.visible = visible;
  }
}

/** How bright a scan is at `progress` from 0 to 1: rising at its start and dying away at its end. */
export function scanStrength(progress: number): number {
  return Math.max(0, Math.min(1, progress / FADE_IN_SHARE, (1 - progress) / FADE_OUT_SHARE));
}

function material(vertexShader: string, fragmentShader: string, colour: number, side: THREE.Side): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: { strength: { value: 0 }, colour: { value: new THREE.Color(colour) } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side,
  });
}

const CONE_VERTEX = /* glsl */ `
varying float along;
varying float facing;
void main() {
  along = position.z;
  // The camera looks straight down its own z, so how squarely the surface faces it is the normal's z in view space.
  facing = abs(normalize(normalMatrix * normal).z);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// Faces seen edge-on fade out, which softens the cone's outline the way light through haze looks.
const CONE_FRAGMENT = /* glsl */ `
uniform float strength;
uniform vec3 colour;
varying float along;
varying float facing;
void main() {
  float glow = pow(facing, 1.5) * mix(0.9, 0.18, along);
  gl_FragColor = vec4(colour, glow * strength);
}
`;

const POOL_VERTEX = /* glsl */ `
varying vec2 spot;
void main() {
  spot = position.xz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const POOL_FRAGMENT = /* glsl */ `
uniform float strength;
uniform vec3 colour;
varying vec2 spot;
void main() {
  float d = length(spot);
  float glow = pow(clamp(1.0 - d, 0.0, 1.0), 1.6) * 0.75;
  gl_FragColor = vec4(colour, glow * strength);
}
`;
