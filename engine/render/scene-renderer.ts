import * as THREE from 'three';
import { clamp, hash2, type Vec2 } from '../core/math';
import type { Level, LevelLight } from '../world/level';
import { inBounds, tileIndex } from '../world/tile-map';
import { ActorFigure, type ActorMoment } from './actor-figure';
import { cornerArms } from './corner-arms';
import { Effects } from './effects';
import { Flames, type FlameSpot } from './flames';
import { blendedGround } from './ground-blend';
import { kitBuilding, type StoreyWindows } from './kit-building';
import { ELEVATION } from './camera-angle';
import { LightMap, type SurfaceFade } from './light-map';
import { Mist } from './mist';
import type { Look, Mood, PropLook, Surroundings, WallFixture, WallLook, WaterLook } from './look';
import { fitMatrix, instancedModel, modelSize, panelFit, panelScale } from './model-instancing';
import { ModelLibrary, type ModelTemplate } from './models';
import { playDistances, shadeArea, shadeAt } from './shade-map';
import { Spatter } from './spatter';
import { WaterSurface } from './water';
import { isWallTile, kitPartitions, kitWalls, wallFaces, wallPanels, type KitCorner, type KitOpening } from './wall-panels';

/** On-screen width of one tile at zoom 1. */
const TILE_PIXELS = 64;
/** The hero sits a little below the centre of the screen, so more of what's ahead is visible. */
const HERO_SCREEN_OFFSET_PX = 24;
const CAMERA_FOLLOW_RATE = 7;
/** Forward rendering pays for every light on every pixel, so only the closest few level lights are lit. */
/** Glows reach this many times a level light's radius, and shine this many times its intensity. */
const GLOW_REACH = 1.5;
const GLOW_STRENGTH = 0.75;
const MARKER_SECONDS = 0.6;
/** Screen shake decays this much a second, and moves the view up to this many pixels at full strength. */
const SHAKE_DECAY = 1.6;
const SHAKE_PIXELS = 10;

