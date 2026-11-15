import * as THREE from 'three';
import { clamp, hash2, type Vec2 } from '../core/math';
import type { Level, LevelLight } from '../world/level';
import { tileIndex } from '../world/tile-map';
import { ActorFigure, type ActorMoment } from './actor-figure';
import { Effects } from './effects';
import { Flames, type FlameSpot } from './flames';
import { blendedGround } from './ground-blend';
import { kitBuilding } from './kit-building';
import { LightMap } from './light-map';
import type { Look, Mood, PropLook, WallFixture } from './look';
import { fitMatrix, instancedModel, panelFit, panelScale } from './model-instancing';
import { ModelLibrary, type ModelTemplate } from './models';
import { isWallTile, wallFaces, wallPanels } from './wall-panels';

/** 30° above the ground gives the classic 2:1 isometric look: a tile is twice as wide as it is tall on screen. */
const ELEVATION = Math.PI / 6;
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
  private readonly marker: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  private markerAge = Infinity;
  /** Set when a level is shown; the next render compiles every shader the level can need. */
  private warmUpPending = false;
  private levelGroup = new THREE.Group();
  private structures: THREE.Object3D[] = [];
  private levelLights: LevelLight[] = [];
  /** Whether the level shown is alarmed, which lights its alarm lights. */
  private alarmed = false;
  private mood: Mood | null = null;
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
  }

  /** How much the view is zoomed, 1 when a tile is 64 pixels wide. */
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
    this.levelLights = [...level.lights];
    this.lightMap.setArea(level.map.width, level.map.height);

    const mood = this.look.mood(level.id);
    this.mood = mood;
    this.alarmed = false;
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
    const walls = this.buildWalls(level);
    this.levelGroup.add(this.buildGround(level, walls?.kinds));
    for (const mesh of this.buildFloors(level, walls?.kinds)) this.levelGroup.add(mesh);
    for (const mesh of walls?.meshes ?? []) this.levelGroup.add(mesh);
    for (const mesh of this.buildProps(level, walls?.kinds)) this.levelGroup.add(mesh);
    this.structures = this.buildStructures(level);
    for (const mesh of this.structures) this.levelGroup.add(mesh);
    this.levelGroup.traverse((o) => this.lightUp(o));
    // Flames give their own light, so they stay out of the light map.
    this.flames = new Flames(this.flameSpots(level));
    this.levelGroup.add(this.flames.group);
  }

  /** Adds a light for the coming frame only, such as one carried by a fireball or an explosion's flash. */
  glow(x: number, y: number, radius: number, colour: number, intensity: number): void {
    this.extraGlows.push({ x, y, radius, colour, intensity });
  }

  /** Makes an object's materials take light from the light map. */
  private lightUp(o: THREE.Object3D): void {
    if (!(o instanceof THREE.Mesh)) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) this.lightMap.light(m);
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
    pose: { moving: boolean; dead: boolean; flash: number; fade: number; speed?: number },
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
    figure.pose(pose.moving, pose.dead, pose.speed);
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
    this.heroLight.position.set(x, 1.2, y);
  }

  render(seconds: number, frameSeconds: number): void {
    if (this.warmUpPending) this.warmUp();
    this.placeCamera();
    this.applyShake(frameSeconds);
    this.updateLightMap(seconds);
    this.updateMarker(frameSeconds);
    this.effects.update(frameSeconds);
    this.flames?.update(seconds, frameSeconds);
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
    for (const figure of this.actors.values()) figure.setLookOf(0, 0.5);
    this.renderer.compile(this.scene, this.camera);
    for (const figure of this.actors.values()) figure.setLookOf(0, 1);
    this.renderer.compile(this.scene, this.camera);
    this.effects.setAllVisible(false);
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

  /** Lights the level's alarm lights and turns its air to the mood's alarm colour, or puts them out. */
  setAlarmed(alarmed: boolean): void {
    if (alarmed === this.alarmed || !this.mood) return;
    this.alarmed = alarmed;
    this.ambient.color.set(alarmed && this.mood.alarmAmbient !== undefined ? this.mood.alarmAmbient : this.mood.ambient);
  }

  /** Draws every level light, with its flicker, and this frame's extra glows into the light map. */
  private updateLightMap(seconds: number): void {
    this.lightMap.begin();
    for (const l of this.levelLights) {
      if (l.alarm && !this.alarmed) continue;
      const flicker = l.flicker
        ? 1 + Math.sin(seconds * 9 + l.seed) * 0.06 * l.flicker + Math.sin(seconds * 23 + l.seed * 3) * 0.04 * l.flicker
        : 1;
      // A beacon sweeps past about twice a second, bright when it faces the room and dim between.
      const pulse = l.alarm ? 0.3 + 0.7 * Math.max(0, Math.sin(seconds * 12 + l.seed)) ** 2 : 1;
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

  /** Ground tiles, except under walls drawn as panels, where the room ends at the panel. */
  private buildGround(level: Level, walls: ReadonlySet<number> = new Set()): THREE.Mesh {
    const { map } = level;
    const grain = this.look.mood(level.id).groundGrain;
    if (grain !== undefined) {
      const colour = new THREE.Color();
      return blendedGround(map.width, map.height, (tx, ty) => {
        const kind = map.ground[ty * map.width + tx]!;
        if (!kind || walls.has(map.prop[ty * map.width + tx]!)) return null;
        colour.set(this.look.groundColour(kind, tx, ty, level.id));
        return [colour.r, colour.g, colour.b];
      }, grain);
    }
    const tile = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const mesh = new THREE.InstancedMesh(tile, new THREE.MeshLambertMaterial(), map.width * map.height);
    const matrix = new THREE.Matrix4();
    const colour = new THREE.Color();
    let n = 0;
    for (let ty = 0; ty < map.height; ty++) {
      for (let tx = 0; tx < map.width; tx++) {
        const kind = map.ground[ty * map.width + tx]!;
        if (!kind || walls.has(map.prop[ty * map.width + tx]!)) continue;
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
    const front = look.front && this.models.get(look.front.name);
    const backs: THREE.Matrix4[] = [];
    const fronts: THREE.Matrix4[] = [];
    for (const p of wallPanels(level.map, isWallTile(level.map, kinds), look.span)) {
      if (p.front && !front) continue;
      // Front pieces are seen from outside the room, so they face the camera rather than the floor.
      const facing = p.front ? { x: -p.facing.x, y: -p.facing.y } : p.facing;
      const placement = new THREE.Matrix4()
        .makeTranslation(p.x, 0, p.y)
        .multiply(new THREE.Matrix4().makeRotationY(Math.atan2(-facing.y, facing.x)))
        .multiply(new THREE.Matrix4().makeScale(1, 1, p.length / look.span));
      (p.front ? fronts : backs).push(placement);
    }
    const meshes = [
      ...instancedModel(panel, panelFit(panel, look.span), backs),
      ...(front && look.front && fronts.length ? instancedModel(front, panelFit(front, look.span, look.front.height), fronts) : []),
      ...(look.fixtures ?? []).flatMap((f) => this.buildFixtures(level, f, isWallTile(level.map, kinds), panelScale(panel, look.span))),
    ];
    return { meshes, kinds };
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
      const fromModels = look.model && this.modelledProps(map.width, tiles, look.model, kind);
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
   * Props drawn from models, each tile picking one of the variants and a turn from the map's stable hash, so a
   * level looks the same on every visit. Null if none of the models loaded.
   */
  private modelledProps(
    mapWidth: number,
    tiles: number[],
    model: NonNullable<PropLook['model']>,
    salt: number,
  ): THREE.InstancedMesh[] | null {
    const variants = model.names.map((name) => this.models.get(name));
    if (variants.every((v) => !v)) return null;
    const placements = variants.map(() => [] as THREE.Matrix4[]);
    for (const i of tiles) {
      const tx = i % mapWidth;
      const ty = Math.floor(i / mapWidth);
      let v = Math.floor(hash2(tx, ty, 31 + salt) * variants.length);
      if (!variants[v]) v = variants.findIndex(Boolean);
      const turn = model.turn === 'random' ? hash2(tx, ty, 37 + salt) * Math.PI * 2 : (model.turn ?? 0);
      placements[v]!.push(new THREE.Matrix4().makeTranslation(tx + 0.5, 0, ty + 0.5).multiply(new THREE.Matrix4().makeRotationY(turn)));
    }
    return variants.flatMap((template, v) =>
      template && placements[v]!.length ? instancedModel(template, fitMatrix(template, model.fit), placements[v]!) : [],
    );
  }

  /** Floor models laid over the ground tiles of the kinds that have one. */
  /** Floor models over the ground, except under walls drawn as panels, like the ground itself. */
  private buildFloors(level: Level, walls: ReadonlySet<number> = new Set()): THREE.InstancedMesh[] {
    const { map } = level;
    const byName = new Map<string, THREE.Matrix4[]>();
    for (let ty = 0; ty < map.height; ty++) {
      for (let tx = 0; tx < map.width; tx++) {
        if (walls.has(map.prop[ty * map.width + tx]!)) continue;
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
