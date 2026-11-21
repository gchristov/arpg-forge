// Rustbelt's people: Quaternius's base characters' heads and hair on his fantasy outfits, with the idle animation.
import { mkdirSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { mergeDocuments, prune, unpartition } from '@gltf-transform/functions';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const C = 'tools/assets/cache';
const BASE = `${C}/ubc/Universal Base Characters[Standard]/Base Characters/Godot - UE`;
const HAIR = `${C}/ubc/Universal Base Characters[Standard]/Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)`;
const OUT = `${C}/outfits/Modular Character Outfits - Fantasy[Standard]/Exports/glTF (Godot-Unreal)/Outfits`;
const HEAD_BONES = /head|neck|eye|jaw|brow|lip|cheek|nose|ear/i;

async function build({ outfit, body, extras, out }) {
  const doc = await io.read(`${OUT}/${outfit}.gltf`);
  const root = doc.getRoot();
  const skin = root.listSkins()[0];
  const jointIndex = new Map(skin.listJoints().map((j, i) => [j.getName(), i]));
  const ownNodes = new Set(root.listNodes());

  // Brings in a skinned file's meshes, bound to the outfit's skeleton; `headOnly` keeps only the head of a full body.
  async function bring(path, headOnly) {
    const src = await io.read(path);
    mergeDocuments(doc, src);
    const added = root.listNodes().filter((n) => !ownNodes.has(n));
    for (const node of added) {
      const mesh = node.getMesh(); const s = node.getSkin();
      if (!mesh || !s) continue;
      const remap = s.listJoints().map((j) => jointIndex.get(j.getName()) ?? 0);
      for (const prim of mesh.listPrimitives()) {
        const joints = prim.getAttribute('JOINTS_0'); const weights = prim.getAttribute('WEIGHTS_0');
        const arr = joints.getArray().slice();
        for (let i = 0; i < arr.length; i++) arr[i] = remap[arr[i]];
        joints.setArray(arr);
        if (headOnly && prim.getMaterial()?.getName().startsWith('MI_Superhero')) {
          const headJoints = new Set(skin.listJoints().flatMap((j, i) => (HEAD_BONES.test(j.getName()) ? [i] : [])));
          const onHead = (v) => { const jj = joints.getElement(v, []); const w = weights.getElement(v, []); return jj.reduce((t, k, n) => t + (headJoints.has(k) ? w[n] : 0), 0) > 0.5; };
          const idx = prim.getIndices().getArray(); const kept = [];
          for (let t = 0; t < idx.length; t += 3) if (onHead(idx[t]) && onHead(idx[t + 1]) && onHead(idx[t + 2])) kept.push(idx[t], idx[t + 1], idx[t + 2]);
          prim.getIndices().setArray(new idx.constructor(kept));
        }
      }
      node.setSkin(skin);
      node.setMatrix([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
      root.listScenes()[0].addChild(node);
    }
    // Drop the brought file's own skeleton and scenes.
    for (const n of added) if (!n.getMesh()) n.dispose();
    for (const sc of root.listScenes().slice(1)) sc.dispose();
    for (const sk of root.listSkins().slice(1)) sk.dispose();
    for (const n of root.listNodes()) ownNodes.add(n);
  }

  await bring(`${BASE}/${body}.gltf`, true);
  for (const e of extras) await bring(`${HAIR}/${e}.gltf`, false);

  const anim = await io.read(`${C}/ual-ue.glb`);
  mergeDocuments(doc, anim);
  const byName = new Map([...ownNodes].map((n) => [n.getName(), n]));
  for (const a of root.listAnimations()) {
    if (a.getName() !== 'Idle_Loop') { a.dispose(); continue; }
    a.setName('Idle');
    for (const ch of a.listChannels()) {
      const target = byName.get(ch.getTargetNode()?.getName());
      if (target && ch.getTargetPath() === 'rotation') ch.setTargetNode(target); else { ch.getSampler()?.dispose(); ch.dispose(); }
    }
  }
  for (const n of root.listNodes()) if (!ownNodes.has(n)) n.dispose();
  for (const sc of root.listScenes().slice(1)) sc.dispose();
  for (const sk of root.listSkins().slice(1)) sk.dispose();
  await doc.transform(prune(), unpartition());
  await io.write(out, doc);
  console.log('wrote', out);
}

const dir = `${C}/people/People`;
mkdirSync(dir, { recursive: true });
await build({ outfit: 'Male_Peasant', body: 'Superhero_Male_FullBody', extras: ['Hair_Beard', 'Hair_Buzzed', 'Eyebrows_Regular'], out: `${dir}/odell.glb` });
await build({ outfit: 'Female_Ranger', body: 'Superhero_Female_FullBody', extras: ['Hair_Long'], out: `${dir}/mags.glb` });
await build({ outfit: 'Female_Peasant', body: 'Superhero_Female_FullBody', extras: ['Hair_Buns'], out: `${dir}/pell.glb` });
