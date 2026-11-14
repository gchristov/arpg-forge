import * as THREE from 'three';
import { clamp, type Vec2 } from '../core/math';
import type { Level, LevelLight } from '../world/level';
import { Effects } from './effects';
import type { Look, PropLook } from './look';

/** 30° above the ground gives the classic 2:1 isometric look: a tile is twice as wide as it is tall on screen. */
const ELEVATION = Math.PI / 6;
/** On-screen width of one tile at zoom 1. */
const TILE_PIXELS = 64;
/** The hero sits a little below the centre of the screen, so more of what's ahead is visible. */
const HERO_SCREEN_OFFSET_PX = 24;
const CAMERA_FOLLOW_RATE = 7;
/** Forward rendering pays for every light on every pixel, so only the closest few level lights are lit. */
const MAX_POINT_LIGHTS = 8;
const LIGHT_STRENGTH = 2.2;
const MARKER_SECONDS = 0.6;
/** Screen shake decays this much a second, and moves the view up to this many pixels at full strength. */
const SHAKE_DECAY = 1.6;
const SHAKE_PIXELS = 10;

const VIEW_DIRECTION = new THREE.Vector3(
  Math.cos(ELEVATION) / Math.SQRT2,
  Math.sin(ELEVATION),
  Math.cos(ELEVATION) / Math.SQRT2,
);

