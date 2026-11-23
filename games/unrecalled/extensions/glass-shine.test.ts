import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { edgeShader, glassShine } from './glass-shine';

describe('glassShine', () => {
  const modelIn = (materialName: string) => {
    const material = new THREE.MeshStandardMaterial();
    material.name = materialName;
    const model = new THREE.Group();
    model.add(new THREE.Mesh(new THREE.BoxGeometry(), material));
    return model;
  };
  const meshesOf = (model: THREE.Object3D) => {
    const meshes: THREE.Mesh[] = [];
    model.traverse((o) => o instanceof THREE.Mesh && meshes.push(o));
    return meshes;
  };

  it('adds a smooth mirror over the glass, sharing its shape and leaving it showing', () => {
    const model = modelIn('Skin');
    const kept: THREE.Material[] = [];
    glassShine({ material: 'Skin', strength: 0.6, sharpness: 3 })(model, (m) => kept.push(m));
    const [glass, shine] = meshesOf(model);
    expect(shine!.geometry).toBe(glass!.geometry);
    const mirror = shine!.material as THREE.MeshStandardMaterial;
    expect(mirror.metalness).toBe(1);
    expect(mirror.roughness).toBeLessThan(0.1);
    expect(mirror.blending).toBe(THREE.AdditiveBlending);
    expect(kept).toEqual([mirror]);
    expect(glass!.visible).toBe(true);
  });

  it('adds nothing when no part is glass', () => {
    const model = modelIn('Shell');
    const kept: THREE.Material[] = [];
    glassShine({ material: 'Skin', strength: 0.6, sharpness: 3 })(model, (m) => kept.push(m));
    expect(meshesOf(model)).toHaveLength(1);
    expect(kept).toHaveLength(0);
  });

  it('keeps the mirror to the edges, where the surface turns away from the camera', () => {
    const shader = { fragmentShader: 'void main() {\n#include <dithering_fragment>\n}' };
    edgeShader(3)(shader);
    expect(shader.fragmentShader).toContain('pow(1.0 - facing, 3.0)');
    expect(shader.fragmentShader.indexOf('#include <dithering_fragment>')).toBeLessThan(shader.fragmentShader.indexOf('facing'));
  });
});
