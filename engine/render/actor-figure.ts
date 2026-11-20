import * as THREE from 'three';
import type { ActorLook, HeldWeapon } from './look';
import { modelSize } from './model-instancing';
import type { ModelLibrary } from './models';
import { walkPace } from './walk-pace';

/** One-off animations that play over the actor's idle, moving or dying pose. */
export type ActorMoment = 'attack' | 'cast' | 'hit';
type BaseName = 'idle' | 'move' | 'channel' | 'death';

const BLEND_SECONDS = 0.15;
/** How quickly an actor leans into a continuous attack and back. */
const LEAN_RATE = 10;
/** Hovering actors bob this many tiles up and down, this many times a second. */
const BOB_HEIGHT = 0.07;
const BOB_RATE = 0.35;
/** A walk never plays slower or faster than this, so a badly measured clip still looks like walking. */
const PACE_RANGE: [number, number] = [0.4, 5];

type FlashableMaterial = THREE.Material & { emissive?: THREE.Color };

/** Each look's measured walking pace. Measuring plays the clip through, too slow to repeat for every spawn. */
const PACES = new WeakMap<ActorLook, number | null>();

/**
 * How one actor is drawn: an animated model from the library, or a simple capsule when there's none. It blends
 * between idle, moving and dying, plays one-off moments such as an attack, and lights up when hit.
 */
export class ActorFigure {
  readonly root = new THREE.Group();
  /** The frame the actor was last placed in. */
  seen = 0;
  private readonly materials: FlashableMaterial[] = [];
  /**
   * How each material looks of its own, before any flash or fade: a see-through part stays as see-through and a
   * glowing part keeps glowing.
   */
  private readonly ownLooks = new Map<FlashableMaterial, { opacity: number; transparent: boolean; emissive: THREE.Color | null }>();
  /** The outline drawn where the actor is hidden, if its look has one. */
  private readonly seenThrough: THREE.MeshBasicMaterial | null = null;
  private readonly mixer: THREE.AnimationMixer | null = null;
  /** For hovering actors: the model, bobbed each frame, and the shadow that shows it's off the ground. */
  private hovering: { model: THREE.Object3D; shadow: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>; age: number } | null = null;
  private readonly actions = new Map<string, THREE.AnimationAction>();
  private base: THREE.AnimationAction | null = null;
  private moment: THREE.AnimationAction | null = null;
  /** Tiles a second the move animation carries the actor at its normal speed, or null if it couldn't be measured. */
  private readonly movePace: number | null = null;
  /** The weapon in hand, where it rests in the hand, and how many of the hand's own units make a tile. */
  private held: { weapon: THREE.Object3D; rest: THREE.Vector3; tilesToBone: number } | null = null;
  /** Whether the actor is keeping up a continuous attack. */
  private channelling = false;
  /** The weapon it's drawn holding, by the rules' weapon id, or null for its own hands. */
  private armedWith: string | null = null;
  private baseName: BaseName = 'idle';
  private model: THREE.Object3D | null = null;

