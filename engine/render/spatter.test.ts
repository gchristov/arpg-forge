import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Spatter } from './spatter';

/** How many droplets are in the air and splats on the ground. */
function counts(scene: THREE.Scene): [number, number] {
  const [droplets, splats] = scene.children as THREE.InstancedMesh[];
  return [droplets!.count, splats!.count];
}

function play(spatter: Spatter, seconds: number): void {
  for (let t = 0; t < seconds; t += 1 / 60) spatter.update(1 / 60);
}

describe('Spatter', () => {
  it('throws droplets that fall, splat where they land, some scattering tiny drops ahead, and dry away', () => {
    const scene = new THREE.Scene();
    const spatter = new Spatter(scene, () => {});
    spatter.spray(5, 5, 0.5, 1, 0, 0x111111, 10);
    spatter.update(1 / 60);
    expect(counts(scene)).toEqual([10, 0]);
    play(spatter, 2);
    expect(counts(scene)[0]).toBe(0);
    expect(counts(scene)[1]).toBeGreaterThanOrEqual(10);
    play(spatter, 40);
    expect(counts(scene)).toEqual([0, 0]);
  });

  it('leaves a puddle of several blobs where it\'s put', () => {
    const scene = new THREE.Scene();
    const spatter = new Spatter(scene, () => {});
    spatter.puddle(5, 5, 0.6, 0x111111);
    spatter.update(1 / 60);
    expect(counts(scene)[1]).toBeGreaterThanOrEqual(4);
  });

  it('loses droplets that come down where liquid can\'t lie, such as on a wall', () => {
    const scene = new THREE.Scene();
    const spatter = new Spatter(scene, () => {});
    spatter.clear((tx) => tx < 5);
    spatter.spray(4.9, 5, 0.5, 1, 0, 0x111111, 10, 0);
    play(spatter, 2);
    expect(counts(scene)).toEqual([0, 0]);
  });

  it('lays its splats under every other see-through effect, taking the light that falls on them', () => {
    const scene = new THREE.Scene();
    const lit: THREE.Material[] = [];
    new Spatter(scene, (m) => lit.push(m));
    const splats = (scene.children as THREE.InstancedMesh[])[1]!;
    expect(splats.renderOrder).toBeLessThan(0);
    expect(lit).toEqual([splats.material]);
  });
});