/** Draws a level and its actors with Three.js under a fixed isometric camera. World tile (x, y) is at (x, 0, y). */
export class SceneRenderer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera();
  private readonly ambient = new THREE.AmbientLight();
  private readonly moon = new THREE.DirectionalLight();
  private readonly heroLight = new THREE.PointLight(0xfff1dd, 1.4, 6, 1);
  private readonly pointLights: THREE.PointLight[] = [];
  private readonly closestLights = new Int32Array(MAX_POINT_LIGHTS);
  private readonly closestDistances = new Float32Array(MAX_POINT_LIGHTS);
  private readonly raycaster = new THREE.Raycaster();
  private readonly groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly ndc = new THREE.Vector2();
  private readonly hit = new THREE.Vector3();
  private readonly target = new THREE.Vector3();
  private readonly cameraUp = new THREE.Vector3();
  private readonly actors = new Map<string, ActorModel>();
  private readonly projected = new THREE.Vector3();
  private shakeAmount = 0;
  private frame = 0;
  readonly effects: Effects;
  private readonly marker: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  private markerAge = Infinity;
  private levelGroup = new THREE.Group();
  private structures: THREE.Object3D[] = [];
  private levelLights: LevelLight[] = [];
  private width = 1;
  private height = 1;
  private pixelsPerUnit = TILE_PIXELS / Math.SQRT2;

  constructor(
    canvas: HTMLCanvasElement,
    private readonly look: Look,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene.add(this.ambient, this.moon, this.moon.target, this.heroLight, this.levelGroup);
    this.moon.castShadow = true;
    this.moon.shadow.mapSize.set(2048, 2048);
    const s = this.moon.shadow.camera;
    s.left = -16;
    s.right = 16;
    s.top = 16;
    s.bottom = -16;
    s.near = 1;
    s.far = 80;
    for (let i = 0; i < MAX_POINT_LIGHTS; i++) {
      const light = new THREE.PointLight(0xffffff, 0, 1, 1);
      this.pointLights.push(light);
      this.scene.add(light);
    }
    this.marker = new THREE.Mesh(
      new THREE.RingGeometry(0.22, 0.3, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }),
    );
    this.marker.visible = false;
    this.scene.add(this.marker);
    this.effects = new Effects(this.scene, look.effects);
  }

  /** How much the view is zoomed, 1 at the prototype's base size. */
  get zoom(): number {
    return (this.pixelsPerUnit * Math.SQRT2) / TILE_PIXELS;
  }

  resize(width: number, height: number, pixelRatio: number): void {
    this.width = width;
    this.height = height;
    this.renderer.setPixelRatio(Math.min(2, pixelRatio));
    this.renderer.setSize(width, height, false);
    const zoom = clamp(Math.min(width, height) / 430, 0.78, 1.3);
    this.pixelsPerUnit = (TILE_PIXELS * zoom) / Math.SQRT2;
    const halfW = width / 2 / this.pixelsPerUnit;
    const halfH = height / 2 / this.pixelsPerUnit;
    Object.assign(this.camera, { left: -halfW, right: halfW, top: halfH, bottom: -halfH, near: 0.1, far: 200 });
    this.camera.updateProjectionMatrix();
  }

  showLevel(level: Level): void {
    this.scene.remove(this.levelGroup);
    disposeTree(this.levelGroup);
    this.levelGroup = new THREE.Group();
    this.scene.add(this.levelGroup);
    this.levelLights = level.lights;

    const mood = this.look.mood(level.id);
    this.scene.background = new THREE.Color(mood.background);
    this.ambient.color.set(mood.ambient);
    this.ambient.intensity = mood.ambientIntensity;
    this.moon.visible = Boolean(mood.moon);
    if (mood.moon) {
      this.moon.color.set(mood.moon.colour);
      this.moon.intensity = mood.moon.intensity;
    }
    this.heroLight.distance = mood.heroLightRadius * 1.6;

    this.levelGroup.add(this.buildGround(level));
    for (const mesh of this.buildProps(level)) this.levelGroup.add(mesh);
    this.structures = this.buildStructures(level);
    for (const mesh of this.structures) this.levelGroup.add(mesh);
  }

  /**
   * Places an actor; creates its model the first time an id is seen. `flash` (0 to 1) lights it up when hit, and
   * `fade` (1 to 0) shrinks and fades it out when it dies. Models not placed in a frame are removed at render.
   */
  setActor(
    id: string,
    kind: string,
    x: number,
    y: number,
    facingX: number,
    facingY: number,
    flash = 0,
    fade = 1,
  ): void {
    let model = this.actors.get(id);
    if (!model) {
      model = this.buildActor(kind);
      this.actors.set(id, model);
      this.scene.add(model.root);
    }
    model.seen = this.frame;
    model.root.position.set(x, 0, y);
    if (facingX || facingY) model.root.rotation.y = Math.atan2(facingX, facingY);
    model.material.emissive.setScalar(flash * 0.8);
    model.material.opacity = fade;
    model.material.transparent = fade < 1;
    model.root.scale.set(1, 0.3 + 0.7 * fade, 1);
  }

  /** Removes every actor's model, for example when a different level is shown. */
  clearActors(): void {
    for (const model of this.actors.values()) {
      this.scene.remove(model.root);
      disposeTree(model.root);
    }
    this.actors.clear();
  }

  /** Where a world point, `height` tiles above the ground, appears on screen. Writes into `out`. */
  screenPosition(x: number, y: number, height: number, out: Vec2): Vec2 {
    this.projected.set(x, height, y).project(this.camera);
    out.x = ((this.projected.x + 1) / 2) * this.width;
    out.y = ((1 - this.projected.y) / 2) * this.height;
    return out;
  }

  shake(amount: number): void {
    this.shakeAmount = Math.max(this.shakeAmount, amount);
  }

  /** What's under a screen position: a structure (by its index in the level) or a point on the ground. */
  pick(screenX: number, screenY: number): { structure: number } | { ground: Vec2 } | null {
    this.ndc.set((screenX / this.width) * 2 - 1, -(screenY / this.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const hit = this.raycaster.intersectObjects(this.structures, true)[0];
    if (hit) {
      let o: THREE.Object3D | null = hit.object;
      while (o && o.userData.structureIndex === undefined) o = o.parent;
      if (o) return { structure: o.userData.structureIndex as number };
    }
    const ground = this.groundPointAt(screenX, screenY);
    return ground ? { ground } : null;
  }

  showMarker(x: number, y: number, colour: number): void {
    this.marker.position.set(x, 0.02, y);
    this.marker.material.color.set(colour);
    this.markerAge = 0;
  }

  /** Moves the camera towards a point, easing in; `snap` jumps straight there, for example on entering a level. */
  follow(x: number, y: number, frameSeconds: number, snap = false): void {
    const k = snap ? 1 : 1 - Math.exp(-frameSeconds * CAMERA_FOLLOW_RATE);
    this.target.x += (x - this.target.x) * k;
    this.target.z += (y - this.target.z) * k;
    this.heroLight.position.set(x, 1.2, y);
  }

  render(seconds: number, frameSeconds: number): void {
    this.placeCamera();
    this.applyShake(frameSeconds);
    this.updateLights(seconds);
    this.updateMarker(frameSeconds);
    this.effects.update(frameSeconds);
    this.removeUnseenActors();
    this.renderer.render(this.scene, this.camera);
    this.frame++;
  }

  private applyShake(frameSeconds: number): void {
    if (this.shakeAmount <= 0) return;
    const reach = (this.shakeAmount * SHAKE_PIXELS) / this.pixelsPerUnit;
    this.camera.position.x += (Math.random() * 2 - 1) * reach;
    this.camera.position.y += (Math.random() * 2 - 1) * reach;
    this.camera.updateMatrixWorld();
    this.shakeAmount = Math.max(0, this.shakeAmount - frameSeconds * SHAKE_DECAY);
  }

  private removeUnseenActors(): void {
    for (const [id, model] of this.actors) {
      if (model.seen === this.frame) continue;
      this.scene.remove(model.root);
      disposeTree(model.root);
      this.actors.delete(id);
    }
  }

  /** The ground point under a screen position, in tiles. */
  groundPointAt(screenX: number, screenY: number): Vec2 | null {
    this.ndc.set((screenX / this.width) * 2 - 1, -(screenY / this.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    return this.raycaster.ray.intersectPlane(this.groundPlane, this.hit) ? { x: this.hit.x, y: this.hit.z } : null;
  }

  private placeCamera(): void {
    this.camera.position.copy(this.target).addScaledVector(VIEW_DIRECTION, 60);
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld();
    this.cameraUp.setFromMatrixColumn(this.camera.matrixWorld, 1);
    this.camera.position.addScaledVector(this.cameraUp, HERO_SCREEN_OFFSET_PX / this.pixelsPerUnit);
    this.camera.updateMatrixWorld();
    this.moon.position.set(this.target.x - 8, 18, this.target.z + 4);
    this.moon.target.position.copy(this.target);
  }

  /** Lights the closest level lights, with the prototype's flicker applied to their reach. */
  private updateLights(seconds: number): void {
    const count = Math.min(MAX_POINT_LIGHTS, this.levelLights.length);
    this.closestDistances.fill(Infinity);
    this.closestLights.fill(-1);
    for (let i = 0; i < this.levelLights.length; i++) {
      const l = this.levelLights[i]!;
      const d = (l.x - this.target.x) ** 2 + (l.y - this.target.z) ** 2;
      let slot = count - 1;
      if (d >= this.closestDistances[slot]!) continue;
      while (slot > 0 && d < this.closestDistances[slot - 1]!) {
        this.closestDistances[slot] = this.closestDistances[slot - 1]!;
        this.closestLights[slot] = this.closestLights[slot - 1]!;
        slot--;
      }
      this.closestDistances[slot] = d;
      this.closestLights[slot] = i;
    }
    for (let slot = 0; slot < MAX_POINT_LIGHTS; slot++) {
      const light = this.pointLights[slot]!;
      const index = this.closestLights[slot]!;
      if (slot >= count || index < 0) {
        light.intensity = 0;
        continue;
      }
      const l = this.levelLights[index]!;
      const flicker = l.flicker
        ? 1 + Math.sin(seconds * 9 + l.seed) * 0.06 * l.flicker + Math.sin(seconds * 23 + l.seed * 3) * 0.04 * l.flicker
        : 1;
      light.color.set(this.look.lightColour(l.colour));
      light.position.set(l.x, 0.9, l.y);
      light.distance = l.radius * 1.8 * flicker;
      light.intensity = l.intensity * LIGHT_STRENGTH;
    }
  }

  private updateMarker(frameSeconds: number): void {
    this.markerAge += frameSeconds;
    const t = this.markerAge / MARKER_SECONDS;
    this.marker.visible = t < 1;
    if (t < 1) {
      this.marker.material.opacity = 1 - t;
      this.marker.scale.setScalar(1 + t * 0.6);
    }
  }

  private buildGround(level: Level): THREE.InstancedMesh {
    const { map } = level;
    const tile = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const mesh = new THREE.InstancedMesh(tile, new THREE.MeshLambertMaterial(), map.width * map.height);
    const matrix = new THREE.Matrix4();
    const colour = new THREE.Color();
    let n = 0;
    for (let ty = 0; ty < map.height; ty++) {
      for (let tx = 0; tx < map.width; tx++) {
        const kind = map.ground[ty * map.width + tx]!;
        if (!kind) continue;
        matrix.makeTranslation(tx + 0.5, 0, ty + 0.5);
        mesh.setMatrixAt(n, matrix);
        mesh.setColorAt(n, colour.set(this.look.groundColour(kind, tx, ty, level.id)));
        n++;
      }
    }
    mesh.count = n;
    mesh.receiveShadow = true;
    return mesh;
  }

  private buildProps(level: Level): THREE.InstancedMesh[] {
    const { map } = level;
    const tilesByKind = new Map<number, number[]>();
    for (let i = 0; i < map.prop.length; i++) {
      const kind = map.prop[i]!;
      if (!kind || !this.look.prop(kind, level.id)) continue;
      let list = tilesByKind.get(kind);
      if (!list) tilesByKind.set(kind, (list = []));
      list.push(i);
    }
    const matrix = new THREE.Matrix4();
    const meshes: THREE.InstancedMesh[] = [];
    for (const [kind, tiles] of tilesByKind) {
      const look = this.look.prop(kind, level.id)!;
      const material = new THREE.MeshLambertMaterial({ color: look.colour, emissive: look.emissive ?? 0 });
      const mesh = new THREE.InstancedMesh(propGeometry(look), material, tiles.length);
      tiles.forEach((i, n) => {
        matrix.makeTranslation((i % map.width) + 0.5, look.height / 2, Math.floor(i / map.width) + 0.5);
        mesh.setMatrixAt(n, matrix);
      });
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      meshes.push(mesh);
    }
    return meshes;
  }

  private buildStructures(level: Level): THREE.Object3D[] {
    return level.structures.map((s, index) => {
      const look = this.look.structure(s.kind);
      const group = new THREE.Group();
      const walls = new THREE.Mesh(
        new THREE.BoxGeometry(s.width, look.wallHeight, s.depth),
        new THREE.MeshLambertMaterial({ color: look.wall }),
      );
      walls.position.y = look.wallHeight / 2;
      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4),
        new THREE.MeshLambertMaterial({ color: look.roof }),
      );
      roof.scale.set(s.width * 1.12, look.roofHeight, s.depth * 1.12);
      roof.position.y = look.wallHeight + look.roofHeight / 2;
      const door = new THREE.Mesh(
        new THREE.PlaneGeometry(0.6, Math.min(0.9, look.wallHeight * 0.75)),
        new THREE.MeshLambertMaterial({ color: 0x1a120c }),
      );
      door.position.set(s.door.tx + 0.5 - (s.x + s.width / 2), door.geometry.parameters.height / 2, s.depth / 2 + 0.01);
      group.add(walls, roof, door);
      group.position.set(s.x + s.width / 2, 0, s.y + s.depth / 2);
      group.userData.structureIndex = index;
      group.traverse((o) => {
        o.castShadow = true;
        o.receiveShadow = true;
      });
      return group;
    });
  }

  private buildActor(kind: string): ActorModel {
    const look = this.look.actor(kind);
    const material = new THREE.MeshLambertMaterial({ color: look.colour });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(look.radius, look.height - look.radius * 2, 4, 12), material);
    body.position.y = look.height / 2;
    const nose = new THREE.Mesh(new THREE.ConeGeometry(look.radius * 0.35, look.radius * 0.9, 8).rotateX(Math.PI / 2), material);
    nose.position.set(0, look.height * 0.62, look.radius * 0.95);
    const root = new THREE.Group();
    root.add(body, nose);
    root.traverse((o) => (o.castShadow = true));
    return { root, material, seen: this.frame };
  }
}

interface ActorModel {
  root: THREE.Object3D;
  material: THREE.MeshLambertMaterial;
  /** The frame it was last placed in. */
  seen: number;
}

function propGeometry(look: PropLook): THREE.BufferGeometry {
  const { width: w, height: h } = look;
  switch (look.shape) {
    case 'box':
      return new THREE.BoxGeometry(w, h, w);
    case 'cylinder':
      return new THREE.CylinderGeometry(w / 2, w / 2, h, 12);
    case 'cone':
      return new THREE.ConeGeometry(w / 2, h, 8);
    case 'sphere':
      return new THREE.SphereGeometry(w / 2, 12, 8).scale(1, h / w, 1);
  }
}

function disposeTree(root: THREE.Object3D): void {
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      const materials = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of materials) m.dispose();
    }
  });
}
