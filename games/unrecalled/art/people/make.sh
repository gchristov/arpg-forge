#!/bin/bash
set -e

# Usage: ./games/unrecalled/art/people/make.sh
#
# Makes the "people" pack the game's models.json builds U-7 and Rustbelt's people from, in tools/assets/cache/people:
# Quaternius's Universal Base Characters dressed in his Modular Character Outfits – Fantasy, given the Universal
# Animation Library's animations. Run it before ./tools/assets/build-models.sh whenever the cache is empty.
#
# The two character packs are only published on itch.io, so they're downloaded by hand (both CC0, pay what you want):
#   https://quaternius.itch.io/universal-base-characters   → unzip into tools/assets/cache/ubc
#   https://quaternius.itch.io/modular-character-outfits-fantasy → unzip into tools/assets/cache/outfits

cd "$(dirname "$0")/../../../.."
CACHE=tools/assets/cache
for pack in ubc outfits; do
  if [ ! -d "$CACHE/$pack" ]; then
    echo "❌ $CACHE/$pack is missing: download it by hand (see the top of this script)."
    exit 1
  fi
done

# The animation library, from its pinned zip in the game's manifest, converted from its Unreal Engine rig, which the
# base characters share.
./tools/node/run.sh node games/unrecalled/art/people/fetch-animations.mjs
FBX="$CACHE/animations/Animation Library[Standard]/Unreal Engine/AL_Standard.fbx"
[ "$CACHE/ual-ue.glb" -nt "$FBX" ] || ./tools/blender/run.sh "$FBX" "$CACHE/ual-ue.glb" | grep -E '^(animations|converted)'

./tools/node/run.sh node games/unrecalled/art/people/townsfolk.mjs
./tools/node/run.sh node games/unrecalled/art/people/u7.mjs
