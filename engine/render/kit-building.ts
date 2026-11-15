import * as THREE from 'three';
import { hash2 } from '../core/math';
import type { LevelLight, Structure } from '../world/level';
import { buildingLayout, buildingParts, type WallSlot } from './building-layout';
import type { BuildingKit } from './look';
import { fitMatrix, instancedModel, modelSize, panelFit, panelScale } from './model-instancing';
import type { ModelLibrary, ModelTemplate } from './models';

/** How far inside its walls a building's lit inside starts, in tiles. */
const INSIDE_INSET = 0.3;

/** How far in from a roof's edge its railing stands, in tiles. */
const RAIL_INSET = 0.12;

/** How far out from a lit window its light falls, and how strong it is. */
const WINDOW_LIGHT = { out: 0.6, radius: 1.3, intensity: 0.45 };

/**
 * A building put together from a kit's pieces on its lot, as `buildingLayout` lays it out, with the light its windows
 * cast, or null while the kit's wall pieces aren't loaded. The group stands at the world's origin.
 */
export function kitBuilding(
  s: Structure, kit: BuildingKit, models: ModelLibrary,
): { group: THREE.Group; lights: LevelLight[] } | null {
  const wall = models.get(kit.wall[0]!);
  if (!wall) return null;
  const group = new THREE.Group();
  const add = (meshes: THREE.Object3D[]) => {
    for (const m of meshes) group.add(m);
  };
  const k = panelScale(wall, kit.span);
  const storeyHeight = modelSize(wall).y * k;
  const top = kit.top ? models.get(kit.top) : undefined;
  const bandHeight = top ? modelSize(top).y * k : 0;
  /** How tall a block of `floors` storeys stands, band and all. */
  const blockHeight = (floors: number) => floors * storeyHeight + bandHeight;
  const layout = buildingLayout(s, kit.span, kit.roofProps?.length ?? 0);

  const placed = new Map<ModelTemplate, THREE.Matrix4[]>();
  const place = (template: ModelTemplate | undefined, matrix: THREE.Matrix4) => {
    if (!template) return;
    let list = placed.get(template);
    if (!list) placed.set(template, (list = []));
    list.push(matrix);
  };
  const windowPiece = kit.window ? models.get(kit.window) : undefined;
  for (const slot of layout.walls) {
    if (slot.part === 'door') continue;
    const variant = Math.floor(hash2(slot.x * 2, slot.y * 2 + slot.storey * 31, 7) * kit.wall.length);
    const piece = slot.part === 'window' && windowPiece ? windowPiece : models.get(kit.wall[variant]!) ?? wall;
    place(piece, along(slot, slot.storey * storeyHeight, kit.span).multiply(panelFit(piece, kit.span)));
  }
  if (top) {
    for (const slot of layout.bands) place(top, along(slot, (slot.storey + 1) * storeyHeight, kit.span).multiply(panelFit(top, kit.span)));
  }
  const rail = kit.rail ? models.get(kit.rail) : undefined;
  if (rail) {
    // Set in from the roof's edge, so the railing stands on the roof rather than on the band.
    for (const slot of layout.rails) {
      const inset = new THREE.Matrix4().makeTranslation(-slot.facing.x * RAIL_INSET, 0, -slot.facing.y * RAIL_INSET);
      place(rail, inset.multiply(along(slot, blockHeight(slot.storey), kit.span)).multiply(panelFit(rail, kit.span)));
    }
  }
  const paint = kit.tint === undefined ? null : new THREE.Color(kit.tint);
  const painted = (meshes: THREE.InstancedMesh[]) => {
    if (paint) for (const mesh of meshes) tintMaterials(mesh, paint);
    return meshes;
  };
  for (const [template, matrices] of placed) {
    const meshes = painted(instancedModel(template, new THREE.Matrix4(), matrices));
    if (kit.glass && template === windowPiece) for (const mesh of meshes) lightGlass(mesh, kit.glass.material, kit.glass.colour);
    add(meshes);
  }

  const door = models.get(kit.door.name);
  const doorSlot = layout.walls.find((slot) => slot.part === 'door');
  if (door && doorSlot) {
    const size = modelSize(door);
    const depth = size.z * (kit.door.width / size.x);
    const fit = fitMatrix(door, { type: 'box', width: kit.door.width, height: kit.door.height, depth });
    add(painted(instancedModel(door, fit, [new THREE.Matrix4()
      .makeTranslation(doorSlot.x, 0, doorSlot.y)
      .multiply(new THREE.Matrix4().makeRotationY(Math.atan2(doorSlot.facing.x, doorSlot.facing.y)))])));
  }

  const corner = kit.corner ? models.get(kit.corner) : undefined;
  if (corner) {
    const size = modelSize(corner);
    for (const top of [false, true]) {
      const columns = layout.corners.filter((c) => c.top === top);
      if (!columns.length) continue;
      const fit = fitMatrix(corner, { type: 'box', width: size.x * k, height: storeyHeight + (top ? bandHeight : 0), depth: size.z * k });
      add(painted(instancedModel(corner, fit, columns.map((c) => new THREE.Matrix4().makeTranslation(c.x, c.storey * storeyHeight, c.y)))));
    }
  }

  const roof = models.get(kit.roof);
  if (roof) {
    const size = modelSize(roof);
    const fit = fitMatrix(roof, { type: 'box', width: kit.span, height: size.y * k, depth: kit.span });
    add(instancedModel(roof, fit, layout.roof.map((p) => new THREE.Matrix4()
      .makeTranslation(p.x, blockHeight(p.floors), p.y)
      .multiply(new THREE.Matrix4().makeScale(p.width / kit.span, 1, p.depth / kit.span)))));
  }
  (kit.roofProps ?? []).forEach((prop, variant) => {
    const template = models.get(typeof prop === 'string' ? prop : prop.name);
    const spots = layout.roofProps.filter((p) => p.variant === variant);
    if (!template || !spots.length) return;
    const fit = typeof prop === 'string' ? new THREE.Matrix4().makeScale(k, k, k) : fitMatrix(template, { type: 'width', width: prop.width });
    add(instancedModel(template, fit, spots.map((p) => new THREE.Matrix4()
      .makeTranslation(p.x, blockHeight(p.floors), p.y)
      .multiply(new THREE.Matrix4().makeRotationY(Math.floor(hash2(p.x * 2, p.y * 2, 9) * 4) * (Math.PI / 2))))));
  });

  // The lit inside fills each block, so the doorway shows light rather than the empty shell.
  const insideMaterial = new THREE.MeshBasicMaterial({ color: kit.inside });
  for (const p of buildingParts(s)) {
    const height = blockHeight(p.floors) - 0.05;
    const inside = new THREE.Mesh(new THREE.BoxGeometry(p.width - INSIDE_INSET * 2, height, p.depth - INSIDE_INSET * 2), insideMaterial);
    inside.position.set(p.x + p.width / 2, height / 2, p.y + p.depth / 2);
    group.add(inside);
  }

  if (kit.sign !== undefined && doorSlot) {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.26, 0.05), new THREE.MeshBasicMaterial({ color: kit.sign }));
    sign.position.set(doorSlot.x + doorSlot.facing.x * 0.06, kit.door.height + 0.2, doorSlot.y + doorSlot.facing.y * 0.06);
    sign.rotation.y = Math.atan2(doorSlot.facing.x, doorSlot.facing.y);
    group.add(sign);
  }
  const lights: LevelLight[] = kit.glass && windowPiece
    ? layout.walls.filter((slot) => slot.part === 'window' && slot.storey === 0).map((slot, i) => ({
      x: slot.x + slot.facing.x * WINDOW_LIGHT.out, y: slot.y + slot.facing.y * WINDOW_LIGHT.out,
      radius: WINDOW_LIGHT.radius, intensity: WINDOW_LIGHT.intensity, colour: kit.glass!.light, flicker: 0.3, seed: i * 7 + s.x,
    }))
    : [];
  return { group, lights };
}

