import * as THREE from 'three';
import { NOISE_GLSL } from './shader-noise';

/** Where a fire burns: on top of a prop, `height` tiles up, with flames about `size` tiles tall. */
export interface FlameSpot {
  x: number;
  y: number;
  height: number;
  size: number;
  colour: number;
}

const EMBERS_PER_FIRE = 8;
/** A flame is this much narrower than it is tall. */
const ASPECT = 0.8;

interface Fire {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  spot: FlameSpot;
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
 * Fires on top of props, such as a burning barrel: a soft flame drawn by a shader, noise rising through a teardrop
 * shape and coloured from the dark edge to the hot core, plus embers drifting up out of it. Each flame is one quad
 * turned to face the camera in the vertex shader. Built with a level and freed with it.
 */
export class Flames {
  readonly group = new THREE.Group();
  private readonly fires: Fire[] = [];
  private readonly embers: Ember[] = [];

  constructor(spots: readonly FlameSpot[]) {
    const quad = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
    const ember = new THREE.SphereGeometry(1, 5, 4);
    for (const spot of spots) {
      const material = new THREE.ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms: {
          time: { value: 0 },
          seed: { value: Math.random() * 100 },
          colour: { value: new THREE.Color(spot.colour) },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(quad, material);
      mesh.position.set(spot.x, spot.height, spot.y);
      mesh.scale.set(spot.size * ASPECT, spot.size, 1);
      // The vertex shader moves the quad to face the camera, so its own bounds don't say where it shows.
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this.fires.push({ mesh, spot, phase: Math.random() * 10 });
      for (let k = 0; k < EMBERS_PER_FIRE; k++) {
        const mesh = new THREE.Mesh(ember, new THREE.MeshBasicMaterial({
          color: new THREE.Color(spot.colour).lerp(WHITE, 0.3), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        }));
        mesh.scale.setScalar(0.012 + Math.random() * 0.01);
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
    for (const f of this.fires) {
      f.mesh.material.uniforms.time!.value = seconds;
      // The flame breathes a little in height, as a fire draws air.
      const breath = 1 + Math.sin(seconds * 7 + f.phase) * 0.06 + Math.sin(seconds * 17 + f.phase * 3) * 0.04;
      f.mesh.scale.y = f.spot.size * breath;
    }
    for (const e of this.embers) {
      e.age += frameSeconds;
      if (e.age >= e.life) this.relight(e);
      // Embers drift on the rising air and wobble as they go.
      e.mesh.position.x += (e.vx + Math.sin(e.age * 9 + e.vz * 40) * 0.08) * frameSeconds;
      e.mesh.position.y += e.vy * frameSeconds;
      e.mesh.position.z += e.vz * frameSeconds;
      e.mesh.material.opacity = (1 - e.age / e.life) * (0.6 + Math.random() * 0.4);
    }
  }

  /** Sends an ember up again from the fire's heart. */
  private relight(e: Ember): void {
    const { spot } = e;
    e.age = 0;
    e.life = 0.8 + Math.random() * 1.2;
    e.vx = (Math.random() - 0.5) * 0.15;
    e.vy = 0.45 + Math.random() * 0.5;
    e.vz = (Math.random() - 0.5) * 0.15;
    e.mesh.position.set(spot.x + (Math.random() - 0.5) * spot.size * 0.3, spot.height + spot.size * 0.35, spot.y + (Math.random() - 0.5) * spot.size * 0.3);
  }
}

const WHITE = new THREE.Color(0xffffff);

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 centre = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  vec2 size = vec2(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz));
  centre.xy += position.xy * size;
  gl_Position = projectionMatrix * centre;
}
`;

const FRAGMENT = /* glsl */ `
uniform float time;
uniform float seed;
uniform vec3 colour;
varying vec2 vUv;

${NOISE_GLSL}

void main() {
  float x = (vUv.x - 0.5) * 2.0;
  float y = vUv.y;
  // Noise rising faster than the flame, so tongues break off and lick upwards.
  float n = fbm(vec2(vUv.x * 3.0 + seed, y * 2.6 - time * 2.4));
  float lick = fbm(vec2(vUv.x * 5.0 - seed, y * 4.0 - time * 3.6));
  // The higher up, the more the flame sways and frays.
  float sway = (n - 0.5) * 0.7 * y;
  // A teardrop: round at the base, narrowing to a tip.
  float halfWidth = 0.75 * sqrt(clamp(y * 6.0, 0.0, 1.0)) * (1.0 - pow(y, 1.3));
  float heat = halfWidth - abs(x + sway) + (lick - 0.5) * 0.45 * (0.3 + y);
  float alpha = smoothstep(0.0, 0.18, heat) * (1.0 - smoothstep(0.75, 1.0, y));
  float core = clamp(heat * 2.4 * (1.0 - y * 0.6), 0.0, 1.0);
  vec3 c = mix(colour * vec3(0.55, 0.18, 0.08), colour, smoothstep(0.0, 0.45, core));
  c = mix(c, vec3(1.0, 0.92, 0.7), smoothstep(0.55, 1.0, core));
  // Additive blending already scales by alpha.
  gl_FragColor = vec4(c, alpha);
  #include <colorspace_fragment>
}
`;
