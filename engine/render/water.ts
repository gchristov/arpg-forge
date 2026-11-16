import * as THREE from 'three';
import type { WaterLook } from './look';
import { NOISE_GLSL } from './shader-noise';

/** The surface sits just above the ground under it, so the bed shows nowhere. */
const SURFACE_HEIGHT = 0.04;

/**
 * Moving water over the tiles `isWater` picks, from `x0`, `y0` across `width` × `depth` tiles: ripples drifting along
 * the flow, glints of light on them, and the light map's lamps reflected, all fading with the level's darkness. Its
 * shore curves through the corners between water and bank rather than following the tiles' edges.
 */
export class WaterSurface {
  readonly mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;

  constructor(
    area: { x0: number; y0: number; width: number; depth: number },
    isWater: (tx: number, ty: number) => boolean,
    look: WaterLook,
    lightMap: Record<string, THREE.IUniform>,
  ) {
    const positions: number[] = [];
    const wet: number[] = [];
    // How much of the water reaches a tile corner: the share of the four tiles meeting there that are water.
    const wetAt = (cx: number, cy: number) =>
      ((isWater(cx - 1, cy - 1) ? 1 : 0) + (isWater(cx, cy - 1) ? 1 : 0) + (isWater(cx - 1, cy) ? 1 : 0) + (isWater(cx, cy) ? 1 : 0)) / 4;
    const corner = (cx: number, cy: number) => {
      positions.push(cx, 0, cy);
      wet.push(wetAt(cx, cy));
    };
    for (let y = area.y0; y < area.y0 + area.depth; y++) {
      for (let x = area.x0; x < area.x0 + area.width; x++) {
        if (wetAt(x, y) + wetAt(x + 1, y) + wetAt(x, y + 1) + wetAt(x + 1, y + 1) === 0) continue;
        // Two triangles, wound to face up.
        corner(x, y);
        corner(x, y + 1);
        corner(x + 1, y);
        corner(x + 1, y);
        corner(x, y + 1);
        corner(x + 1, y + 1);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('wet', new THREE.Float32BufferAttribute(wet, 1));
    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: {
        ...lightMap,
        time: { value: 0 },
        flow: { value: new THREE.Vector2(look.flow.x, look.flow.y) },
        deep: { value: new THREE.Color(look.deep) },
        shallow: { value: new THREE.Color(look.shallow) },
        glint: { value: new THREE.Color(look.glint) },
      },
      transparent: true,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.y = SURFACE_HEIGHT;
  }

  update(seconds: number): void {
    this.mesh.material.uniforms.time!.value = seconds;
  }
}

const VERTEX = /* glsl */ `
attribute float wet;
varying vec2 world;
varying float wetness;
void main() {
  wetness = wet;
  vec4 w = modelMatrix * vec4(position, 1.0);
  world = w.xz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

// Stylised river water, built the way such shaders usually are: ripple lines from drifting Voronoi cells, their
// coordinates bent by noise (domain warping) so nothing moves in straight lines; two copies of the pattern drifting
// downstream half a cycle apart and cross-faded (two-phase flow), so the current never stretches or shows its loop;
// slower water by the banks than mid-stream; a broken line of foam along the shore; and a few twinkling sparkles.
const FRAGMENT = /* glsl */ `
uniform sampler2D lightMap;
uniform vec4 lightMapBounds;
uniform sampler2D shadeMap;
uniform vec4 shadeBounds;
uniform float time;
uniform vec2 flow;
uniform vec3 deep;
uniform vec3 shallow;
uniform vec3 glint;
varying vec2 world;
varying float wetness;
${NOISE_GLSL}
vec2 cellPoint(vec2 cell) {
  return fract(sin(vec2(dot(cell, vec2(127.1, 311.7)), dot(cell, vec2(269.5, 183.3)))) * 43758.5453);
}

// How close a point is to the border between two drifting cells: 1 on the border, 0 well inside a cell.
float cellEdges(vec2 p, float t, float width) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float nearest = 8.0;
  float second = 8.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 o = 0.5 + 0.4 * sin(t + 6.2831 * cellPoint(i + g));
      float d = length(g + o - f);
      if (d < nearest) { second = nearest; nearest = d; }
      else if (d < second) second = d;
    }
  }
  return smoothstep(width, 0.0, second - nearest);
}

float ripples(vec2 p) {
  vec2 warp = vec2(fbm(p * 0.35 + time * 0.05), fbm(p * 0.35 + vec2(5.2, 1.3) - time * 0.04)) - 0.5;
  return cellEdges(p * 1.1 + warp * 1.6, time * 0.9, 0.12) * 0.6 + cellEdges(p * 1.9 + warp * 2.4 + 7.3, time * 1.3, 0.1) * 0.4;
}

void main() {
  float midstream = smoothstep(0.5, 1.0, wetness);
  float speed = mix(0.3, 0.8, midstream);
  float cycle = 4.0;
  float phase = fract(time / cycle);
  vec2 drift = flow * cycle * speed * 0.6;
  vec2 p = world * 0.6;
  float first = ripples(p - drift * phase);
  float second = ripples(p - drift * fract(phase + 0.5) + vec2(3.7, 9.1));
  float weight = 1.0 - abs(2.0 * phase - 1.0);
  float lines = first * weight + second * (1.0 - weight);

  float broad = fbm(world * 0.12 + vec2(fbm(world * 0.2 - flow * time * 0.05)) * 1.5);
  vec3 colour = mix(shallow, deep, midstream) * (0.9 + 0.2 * broad);
  colour += glint * lines * 0.08;

  // Sparkles: now and then a spot on the drifting surface catches the light and twinkles.
  vec2 sparkleCell = world * 2.5 - flow * time * 0.6;
  float chance = hash(floor(sparkleCell));
  float twinkle = pow(max(0.0, sin(time * 2.5 + chance * 60.0)), 24.0) * step(0.97, chance);
  colour += glint * twinkle * 0.25 * smoothstep(0.35, 0.0, length(fract(sparkleCell) - 0.5));

  // Foam along the shore, broken up and ebbing.
  float shoreBand = smoothstep(0.42, 0.52, wetness) * (1.0 - smoothstep(0.55, 0.8, wetness));
  float froth = smoothstep(0.5, 0.72, fbm(world * 1.8 + vec2(time * 0.25, 0.0)) + 0.12 * sin(time * 1.1 + world.x * 0.7 + world.y * 0.5));
  colour = mix(colour, glint * 0.5, shoreBand * froth * 0.2);

  vec2 lightUv = vec2((world.x - lightMapBounds.x) * lightMapBounds.z, 1.0 - (world.y - lightMapBounds.y) * lightMapBounds.w);
  colour += texture2D(lightMap, clamp(lightUv, 0.0, 1.0)).rgb * (0.8 + lines * 0.25);
  float shade = texture2D(shadeMap, vec2((world.x - shadeBounds.x) * shadeBounds.z, (world.y - shadeBounds.y) * shadeBounds.w)).r;
  // The shore: a line through the corners' wetness, softened over a little of a tile and wavering with the ripples.
  float shore = smoothstep(0.4, 0.6, wetness + (broad - 0.5) * 0.15);
  gl_FragColor = vec4(colour * shade, 0.93 * shore);
}
`;
