// Builds a game's 3D models from asset packs: downloads each source model from a pinned commit, keeps only the
// parts and animations the game uses, compresses it, and writes a .glb next to the manifest.
//
// Usage: ./tools/assets/build-models.sh <manifest.json>, which runs this in the Node image after converting any FBX
// models with the Blender image. `--list-fbx` only fetches the packs and prints each FBX model's local path, textures folder, borrow spec and decimate ratio, separated by |.
//
// A pack is either a folder URL at a pinned commit, or `{ "zip": url, "sha256": hash }` for packs only published as
// zip files; a zip whose checksum doesn't match is refused. A zip pack's `textures` names the folder inside it that
// holds images its .gltf files expect beside them. A model's `textures` option shrinks its textures to
// `maxSize` pixels and can drop its normal and occlusion-roughness-metal maps, for packs made for close-up games.
// An FBX model's `decimate` keeps about that share of its triangles (the converter does it in Blender).
// `textures.recolour` multiplies their `brightness` and `saturation` and turns their `hue` (degrees), to weather a clean
// pack into a game's palette.
// An FBX model's `borrow` adds animations its pack lacks, retargeted from another pack's rig by the converter: `path`
// in `pack` is the source glTF, `animations` maps new names to the source's, `pose` is the source animation that
// matches the model's rest pose, and `bones` maps the model's bones to the source's (see tools/blender/retarget.py).
//
// A model's `keepMeshes` keeps only the meshes of the named nodes, and `keepMaterials` only the parts drawn in the
// named materials.
//
// A character's parts can be changed by material (tools/assets/model-parts.mjs): `split` moves part of one material
// into a copy of it, such as a faceplate off a body, and `paint` repaints parts, making them see-through or glow.
// `frame` (with its `wires`), `core` and `brain` build a machine's insides along its skeleton
// (tools/assets/model-frame.mjs). `raisedCopy` copies a part a little off its surface, for a game to draw lines over.
// They run in that order: split, frame, core, brain, raised copy, then paint, so the new parts can be painted too.
//
// Downloads are cached in tools/assets/cache (gitignored). The output goes in a `models/` folder beside the manifest.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, quantize, resample, textureCompress } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import { addBrain, addCore, addFrame } from './model-frame.mjs';
import { addRaisedCopy, paintParts, splitPart } from './model-parts.mjs';

const manifestPath = process.argv[2];
const listFbx = process.argv.includes('--list-fbx');
if (!manifestPath) {
  console.error('❌ Usage: node tools/assets/build-models.mjs <manifest.json>');
  process.exit(1);
}
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const outDir = join(dirname(manifestPath), 'models');
const cacheDir = 'tools/assets/cache';
await mkdir(outDir, { recursive: true });

const exists = (path) => access(path).then(() => true, () => false);

async function download(url, path) {
  if (await exists(path)) return;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} for ${url}`);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, Buffer.from(await response.arrayBuffer()));
}

/** Downloads a zip pack once, checks it is the pinned file, and unpacks it. Returns the folder it was unpacked to. */
async function unpackZip(pack, packName) {
  const zip = join(cacheDir, `${packName}.zip`);
  const folder = join(cacheDir, packName);
  await download(pack.zip, zip);
  const sha256 = createHash('sha256').update(await readFile(zip)).digest('hex');
  if (sha256 !== pack.sha256) throw new Error(`${packName}: ${pack.zip} has sha256 ${sha256}, not the pinned ${pack.sha256}`);
  if (!(await exists(folder))) execFileSync('unzip', ['-q', '-o', zip, '-d', folder]);
  return folder;
}

/** Downloads a model and, for .gltf, the buffers and images it refers to. Returns the local path. */
async function fetchModel(pack, packName, path) {
  if (typeof pack === 'object') {
    const folder = await unpackZip(pack, packName);
    const local = join(folder, path);
    if (pack.textures && path.endsWith('.gltf')) {
      const json = JSON.parse(await readFile(local, 'utf8'));
      for (const uri of (json.images ?? []).map((i) => i.uri).filter((u) => u && !u.startsWith('data:'))) {
        const beside = join(dirname(local), uri);
        if (!(await exists(beside))) await copyFile(join(folder, pack.textures, uri), beside);
      }
    }
    return local;
  }
  const packUrl = pack;
  const local = join(cacheDir, packName, path);
  await download(`${packUrl}/${path}`, local);
  if (path.endsWith('.gltf')) {
    const json = JSON.parse(await readFile(local, 'utf8'));
    const uris = [...(json.buffers ?? []), ...(json.images ?? [])].map((r) => r.uri).filter((u) => u && !u.startsWith('data:'));
    for (const uri of uris) await download(`${packUrl}/${dirname(path)}/${uri}`, join(dirname(local), uri));
  }
  return local;
}

/**
 * Drops animation channels that hold a bone at its rest value the whole time. Most of a rig's bones never move or
 * stretch, yet each channel costs the game an evaluation per character every frame; without the channel the bone simply
 * stays at rest, so every animation and blend between them looks the same.
 */
function dropRestingChannels() {
  const rest = { translation: (n) => n.getTranslation(), rotation: (n) => n.getRotation(), scale: (n) => n.getScale() };
  const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-5);
  return (doc) => {
    let dropped = 0;
    for (const animation of doc.getRoot().listAnimations()) {
      for (const channel of animation.listChannels()) {
        const node = channel.getTargetNode();
        const path = channel.getTargetPath();
        const output = channel.getSampler()?.getOutput();
        if (!node || !rest[path] || !output) continue;
        const value = rest[path](node);
        const same = (v) => near(v, value) || (path === 'rotation' && near(v.map((x) => -x), value));
        let resting = true;
        for (let i = 0; i < output.getCount() && resting; i++) resting = same(output.getElement(i, []));
        if (!resting) continue;
        const sampler = channel.getSampler();
        channel.dispose();
        sampler.dispose();
        dropped++;
      }
    }
    if (dropped) console.log(`  dropped ${dropped} resting animation channels`);
  };
}

/**
 * Fetches the rig a model borrows animations from and writes the converter's spec beside the FBX, only when it changed
 * so the model isn't converted again for nothing. Returns the spec's path, or '' when the model borrows nothing.
 */
async function borrowSpec(model, fetched) {
  if (!model.borrow) return '';
  const { pack: packName, path, ...rest } = model.borrow;
  const pack = manifest.packs[packName];
  if (!pack) throw new Error(`unknown pack ${packName} for ${model.name}'s borrowed animations`);
  const spec = JSON.stringify({ from: await fetchModel(pack, packName, path), ...rest }, null, 2);
  const specPath = `${fetched}.borrow.json`;
  if (!(await exists(specPath)) || (await readFile(specPath, 'utf8')) !== spec) await writeFile(specPath, spec);
  return specPath;
}

