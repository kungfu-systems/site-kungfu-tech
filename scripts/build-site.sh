#!/bin/bash
set -eu

repo_root=$(cd "$(dirname "$0")/.." && pwd)
cd "$repo_root"

test -d public
test -f site/shared-layout.json

node scripts/import-auditable-demo.mjs
node scripts/render-shared-layout.mjs

rm -rf dist
mkdir -p dist
cp -R public/. dist/
node scripts/publish-bootstrap-evidence.mjs

node scripts/consume-installer-publication-bundle.mjs \
  --source site/installer-publication-source.json \
  --output-root dist
node scripts/render-whitepaper.mjs
node scripts/render-agent-supply-chain.mjs
node scripts/render-agent-hub.mjs
node scripts/fingerprint-site-assets.mjs --root dist

test -f dist/index.html
test -s dist/favicon.ico
test -f dist/404.html
test -f dist/how-tested/continuity/index.html
test -f dist/how-tested/auditable-demo/index.html
test -f dist/auditable-demo.json
test -f dist/agent-builders/index.html
test -f dist/agent-builders/hub-starter/index.html
test -f dist/agent-supply-chain/index.html
test -f dist/agent-supply-chain.json
test -f dist/agent-hub/index.html
test -f dist/agent-hub.json
test -f dist/llms.txt
test -f dist/.well-known/security.txt
test -f dist/.well-known/kungfu-release-status.json
test -f dist/about/index.html
test -f dist/about/bootstrapping/index.html
test -f dist/about/bootstrapping/evidence/index.html
test -f dist/about/bootstrapping/evidence/data/manifest.json
test -f dist/about/bootstrapping/evidence/data/collect.mjs
test -f dist/about/bootstrapping/evidence/data/pull-requests.json
test -f dist/capital/index.html
test -f dist/capital/investor-perspective/index.html
test -f dist/services/index.html
test -f dist/trust/index.html
test -f dist/legal/index.html
test -f dist/install/index.html
test -f dist/whitepaper/index.html
test -f dist/whitepaper/kungfu-white-paper/index.html
test -f dist/whitepaper/kungfu-white-paper.pdf
test -f dist/whitepaper/kungfu-machine-life/index.html
test -f dist/whitepaper/kungfu-machine-life.pdf
test -f dist/whitepaper/kungfu-machine-life/manifest.json
test -f dist/whitepaper/kungfu-machine-life/llms.txt
test ! -e dist/whitepaper/kungfu-real-world-agent-work
test ! -e dist/whitepaper/kungfu-real-world-agent-work.pdf
test ! -e dist/whitepaper/kfd-machine-life-roadmap
test ! -e dist/whitepaper/kfd-machine-life-roadmap.pdf
test -f dist/whitepaper/manifest.json
test -f dist/whitepaper/catalog.json
test -f dist/whitepaper/llms.txt

echo "site-kungfu-tech built dist/"
