#!/bin/bash
set -eu

repo_root=$(cd "$(dirname "$0")/.." && pwd)
cd "$repo_root"

node scripts/check-infra-outputs.mjs

if grep -RInE 'mailto:|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' \
  README.md docs public; then
  echo "error: email address or mailto link found" >&2
  exit 1
fi

test -f public/index.html
test -f public/.well-known/security.txt
grep -q 'See when your agents are making progress, getting stuck, or wasting tokens.' public/index.html
grep -q 'long-running agent work a local control pane' public/index.html
grep -q 'Cost control' public/index.html
grep -q 'Responsibility state' public/index.html
grep -q 'Transparency' public/index.html
grep -q 'Kungfu Origin Technology Limited' public/index.html
grep -q 'Apache License 2.0' public/index.html
grep -q 'GitHub private vulnerability reporting' public/index.html
grep -q 'journal-first' public/index.html
grep -q 'Agent-native' public/index.html
grep -q 'github.com/kungfu-systems/kungfu/security' public/.well-known/security.txt

if [ -d dist ]; then
  test -f dist/index.html
  test -f dist/.well-known/security.txt
  grep -q 'See when your agents are making progress, getting stuck, or wasting tokens.' dist/index.html
  grep -q 'Kungfu Origin Technology Limited' dist/index.html
fi

echo "site-kungfu-tech checks passed"
