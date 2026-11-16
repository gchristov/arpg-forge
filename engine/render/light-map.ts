import * as THREE from 'three';

/** Texels per tile of level, capped by `MAX_SIZE`. */
const TEXELS_PER_TILE = 8;
const MAX_SIZE = 1024;
/** Light is stored at half strength, so overlapping lights can reach twice full brightness before clipping. */
/**
 * Lights hang about a tile up, so surfaces well above that, such as roofs and wall tops, get less of the light below:
 * full strength up to `FULL_HEIGHT` tiles, fading to none at `FULL_HEIGHT + FADE_HEIGHT`.
 */
const FULL_HEIGHT = 1.2;
const FADE_HEIGHT = 1.0;
const HEADROOM = 2;
const GLOW_POOL = 512;

export interface Glow {
  x: number;
  y: number;
  radius: number;
  colour: THREE.Color;
  intensity: number;
}

/**
 * Lighting from any number of small lights at a fixed cost. Each frame, every light is drawn as a soft glow into a
 * top-down texture covering the level, and every lit material adds the light under each of its pixels. A lamp, a
 * hundred torches and a flying fireball all cost the same: one texture lookup per pixel. It suits a game seen from
 * above at a fixed angle, where light pooling on the ground and on what stands on it is what matters.
 *
 * It also darkens what lies away from the playable world: a second, fixed texture of how lit each tile is, which every
 * lit material multiplies by, so a level fades into darkness past its walls and edges instead of stopping.
 */
export class LightMap {
  private readonly target = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(0, 1, 0, 1, -10, 10);
  private readonly glows: THREE.InstancedMesh;
  private readonly matrix = new THREE.Matrix4();
  private readonly colour = new THREE.Color();
  private used = 0;
  /** Shared by every lit material, so changing level only updates these values. */
  readonly uniforms = {
    lightMap: { value: this.target.texture as THREE.Texture },
    lightMapBounds: { value: new THREE.Vector4(0, 0, 1, 1) },
    shadeMap: { value: fullyLit() as THREE.Texture },
    shadeBounds: { value: new THREE.Vector4(0, 0, 1, 1) },
    /** The level's surfaces dissolve away between these heights; equal heights turn the fade off. */
    heightFade: { value: new THREE.Vector2(1e4, 1e4) },
  };