  constructor(
    private readonly look: ActorLook,
    private readonly library: ModelLibrary,
  ) {
    const model = look.model && library.instantiate(look.model.name);
    const template = look.model && library.get(look.model.name);
    if (look.seenThrough !== undefined) this.seenThrough = seenThroughMaterial(look.seenThrough);
    if (!model || !template || !look.model) {
      this.buildCapsule();
      this.addSeenThrough();
      return;
    }
    model.scale.setScalar(look.height / template.height);
    this.model = model;
    if (look.hover) {
      model.position.y = look.hover;
      // Indoors nothing casts shadows, so without its own a floating actor looks like it stands further back.
      const shadow = new THREE.Mesh(
        new THREE.CircleGeometry(look.radius * 1.4, 20).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false }),
      );
      shadow.position.y = 0.02;
      this.root.add(shadow);
      this.hovering = { model, shadow, age: Math.random() * 10 };
    }
    const tint = look.model.tint === undefined ? null : new THREE.Color(look.model.tint);
    model.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      o.castShadow = true;
      o.material = this.ownMaterial(o.material as THREE.Material, tint);
    });
    if (look.model.weapon) this.holdWeapon(model, look.model.weapon, library);
    this.root.add(model);
    model.traverse((o) => {
      // Three.js keeps every object's `rotation` angles in step with its quaternion. Animation moves bones by their
      // quaternions dozens of times a frame per character, and nothing reads a bone's angles, so skip that work.
      if (o instanceof THREE.Bone) o.quaternion._onChange(() => {});
    });
    const moveClip = template.animations.find((c) => c.name === look.model!.animations.move);
    if (moveClip && look.model.matchPace) {
      if (!PACES.has(look)) PACES.set(look, walkPace(model, moveClip));
      this.movePace = PACES.get(look)!;
    }
    this.mixer = new THREE.AnimationMixer(model);
    for (const clip of template.animations) this.actions.set(clip.name, this.mixer.clipAction(clip));
    this.mixer.addEventListener('finished', (e) => {
      if (e.action !== this.moment) return;
      this.moment = null;
      if (this.base) this.base.reset().play().crossFadeFrom(e.action, BLEND_SECONDS, false);
    });
    this.setBase('idle');
    this.addSeenThrough();
    look.model.dress?.(model, (material) => this.keep(material));
  }

  /**
   * Sets the ongoing pose: dying wins over moving, which wins over keeping up a continuous attack, which wins over
   * idling. While channelling, the actor leans in and a held weapon buzzes, as far as its look's `channelPose` says. For looks that match their pace, the move
   * animation plays faster or slower to match `speed`, in tiles a second, so its feet don't slide over the ground.
   */
  pose(moving: boolean, dead: boolean, speed?: number, channelling = false): void {
    this.channelling = channelling && !dead && !moving;
    this.setBase(dead ? 'death' : moving ? 'move' : this.channelling ? 'channel' : 'idle');
    const move = this.action('move');
    if (move && speed && this.movePace) move.timeScale = THREE.MathUtils.clamp(speed / this.movePace, ...PACE_RANGE);
  }

  /**
   * Plays a one-off moment, stretched to last `seconds` if given, such as an attack timed to its wind-up. A flinch
   * stops the legs, so it's skipped while moving rather than sliding along, and while keeping up a continuous attack
   * rather than breaking it off; the hit flash still shows.
   */
  play(moment: ActorMoment, seconds?: number): void {
    if (moment === 'hit' && (this.moment || this.channelling || this.base === this.action('move'))) return;
    const action = this.action(moment);
    if (!action || this.base === this.action('death')) return;
    const from = this.moment ?? this.base;
    this.moment = action;
    action.reset();
    action.setLoop(THREE.LoopOnce, 1);
    // Hold the last frame, so the blend back to the pose starts from it rather than from the rest pose.
    action.clampWhenFinished = true;
    action.timeScale = seconds ? action.getClip().duration / seconds : 1;
    action.play();
    if (from && from !== action) action.crossFadeFrom(from, 0.08, false);
  }

  /** `flash` from 0 to 1 lights the actor up; `fade` from 1 to 0 fades it out. */
  setLookOf(flash: number, fade: number): void {
    for (const m of this.materials) {
      const own = this.ownLooks.get(m);
      if (m.emissive) {
        if (own?.emissive) m.emissive.copy(own.emissive);
        else m.emissive.setScalar(0);
        m.emissive.addScalar(flash * 0.8);
      }
      m.opacity = (own?.opacity ?? 1) * fade;
      m.transparent = Boolean(own?.transparent) || fade < 1;
    }
    if (this.hovering) this.hovering.shadow.material.opacity = 0.45 * fade;
    if (this.seenThrough) this.seenThrough.opacity = SEEN_THROUGH_OPACITY * fade;
    this.root.scale.set(1, this.mixer ? 1 : 0.3 + 0.7 * fade, 1);
  }

  private holdWeapon(model: THREE.Object3D, held: string | HeldWeapon, library: ModelLibrary): void {
    const name = typeof held === 'string' ? held : held.name;
    const weapon = library.instantiate(name);
    const hand = model.getObjectByName(typeof held === 'string' ? 'handslot.r' : THREE.PropertyBinding.sanitizeNodeName(held.bone));
    if (!weapon || !hand) return;
    weapon.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      o.castShadow = true;
      o.material = this.ownMaterial(o.material as THREE.Material, null);
    });
    // Sizes in tiles undo the scale the hand's bones and the model already carry.
    model.updateMatrixWorld(true);
    const handScale = hand.getWorldScale(new THREE.Vector3()).x;
    if (typeof held !== 'string') {
      const size = modelSize(library.get(name)!);
      weapon.scale.setScalar(held.length / Math.max(size.x, size.y, size.z) / handScale);
      weapon.rotation.set(...held.turn);
      const [ox, oy, oz] = held.offset ?? [0, 0, 0];
      weapon.position.set(ox / handScale, oy / handScale, oz / handScale);
    }
    hand.add(weapon);
    this.held = { weapon, rest: weapon.position.clone(), tilesToBone: 1 / handScale };
  }

  /**
   * Draws it holding a weapon the rules gave it, by id, or with its own hands or weapon for null: the look's model in
   * hand, and its animations for that weapon, blending in from the ones before.
   */
  arm(weapon: string | null): void {
    if (weapon === this.armedWith || !this.model || !this.look.model) return;
    this.armedWith = weapon;
    this.held?.weapon.removeFromParent();
    this.held = null;
    const held = (weapon === null ? undefined : this.look.model.armed?.[weapon]?.weapon) ?? this.look.model.weapon;
    if (held) this.holdWeapon(this.model, held, this.library);
    this.setBase(this.baseName);
  }

  /** Names of the animations currently showing, for tests and debugging. */
  activeAnimations(): string[] {
    return [...this.actions]
      .filter(([, action]) => action.isScheduled() && action.getEffectiveWeight() > 0.01)
      .map(([name]) => name);
  }

  /**
   * How much of the pose comes from animations, from 0 to 1. Below 1 the model sags towards its rest pose, which
   * shows as a glitch.
   */
  poseWeight(): number {
    let total = 0;
    for (const action of this.actions.values()) if (action.isScheduled()) total += action.getEffectiveWeight();
    return total;
  }

  update(frameSeconds: number): void {
    this.mixer?.update(frameSeconds);
    if (this.model) {
      const lean = this.channelling ? this.look.channelPose?.lean ?? 0 : 0;
      this.model.rotation.x += (lean - this.model.rotation.x) * Math.min(1, frameSeconds * LEAN_RATE);
    }
    if (this.held) {
      const { weapon, rest, tilesToBone } = this.held;
      weapon.position.copy(rest);
      if (this.channelling && this.look.channelPose) {
        const buzz = this.look.channelPose.buzz * tilesToBone;
        weapon.position.x += (Math.random() * 2 - 1) * buzz;
        weapon.position.y += (Math.random() * 2 - 1) * buzz;
        weapon.position.z += (Math.random() * 2 - 1) * buzz;
      }
    }
    if (this.hovering) {
      const h = this.hovering;
      h.age += frameSeconds;
      h.model.position.y = (this.look.hover ?? 0) + Math.sin(h.age * BOB_RATE * Math.PI * 2) * BOB_HEIGHT;
    }
  }

  dispose(): void {
    this.mixer?.stopAllAction();
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh && !this.mixer) o.geometry.dispose();
    });
    for (const m of this.materials) m.dispose();
    this.seenThrough?.dispose();
    if (this.hovering) {
      this.hovering.shadow.geometry.dispose();
      this.hovering.shadow.material.dispose();
    }
  }

  private action(name: keyof NonNullable<ActorLook['model']>['animations']): THREE.AnimationAction | undefined {
    const armed = this.armedWith === null ? undefined : this.look.model?.armed?.[this.armedWith]?.animations;
    const clip = armed?.[name] ?? this.look.model?.animations[name];
    return clip ? this.actions.get(clip) : undefined;
  }

  /**
   * Switches the ongoing pose. While a moment is showing, the new pose waits for it to end (see the 'finished'
   * handler) and the old one stops, so no pose is left running underneath. Dying cuts a moment short, and so does
   * moving off during a flinch.
   */
  private setBase(name: BaseName): void {
    this.baseName = name;
    const next = this.action(name) ?? this.action('idle');
    if (!next || next === this.base) return;
    const previous = this.base;
    this.base = next;
    const dying = name === 'death';
    next.setLoop(dying ? THREE.LoopOnce : THREE.LoopRepeat, dying ? 1 : Infinity);
    next.clampWhenFinished = dying;
    const moment = this.moment;
    const cutShort = dying || (name === 'move' && moment !== null && moment === this.action('hit'));
    if (moment && !cutShort) {
      previous?.stop();
      return;
    }
    this.moment = null;
    next.reset().play();
    if (moment) {
      next.crossFadeFrom(moment, BLEND_SECONDS, false);
      previous?.stop();
    } else if (previous) next.crossFadeFrom(previous, BLEND_SECONDS, false);
  }

  /**
   * Gives each of the actor's meshes a twin in the outline material, drawn after everything solid. The actor marks
   * the stencil wherever it shows, and the twin draws only where it doesn't and something nearer hides it.
   */
  private addSeenThrough(): void {
    const material = this.seenThrough;
    if (!material) return;
    const meshes: THREE.Mesh[] = [];
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh && o.material !== this.hovering?.shadow.material) meshes.push(o);
    });
    for (const mesh of meshes) {
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) markStencil(m);
      let twin: THREE.Mesh;
      if (mesh instanceof THREE.SkinnedMesh) {
        const skinned = new THREE.SkinnedMesh(mesh.geometry, material);
        skinned.bind(mesh.skeleton, mesh.bindMatrix);
        twin = skinned;
      } else twin = new THREE.Mesh(mesh.geometry, material);
      twin.position.copy(mesh.position);
      twin.quaternion.copy(mesh.quaternion);
      twin.scale.copy(mesh.scale);
      twin.renderOrder = SEEN_THROUGH_ORDER;
      twin.frustumCulled = false;
      mesh.parent?.add(twin);
    }
  }

  /** Each actor gets its own copy of a material, so flashing or fading one doesn't affect the rest. */
  private ownMaterial(material: THREE.Material, tint: THREE.Color | null): THREE.Material {
    const own = material.clone() as FlashableMaterial & { color?: THREE.Color };
    if (tint && own.color) own.color.multiply(tint);
    // Metallic surfaces only look right with an environment map; under the scene's lamps they turn dark.
    if (own instanceof THREE.MeshStandardMaterial) own.metalness = 0;
    this.keep(own);
    return own;
  }

  /** Adds a material to those that flash and fade, remembering how it looks of its own. */
  private keep(material: FlashableMaterial): void {
    this.materials.push(material);
    this.ownLooks.set(material, {
      opacity: material.opacity,
      transparent: material.transparent,
      emissive: material.emissive ? material.emissive.clone() : null,
    });
  }

  private buildCapsule(): void {
    const { look } = this;
    const material = new THREE.MeshLambertMaterial({ color: look.colour });
    this.keep(material);
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(look.radius, look.height - look.radius * 2, 4, 12), material);
    body.position.y = look.height / 2;
    const nose = new THREE.Mesh(new THREE.ConeGeometry(look.radius * 0.35, look.radius * 0.9, 8).rotateX(Math.PI / 2), material);
    nose.position.set(0, look.height * 0.62, look.radius * 0.95);
    this.root.add(body, nose);
    this.root.traverse((o) => (o.castShadow = true));
  }
}

/** How strongly a hidden actor's outline shows, and when it draws: after everything else that's see-through. */
const SEEN_THROUGH_OPACITY = 0.5;
const SEEN_THROUGH_ORDER = 10;
const STENCIL_SHOWN = 1;

/** Marks the stencil wherever this material's surface is drawn. */
function markStencil(material: THREE.Material): void {
  material.stencilWrite = true;
  material.stencilRef = STENCIL_SHOWN;
  material.stencilFunc = THREE.AlwaysStencilFunc;
  material.stencilZPass = THREE.ReplaceStencilOp;
}

/** Flat colour drawn only behind something nearer, and only where the actor itself didn't show. */
function seenThroughMaterial(colour: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: colour, transparent: true, opacity: SEEN_THROUGH_OPACITY, depthWrite: false, depthFunc: THREE.GreaterDepth,
    stencilWrite: true, stencilRef: STENCIL_SHOWN, stencilFunc: THREE.NotEqualStencilFunc,
    stencilFail: THREE.KeepStencilOp, stencilZFail: THREE.KeepStencilOp, stencilZPass: THREE.KeepStencilOp,
  });
}
