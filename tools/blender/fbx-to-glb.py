# Converts an FBX model, with its animations, to a binary glTF that tools/assets/build-models.mjs can process.
# Usage (inside the Blender image): blender ... --python tools/blender/fbx-to-glb.py -- <in.fbx> <out.glb> [textures]
# FBX files often point to textures by paths on their author's machine; `textures` is a folder to find them in.
import os
import sys

import bpy

args = sys.argv[sys.argv.index('--') + 1:]
source, target = args[:2]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=source)
if len(args) > 2:
    textures = args[2]
    bpy.ops.file.find_missing_files(directory=textures)
    # Some packs name each material after its texture but leave it unlinked, expecting it to be assigned by hand.
    for material in bpy.data.materials:
        nodes = material.node_tree.nodes if material.use_nodes else None
        file = os.path.join(textures, f'{material.name}.png')
        if not nodes or any(n.type == 'TEX_IMAGE' for n in nodes) or not os.path.exists(file):
            continue
        shader = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
        texture = nodes.new('ShaderNodeTexImage')
        texture.image = bpy.data.images.load(file)
        material.node_tree.links.new(texture.outputs['Color'], shader.inputs['Base Color'])
    for image in bpy.data.images:
        if image.filepath:
            image.pack()
missing = [i.name for i in bpy.data.images if i.source == 'FILE' and not i.has_data and not i.packed_file]
if missing:
    raise RuntimeError(f'textures not found: {", ".join(missing)}')
# FBX actions are named "<armature>|<animation>"; keep only the animation's name. Rigs often move only some bones,
# such as the feet, and let constraints like IK bend the rest; a game engine doesn't run those, so each animation is
# baked with every bone keyed as it appears. The exporter writes one glTF animation per NLA track, so each baked
# action gets a track of its own, and none is left active.
armature = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
armature.animation_data_create()
bpy.context.view_layer.objects.active = armature
armature.select_set(True)
bpy.ops.object.mode_set(mode='POSE')
bpy.ops.pose.select_all(action='SELECT')
for action in list(bpy.data.actions):
    action.name = action.name.split('|')[-1]
    armature.animation_data.action = action
    start, end = (int(f) for f in action.frame_range)
    bpy.ops.nla.bake(
        frame_start=start, frame_end=end, only_selected=False, visual_keying=True,
        clear_constraints=False, use_current_action=True, bake_types={'POSE'},
    )
bpy.ops.object.mode_set(mode='OBJECT')
for action in list(bpy.data.actions):
    track = armature.animation_data.nla_tracks.new()
    track.name = action.name
    track.strips.new(action.name, int(action.frame_range[0]), action)
armature.animation_data.action = None
print('animations:', ', '.join(sorted(a.name for a in bpy.data.actions)))
bpy.ops.export_scene.gltf(
    filepath=target,
    export_format='GLB',
    export_animations=True,
    export_nla_strips=True,
    export_force_sampling=True,
    export_yup=True,
)
print(f'converted {source} -> {target}')
