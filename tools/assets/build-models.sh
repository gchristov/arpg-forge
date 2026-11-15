#!/bin/bash
set -e

# Usage: ./tools/assets/build-models.sh <manifest.json>
# e.g.   ./tools/assets/build-models.sh games/unrecalled/art/models.json
#
# Builds a game's models: fetches each pack, converts any FBX models to glTF with Blender (tools/blender), then
# trims, compresses and writes them with tools/assets/build-models.mjs. Everything runs in Docker.

cd "$(dirname "$0")/../.."

if [ $# -ne 1 ]; then
  echo "❌ Usage: ./tools/assets/build-models.sh <manifest.json>"
  exit 1
fi

./tools/node/run.sh node tools/assets/build-models.mjs "$1" --list-fbx | sed -n 's/^FBX //p' | while IFS=$'\t' read -r fbx textures; do
  # Converted again whenever the converter changes.
  [ "$fbx.glb" -nt tools/blender/fbx-to-glb.py ] || ./tools/blender/run.sh "$fbx" "$fbx.glb" ${textures:+"$textures"} | grep -E '^(animations|converted)'
done
./tools/node/run.sh node tools/assets/build-models.mjs "$1"
