import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { coreGlow, FADE_SECONDS, glowAfter } from './core-glow';

describe('glowAfter', () => {
  it('fades out over the fade time once its wearer is dead, and stays out', () => {
    expect(glowAfter(1, true, FADE_SECONDS / 2)).toBeCloseTo(0.5);
    expect(glowAfter(0.5, true, FADE_SECONDS)).toBe(0);
  });

  it('comes back to full when its wearer gets up, and no brighter', () => {
    expect(glowAfter(0, false, FADE_SECONDS / 4)).toBeCloseTo(0.25);
    expect(glowAfter(0.9, false, 1)).toBe(1);
  });
});

describe('coreGlow', () => {
  const modelWithCore = () => {
    const material = new THREE.MeshStandardMaterial();
    material.name = 'Core';
    const model = new THREE.Group();
    model.add(new THREE.Mesh(new THREE.BoxGeometry(), material));
    return model;
  };

  it('dims the glow it added while its wearer is dead, and says how bright it is', () => {
    const glow = coreGlow({ materials: ['Core'], colour: 0xffffff, strength: 1 });
    const kept: THREE.Material[] = [];
    glow.dress(modelWithCore(), (m) => kept.push(m));
    const [material] = kept as THREE.MeshBasicMaterial[];
    expect(glow.draw(true, FADE_SECONDS / 2)).toBeCloseTo(0.5);
    expect(material!.color.r).toBeCloseTo(0.5);
  });

  it('forgets a glow once it is disposed, leaving it as it was', () => {
    const glow = coreGlow({ materials: ['Core'], colour: 0xffffff, strength: 1 });
    const kept: THREE.Material[] = [];
    glow.dress(modelWithCore(), (m) => kept.push(m));
    const [material] = kept as THREE.MeshBasicMaterial[];
    material!.dispose();
    glow.draw(true, FADE_SECONDS);
    expect(material!.color.r).toBe(1);
  });
});
