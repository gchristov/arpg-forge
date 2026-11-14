// Builds a game's 3D models from asset packs: downloads each source model from a pinned commit, keeps only the
// parts and animations the game uses, compresses it, and writes a .glb next to the manifest.
//
// Usage: ./tools/node/run.sh node tools/assets/build-models.mjs <manifest.json>
// e.g.   ./tools/node/run.sh node tools/assets/build-models.mjs games/ashen-hollow/art/models.json
//
// Downloads are cached in tools/assets/cache (gitignored). The output goes in a `models/` folder beside the manifest.
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, quantize, resample } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';

const manifestPath = process.argv[2];
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

/** Downloads a model and, for .gltf, the buffers and images it refers to. Returns the local path. */
async function fetchModel(packUrl, packName, path) {
  const local = join(cacheDir, packName, path);
  await download(`${packUrl}/${path}`, local);
  if (path.endsWith('.gltf')) {
    const json = JSON.parse(await readFile(local, 'utf8'));
    const uris = [...(json.buffers ?? []), ...(json.images ?? [])].map((r) => r.uri).filter((u) => u && !u.startsWith('data:'));
    for (const uri of uris) await download(`${packUrl}/${dirname(path)}/${uri}`, join(dirname(local), uri));
  }
  return local;
}

await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

for (const model of manifest.models) {
  const packUrl = manifest.packs[model.pack];
  if (!packUrl) throw new Error(`unknown pack ${model.pack} for ${model.name}`);
  const local = await fetchModel(packUrl, model.pack, model.path);
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
  await doc.transform(prune(), dedup(), resample(), quantize(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const out = join(outDir, `${model.name}.glb`);
  await writeFile(out, await io.writeBinary(doc));
  const size = (await readFile(out)).length;
  console.log(`✓ ${model.name}.glb ${(size / 1024).toFixed(0)} KB`);
}
