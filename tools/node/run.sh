#!/bin/bash
set -e

# Usage: ./tools/node/run.sh <command> [args]
# e.g.   ./tools/node/run.sh npm install
#        ./tools/node/run.sh npm test
#        ./tools/node/run.sh npm run dev
#
# Runs a Node command in Docker, so Node doesn't need installing on this machine. The repo is mounted at
# /repo; node_modules lives in a Docker volume, so Linux packages never mix with the checkout.
# `npm run dev` and `npm run preview` are served on localhost:5173 and localhost:4173, and to phones on the
# same network at this machine's address.

cd "$(dirname "$0")/../.."

if [ $# -eq 0 ]; then
  echo "❌ Usage: ./tools/node/run.sh <command> [args], e.g. npm test"
  exit 1
fi

docker build -q -t arpg-forge-node tools/node > /dev/null

TTY=()
if [ -t 0 ] && [ -t 1 ]; then
  TTY=(-it)
fi
PORTS=()
case " $* " in
  *" dev "*) PORTS=(-p 5173:5173) ;;
  *" preview "*) PORTS=(-p 4173:4173) ;;
esac

docker run --rm "${TTY[@]}" "${PORTS[@]}" \
  -v "$(pwd):/repo" \
  -v arpg-forge-node-modules:/repo/node_modules \
  -w /repo \
  arpg-forge-node "$@"
