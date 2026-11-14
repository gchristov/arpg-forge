#!/bin/bash
set -e

# Usage: ./tools/browser/run.sh <page path> [out.png] [width] [height] [script]
# e.g.   ./tools/browser/run.sh /games/ashen-hollow/ tools/browser/out/village.png 390 844
#
# Takes a screenshot of a page from the last build (dist/) in headless Chromium with WebGL, in Docker.
# Run `./tools/node/run.sh npm run build` first. Screenshots go to tools/browser/out (gitignored).
# Exits non-zero if the page logs an error.

cd "$(dirname "$0")/../.."

if [ $# -eq 0 ]; then
  echo "❌ Usage: ./tools/browser/run.sh <page path> [out.png] [width] [height] [script]"
  exit 1
fi

docker build -q -t arpg-forge-browser tools/browser > /dev/null
mkdir -p tools/browser/out
docker run --rm --ipc=host \
  -v "$(pwd):/repo" \
  -w /repo \
  arpg-forge-browser node tools/browser/screenshot.mjs "$@"
