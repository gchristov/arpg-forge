import * as THREE from 'three';

const SAMPLES = 48;
/** Bones that travel less than this share of the furthest-travelling bone's distance are not feet. */
const FOOT_TRAVEL_SHARE = 0.25;

/**
 * How fast a walk or run animation carries its model over the ground, in the model's parent's units a second: the
 * speed at which the foot on the ground slides backwards. Plays the clip through once on `model` (already scaled)
 * and follows whichever moving bone is lowest, which is the planted foot; bones that barely move, such as a root
 * bone resting on the ground, are left out. Null for clips that never plant a foot, such as a hover. Leaves the
 * model in its clip's last pose; the actor's own animation takes over from there.
 */
export function walkPace(model: THREE.Object3D, clip: THREE.AnimationClip): number | null {
  const bones: THREE.Bone[] = [];
  model.traverse((o) => o instanceof THREE.Bone && bones.push(o));
  if (!bones.length || clip.duration <= 0) return null;
  const tracks = sampleBones(model, bones, clip);
  const travel = tracks.map((track) => track.slice(1).reduce((sum, p, i) => sum + horizontal(p, track[i]!), 0));
  const furthest = Math.max(...travel);
  if (furthest < 1e-4) return null;
  const feet = bones.map((_, b) => b).filter((b) => travel[b]! >= furthest * FOOT_TRAVEL_SHARE);
  let distance = 0;
  let samples = 0;
  let previous = -1;
  for (let i = 0; i < SAMPLES; i++) {
    const lowest = feet.reduce((best, b) => (tracks[b]![i]!.y < tracks[best]![i]!.y ? b : best));
    if (lowest === previous) {
      distance += horizontal(tracks[lowest]![i]!, tracks[lowest]![i - 1]!);
      samples++;
    }
    previous = lowest;
  }
  return samples > 0 && distance > 1e-4 ? distance / (samples * (clip.duration / SAMPLES)) : null;
}

const horizontal = (a: THREE.Vector3, b: THREE.Vector3) => Math.hypot(a.x - b.x, a.z - b.z);

/**
 * Each bone's position, in the model's parent's space, at evenly spaced times through the clip: up to its end but
 * not onto it, since a looping clip's end is its start again and the foot's jump back would count as a step.
 */
function sampleBones(model: THREE.Object3D, bones: THREE.Bone[], clip: THREE.AnimationClip): THREE.Vector3[][] {
  const mixer = new THREE.AnimationMixer(model);
  mixer.clipAction(clip).play();
  const tracks = bones.map(() => [] as THREE.Vector3[]);
  for (let i = 0; i < SAMPLES; i++) {
    mixer.setTime((i * clip.duration) / SAMPLES);
    model.updateMatrixWorld(true);
    bones.forEach((bone, b) => {
      const at = bone.getWorldPosition(new THREE.Vector3());
      tracks[b]!.push(model.parent ? model.parent.worldToLocal(at) : at);
    });
  }
  mixer.stopAllAction();
  mixer.uncacheRoot(model);
  return tracks;
}