/** Weathers every texture of a model, such as darkening and dulling a bright pack to sit in a grimier game. */
async function recolour(doc, { brightness = 1, saturation = 1, hue = 0 }) {
  for (const texture of doc.getRoot().listTextures()) {
    const image = texture.getImage();
    if (!image) continue;
    const png = await sharp(Buffer.from(image)).modulate({ brightness, saturation, hue }).png().toBuffer();
    texture.setImage(new Uint8Array(png)).setMimeType('image/png');
  }
}

await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

for (const model of manifest.models) {
  const pack = manifest.packs[model.pack];
  if (!pack) throw new Error(`unknown pack ${model.pack} for ${model.name}`);
  const fetched = await fetchModel(pack, model.pack, model.path);
  // FBX models are read from the glTF that tools/blender converts them to, beside the original.
  const isFbx = model.path.toLowerCase().endsWith('.fbx');
  if (listFbx) {
    // The pack's textures folder, if it names one, for the converter to find the FBX's textures in.
    if (isFbx) console.log(`FBX ${fetched}|${typeof pack === 'object' && pack.textures ? join(cacheDir, model.pack, pack.textures) : ''}|${await borrowSpec(model, fetched)}|${model.decimate ?? ''}`);
    continue;
  }
  const local = isFbx ? `${fetched}.glb` : fetched;
  if (!(await exists(local))) throw new Error(`${model.name}: ${local} is missing; build with tools/assets/build-models.sh`);
  const doc = await io.read(local);
  const root = doc.getRoot();

  if (model.keepMeshes) {
    for (const node of root.listNodes()) {
      if (node.getMesh() && !model.keepMeshes.includes(node.getName())) node.dispose();
    }
  }
  // Keeps only the parts of each mesh drawn in these materials, for a model that's one mesh of several pieces.
  if (model.keepMaterials) {
    for (const mesh of root.listMeshes()) {
      for (const primitive of mesh.listPrimitives()) {
        if (!model.keepMaterials.includes(primitive.getMaterial()?.getName() ?? '')) primitive.dispose();
      }
    }
  }
  if (model.animations) {
    const found = new Set(root.listAnimations().map((a) => a.getName()));
    const missing = model.animations.filter((name) => !found.has(name));
    if (missing.length) throw new Error(`${model.name} has no animation ${missing.join(', ')}`);
    for (const animation of root.listAnimations()) {
      if (model.animations.includes(animation.getName())) continue;
      // Samplers hold the keyframe data and outlive their animation unless disposed too.
      for (const channel of animation.listChannels()) channel.dispose();
      for (const sampler of animation.listSamplers()) sampler.dispose();
      animation.dispose();
    }
  }
  for (const rule of model.split ?? []) splitPart(doc, rule);
  if (model.frame) addFrame(doc, model.frame);
  if (model.core) addCore(doc, model.core);
  if (model.brain) addBrain(doc, model.brain);
  if (model.raisedCopy) addRaisedCopy(doc, model.raisedCopy);
  if (model.paint) paintParts(doc, model.paint);
  if (model.textures?.dropDetailMaps) {
    for (const material of root.listMaterials()) {
      material.setNormalTexture(null);
      material.setOcclusionTexture(null);
      material.setMetallicRoughnessTexture(null);
    }
  }
  if (model.textures?.recolour) await recolour(doc, model.textures.recolour);
  const textures = model.textures?.maxSize
    ? [textureCompress({ encoder: sharp, targetFormat: 'png', resize: [model.textures.maxSize, model.textures.maxSize] })]
    : [];
  await doc.transform(prune(), dedup(), ...textures, resample(), dropRestingChannels(), prune(), quantize(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const out = join(outDir, `${model.name}.glb`);
  await writeFile(out, await io.writeBinary(doc));
  const size = (await readFile(out)).length;
  console.log(`✓ ${model.name}.glb ${(size / 1024).toFixed(0)} KB`);
}
