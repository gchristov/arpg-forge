#!/bin/bash
set -e

# Usage: ./tools/browser/run.sh smoke
#        ./tools/browser/run.sh screenshot <page path> [out.png] [width] [height] [script]
# e.g.   ./tools/browser/run.sh screenshot /games/ashen-hollow/ tools/browser/out/phone.png 390 844
#
# Runs the built site (dist/) in headless Chromium with WebGL, in Docker. Run
# `./tools/node/run.sh npm run build` first. Output goes to tools/browser/out (gitignored).
#   smoke       loads every page at desktop and phone size, fails on any page error, and checks that a tap
#               moves the hero in each engine game. CI runs this as the test-web job.
#   screenshot  saves one page's screenshot, optionally after running a script in it. Fails on page errors.

cd "$(dirname "$0")/../.."

COMMAND=$1
shift || true
case "$COMMAND" in
  smoke) SCRIPT=tools/browser/smoke.mjs ;;
  screenshot) SCRIPT=tools/browser/screenshot.mjs ;;
  *)
    echo "❌ Usage: ./tools/browser/run.sh smoke | screenshot <page path> [out.png] [width] [height] [script]"
    exit 1
    ;;
esac

docker build -q -t arpg-forge-browser tools/browser > /dev/null
mkdir -p tools/browser/out
docker run --rm --ipc=host \
  -v "$(pwd):/repo" \
  -w /repo \
  arpg-forge-browser node "$SCRIPT" "$@"
