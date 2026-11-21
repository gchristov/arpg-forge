import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { Structure } from '../world/level';
import { kitBuilding } from './kit-building';
import type { ModelLibrary, ModelTemplate } from './models';

const LOT: Structure = { kind: 'shed', name: 'Shed', x: 10, y: 20, width: 6, depth: 4, door: { tx: 12, ty: 23 } };

const piece = (width: number, height: number, depth: number, name: string): ModelTemplate => {
  const scene = new THREE.Group();
  const geometry = height > 0 ? new THREE.BoxGeometry(width, height, depth) : new THREE.PlaneGeometry(width, depth).rotateX(-Math.PI / 2);
  scene.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ name })));
  return { scene, animations: [], height: Math.max(0.001, height) };
};

const library = (pieces: Record<string, ModelTemplate>) => ({ get: (name: string) => pieces[name] }) as unknown as ModelLibrary;

/** Every copy of every instanced mesh drawn in `material`, as its scale along each axis. */
function scalesOf(group: THREE.Group, material: string): THREE.Vector3[] {
  const scales: THREE.Vector3[] = [];
  group.traverse((o) => {
    if (!(o instanceof THREE.InstancedMesh) || (o.material as THREE.Material).name !== material) return;
    for (let i = 0; i < o.count; i++) {
      const matrix = new THREE.Matrix4().fromArray(o.instanceMatrix.array, i * 16);
      scales.push(new THREE.Vector3().setFromMatrixScale(matrix));
    }
  });
  return scales;
}

describe('kitBuilding', () => {
  it('lays a flat roof plate at its own size, rather than squashing it to nothing', () => {
    const models = library({
      wall: piece(4, 3, 0.2, 'wall'),
      door: piece(2, 3, 0.2, 'door'),
      roof: piece(4, 0, 4, 'roof'),
    });
    const kit = { span: 2, wall: ['wall'], door: { name: 'door', width: 1, height: 1.5 }, roof: 'roof', inside: 0 };
    const built = kitBuilding(LOT, kit, models)!;
    const roof = scalesOf(built.group, 'roof');
    expect(roof.length).toBeGreaterThan(0);
    for (const scale of roof) expect(Math.min(scale.x, scale.y, scale.z)).toBeGreaterThan(0.01);
  });
});
