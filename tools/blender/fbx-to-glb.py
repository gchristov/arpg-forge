# Converts an FBX model, with its animations, to a binary glTF that tools/assets/build-models.mjs can process.
# Usage (inside the Blender image): blender ... --python tools/blender/fbx-to-glb.py -- <in.fbx> <out.glb>
import sys

import bpy

source, target = sys.argv[sys.argv.index('--') + 1:][:2]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=source)
# FBX actions are named "<armature>|<animation>"; keep only the animation's name. The exporter writes one glTF
# animation per NLA track, so each action gets a track of its own, and none is left active.
armature = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
armature.animation_data_create()
for action in list(bpy.data.actions):
    action.name = action.name.split('|')[-1]
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