/** Gives a mesh its own copies of its materials, multiplied by `paint`. */
function tintMaterials(mesh: THREE.InstancedMesh, paint: THREE.Color): void {
  const tint = (m: THREE.Material) => {
    const own = m.clone() as THREE.Material & { color?: THREE.Color };
    own.color?.multiply(paint);
    own.userData.ownCopy = true;
    return own;
  };
  mesh.material = Array.isArray(mesh.material) ? mesh.material.map(tint) : tint(mesh.material);
}

/** Swaps a mesh's glass for a glowing copy, lit from inside whatever light falls on it. */
function lightGlass(mesh: THREE.InstancedMesh, name: string, colour: number): void {
  const swap = (m: THREE.Material) => {
    if (m.name !== name) return m;
    const lit = new THREE.MeshBasicMaterial({ color: colour });
    lit.userData.ownCopy = true;
    return lit;
  };
  mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swap) : swap(mesh.material);
}

/** Stands a piece lying along z, facing +x and `span` tiles long, on a wall slot `height` tiles up, fitted to it. */
function along(slot: WallSlot, height: number, span: number): THREE.Matrix4 {
  return new THREE.Matrix4()
    .makeTranslation(slot.x, height, slot.y)
    .multiply(new THREE.Matrix4().makeRotationY(Math.atan2(-slot.facing.y, slot.facing.x)))
    .multiply(new THREE.Matrix4().makeScale(1, 1, slot.length / span));
}
