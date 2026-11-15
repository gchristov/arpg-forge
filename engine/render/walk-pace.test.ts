import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { walkPace } from './walk-pace';

/** A hip above a foot; the clip slides the planted foot backwards by `stride` over a second, as a walk does. */
function walker(stride: number, scale = 1) {
  const parent = new THREE.Group();
  const model = new THREE.Group();
  model.scale.setScalar(scale);
  parent.add(model);
  const hip = new THREE.Bone();
  hip.name = 'hip';
  hip.position.y = 1;
  const foot = new THREE.Bone();
  foot.name = 'foot';
  model.add(hip, foot);
  const clip = new THREE.AnimationClip('Walk', 1, [
    new THREE.VectorKeyframeTrack('foot.position', [0, 1], [0, 0, stride / 2, 0, 0, -stride / 2]),
  ]);
  return { model, clip };
}

describe('walkPace', () => {
  it('measures how fast the planted foot slides back', () => {
    const { model, clip } = walker(1.2);
    expect(walkPace(model, clip)).toBeCloseTo(1.2);
  });

  it('measures in the units the model is drawn at', () => {
    const { model, clip } = walker(1.2, 2);
    expect(walkPace(model, clip)).toBeCloseTo(2.4);
  });

  it('follows the foot rather than a still bone lower down, such as a root resting on the ground', () => {
    const { model, clip } = walker(1.2);
    const root = new THREE.Bone();
    root.position.y = -0.1;
    model.add(root);
    expect(walkPace(model, clip)).toBeCloseTo(1.2);
  });

  it('gives nothing for a clip that never moves a foot over the ground', () => {
    const { model, clip } = walker(0);
    expect(walkPace(model, clip)).toBeNull();
  });
});
