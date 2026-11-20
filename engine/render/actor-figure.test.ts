import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ActorFigure } from './actor-figure';
import type { ActorLook } from './look';
import type { ModelLibrary, ModelTemplate } from './models';

/** A model with one bone and short clips, so the real animation mixer can run headless. */
function figure(changes: Partial<ActorLook> = {}): ActorFigure {
  const clip = (name: string, seconds: number) =>
    new THREE.AnimationClip(name, seconds, [new THREE.NumberKeyframeTrack('bone.position[x]', [0, seconds], [0, 1])]);
  const scene = new THREE.Group();
  const bone = new THREE.Object3D();
  bone.name = 'bone';
  scene.add(bone);
  const template: ModelTemplate = {
    scene,
    animations: [clip('Idle', 1), clip('Run', 0.8), clip('Attack', 0.5), clip('Cut', 0.7), clip('Hit', 0.6), clip('Death', 1)],
    height: 1,
  };
  const library = { get: () => template, instantiate: () => scene.clone() } as unknown as ModelLibrary;
  const look: ActorLook = {
    colour: 0, height: 1, radius: 0.3,
    model: { name: 'm', animations: { idle: 'Idle', move: 'Run', attack: 'Attack', channel: 'Cut', hit: 'Hit', death: 'Death' } },
    ...changes,
  };
  return new ActorFigure(look, library);
}

/** Advances the animations, checking at every frame that the model never sags towards its rest pose. */
function run(f: ActorFigure, seconds: number): void {
  for (let t = 0; t < seconds; t += 1 / 60) {
    f.update(1 / 60);
    expect(f.poseWeight()).toBeGreaterThan(0.95);
  }
}

describe('ActorFigure animation', () => {
  it('settles on idle when the actor stops moving during an attack', () => {
    const f = figure();
    f.pose(true, false);
    run(f, 0.3);
    f.play('attack', 0.5);
    run(f, 0.1);
    f.pose(false, false);
    run(f, 1);
    expect(f.activeAnimations()).toEqual(['Idle']);
  });

  it('settles on moving when the actor starts moving during an attack', () => {
    const f = figure();
    f.play('attack', 0.5);
    run(f, 0.1);
    f.pose(true, false);
    run(f, 1);
    expect(f.activeAnimations()).toEqual(['Run']);
  });

  it('keeps blending back and forth without leaving earlier poses running', () => {
    const f = figure();
    for (let i = 0; i < 4; i++) {
      f.pose(true, false);
      run(f, 0.2);
      f.play('attack', 0.5);
      run(f, 0.1);
      f.pose(false, false);
      run(f, 0.1);
      f.pose(true, false);
      run(f, 0.1);
    }
    f.pose(false, false);
    run(f, 1);
    expect(f.activeAnimations()).toEqual(['Idle']);
  });

  it('never sags to the rest pose while blending out of an attack', () => {
    const f = figure();
    run(f, 0.3);
    f.play('attack', 0.5);
    let lowest = Infinity;
    for (let t = 0; t < 1.2; t += 1 / 60) {
      f.update(1 / 60);
      lowest = Math.min(lowest, f.poseWeight());
    }
    expect(lowest).toBeGreaterThan(0.95);
    expect(f.activeAnimations()).toEqual(['Idle']);
  });

  it('keeps running when hit on the move, so it never slides along in a flinch', () => {
    const f = figure();
    f.pose(true, false);
    run(f, 0.3);
    f.play('hit');
    run(f, 0.1);
    expect(f.activeAnimations()).toEqual(['Run']);
  });

  it('cuts a flinch short to run when the actor starts moving', () => {
    const f = figure();
    f.play('hit');
    run(f, 0.1);
    f.pose(true, false);
    run(f, 0.3);
    expect(f.activeAnimations()).toEqual(['Run']);
  });

  it('dies cleanly in the middle of an attack', () => {
    const f = figure();
    f.pose(true, false);
    run(f, 0.2);
    f.play('attack', 0.5);
    run(f, 0.1);
    f.pose(true, true);
    run(f, 1.5);
    expect(f.activeAnimations()).toEqual(['Death']);
  });
});

describe('ActorFigure hovering', () => {
  const parts = (f: ActorFigure) => {
    const isShadow = (o: THREE.Object3D) => o instanceof THREE.Mesh && o.geometry instanceof THREE.CircleGeometry;
    const shadow = f.root.children.find(isShadow) as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
    const model = f.root.children.find((o) => !isShadow(o))!;
    return { model, shadow };
  };

  it('floats its model, bobbing around its height, over a shadow on the ground', () => {
    const f = figure({ hover: 0.8 });
    const { model, shadow } = parts(f);
    const heights: number[] = [];
    for (let t = 0; t < 3; t += 1 / 60) {
      f.update(1 / 60);
      heights.push(model.position.y);
    }
    expect(Math.min(...heights)).toBeGreaterThan(0.7);
    expect(Math.max(...heights)).toBeLessThan(0.9);
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(0.1);
    expect(shadow.position.y).toBeLessThan(0.05);
  });

  it('fades its shadow as it fades out', () => {
    const f = figure({ hover: 0.8 });
    f.setLookOf(0, 0.5);
    expect(parts(f).shadow.material.opacity).toBeCloseTo(0.225);
  });

  it('keeps grounded actors on the ground, without a shadow of their own', () => {
    const f = figure();
    f.update(0.5);
    expect(f.root.children).toHaveLength(1);
    expect(f.root.children[0]!.position.y).toBe(0);
  });
});

