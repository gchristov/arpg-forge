import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ActorFigure } from './actor-figure';
import type { ActorLook } from './look';
import type { ModelLibrary, ModelTemplate } from './models';

/** A model with one bone and short clips, so the real animation mixer can run headless. */
function figure(): ActorFigure {
  const clip = (name: string, seconds: number) =>
    new THREE.AnimationClip(name, seconds, [new THREE.NumberKeyframeTrack('bone.position[x]', [0, seconds], [0, 1])]);
  const scene = new THREE.Group();
  const bone = new THREE.Object3D();
  bone.name = 'bone';
  scene.add(bone);
  const template: ModelTemplate = {
    scene,
    animations: [clip('Idle', 1), clip('Run', 0.8), clip('Attack', 0.5), clip('Death', 1)],
    height: 1,
  };
  const library = { get: () => template, instantiate: () => scene.clone() } as unknown as ModelLibrary;
  const look: ActorLook = {
    colour: 0, height: 1, radius: 0.3,
    model: { name: 'm', animations: { idle: 'Idle', move: 'Run', attack: 'Attack', death: 'Death' } },
  };
  return new ActorFigure(look, library);
}

function run(f: ActorFigure, seconds: number): void {
  for (let t = 0; t < seconds; t += 1 / 60) f.update(1 / 60);
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
