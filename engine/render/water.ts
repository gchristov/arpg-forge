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
void main() {
  vec2 p = world * 0.45;
  // Two layers of ripples drifting downstream at different speeds, so the surface never repeats.
  float ripples = fbm(p * vec2(1.0, 2.2) - flow * time * 0.5) * 0.6 + fbm(p * 1.7 + vec2(3.1, 1.3) - flow * time * 0.9) * 0.4;
  vec3 colour = mix(deep, shallow, smoothstep(0.35, 0.75, ripples));
  // Thin glints stretched along the current where ripples crest, flickering as they move.
  vec2 along = normalize(flow + vec2(1e-4));
  vec2 q = vec2(dot(world, along) * 0.9, dot(world, vec2(-along.y, along.x)) * 5.0);
  float crest = smoothstep(0.7, 0.8, fbm(q - vec2(time * length(flow) * 1.6, 0.0) + ripples * 0.8));
  colour += glint * crest * 0.35;
  vec2 lightUv = vec2((world.x - lightMapBounds.x) * lightMapBounds.z, 1.0 - (world.y - lightMapBounds.y) * lightMapBounds.w);
  colour += texture2D(lightMap, clamp(lightUv, 0.0, 1.0)).rgb * (0.8 + crest);
  float shade = texture2D(shadeMap, vec2((world.x - shadeBounds.x) * shadeBounds.z, (world.y - shadeBounds.y) * shadeBounds.w)).r;
  // The shore: a line through the corners' wetness, softened over a little of a tile and wavering with the ripples.
  float shore = smoothstep(0.4, 0.6, wetness + (ripples - 0.5) * 0.15);
  gl_FragColor = vec4(colour * shade, 0.92 * shore);
}
`;
