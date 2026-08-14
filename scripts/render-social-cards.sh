#!/bin/bash
set -eu

repo_root=$(cd "$(dirname "$0")/.." && pwd)
chrome_bin=${CHROME_BIN:-}

if [ -z "$chrome_bin" ]; then
  for candidate in \
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    "/Applications/Chromium.app/Contents/MacOS/Chromium" \
    "$(command -v google-chrome 2>/dev/null || true)" \
    "$(command -v chromium 2>/dev/null || true)"; do
    if [ -n "$candidate" ] && [ -x "$candidate" ]; then
      chrome_bin=$candidate
      break
    fi
  done
fi

if [ -z "$chrome_bin" ] && ! command -v sips >/dev/null 2>&1; then
  echo "error: Chrome or Chromium is required; set CHROME_BIN" >&2
  exit 1
fi

profile_dir=$(mktemp -d "${TMPDIR:-/tmp}/kungfu-social-card.XXXXXX")
trap 'rm -rf "$profile_dir"' EXIT

mkdir -p "$repo_root/public/assets/social"
if command -v sips >/dev/null 2>&1; then
  sips -s format png \
    "$repo_root/site/social-cards/public-week-agent-work.svg" \
    --out "$repo_root/public/assets/social/public-week-agent-work.png" >/dev/null
  echo "Rendered social card in public/assets/social/"
  exit 0
fi

"$chrome_bin" \
  --headless \
  --disable-gpu \
  --hide-scrollbars \
  --force-device-scale-factor=1 \
  --window-size=1200,630 \
  --user-data-dir="$profile_dir" \
  --screenshot="$repo_root/public/assets/social/public-week-agent-work.png" \
  "file://$repo_root/site/social-cards/public-week-agent-work.svg" >/dev/null 2>&1

echo "Rendered social card in public/assets/social/"
