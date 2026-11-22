// U-7: the plain male base body, given the animations the game plays on it, renamed to what the game calls them.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { mergeDocuments, prune, unpartition } from '@gltf-transform/functions';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const C = 'tools/assets/cache';
const doc = await io.read(`${C}/ubc/Universal Base Characters[Standard]/Base Characters/Godot - UE/Superhero_Male_FullBody.gltf`);
const root = doc.getRoot();
const own = new Set(root.listNodes());
const byName = new Map([...own].map((n) => [n.getName(), n]));
const library = await io.read(`${C}/ual-ue.glb`);
// The library's rig is shorter than the body, so its pelvis moves are scaled to the body's height, or the feet sink.
const restHeight = (d) => d.getRoot().listNodes().find((n) => n.getName() === 'pelvis').getTranslation()[2];
const pelvisScale = restHeight(doc) / restHeight(library);
mergeDocuments(doc, library);

/** The game's name for each animation, and the library's. */
const ANIMATIONS = {
  Idle: 'Idle_Loop', Run: 'Sprint_Loop', Punch: 'Punch_Jab', Shoot_OneHanded: 'Spell_Simple_Shoot', RecieveHit: 'Hit_Chest',
  Death: 'Death01', PistolIdle: 'Pistol_Idle_Loop', PunchCross: 'Punch_Cross', IdleLoop: 'Idle_Loop',
};
const sources = new Map(root.listAnimations().map((a) => [a.getName(), a]));
for (const [name, from] of Object.entries(ANIMATIONS)) {
  const source = sources.get(from);
  if (!source) throw new Error(`the animation library has no ${from}`);
  const animation = doc.createAnimation(name);
  for (const channel of source.listChannels()) {
    const target = byName.get(channel.getTargetNode()?.getName());
    const path = channel.getTargetPath();
    // Bones turn; only the pelvis moves, so the body bobs and falls without sliding away from its place.
    if (!target || !(path === 'rotation' || (path === 'translation' && target.getName() === 'pelvis'))) continue;
    const s = channel.getSampler();
    let output = s.getOutput();
    if (path === 'translation') {
      output = output.clone().setArray(output.getArray().map((v) => v * pelvisScale));
    }
    const sampler = doc.createAnimationSampler().setInput(s.getInput()).setOutput(output).setInterpolation(s.getInterpolation());
    animation.addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(target).setTargetPath(path).setSampler(sampler));
  }
}
for (const animation of sources.values()) animation.dispose();
for (const node of root.listNodes()) if (!own.has(node)) node.dispose();
for (const scene of root.listScenes().slice(1)) scene.dispose();
for (const skin of root.listSkins().slice(1)) skin.dispose();
await doc.transform(prune(), unpartition());
const out = `${C}/people/People/u7.glb`;
await io.write(out, doc);
console.log('wrote', out);
