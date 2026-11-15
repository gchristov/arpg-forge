#!/bin/bash
set -e

# Usage: ./tools/blender/run.sh <in.fbx> <out.glb>
# e.g.   ./tools/blender/run.sh tools/assets/cache/mechs/FBX/Stan.fbx tools/assets/cache/mechs/FBX/Stan.fbx.glb
#
# Converts an FBX model and its animations to glTF with Blender, in Docker, so Blender doesn't need installing on this
# machine. Paths are relative to the repo, which is mounted at /repo. tools/assets/build-models.sh calls this for
# every FBX model in a manifest; it's rarely needed by hand.

cd "$(dirname "$0")/../.."

if [ $# -ne 2 ]; then
  echo "❌ Usage: ./tools/blender/run.sh <in.fbx> <out.glb>"
  exit 1
fi

docker build -q -t arpg-forge-blender tools/blender > /dev/null
docker run --rm -v "$(pwd):/repo" -w /repo arpg-forge-blender --python tools/blender/fbx-to-glb.py -- "$1" "$2"