describe('ActorFigure walking pace', () => {
  it('plays its move animation faster or slower to match how fast it moves', () => {
    const scene = new THREE.Group();
    const foot = new THREE.Bone();
    foot.name = 'foot';
    scene.add(foot);
    const walk = new THREE.AnimationClip('Walk', 1, [new THREE.VectorKeyframeTrack('foot.position', [0, 1], [0, 0, 0.5, 0, 0, -0.5])]);
    const template: ModelTemplate = { scene, animations: [new THREE.AnimationClip('Idle', 1, []), walk], height: 1 };
    const library = { get: () => template, instantiate: () => scene.clone() } as unknown as ModelLibrary;
    const f = new ActorFigure({ colour: 0, height: 1, radius: 0.3, model: { name: 'm', animations: { idle: 'Idle', move: 'Walk' }, matchPace: true } }, library);
    const moveRate = () => (f as unknown as { actions: Map<string, THREE.AnimationAction> }).actions.get('Walk')!.timeScale;
    f.pose(true, false, 2);
    expect(moveRate()).toBeCloseTo(2);
    f.pose(true, false, 0.5);
    expect(moveRate()).toBeCloseTo(0.5);
    f.pose(true, false, 50);
    expect(moveRate()).toBe(5);
  });

  it('leaves the move animation at its own pace unless the look asks to match it', () => {
    const f = figure();
    f.pose(true, false, 4);
    expect((f as unknown as { actions: Map<string, THREE.AnimationAction> }).actions.get('Run')!.timeScale).toBe(1);
  });
});

describe('ActorFigure seen through', () => {
  /** A figure of one box, so there's a mesh to outline. */
  function boxFigure(seenThrough?: number): ActorFigure {
    const scene = new THREE.Group();
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshLambertMaterial()));
    const template: ModelTemplate = { scene, animations: [new THREE.AnimationClip('Idle', 1, [])], height: 1 };
    const library = { get: () => template, instantiate: () => scene.clone() } as unknown as ModelLibrary;
    const look: ActorLook = {
      colour: 0, height: 1, radius: 0.3, model: { name: 'm', animations: { idle: 'Idle' } },
      ...(seenThrough === undefined ? {} : { seenThrough }),
    };
    return new ActorFigure(look, library);
  }
  const meshesOf = (f: ActorFigure) => {
    const meshes: THREE.Mesh[] = [];
    f.root.traverse((o) => o instanceof THREE.Mesh && meshes.push(o));
    return meshes;
  };

  it('gives an outlined actor a twin drawn only behind what hides it, where the actor itself marked nothing', () => {
    const f = boxFigure(0x88ccff);
    const [body, twin] = meshesOf(f);
    expect(body!.geometry).toBe(twin!.geometry);
    const outline = twin!.material as THREE.MeshBasicMaterial;
    expect(outline.depthFunc).toBe(THREE.GreaterDepth);
    expect(outline.stencilFunc).toBe(THREE.NotEqualStencilFunc);
    expect((body!.material as THREE.Material).stencilZPass).toBe(THREE.ReplaceStencilOp);
    expect(twin!.renderOrder).toBeGreaterThan(body!.renderOrder);
  });

  it('fades the outline out with the actor', () => {
    const f = boxFigure(0x88ccff);
    const outline = meshesOf(f)[1]!.material as THREE.MeshBasicMaterial;
    const shown = outline.opacity;
    f.setLookOf(0, 0.5);
    expect(outline.opacity).toBeCloseTo(shown / 2);
  });

  it('leaves actors without an outline as they are', () => {
    expect(meshesOf(boxFigure())).toHaveLength(1);
  });
});

describe('ActorFigure channelling', () => {
  it('loops the channel animation while the actor keeps up a continuous attack, through hits, and walks when it moves off', () => {
    const f = figure();
    f.pose(false, false, undefined, true);
    run(f, 1.5);
    expect(f.activeAnimations()).toContain('Cut');
    f.play('hit');
    run(f, 0.3);
    expect(f.activeAnimations()).toEqual(['Cut']);
    f.pose(true, false, undefined, true);
    run(f, 0.5);
    expect(f.activeAnimations()).toEqual(['Run']);
    f.pose(false, false);
    run(f, 0.5);
    expect(f.activeAnimations()).toEqual(['Idle']);
  });
});

