import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { ModelLibrary } from '../../../engine/render/models';

/** Who sits for a portrait: a model from the library, posed in an animation's first frame. */
export interface Sitter {
  model: string;
  pose?: string;
  /** How much of the model's height, from the top, the picture shows. */
  show?: number;
  /** Radians the model turns from facing the camera, for a three-quarter view. */
  turn?: number;
  /** What the game adds to the model as it does in the world, such as U-7's mesh lines and glass glare. */
  dress?: (model: THREE.Object3D, keep: (material: THREE.Material) => void) => void;
}

const DEFAULT_SHOW = 0.45;
const DEFAULT_TURN = 0.45;
const FOV_DEGREES = 24;

/**
 * Draws each sitter's head and shoulders once, as an image URL, for the game's page to show beside what they say.
 * They're drawn on a small canvas of their own, with copies of the models' materials, so nothing in the world's scene
 * is touched; the canvas is let go of afterwards.
 */
export function drawPortraits(models: ModelLibrary, sitters: Record<string, Sitter>, size = 128): Record<string, string> {
  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(size, size, false);
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  // The same plain room to reflect as in the world, so metal looks as it does there.
  const reflections = new THREE.PMREMGenerator(renderer);
  const room = reflections.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = room;
  reflections.dispose();
  scene.add(new THREE.HemisphereLight(0xdfe8f0, 0x2a2420, 2));
  const key = new THREE.DirectionalLight(0xffe6c8, 2.2);
  key.position.set(1.5, 2, 2.5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x6ad8ff, 1.4);
  rim.position.set(-2, 1.5, -1.5);
  scene.add(rim);
  const camera = new THREE.PerspectiveCamera(FOV_DEGREES, 1, 0.05, 100);

  const urls: Record<string, string> = {};
  for (const [name, sitter] of Object.entries(sitters)) {
    const template = models.get(sitter.model);
    const figure = models.instantiate(sitter.model);
    if (!template || !figure) continue;
    posed(figure, template.animations, sitter.pose);
    figure.traverse((o) => {
      if (o instanceof THREE.Mesh) o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone();
    });
    sitter.dress?.(figure, () => {});
    figure.rotation.y = sitter.turn ?? DEFAULT_TURN;
    scene.add(figure);
    figure.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(figure);
    const height = box.max.y - box.min.y;
    const shown = height * (sitter.show ?? DEFAULT_SHOW);
    const centre = new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y - shown / 2, (box.min.z + box.max.z) / 2);
    // A little room round the edges, so hair and hats aren't cut off.
    const distance = (shown * 0.56) / Math.tan(THREE.MathUtils.degToRad(FOV_DEGREES / 2));
    camera.position.set(centre.x, centre.y + shown * 0.08, centre.z + distance);
    camera.lookAt(centre);
    renderer.render(scene, camera);
    urls[name] = canvas.toDataURL('image/png');
    scene.remove(figure);
  }
  room.dispose();
  renderer.dispose();
  renderer.forceContextLoss();
  return urls;
}

function posed(figure: THREE.Object3D, animations: THREE.AnimationClip[], pose: string | undefined): void {
  const clip = animations.find((a) => a.name === pose);
  if (!clip) return;
  const mixer = new THREE.AnimationMixer(figure);
  mixer.clipAction(clip).play();
  mixer.update(0);
}
