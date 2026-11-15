# Retargets animations from another rig onto a model's armature, for models whose pack lacks an animation the game
# needs. Each mapped bone turns in the world as its source bone turns from the source's reference pose, which must be
# the same pose as the model's rest pose (usually a T-pose). Proportions differ between rigs, so bones keep their own
# lengths: a bone hangs from its parent as at rest, a bone whose parent in the source isn't mapped moves as the source
# bone does, scaled by how tall the two are there, and a bone that the source chains to a different parent than the
# model does, such as a foot hung off the root, is placed at the end of the bone it follows in the source.
import bpy
import numpy
from mathutils import Matrix, Vector

# Blender 3.4's glTF importer uses numpy.bool, which the numpy beside it in Debian no longer has.
if not hasattr(numpy, 'bool'):
    numpy.bool = bool


def borrow(target, spec):
    """Adds `spec['animations']` (new name -> source animation) to the `target` armature, as actions."""
    bones = spec['bones']
    objects_before, actions_before = set(bpy.data.objects), set(bpy.data.actions)
    bpy.ops.import_scene.gltf(filepath=spec['from'])
    imported = [o for o in bpy.data.objects if o not in objects_before]
    source = next(o for o in imported if o.type == 'ARMATURE')
    source.animation_data_create()
    # The importer names each action after its animation and the object it moves.
    actions = {a.name.removesuffix(f'_{source.name}'): a for a in bpy.data.actions if a not in actions_before}
    missing = [n for n in [spec['pose'], *spec['animations'].values()] if n not in actions]
    if missing:
        raise RuntimeError(f'{spec["from"]} has no animation {", ".join(missing)}')

    reference = _world_pose(source, actions[spec['pose']], int(actions[spec['pose']].frame_range[0]))
    rest = {b.name: target.matrix_world @ b.matrix_local for b in target.data.bones}
    root = next(t for t, s in bones.items() if not _mapped_parent(source, s, bones))
    scale = rest[root].translation.z / reference[bones[root]].translation.z
    rehung = {t for t, s in bones.items() if _mapped_parent(source, s, bones) not in (None, _parent_name(target, t))}
    # Parents before children, and re-hung bones after the bones they hang from.
    def rank(b):
        return any(a.name in rehung for a in [b, *b.parent_recursive]), len(b.parent_recursive)
    order = sorted(target.data.bones, key=rank)
    for pose_bone in target.pose.bones:
        pose_bone.rotation_mode = 'QUATERNION'

    for name, clip in spec['animations'].items():
        action = bpy.data.actions.new(name)
        target.animation_data.action = action
        start, end = (int(f) for f in actions[clip].frame_range)
        for frame in range(start, end + 1):
            posed = _world_pose(source, actions[clip], frame)
            world = {}
            for bone in order:
                world[bone.name] = _place(bone, bones, source, posed, reference, rest, world, scale)
                _key(target, bone, world, frame - start)
        print(f'borrowed {clip} as {name}')

    for o in imported:
        bpy.data.objects.remove(o, do_unlink=True)
    for a in actions.values():
        bpy.data.actions.remove(a)


def _mapped_parent(source, name, bones):
    """The model bone mapped from the source bone's parent, if any."""
    parent = source.data.bones[name].parent
    return next((t for t, s in bones.items() if parent and s == parent.name), None)


def _parent_name(armature, name):
    parent = armature.data.bones[name].parent
    return parent.name if parent else None


def _world_pose(armature, action, frame):
    armature.animation_data.action = action
    bpy.context.scene.frame_set(frame)
    return {b.name: armature.matrix_world @ b.matrix for b in armature.pose.bones}


def _place(bone, bones, source, posed, reference, rest, world, scale):
    """The model bone's world matrix this frame."""
    parent = bone.parent
    hanging = world[parent.name] @ parent.matrix_local.inverted() @ bone.matrix_local if parent else rest[bone.name]
    name = bones.get(bone.name)
    if not name:
        return hanging
    turn = posed[name].to_quaternion() @ reference[name].to_quaternion().inverted()
    rotation = turn @ rest[bone.name].to_quaternion()
    follows = _mapped_parent(source, name, bones)
    if not follows:
        location = rest[bone.name].translation + (posed[name].translation - reference[name].translation) * scale
    elif parent and follows != parent.name:
        location = world[follows] @ Vector((0, bone.id_data.bones[follows].length, 0))
    else:
        location = hanging.translation
    size = rest[bone.name].to_scale()
    return Matrix.LocRotScale(location, rotation, size)


def _key(target, bone, world, frame):
    pose_bone = target.pose.bones[bone.name]
    inverse = target.matrix_world.inverted()
    # Worked out from what this frame placed rather than set through `matrix`, which reads the parent's pose as last
    # evaluated.
    posed = inverse @ world[bone.name]
    if bone.parent:
        at_rest = bone.parent.matrix_local.inverted() @ bone.matrix_local
        pose_bone.matrix_basis = at_rest.inverted() @ (inverse @ world[bone.parent.name]).inverted() @ posed
    else:
        pose_bone.matrix_basis = bone.matrix_local.inverted() @ posed
    pose_bone.keyframe_insert('location', frame=frame)
    pose_bone.keyframe_insert('rotation_quaternion', frame=frame)
    pose_bone.keyframe_insert('scale', frame=frame)