describe('ActorFigure armed', () => {
  it('swaps to a weapon\'s own animations when armed with it, and back when disarmed', () => {
    const f = figure({
      colour: 0, height: 1, radius: 0.3,
      model: {
        name: 'm', animations: { idle: 'Idle', move: 'Run', attack: 'Attack', hit: 'Hit', death: 'Death' },
        armed: { saw: { animations: { idle: 'Cut' } } },
      },
    });
    f.pose(false, false);
    run(f, 0.5);
    expect(f.activeAnimations()).toEqual(['Idle']);
    f.arm('saw');
    run(f, 0.5);
    expect(f.activeAnimations()).toEqual(['Cut']);
    f.arm(null);
    run(f, 0.5);
    expect(f.activeAnimations()).toEqual(['Idle']);
  });
});

describe('ActorFigure weapon', () => {
  it('fits a weapon made for another hand into the named bone, sized in tiles whatever the bones\' scale', () => {
    // An actor model twice its height in its own units, with a hand bone scaled up a hundredfold, as converted models are.
    const scene = new THREE.Group();
    const hand = new THREE.Object3D();
    hand.name = 'FistR';
    hand.scale.setScalar(100);
    scene.add(hand, new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1).translate(0, 1, 0)));
    const actor: ModelTemplate = { scene, animations: [new THREE.AnimationClip('Idle', 1, [])], height: 2 };
    const saw = new THREE.Group().add(new THREE.Mesh(new THREE.BoxGeometry(4, 1, 1)));
    const weapon: ModelTemplate = { scene: saw, animations: [], height: 1 };
    const library = {
      get: (name: string) => (name === 'saw' ? weapon : actor),
      instantiate: (name: string) => (name === 'saw' ? saw.clone() : scene.clone()),
    } as unknown as ModelLibrary;
    const f = new ActorFigure({
      colour: 0, height: 1, radius: 0.3,
      model: { name: 'actor', animations: { idle: 'Idle' }, weapon: { name: 'saw', bone: 'Fist.R', length: 0.6, turn: [0, Math.PI, 0] } },
    }, library);
    f.root.updateMatrixWorld(true);
    const held = f.root.getObjectByName('FistR')!.children[0]!;
    const size = new THREE.Box3().setFromObject(held).getSize(new THREE.Vector3());
    expect(size.x).toBeCloseTo(0.6);
  });
});

describe('ActorFigure parts with looks of their own', () => {
  /** A figure of one box in `material`, dressed by the game if `dress` is given. */
  function partFigure(material: THREE.Material, dress?: NonNullable<ActorLook['model']>['dress']): ActorFigure {
    const scene = new THREE.Group();
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(), material));
    const template: ModelTemplate = { scene, animations: [new THREE.AnimationClip('Idle', 1, [])], height: 1 };
    const library = { get: () => template, instantiate: () => scene.clone() } as unknown as ModelLibrary;
    const look: ActorLook = {
      colour: 0, height: 1, radius: 0.3, model: { name: 'm', animations: { idle: 'Idle' }, ...(dress ? { dress } : {}) },
    };
    return new ActorFigure(look, library);
  }
  const meshesOf = (f: ActorFigure) => {
    const meshes: THREE.Mesh[] = [];
    f.root.traverse((o) => o instanceof THREE.Mesh && meshes.push(o));
    return meshes;
  };

  it('keeps a see-through part see-through, and fades it from there', () => {
    const f = partFigure(new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.3 }));
    const shell = meshesOf(f)[0]!.material as THREE.MeshStandardMaterial;
    f.setLookOf(0, 1);
    expect(shell.opacity).toBeCloseTo(0.3);
    expect(shell.transparent).toBe(true);
    f.setLookOf(0, 0.5);
    expect(shell.opacity).toBeCloseTo(0.15);
  });

  it('keeps a glowing part glowing, lighting it further when hit and settling back after', () => {
    const f = partFigure(new THREE.MeshStandardMaterial({ emissive: 0x804020 }));
    const core = meshesOf(f)[0]!.material as THREE.MeshStandardMaterial;
    const glow = core.emissive.clone();
    f.setLookOf(0, 1);
    expect(core.emissive.equals(glow)).toBe(true);
    f.setLookOf(1, 1);
    expect(core.emissive.r).toBeGreaterThan(glow.r);
    f.setLookOf(0, 1);
    expect(core.emissive.equals(glow)).toBe(true);
  });

  it("flashes and fades the game's own pieces with the actor", () => {
    const piece = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.4 });
    const f = partFigure(new THREE.MeshStandardMaterial(), (model, keep) => {
      keep(piece);
      model.add(new THREE.Mesh(new THREE.BoxGeometry(), piece));
    });
    expect(meshesOf(f)).toHaveLength(2);
    f.setLookOf(0, 0.5);
    expect(piece.opacity).toBeCloseTo(0.2);
  });
});