/** A modular wall kit's cell, in its own units: a straight panel is one long, a corner piece one each way. */
const KIT_CELL = 4;
/** A kit wall's height, in its own units, and how much taller than the walls a doorway's frame stands. */
const KIT_WALL_HEIGHT = 3;
const DOOR_RISE = 1.15;
/** The turn about the vertical that points a kit corner's two arms, +x and +z, along the given map directions. */
const KIT_CORNER_TURN: Record<string, number> = { '1,1': 0, '1,-1': Math.PI / 2, '-1,-1': Math.PI, '-1,1': (3 * Math.PI) / 2 };

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
  private readonly fill = new THREE.HemisphereLight();
  private readonly moon = new THREE.DirectionalLight();
  private readonly heroLight = new THREE.PointLight(0xfff1dd, 1.4, 6, 1);
  private readonly lightMap = new LightMap();
  private readonly glowColour = new THREE.Color();
  /** Kit corner pieces split into their arms, by model name, split once and kept for every level. */
  private readonly cornerArmsByModel = new Map<string, ReturnType<typeof cornerArms>>();
  /** Glows added for this frame only, such as a flying fireball. */
  private readonly extraGlows: Array<{ x: number; y: number; radius: number; colour: number; intensity: number }> = [];
  private readonly raycaster = new THREE.Raycaster();
  private readonly groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly ndc = new THREE.Vector2();
  private readonly hit = new THREE.Vector3();
  private readonly target = new THREE.Vector3();
  private readonly cameraUp = new THREE.Vector3();
  private readonly actors = new Map<string, ActorFigure>();
  private readonly projected = new THREE.Vector3();
  private shakeAmount = 0;
  private frame = 0;
  readonly effects: Effects;
  readonly spatter: Spatter;
  private readonly marker: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  private markerAge = Infinity;
  /** Set when a level is shown; the next render compiles every shader the level can need. */
  private warmUpPending = false;
  private levelGroup = new THREE.Group();
  private structures: THREE.Object3D[] = [];
  private levelLights: LevelLight[] = [];
  /** Each building's windows that start dark, by its index in the level's structures. */
  private readonly darkWindows = new Map<number, StoreyWindows[]>();
  /** What the shown level's extensions keep, whose marks switch on the lights waiting for them. */
  private levelMemory: Readonly<Record<string, number>> = {};
  /** Whether the air is the mood's `ambientWhen` colour. */
  private ambientSwitched = false;
  private mood: Mood | null = null;
  private mist: Mist | null = null;
  private water: WaterSurface | null = null;
  /** The level's darkness: by distance from the playable world (`base`), times what the hero has found. */
  private shade: {
    values: Float32Array; base: Float32Array | null; x0: number; y0: number; width: number; depth: number; mapWidth: number; mapHeight: number;
  } | null = null;
  private flames: Flames | null = null;
  private width = 1;
  private height = 1;
  private pixelsPerUnit = TILE_PIXELS / Math.SQRT2;

  constructor(
    canvas: HTMLCanvasElement,
    private readonly look: Look,
    private readonly models = new ModelLibrary(),
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, stencil: true });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene.add(this.ambient, this.fill, this.moon, this.moon.target, this.heroLight, this.levelGroup);
    this.moon.castShadow = true;
    this.moon.shadow.mapSize.set(2048, 2048);
    const s = this.moon.shadow.camera;
    s.left = -16;
    s.right = 16;
    s.top = 16;
    s.bottom = -16;
    s.near = 1;
    s.far = 80;
    this.marker = new THREE.Mesh(
      new THREE.RingGeometry(0.22, 0.3, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }),
    );
    this.marker.visible = false;
    this.scene.add(this.marker);
    this.effects = new Effects(this.scene, look.effects);
    this.spatter = new Spatter(this.scene);
  }

  /** How much the view is zoomed, 1 when a tile is 64 pixels wide. */
  get zoom(): number {
    return (this.pixelsPerUnit * Math.SQRT2) / TILE_PIXELS;
  }

  /** How close the camera is: 1 as in play, less for a wider shot, such as a moment the game shows from afar. */
  setCloseness(closeness: number): void {
    this.camera.zoom = closeness;
    this.camera.updateProjectionMatrix();
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
    this.levelLights = [...level.lights];
    this.darkWindows.clear();
    this.lightMap.setArea(level.map.width, level.map.height);

    const mood = this.look.mood(level.id);
    this.mood = mood;
    this.levelMemory = {};
    this.ambientSwitched = false;
    this.scene.background = new THREE.Color(mood.background);
    this.ambient.color.set(mood.ambient);
    this.ambient.intensity = mood.ambientIntensity;
    this.moon.visible = Boolean(mood.moon);
    if (mood.moon) {
      this.moon.color.set(mood.moon.colour);
      this.moon.intensity = mood.moon.intensity;
    }
    this.heroLight.distance = mood.heroLightRadius * 1.6;
    this.fill.visible = Boolean(mood.fill);
    if (mood.fill) {
      this.fill.color.set(mood.fill.sky);
      this.fill.groundColor.set(mood.fill.ground);
      this.fill.intensity = mood.fill.intensity;
    }

    this.warmUpPending = true;
    const surroundings = this.look.surroundings?.(level) ?? null;
    this.shade = this.shadeOf(level, surroundings);
    this.lightMap.setShade(surroundings && this.shade);
    this.lightMap.setHeightFade(mood.heightFade ?? null);
    this.lightMap.setCutaway(null);
    const walls = this.buildWalls(level);
    // A framed doorway's own tile lies in the wall's line, outside the room; its floor would poke out past the wall.
    const doorways = walls && this.look.walls?.(level.id)?.kit ? this.doorwayTiles(level, walls.kinds) : new Set<number>();
    this.levelGroup.add(this.buildGround(level, walls?.kinds, surroundings, doorways));
    for (const mesh of this.buildScenery(level, surroundings)) this.levelGroup.add(mesh);
    this.water = mood.water ? this.buildWater(level, mood.water, surroundings) : null;
    if (this.water) this.levelGroup.add(this.water.mesh);
    for (const mesh of this.buildFloors(level, walls?.kinds, doorways)) this.levelGroup.add(mesh);
    for (const mesh of walls?.meshes ?? []) this.levelGroup.add(mesh);
    for (const mesh of this.buildProps(level, walls?.kinds)) this.levelGroup.add(mesh);
    this.structures = this.buildStructures(level);
    for (const mesh of this.structures) this.levelGroup.add(mesh);
    this.levelGroup.traverse((o) => this.lightUp(o, true));
    this.mist = mood.mist ? new Mist(level.map.width, level.map.height, mood.mist, this.lightMap.uniforms) : null;
    if (this.mist) this.levelGroup.add(this.mist.group);
    // Flames give their own light, so they stay out of the light map.
    this.flames = new Flames(this.flameSpots(level));
    this.levelGroup.add(this.flames.group);
  }

  /**
   * How lit a storey of a building's dark windows is, from 0 (dark) to 1, by the building's index in the level's
   * structures and the storey from the ground up.
   */
  lightWindows(structureIndex: number, storey: number, amount: number): void {
    const windows = this.darkWindows.get(structureIndex)?.find((w) => w.storey === storey);
    if (windows) for (const glass of windows.glass) glass.color.copy(windows.colour).multiplyScalar(amount);
  }

  /** How many storeys of a building have dark windows. */
  darkStoreys(structureIndex: number): number {
    return this.darkWindows.get(structureIndex)?.length ?? 0;
  }

  /** Adds a light for the coming frame only, such as one carried by a fireball or an explosion's flash. */
  glow(x: number, y: number, radius: number, colour: number, intensity: number): void {
    this.extraGlows.push({ x, y, radius, colour, intensity });
  }

  /**
   * Makes an object's materials take light from the light map. Of the level's own surfaces, those reaching up into the
   * mood's height fade, or marked to cut away, get their own copies that fade.
   */
  private lightUp(o: THREE.Object3D, ofLevel = false): void {
    if (!(o instanceof THREE.Mesh)) return;
    const fade = ofLevel ? this.fadeOf(o) : 'none';
    if (fade !== 'none') {
      const own = (m: THREE.Material) => {
        const copy = m.clone();
        copy.userData = { ownCopy: true };
        // A see-through material showing both sides would be drawn twice, back faces first; walls don't need that.
        copy.forceSinglePass = true;
        return copy;
      };
      o.material = Array.isArray(o.material) ? o.material.map(own) : own(o.material);
    }
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) this.lightMap.light(m, fade);
  }

  private fadeOf(mesh: THREE.Mesh): SurfaceFade {
    if (mesh.userData.cutaway) return 'cutaway';
    const fadeFrom = this.mood?.heightFade?.from;
    if (fadeFrom === undefined) return 'none';
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const box = mesh instanceof THREE.InstancedMesh ? (mesh.computeBoundingBox(), mesh.boundingBox!) : mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld);
    return box.max.y > fadeFrom ? 'height' : 'none';
  }

  /**
   * Places an actor and sets its pose; creates its figure the first time an id is seen. `flash` (0 to 1) lights it
   * up when hit, and `fade` (1 to 0) fades it out after death. Figures not placed in a frame are removed at render.
   */
  setActor(
    id: string,
    kind: string,
    x: number,
    y: number,
    facingX: number,
    facingY: number,
    pose: { moving: boolean; dead: boolean; flash: number; fade: number; speed?: number; channelling?: boolean; armed?: string | null },
  ): void {
    let figure = this.actors.get(id);
    if (!figure) {
      figure = new ActorFigure(this.look.actor(kind), this.models);
      figure.root.traverse((o) => this.lightUp(o));
      this.actors.set(id, figure);
      this.scene.add(figure.root);
    }
    figure.seen = this.frame;
    figure.root.position.set(x, 0, y);
    if (facingX || facingY) figure.root.rotation.y = Math.atan2(facingX, facingY);
    figure.arm(pose.armed ?? null);
    figure.pose(pose.moving, pose.dead, pose.speed, pose.channelling);
    figure.setLookOf(pose.flash, pose.fade);
  }

  /** Plays a one-off moment on an actor, such as an attack, stretched to `seconds` if given. */
  playActor(id: string, moment: ActorMoment, seconds?: number): void {
    this.actors.get(id)?.play(moment, seconds);
  }

  /** Removes every actor's figure, for example when a different level is shown. */
  clearActors(): void {
    for (const figure of this.actors.values()) this.removeFigure(figure);
    this.actors.clear();
  }

  private removeFigure(figure: ActorFigure): void {
    this.scene.remove(figure.root);
    figure.dispose();
  }

  /** Where a world point, `height` tiles above the ground, appears on screen. Writes into `out`. */
  screenPosition(x: number, y: number, height: number, out: Vec2): Vec2 {
    this.projected.set(x, height, y).project(this.camera);
    out.x = ((this.projected.x + 1) / 2) * this.width;
    out.y = ((1 - this.projected.y) / 2) * this.height;
    return out;
  }

  /** Draw calls and triangles in the last frame, for the debug overlay. */
  stats(): { calls: number; triangles: number } {
    return { calls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles };
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
  }

  /** Moves the light the hero carries to where they stand. */
  lightHero(x: number, y: number): void {
    this.heroLight.position.set(x, 1.2, y);
    this.lightMap.setHero(x, y);
  }

  render(seconds: number, frameSeconds: number): void {
    if (this.warmUpPending) this.warmUp();
    this.placeCamera();
    this.applyShake(frameSeconds);
    this.updateLightMap(seconds);
    this.updateMarker(frameSeconds);
    this.effects.update(frameSeconds);
    this.spatter.update(frameSeconds);
    this.flames?.update(seconds, frameSeconds);
    this.mist?.update(seconds);
    this.water?.update(seconds);
    this.removeUnseenActors();
    for (const figure of this.actors.values()) figure.update(frameSeconds);
    this.renderer.render(this.scene, this.camera);
    this.frame++;
  }

  /**
   * Compiles the shaders a level can need before play, so the first fireball, explosion or fading corpse doesn't
   * stall a frame mid-fight while the GPU compiles them. Effects are briefly shown and actors briefly see-through
   * (a dying actor's fade uses a different shader) for the compile only.
   */
  private warmUp(): void {
    this.warmUpPending = false;
    this.effects.setAllVisible(true);
    this.spatter.setAllVisible(true);
    for (const figure of this.actors.values()) figure.setLookOf(0, 0.5);
    this.renderer.compile(this.scene, this.camera);
    for (const figure of this.actors.values()) figure.setLookOf(0, 1);
    this.renderer.compile(this.scene, this.camera);
    this.effects.setAllVisible(false);
    this.spatter.setAllVisible(false);
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
    for (const [id, figure] of this.actors) {
      if (figure.seen === this.frame) continue;
      this.removeFigure(figure);
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

  /** Lights the level's lights whose mark is set in its memory, and turns its air to the mood's colour for its mark. */
  showLevelMemory(memory: Readonly<Record<string, number>>): void {
    this.levelMemory = memory;
    const when = this.mood?.ambientWhen;
    if (!when || Boolean(memory[when.mark]) === this.ambientSwitched) return;
    this.ambientSwitched = !this.ambientSwitched;
    this.ambient.color.set(this.ambientSwitched ? when.colour : this.mood!.ambient);
  }

  /** Adds something a game draws itself, such as its own effects, to the scene for good. */
  add(object: THREE.Object3D): void {
    this.scene.add(object);
  }

  /** Draws every level light, with its flicker, and this frame's extra glows into the light map. */
  private updateLightMap(seconds: number): void {
    this.lightMap.begin();
    for (const l of this.levelLights) {
      if (l.onlyWhen !== undefined && !this.levelMemory[l.onlyWhen]) continue;
      const flicker = l.flicker
        ? 1 + Math.sin(seconds * 9 + l.seed) * 0.06 * l.flicker + Math.sin(seconds * 23 + l.seed * 3) * 0.04 * l.flicker
        : 1;
      // A beacon sweeps past about twice a second, bright when it faces the room and dim between.
      const pulse = l.pulse ? 0.3 + 0.7 * Math.max(0, Math.sin(seconds * 12 + l.seed)) ** 2 : 1;
      this.glowColour.set(this.look.lightColour(l.colour));
      this.lightMap.add(l.x, l.y, l.radius * GLOW_REACH * flicker, this.glowColour, l.intensity * GLOW_STRENGTH * pulse);
    }
    for (const g of this.extraGlows) this.lightMap.add(g.x, g.y, g.radius, g.colour, g.intensity);
    this.extraGlows.length = 0;
    this.lightMap.render(this.renderer);
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

  /**
   * How lit each tile of a level and its surroundings is, by how far it lies from the playable world; fully lit
   * everywhere without surroundings.
   */
  private shadeOf(level: Level, surroundings: Surroundings | null) {
    const area = shadeArea(level.map, surroundings?.margin ?? 0);
    if (!surroundings) return { values: new Float32Array(area.width * area.depth).fill(1), base: null, ...area, mapWidth: level.map.width, mapHeight: level.map.height };
    const inside = (tx: number, ty: number) =>
      level.structures.some((s) => tx >= s.x && ty >= s.y && tx < s.x + s.width && ty < s.y + s.depth);
    const values = playDistances(level.map, area, inside).map((d) => shadeAt(d, surroundings.fade));
    return { values, base: values.slice(), ...area, mapWidth: level.map.width, mapHeight: level.map.height };
  }

  /**
   * Darkens what the hero hasn't found yet: `shown` says how far each of the level's tiles has been revealed, from 0
   * to 1. Past the map's edges, the surroundings' own darkness holds.
   */
  setExplored(shown: Float32Array): void {
    const shade = this.shade;
    if (!shade) return;
    const { values, base, x0, y0, width, depth, mapWidth, mapHeight } = shade;
    for (let y = 0; y < depth; y++) {
      for (let x = 0; x < width; x++) {
        const tx = x + x0;
        const ty = y + y0;
        const onMap = tx >= 0 && ty >= 0 && tx < mapWidth && ty < mapHeight;
        values[y * width + x] = (base?.[y * width + x] ?? 1) * (onMap ? shown[ty * mapWidth + tx]! : 1);
      }
    }
    this.lightMap.setShade(shade);
  }

  /**
   * Ground tiles, except under walls drawn as panels, where the room ends at the panel. With surroundings, the ground
   * carries on under the walls too, and past the map's edges.
   */
  private buildGround(
    level: Level, walls: ReadonlySet<number> = new Set(), surroundings: Surroundings | null = null, holes: ReadonlySet<number> = new Set(),
  ): THREE.Mesh {
    const { map } = level;
    const margin = surroundings?.margin ?? 0;
    const kindAt = (tx: number, ty: number): number => {
      const i = clamp(ty, 0, map.height - 1) * map.width + clamp(tx, 0, map.width - 1);
      if (surroundings?.ground !== undefined) return map.ground[i] || surroundings.ground;
      const onMap = tx >= 0 && ty >= 0 && tx < map.width && ty < map.height;
      return !onMap || walls.has(map.prop[i]!) || holes.has(i) ? 0 : map.ground[i]!;
    };
    const grain = this.look.mood(level.id).groundGrain;
    if (grain !== undefined) {
      const colour = new THREE.Color();
      const ground = blendedGround(map.width + margin * 2, map.height + margin * 2, (x, y) => {
        const kind = kindAt(x - margin, y - margin);
        if (!kind) return null;
        colour.set(this.look.groundColour(kind, x - margin, y - margin, level.id));
        return [colour.r, colour.g, colour.b];
      }, grain);
      ground.position.set(-margin, 0, -margin);
      return ground;
    }
    const tile = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const mesh = new THREE.InstancedMesh(tile, new THREE.MeshLambertMaterial(), (map.width + margin * 2) * (map.height + margin * 2));
    const matrix = new THREE.Matrix4();
    const colour = new THREE.Color();
    let n = 0;
    for (let ty = -margin; ty < map.height + margin; ty++) {
      for (let tx = -margin; tx < map.width + margin; tx++) {
        const kind = kindAt(tx, ty);
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

  /**
   * Walls as panels along the edges where wall tiles meet the floor, if the look draws them that way and its models
   * loaded. Returns the panels and the prop kinds they stand in for.
   */
  private buildWalls(level: Level): { meshes: THREE.InstancedMesh[]; kinds: ReadonlySet<number> } | null {
    const look = this.look.walls?.(level.id);
    const panel = look && this.models.get(look.panel);
    if (!look || !panel) return null;
    const kinds = new Set(look.props);
    if (look.kit) return { meshes: this.buildKitWalls(level, look, look.kit, panel, kinds), kinds };
    // Cut away round the hero, front walls stand full height like back walls; otherwise they're drawn low.
    const front = look.cutaway ? panel : look.front && this.models.get(look.front.name);
    this.lightMap.setCutaway(look.cutaway?.radius ?? null, { x: VIEW_DIRECTION.x, y: VIEW_DIRECTION.z }, look.cutaway?.opacity);
    const backs: THREE.Matrix4[] = [];
    const fronts: THREE.Matrix4[] = [];
    // A panel stands just behind its edge, on the wall's side; turned to face the camera, it's moved back over by its
    // own thickness, so it stays on the wall's side and meets the walls either side of it.
    const thickness = modelSize(panel).x * panelScale(panel, look.span);
    for (const p of wallPanels(level.map, isWallTile(level.map, kinds), look.span)) {
      if (p.front && !front) continue;
      // Front pieces are seen from outside the room, so they face the camera rather than the floor.
      const facing = p.front ? { x: -p.facing.x, y: -p.facing.y } : p.facing;
      const placement = new THREE.Matrix4()
        .makeTranslation(p.x, 0, p.y)
        .multiply(new THREE.Matrix4().makeRotationY(Math.atan2(-facing.y, facing.x)))
        .multiply(new THREE.Matrix4().makeScale(1, 1, p.length / look.span));
      if (p.front && look.cutaway) placement.multiply(new THREE.Matrix4().makeTranslation(thickness, 0, 0));
      (p.front ? fronts : backs).push(placement);
    }
    const meshes = [
      ...instancedModel(panel, panelFit(panel, look.span), backs),
      ...this.buildCrown(look, panelFit(panel, look.span), backs),
      ...(front && fronts.length ? this.frontWalls(look, front, fronts) : []),
      ...(look.fixtures ?? []).flatMap((f) => this.buildFixtures(level, f, isWallTile(level.map, kinds), panelScale(panel, look.span))),
    ];
    return { meshes, kinds };
  }

  /** Walls between the room and the camera: full panels cut away round the hero, or the look's low piece. */
  private frontWalls(look: WallLook, front: ModelTemplate, fronts: THREE.Matrix4[]): THREE.InstancedMesh[] {
    if (!look.cutaway) return instancedModel(front, panelFit(front, look.span, look.front!.height), fronts);
    const meshes = instancedModel(front, panelFit(front, look.span), fronts);
    for (const mesh of meshes) mesh.userData.cutaway = true;
    return meshes;
  }

  /** The crown along the top of the back walls: each piece picks a model and shares its wall panel's placement and fit. */
  private buildCrown(look: WallLook, fit: THREE.Matrix4, backs: readonly THREE.Matrix4[]): THREE.InstancedMesh[] {
    const crowns = (look.crown ?? []).map((name) => (name === null ? undefined : this.models.get(name)));
    const placements = crowns.map(() => [] as THREE.Matrix4[]);
    const at = new THREE.Vector3();
    for (const placement of backs) {
      at.setFromMatrixPosition(placement);
      const pick = Math.floor(hash2(Math.floor(at.x * 2), Math.floor(at.z * 2), 47) * crowns.length);
      if (crowns[pick]) placements[pick]!.push(placement);
    }
    return crowns.flatMap((template, i) => (template && placements[i]!.length ? instancedModel(template, fit, placements[i]!) : []));
  }

  /**
   * Walls from a modular kit, each piece in the kit's own frame: a straight panel's face stands on the edge of its
   * 4-unit cell, and a corner piece is an L across one cell, so the pieces meet as the kit was made to. Walls between the
   * room and the camera face the room like the rest; with a cutaway they turn see-through round the hero.
   */
  private buildKitWalls(level: Level, look: WallLook, kit: NonNullable<WallLook['kit']>, panel: ModelTemplate, kinds: ReadonlySet<number>): THREE.InstancedMesh[] {
    const { map } = level;
    const isWall = isWallTile(map, kinds);
    // Openings in a wall's line, between wall tiles: doorways, and anything solid set into it, such as a cradle.
    const isOpening = (tx: number, ty: number) => {
      if (isWall(tx, ty)) return false;
      const doorway = level.portals.some((p) => p.tx === tx && p.ty === ty);
      if (!doorway && !map.solid[tileIndex(map, tx, ty)]) return false;
      const wallAt = (x: number, y: number) => inBounds(map, x, y) && isWall(x, y);
      return (wallAt(tx - 1, ty) && wallAt(tx + 1, ty)) || (wallAt(tx, ty - 1) && wallAt(tx, ty + 1));
    };
    const { panels, corners, openings } = kitWalls(map, isWall, look.span, isOpening);
    const k = look.span / KIT_CELL;
    const scale = new THREE.Matrix4().makeScale(k, k, k);
    const straight = (p: { x: number; y: number; facing: Vec2 }) => new THREE.Matrix4()
      .makeTranslation(p.x, 0, p.y)
      .multiply(new THREE.Matrix4().makeRotationY(Math.atan2(-p.facing.y, p.facing.x)))
      .multiply(scale)
      .multiply(new THREE.Matrix4().makeTranslation(KIT_CELL / 2, 0, 0));
    // Both kinds of corner piece have their corner a cell back from the origin and arms running along +x and +z; an inner
    // piece's walls face in between its arms, an outer one's out. Moved a cell over, they're turned to run along `arms`.
    const turnOf = (c: KitCorner) => KIT_CORNER_TURN[`${c.arms.x},${c.arms.y}`]!;
    // Whether the arm along the piece's own x (or else its z) lies on a front wall, once the piece is turned into place.
    const armIsFront = (c: KitCorner, pieceX: boolean) => {
      const runsAlongMapX = Math.abs(Math.cos(turnOf(c))) > 0.5 === pieceX;
      return runsAlongMapX ? c.front.alongX : c.front.alongY;
    };
    const cornerAt = (c: KitCorner) => new THREE.Matrix4()
      .makeTranslation(c.x, 0, c.y)
      .multiply(new THREE.Matrix4().makeRotationY(turnOf(c)))
      .multiply(scale)
      .multiply(new THREE.Matrix4().makeTranslation(KIT_CELL, 0, KIT_CELL));
    const pieces: Array<{ template: ModelTemplate | undefined; placements: THREE.Matrix4[]; front: boolean }> = [];
    for (const front of [false, true]) {
      pieces.push({ template: panel, placements: panels.filter((p) => p.front === front).map(straight), front });
    }
    // A corner's two arms are placed apart, so the one along a front wall cuts away and the one along a back wall doesn't.
    for (const inner of [true, false]) {
      const arms = this.cornerArmsOf(inner ? kit.inner : kit.outer);
      for (const alongX of [true, false]) {
        for (const front of [false, true]) {
          const placements = corners.filter((c) => c.inner === inner && armIsFront(c, alongX) === front).map(cornerAt);
          pieces.push({ template: arms && (alongX ? arms.alongX : arms.alongZ), placements, front });
        }
      }
    }
    this.lightMap.setCutaway(look.cutaway?.radius ?? null, { x: VIEW_DIRECTION.x, y: VIEW_DIRECTION.z }, look.cutaway?.opacity);
    const meshes = pieces.flatMap(({ template, placements, front }) => {
      if (!template || !placements.length) return [];
      const made = instancedModel(template, new THREE.Matrix4(), placements);
      if (front && look.cutaway) for (const mesh of made) mesh.userData.cutaway = true;
      return made;
    });
    const partitionKinds = new Set(look.partitions ?? []);
    const isPartition = (tx: number, ty: number) => partitionKinds.has(map.prop[tileIndex(map, tx, ty)]!);
    const inner = kitPartitions(map, isPartition, isWall, look.span);
    const doorways = openings.filter((o) => level.portals.some((p) => p.tx === o.tx && p.ty === o.ty));
    // A doorway in a front wall cuts away with it, rather than standing alone round the hero.
    const inFront = (o: KitOpening) => o.facing.x < 0 || o.facing.y < 0;
    return [
      ...meshes,
      ...this.buildCrown(look, new THREE.Matrix4(), panels.filter((p) => !p.front).map(straight)),
      ...instancedModel(panel, new THREE.Matrix4(), inner.panels.map(straight)),
      ...this.kitDoors(kit, [...doorways.filter((d) => !inFront(d)), ...inner.doorways], k),
      ...this.kitDoors(kit, doorways.filter(inFront), k).map((mesh) => {
        if (look.cutaway) mesh.userData.cutaway = true;
        return mesh;
      }),
      ...(look.fixtures ?? []).flatMap((f) => this.buildFixtures(level, f, isWall, k)),
    ];
  }

  private cornerArmsOf(name: string): ReturnType<typeof cornerArms> | undefined {
    const template = this.models.get(name);
    if (!template) return undefined;
    let arms = this.cornerArmsByModel.get(name);
    if (!arms) this.cornerArmsByModel.set(name, (arms = cornerArms(template)));
    return arms;
  }

  /**
   * A door frame in each doorway of kit walls, centred on the wall's line across its cell, as wide as the kit's frame
   * at the kit's scale and a little taller than the walls, so it reads as the way through.
   */
  private kitDoors(kit: NonNullable<WallLook['kit']>, doorways: ReadonlyArray<{ x: number; y: number; facing: Vec2 }>, k: number): THREE.InstancedMesh[] {
    const frame = kit.door ? this.models.get(kit.door) : undefined;
    if (!frame || !doorways.length) return [];
    const size = modelSize(frame);
    const fit = fitMatrix(frame, { type: 'box', width: size.x * k, height: KIT_WALL_HEIGHT * k * DOOR_RISE, depth: size.z * k });
    // The frame's width lies along its x, so it's turned a quarter more than a panel, to run along the wall.
    return instancedModel(frame, fit, doorways.map((o) => new THREE.Matrix4()
      .makeTranslation(o.x, 0, o.y)
      .multiply(new THREE.Matrix4().makeRotationY(Math.atan2(-o.facing.y, o.facing.x) + Math.PI / 2))));
  }

  private buildFixtures(level: Level, fixture: WallFixture, isWall: (tx: number, ty: number) => boolean, scale: number): THREE.InstancedMesh[] {
    const template = this.models.get(fixture.name);
    if (!template) return [];
    const { map } = level;
    const kinds = new Set(fixture.props);
    const placements: THREE.Matrix4[] = [];
    for (let ty = 0; ty < map.height; ty++) {
      for (let tx = 0; tx < map.width; tx++) {
        if (!kinds.has(map.prop[tileIndex(map, tx, ty)]!)) continue;
        for (const face of wallFaces(map, isWall, tx, ty)) {
          if (face.front) continue;
          placements.push(new THREE.Matrix4()
            .makeTranslation(face.x, fixture.height, face.y)
            .multiply(new THREE.Matrix4().makeRotationY(Math.atan2(-face.facing.y, face.facing.x))));
        }
      }
    }
    const fit = new THREE.Matrix4()
      .makeScale(scale, scale, scale)
      .multiply(new THREE.Matrix4().makeRotationZ(fixture.tilt ?? 0))
      .multiply(new THREE.Matrix4().makeRotationY(fixture.turn ?? 0));
    return placements.length ? instancedModel(template, fit, placements) : [];
  }

  /** Where the level's props burn, for those whose look has flames. */
  private flameSpots(level: Level): FlameSpot[] {
    const { map } = level;
    const spots: FlameSpot[] = [];
    for (let i = 0; i < map.prop.length; i++) {
      const flame = map.prop[i] ? this.look.prop(map.prop[i]!, level.id)?.flame : undefined;
      if (flame) spots.push({ x: (i % map.width) + 0.5, y: Math.floor(i / map.width) + 0.5, ...flame });
    }
    return spots;
  }

  /** The level's water, over its tiles of the water's ground kind and on past its edges with the ground. */
  private buildWater(level: Level, look: WaterLook, surroundings: Surroundings | null): WaterSurface {
    const { map } = level;
    const area = shadeArea(map, surroundings?.margin ?? 0);
    const isWater = (tx: number, ty: number) =>
      map.ground[clamp(ty, 0, map.height - 1) * map.width + clamp(tx, 0, map.width - 1)] === look.ground;
    return new WaterSurface(area, isWater, look, this.lightMap.uniforms);
  }

  /** Scenery standing in the dark round a level, grouped by kind and drawn like props of that kind. */
  private buildScenery(level: Level, surroundings: Surroundings | null): THREE.InstancedMesh[] {
    const byKind = new Map<number, Vec2[]>();
    for (const piece of surroundings?.scenery ?? []) {
      let list = byKind.get(piece.prop);
      if (!list) byKind.set(piece.prop, (list = []));
      list.push(piece);
    }
    return [...byKind].flatMap(([kind, points]) => {
      const model = this.look.prop(kind, level.id)?.model;
      return (model && this.modelledProps(points, model, kind)) ?? [];
    });
  }

  private buildProps(level: Level, skip: ReadonlySet<number> = new Set()): THREE.InstancedMesh[] {
    const { map } = level;
    const tilesByKind = new Map<number, number[]>();
    for (let i = 0; i < map.prop.length; i++) {
      const kind = map.prop[i]!;
      if (!kind || skip.has(kind) || !this.look.prop(kind, level.id)) continue;
      let list = tilesByKind.get(kind);
      if (!list) tilesByKind.set(kind, (list = []));
      list.push(i);
    }
    const matrix = new THREE.Matrix4();
    const meshes: THREE.InstancedMesh[] = [];
    for (const [kind, tiles] of tilesByKind) {
      const look = this.look.prop(kind, level.id)!;
      const points = tiles.map((i) => ({ x: (i % map.width) + 0.5, y: Math.floor(i / map.width) + 0.5 }));
      const fromModels = look.model && this.modelledProps(points, look.model, kind);
      if (fromModels) {
        meshes.push(...fromModels);
        continue;
      }
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

  /**
   * Props drawn from models at `points`, each picking one of the variants and a turn from the map's stable hash of its
   * tile, so a level looks the same on every visit. Null if none of the models loaded.
   */
  private modelledProps(points: readonly Vec2[], model: NonNullable<PropLook['model']>, salt: number): THREE.InstancedMesh[] | null {
    const variants = model.names.map((name) => this.models.get(name));
    if (variants.every((v) => !v)) return null;
    const placements = variants.map(() => [] as THREE.Matrix4[]);
    for (const p of points) {
      const tx = Math.floor(p.x);
      const ty = Math.floor(p.y);
      let v = Math.floor(hash2(tx, ty, 31 + salt) * variants.length);
      if (!variants[v]) v = variants.findIndex(Boolean);
      const turn = model.turn === 'random' ? hash2(tx, ty, 37 + salt) * Math.PI * 2 : (model.turn ?? 0);
      placements[v]!.push(new THREE.Matrix4().makeTranslation(p.x, 0, p.y).multiply(new THREE.Matrix4().makeRotationY(turn)));
    }
    return variants.flatMap((template, v) =>
      template && placements[v]!.length ? instancedModel(template, fitMatrix(template, model.fit), placements[v]!) : [],
    );
  }

  /** Tiles of the level's doorways set into a wall's line, between wall tiles, as indexes. */
  private doorwayTiles(level: Level, kinds: ReadonlySet<number>): Set<number> {
    const { map } = level;
    const wallAt = (x: number, y: number) => inBounds(map, x, y) && kinds.has(map.prop[tileIndex(map, x, y)]!) && map.solid[tileIndex(map, x, y)] === 1;
    return new Set(level.portals
      .filter((p) => (wallAt(p.tx - 1, p.ty) && wallAt(p.tx + 1, p.ty)) || (wallAt(p.tx, p.ty - 1) && wallAt(p.tx, p.ty + 1)))
      .map((p) => tileIndex(map, p.tx, p.ty)));
  }

  /** Floor models over the ground, except under walls drawn as panels and in doorways, like the ground itself. */
  private buildFloors(level: Level, walls: ReadonlySet<number> = new Set(), holes: ReadonlySet<number> = new Set()): THREE.InstancedMesh[] {
    const { map } = level;
    const byName = new Map<string, THREE.Matrix4[]>();
    for (let ty = 0; ty < map.height; ty++) {
      for (let tx = 0; tx < map.width; tx++) {
        if (walls.has(map.prop[ty * map.width + tx]!) || holes.has(ty * map.width + tx)) continue;
        const name = this.look.floorModel?.(map.ground[ty * map.width + tx]!, level.id);
        if (!name || !this.models.get(name)) continue;
        let list = byName.get(name);
        if (!list) byName.set(name, (list = []));
        list.push(new THREE.Matrix4().makeTranslation(tx + 0.5, 0.001, ty + 0.5));
      }
    }
    return [...byName].flatMap(([name, placements]) => {
      const template = this.models.get(name)!;
      return instancedModel(template, fitMatrix(template, { type: 'width', width: 1 }), placements);
    });
  }

  private buildStructures(level: Level): THREE.Object3D[] {
    return level.structures.map((s, index) => {
      const look = this.look.structure(s.kind);
      const built = look.kit && kitBuilding(s, look.kit, this.models);
      if (built) {
        built.group.userData.structureIndex = index;
        this.levelLights.push(...built.lights);
        this.darkWindows.set(index, built.windows);
        return built.group;
      }
      const group = new THREE.Group();
      const template = look.model && this.models.get(look.model.name);
      if (template && look.model) {
        const fit = fitMatrix(template, { type: 'footprint', width: s.width + 0.4, depth: s.depth + 0.4 }, look.model.rotation);
        for (const mesh of instancedModel(template, fit, [new THREE.Matrix4()])) group.add(mesh);
        group.position.set(s.x + s.width / 2, 0, s.y + s.depth / 2);
        group.userData.structureIndex = index;
        return group;
      }
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

/** Frees a level's own geometry and materials. Model geometry belongs to the model library and stays. */
function disposeTree(root: THREE.Object3D): void {
  root.traverse((o) => {
    if (o instanceof THREE.InstancedMesh && o.userData.fromModel) {
      o.dispose();
      const materials = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of materials) if (m.userData.ownCopy) m.dispose();
      return;
    }
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      const materials = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of materials) m.dispose();
    }
  });
}