  constructor() {
    this.scene.background = new THREE.Color(0x000000);
    this.camera.position.set(0, 5, 0);
    this.camera.up.set(0, 0, -1);
    this.camera.lookAt(0, 0, 0);
    const material = new THREE.MeshBasicMaterial({
      map: glowTexture(),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
    });
    this.glows = new THREE.InstancedMesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), material, GLOW_POOL);
    this.glows.frustumCulled = false;
    this.glows.count = 0;
    this.scene.add(this.glows);
  }

  /** Fits the texture to a level of `width` × `depth` tiles. */
  setArea(width: number, depth: number): void {
    const size = (tiles: number) => Math.min(MAX_SIZE, THREE.MathUtils.ceilPowerOfTwo(Math.max(16, tiles * TEXELS_PER_TILE)));
    this.target.setSize(size(width), size(depth));
    Object.assign(this.camera, { left: 0, right: width, top: 0, bottom: -depth });
    this.camera.updateProjectionMatrix();
    this.uniforms.lightMapBounds.value.set(0, 0, 1 / width, 1 / depth);
  }

  /**
   * How lit each tile is, from 0 to 1, over an area of `width` × `depth` tiles whose top-left corner is the tile `x0`,
   * `y0`; shading blends smoothly between tiles. Null lights everything fully.
   */
  setShade(shade: { values: Float32Array; x0: number; y0: number; width: number; depth: number } | null): void {
    const current = this.uniforms.shadeMap.value as THREE.DataTexture;
    if (!shade) {
      current.dispose();
      this.uniforms.shadeMap.value = fullyLit();
      this.uniforms.shadeBounds.value.set(0, 0, 1, 1);
      return;
    }
    const { values, x0, y0, width, depth } = shade;
    // Changes to the same area, such as ground being revealed, rewrite the texture rather than making a new one.
    const same = current.image.width === width && current.image.height === depth;
    const texture = same ? current : new THREE.DataTexture(new Uint8Array(width * depth * 4), width, depth);
    const bytes = texture.image.data as Uint8Array;
    values.forEach((v, i) => bytes.fill(Math.round(Math.min(1, Math.max(0, v)) * 255), i * 4, i * 4 + 4));
    texture.needsUpdate = true;
    if (!same) {
      current.dispose();
      texture.magFilter = THREE.LinearFilter;
      texture.minFilter = THREE.LinearFilter;
      this.uniforms.shadeMap.value = texture;
    }
    // Texel centres sit on tile centres, so a tile's shade is exact at its middle and blends towards its neighbours.
    this.uniforms.shadeBounds.value.set(x0, y0, 1 / width, 1 / depth);
  }

  /** Dissolves the level's surfaces away from `from` to `to` tiles up, or nothing with null. */
  setHeightFade(fade: { from: number; to: number } | null): void {
    this.uniforms.heightFade.value.set(fade?.from ?? 1e4, fade?.to ?? 1e4);
  }

  /** Starts a frame's glows. Call `add` for each light, then `render`. */
  begin(): void {
    this.used = 0;
  }

  add(x: number, y: number, radius: number, colour: number | THREE.Color, intensity: number): void {
    if (this.used >= GLOW_POOL) return;
    this.matrix.makeScale(radius, 1, radius).setPosition(x, 0, y);
    this.glows.setMatrixAt(this.used, this.matrix);
    this.glows.setColorAt(this.used, this.colour.set(colour).multiplyScalar(intensity / HEADROOM));
    this.used++;
  }

  render(renderer: THREE.WebGLRenderer): void {
    this.glows.count = this.used;
    this.glows.instanceMatrix.needsUpdate = true;
    if (this.glows.instanceColor) this.glows.instanceColor.needsUpdate = true;
    const previous = renderer.getRenderTarget();
    const shadows = renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(this.target);
    renderer.render(this.scene, this.camera);
    renderer.setRenderTarget(previous);
    renderer.shadowMap.autoUpdate = shadows;
  }

  /**
   * Makes a material add the light map's light: the light under each pixel, times the surface's own colour, and take
   * the level's darkness. With `fadesAway`, for the level's own surfaces, it also dissolves through the height fade:
   * a growing share of its pixels isn't drawn as it rises, in a fine scattered pattern, so whatever lies behind shows
   * through rather than a dark shape. Safe to call more than once.
   */
  light(material: THREE.Material, fadesAway = false): void {
    if (material.userData.lightMapped) return;
    if (!(material instanceof THREE.MeshLambertMaterial || material instanceof THREE.MeshStandardMaterial)) return;
    material.userData.lightMapped = true;
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vLightMapUv;\nvarying vec2 vShadeUv;\nvarying float vLightMapHeight;\nuniform vec4 lightMapBounds;\nuniform vec4 shadeBounds;')
        .replace(
          '#include <project_vertex>',
          `#include <project_vertex>
          vec4 lightMapWorld = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            lightMapWorld = instanceMatrix * lightMapWorld;
          #endif
          lightMapWorld = modelMatrix * lightMapWorld;
          vLightMapHeight = lightMapWorld.y;
          vLightMapUv = vec2((lightMapWorld.x - lightMapBounds.x) * lightMapBounds.z, 1.0 - (lightMapWorld.z - lightMapBounds.y) * lightMapBounds.w);
          vShadeUv = vec2((lightMapWorld.x - shadeBounds.x) * shadeBounds.z, (lightMapWorld.z - shadeBounds.y) * shadeBounds.w);`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vLightMapUv;\nvarying vec2 vShadeUv;\nvarying float vLightMapHeight;\nuniform sampler2D lightMap;\nuniform sampler2D shadeMap;\nuniform vec2 heightFade;')
        .replace(
          '#include <opaque_fragment>',
          `float lightMapReach = clamp(1.0 - (vLightMapHeight - ${FULL_HEIGHT.toFixed(2)}) / ${FADE_HEIGHT.toFixed(2)}, 0.0, 1.0);
          outgoingLight += diffuseColor.rgb * texture2D(lightMap, vLightMapUv).rgb * ${HEADROOM.toFixed(1)} * lightMapReach;
          outgoingLight *= texture2D(shadeMap, vShadeUv).r;
          ${fadesAway ? DISSOLVE_GLSL : ''}
          #include <opaque_fragment>`,
        );
    };
    material.customProgramCacheKey = () => (fadesAway ? 'light-map-fades-away' : 'light-map');
    material.needsUpdate = true;
  }

  dispose(): void {
    this.target.dispose();
    this.uniforms.shadeMap.value.dispose();
  }
}

/**
 * Screen-door transparency: past the height fade's start, drop the pixels whose place in a fine, even scatter (an
 * interleaved gradient noise) falls below how far the surface has risen, and darken what's left a little. It needs no
 * sorting, unlike real transparency, so walls stay cheap to draw.
 */
const DISSOLVE_GLSL = `
          if (heightFade.y > heightFade.x) {
            float rise = smoothstep(heightFade.x, heightFade.y, vLightMapHeight);
            if (rise >= fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))))) discard;
            outgoingLight *= 1.0 - rise * 0.6;
          }`;

/** One white texel: everything fully lit. */
function fullyLit(): THREE.DataTexture {
  const texture = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  texture.needsUpdate = true;
  return texture;
}

/** A soft round glow, brightest in the middle and fading smoothly to nothing at the edge. */
function glowTexture(): THREE.DataTexture {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.min(1, Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) / (size / 2));
      const v = Math.round(255 * (1 - d) * (1 - d));
      data.set([255, 255, 255, v], (y * size + x) * 4);
    }
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
