import * as THREE from 'three';
import { ELEVATION } from './camera-angle';
import type { MistLook } from './look';
import { NOISE_GLSL } from './shader-noise';

/**
 * Layers of mist at these heights in tiles, each drifting its own way. Two lie low over the ground, behind whatever
 * stands on it; the last drifts over everything, figures and buildings too, like low cloud across the view.
 */
const LAYERS = [
  { height: 0.15, drift: [0.11, 0.05], scale: 0.09, share: 0.6, over: false },
  { height: 0.55, drift: [-0.07, 0.09], scale: 0.14, share: 0.4, over: false },
  { height: 2, drift: [0.05, -0.04], scale: 0.07, share: 0.4, over: true },
] as const;
/** Drawn after the level and its effects but before the guide arrow, which stays clear of the mist. */
const OVER_DRAW_ORDER = 4;
/** How far past the level's edges the mist reaches, so its edge never shows. */
const MARGIN = 8;

/**
 * Drifting mist lying low over a whole level: see-through layers of moving noise. It reads the light map, so lamps
 * and fires glow through it rather than the mist hiding them.
 */
export class Mist {
  readonly group = new THREE.Group();
  private readonly materials: THREE.ShaderMaterial[] = [];

  constructor(width: number, depth: number, look: MistLook, lightMap: Record<string, THREE.IUniform>) {
    const plane = new THREE.PlaneGeometry(width + MARGIN * 2, depth + MARGIN * 2).rotateX(-Math.PI / 2);
    for (const layer of LAYERS) {
      const material = new THREE.ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms: {
          ...lightMap,
          time: { value: 0 },
          drift: { value: new THREE.Vector2(...layer.drift) },
          scale: { value: layer.scale },
          density: { value: look.density * layer.share },
          colour: { value: new THREE.Color(look.colour) },
          // A layer above the ground shows on screen over the ground this far back from it, which is where its light comes from.
          lift: { value: layer.height / Math.tan(ELEVATION) / Math.SQRT2 },
        },
        transparent: true,
        depthWrite: false,
        depthTest: !layer.over,
      });
      const mesh = new THREE.Mesh(plane, material);
      if (layer.over) mesh.renderOrder = OVER_DRAW_ORDER;
      mesh.position.set(width / 2, layer.height, depth / 2);
      this.group.add(mesh);
      this.materials.push(material);
    }
  }

  update(seconds: number): void {
    for (const m of this.materials) m.uniforms.time!.value = seconds;
  }
}

const VERTEX = /* glsl */ `
varying vec2 world;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  world = w.xz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

// Lamps light the mist the way they light the ground, so their glow spreads through it.
const FRAGMENT = /* glsl */ `
uniform sampler2D lightMap;
uniform vec4 lightMapBounds;
uniform sampler2D shadeMap;
uniform vec4 shadeBounds;
uniform float time;
uniform vec2 drift;
uniform float scale;
uniform float density;
uniform vec3 colour;
uniform float lift;
varying vec2 world;
${NOISE_GLSL}
void main() {
  vec2 p = world * scale + drift * time;
  float gather = fbm(p + fbm(p * 0.7 - drift * time * 0.5) * 1.6);
  float amount = smoothstep(0.28, 0.62, gather) * density;
  vec2 below = world - lift;
  vec2 uv = vec2((below.x - lightMapBounds.x) * lightMapBounds.z, 1.0 - (below.y - lightMapBounds.y) * lightMapBounds.w);
  vec3 lit = colour + texture2D(lightMap, clamp(uv, 0.0, 1.0)).rgb * 0.9;
  float shade = texture2D(shadeMap, vec2((below.x - shadeBounds.x) * shadeBounds.z, (below.y - shadeBounds.y) * shadeBounds.w)).r;
  gl_FragColor = vec4(lit * shade, amount * mix(0.4, 1.0, shade));
}
`;
