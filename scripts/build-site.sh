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

test -f dist/index.html
test -f dist/.well-known/security.txt
test -f dist/trust/index.html

echo "site-kungfu-tech built dist/"
