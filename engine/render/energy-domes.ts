import * as THREE from 'three';
import { NOISE_GLSL } from './shader-noise';

const POOL = 4;
/** How long a dome takes to swell to full size, and the share of its life it spends fading at the end. */
const GROW_SECONDS = 0.12;
const FADE_SHARE = 0.45;
/** The mist at a dome's foot spreads this far beyond the dome. */
const MIST_REACH = 1.5;

interface Dome {
  shell: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  mist: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  age: number;
  life: number;
  radius: number;
}

/**
 * Domes of energy for bursts: a see-through shell with a bright rim and veins of lightning crawling over it, standing in
 * a ring of glowing mist. Drawn from a pool made up front.
 */
export class EnergyDomes {
  private readonly domes: Dome[] = [];

  constructor(scene: THREE.Scene) {
    const sphere = new THREE.SphereGeometry(1, 32, 20);
    const plane = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
    for (let i = 0; i < POOL; i++) {
      const shell = new THREE.Mesh(sphere, material(SHELL_VERTEX, SHELL_FRAGMENT, THREE.DoubleSide));
      const mist = new THREE.Mesh(plane, material(MIST_VERTEX, MIST_FRAGMENT, THREE.FrontSide));
      shell.visible = false;
      mist.visible = false;
      scene.add(shell, mist);
      this.domes.push({ shell, mist, age: 0, life: 0, radius: 0 });
    }
  }

  /** A dome of `radius` tiles, its middle `height` tiles up, lasting `seconds`. */
  show(x: number, y: number, height: number, radius: number, colour: number, seconds: number): void {
    const d = this.domes.find((candidate) => candidate.age >= candidate.life)
      ?? this.domes.reduce((a, b) => (a.age / a.life > b.age / b.life ? a : b));
    d.age = 0;
    d.life = seconds;
    d.radius = radius;
    const seed = Math.random() * 100;
    for (const mesh of [d.shell, d.mist]) {
      mesh.material.uniforms.colour!.value.set(colour);
      mesh.material.uniforms.seed!.value = seed;
      mesh.visible = true;
    }
    d.shell.position.set(x, height, y);
    d.mist.position.set(x, 0.03, y);
  }

  setAllVisible(visible: boolean): void {
    for (const d of this.domes) {
      d.shell.visible = visible;
      d.mist.visible = visible;
    }
  }

  update(frameSeconds: number): void {
    for (const d of this.domes) {
      if (d.age >= d.life) {
        d.shell.visible = false;
        d.mist.visible = false;
        continue;
      }
      d.age += frameSeconds;
      const k = Math.min(1, d.age / d.life);
      const grown = 1 - (1 - Math.min(1, d.age / GROW_SECONDS)) ** 3;
      const fade = k < 1 - FADE_SHARE ? 1 : (1 - k) / FADE_SHARE;
      // A bright flash as it bursts out, settling to a steady glow.
      const intensity = fade * (1 + 0.8 * Math.max(0, 1 - d.age / GROW_SECONDS));
      d.shell.scale.setScalar(d.radius * (0.3 + 0.7 * grown));
      d.mist.scale.setScalar(d.radius * MIST_REACH * (0.6 + 0.3 * grown + 0.15 * k));
      for (const mesh of [d.shell, d.mist]) {
        mesh.material.uniforms.time!.value = d.age;
        mesh.material.uniforms.intensity!.value = intensity;
      }
    }
  }
}

function material(vertexShader: string, fragmentShader: string, side: THREE.Side): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      time: { value: 0 },
      seed: { value: 0 },
      intensity: { value: 0 },
      colour: { value: new THREE.Color() },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side,
  });
}

const SHELL_VERTEX = /* glsl */ `
varying vec3 vNormal;
varying vec3 vLocal;
void main() {
  vLocal = position;
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const SHELL_FRAGMENT = /* glsl */ `
uniform float time;
uniform float seed;
uniform float intensity;
uniform vec3 colour;
varying vec3 vNormal;
varying vec3 vLocal;

${NOISE_GLSL}

// Noise wrapped around the sphere from three sides, so it has no seam.
float around(vec3 p, float t) {
  vec3 w = abs(normalize(vLocal));
  w /= w.x + w.y + w.z;
  return fbm(p.xy + vec2(seed, t)) * w.z + fbm(p.zy + vec2(t, seed)) * w.x + fbm(p.xz - vec2(seed, t)) * w.y;
}

void main() {
  float facing = abs(normalize(vNormal).z);
  float rim = pow(1.0 - facing, 2.2);
  // Thin ridges of the noise, flickering fast, read as lightning crawling over the shell.
  float v = around(vLocal * 2.0, time * 3.0);
  float haze = around(vLocal * 1.4, time * 0.8);
  // Only patches of the shell crackle at a time.
  float veins = smoothstep(0.95, 0.995, 1.0 - abs(v * 2.0 - 1.0)) * smoothstep(0.45, 0.6, haze);
  float glow = rim * 0.55 + veins * 0.7 + haze * 0.06 + 0.02;
  vec3 c = mix(colour, vec3(1.0), clamp(veins * 0.7, 0.0, 1.0));
  gl_FragColor = vec4(c, clamp(glow * intensity, 0.0, 1.0));
  #include <colorspace_fragment>
}
`;

const MIST_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const MIST_FRAGMENT = /* glsl */ `
uniform float time;
uniform float seed;
uniform float intensity;
uniform vec3 colour;
varying vec2 vUv;

${NOISE_GLSL}

void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  float d = length(p);
  // Billowing clouds, thickest in a ring around the dome's foot and thinning towards the middle and the edge.
  float clouds = fbm(p * 3.0 + vec2(seed, time * 0.6)) * 0.6 + fbm(p * 6.0 - vec2(time * 0.9, seed)) * 0.4;
  float ring = exp(-pow((d - 0.62) / 0.2, 2.0));
  float fill = 0.3 * (1.0 - smoothstep(0.0, 0.65, d));
  float puffs = smoothstep(0.35, 0.8, clouds);
  float a = (ring + fill) * (0.25 + puffs) * (1.0 - smoothstep(0.8, 1.0, d));
  vec3 c = mix(colour, vec3(1.0), puffs * ring * 0.5);
  gl_FragColor = vec4(c, clamp(a * intensity, 0.0, 1.0));
  #include <colorspace_fragment>
}
`;
