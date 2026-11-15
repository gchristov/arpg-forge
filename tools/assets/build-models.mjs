// Builds a game's 3D models from asset packs: downloads each source model from a pinned commit, keeps only the
// parts and animations the game uses, compresses it, and writes a .glb next to the manifest.
//
// Usage: ./tools/assets/build-models.sh <manifest.json>, which runs this in the Node image after converting any FBX
// models with the Blender image. `--list-fbx` only fetches the packs and prints each FBX model's local path.
//
// A pack is either a folder URL at a pinned commit, or `{ "zip": url, "sha256": hash }` for packs only published as
// zip files; a zip whose checksum doesn't match is refused. A zip pack's `textures` names the folder inside it that
// holds images its .gltf files expect beside them. A model's `textures` option shrinks its textures to
// `maxSize` pixels and can drop its normal and occlusion-roughness-metal maps, for packs made for close-up games.
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

await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

for (const model of manifest.models) {
  const pack = manifest.packs[model.pack];
  if (!pack) throw new Error(`unknown pack ${model.pack} for ${model.name}`);
  const fetched = await fetchModel(pack, model.pack, model.path);
  // FBX models are read from the glTF that tools/blender converts them to, beside the original.
  const isFbx = model.path.toLowerCase().endsWith('.fbx');
  if (listFbx) {
    if (isFbx) console.log(`FBX ${fetched}`);
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
  if (model.textures?.dropDetailMaps) {
    for (const material of root.listMaterials()) {
      material.setNormalTexture(null);
      material.setOcclusionTexture(null);
      material.setMetallicRoughnessTexture(null);
    }
  }
  const textures = model.textures?.maxSize
    ? [textureCompress({ encoder: sharp, targetFormat: 'png', resize: [model.textures.maxSize, model.textures.maxSize] })]
    : [];
  await doc.transform(prune(), dedup(), ...textures, resample(), dropRestingChannels(), prune(), quantize(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const out = join(outDir, `${model.name}.glb`);
  await writeFile(out, await io.writeBinary(doc));
  const size = (await readFile(out)).length;
  console.log(`✓ ${model.name}.glb ${(size / 1024).toFixed(0)} KB`);
}
