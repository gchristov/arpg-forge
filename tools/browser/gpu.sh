#!/bin/bash
set -e

# Usage: ./tools/browser/gpu.sh <page URL> <seconds> [query]...
# e.g.   ./tools/browser/gpu.sh https://gchristov.github.io/arpg-forge/pr-preview/pr-27/games/ashen-hollow/ 12 "" "&stress=120"
#
# Measures a page on this Mac's real GPU, which the Docker browser can't use. Starts a separate headless Chrome
# with its own throwaway profile and a debugging port, drives it from the browser tool's Docker image, and prints
# the debug overlay for each query (fps, frame times, draw calls, triangles). Screenshots go to tools/browser/out.
# Only the Chrome this script starts is stopped afterwards; any Chrome you have open is left alone.
# MEASURE_SCRIPT=<path> runs a different measuring script against the same Chrome, for one-off investigations.

cd "$(dirname "$0")/../.."
if [ $# -lt 2 ]; then
  echo "❌ Usage: ./tools/browser/gpu.sh <page URL> <seconds> [query]..."
  exit 1
fi

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PORT=9333
PROFILE="$(mktemp -d -t arpg-forge-gpu-chrome)"
"$CHROME" --headless=new --remote-debugging-port=$PORT --user-data-dir="$PROFILE" --no-first-run \
  --no-default-browser-check --enable-gpu --use-angle=metal about:blank > /dev/null 2>&1 &
stop_chrome() {
  pkill -f -- "--remote-debugging-port=$PORT --user-data-dir=$PROFILE" || true
  rm -rf "$PROFILE"
}
trap stop_chrome EXIT
for _ in $(seq 1 40); do curl -s "http://127.0.0.1:$PORT/json/version" > /dev/null && break; sleep 0.25; done

docker build -q -t arpg-forge-browser tools/browser > /dev/null
mkdir -p tools/browser/out
docker run --rm -e GPU_CHROME_PORT=$PORT -v "$(pwd):/repo" -w /repo arpg-forge-browser node "${MEASURE_SCRIPT:-tools/browser/measure.mjs}" "$@"
