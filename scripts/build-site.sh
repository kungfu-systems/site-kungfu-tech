#!/bin/bash
set -eu

repo_root=$(cd "$(dirname "$0")/.." && pwd)
cd "$repo_root"

test -d public
test -f site/shared-layout.json

node scripts/render-shared-layout.mjs

rm -rf dist
mkdir -p dist
cp -R public/. dist/

node scripts/render-whitepaper.mjs

test -f dist/index.html
test -f dist/.well-known/security.txt
test -f dist/about/index.html
test -f dist/services/index.html
test -f dist/trust/index.html
test -f dist/legal/index.html
test -f dist/whitepaper/index.html
test -f dist/whitepaper/kungfu-real-world-agent-work/index.html
test -f dist/whitepaper/kungfu-real-world-agent-work.pdf
test -f dist/whitepaper/manifest.json
test -f dist/whitepaper/llms.txt

echo "site-kungfu-tech built dist/"
