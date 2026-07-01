#!/bin/bash
set -eu

repo_root=$(cd "$(dirname "$0")/.." && pwd)
cd "$repo_root"

if grep -RInE 'mailto:|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' \
  README.md docs public; then
  echo "error: email address or mailto link found" >&2
  exit 1
fi

test -f public/index.html
test -f public/.well-known/security.txt
grep -q 'Local-first debugging infrastructure' public/index.html
grep -q 'github.com/kungfu-systems/kungfu/security' public/.well-known/security.txt

echo "site-kungfu-tech checks passed"
