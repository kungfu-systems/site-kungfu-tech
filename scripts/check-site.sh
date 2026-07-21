#!/bin/bash
set -eu

repo_root=$(cd "$(dirname "$0")/.." && pwd)
cd "$repo_root"

node scripts/check-infra-outputs.mjs
node scripts/render-shared-layout.mjs --check
node scripts/check-whitepaper.mjs

shared_block() {
  block_name=$1
  page_path=$2
  sed -n "/shared-${block_name}:start/,/shared-${block_name}:end/p" "$page_path"
}

assert_shared_contains() {
  block_name=$1
  page_path=$2
  expected=$3
  if ! shared_block "$block_name" "$page_path" | grep -Fq "$expected"; then
    echo "error: ${page_path} shared ${block_name} is missing ${expected}" >&2
    exit 1
  fi
}

assert_shared_lacks() {
  block_name=$1
  page_path=$2
  unexpected=$3
  if shared_block "$block_name" "$page_path" | grep -Fq "$unexpected"; then
    echo "error: ${page_path} shared ${block_name} unexpectedly contains ${unexpected}" >&2
    exit 1
  fi
}

if grep -RInE 'mailto:|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' \
  README.md docs public site; then
  echo "error: email address or mailto link found" >&2
  exit 1
fi

test -f public/index.html
test -f public/agent-builders/index.html
test -f public/why-kungfu/index.html
test -f public/assets/site.css
test -f public/.well-known/security.txt
test -f public/about/index.html
test -f public/services/index.html
test -f public/trust/index.html
test -f public/legal/index.html
for page in public/index.html public/agent-builders/index.html public/why-kungfu/index.html public/about/index.html public/services/index.html public/trust/index.html public/legal/index.html; do
  grep -q 'href="/assets/site.css"' "$page"
done
if grep -RInE '^    \\.(site-header|brand|mark|site-nav|site-footer|nav-menu)\\b' \
  public/index.html public/about/index.html public/services/index.html public/trust/index.html public/legal/index.html; then
  echo "error: shared header/footer CSS must live in public/assets/site.css" >&2
  exit 1
fi
grep -q 'See when your agents are making progress, getting stuck, or wasting tokens.' public/index.html
grep -q 'Never Guess. Facts Unfold.' public/index.html
grep -q 'href="/why-kungfu/"' public/index.html
grep -q 'href="/agent-builders/"' public/index.html
grep -q 'Build your Hub. Don&rsquo;t rebuild the runtime.' public/index.html
grep -q 'Your product' public/index.html
grep -q '7eeb5bd1b45492f4da27eaacbe63eddfd6245176/examples/opencode-kungfu/quickstart' public/index.html
grep -q 'local control pane for agent work' public/index.html
grep -q 'Coming soon' public/index.html
grep -q 'being prepared' public/index.html
grep -q 'Follow Kungfu on GitHub' public/index.html
grep -q 'Developer site' public/index.html
grep -q 'Cost control' public/index.html
grep -q 'Responsibility state' public/index.html
grep -q 'Transparency' public/index.html
grep -q 'Kungfu Origin Technology Limited' public/index.html
grep -q 'Apache License 2.0' public/index.html
grep -q 'journal-first' public/index.html
grep -q 'libkungfu.dev' public/index.html
grep -q 'href="/about/index.html"' public/index.html
grep -q 'href="/services/index.html"' public/index.html
grep -q 'href="/trust/index.html"' public/index.html
grep -q 'href="/legal/index.html"' public/index.html
assert_shared_contains header public/index.html 'href="/about/index.html"'
assert_shared_contains header public/index.html 'href="/whitepaper/"'
assert_shared_contains header public/index.html 'class="nav-menu"'
assert_shared_contains header public/index.html 'href="/agent-builders/"'
assert_shared_contains header public/index.html 'libkungfu.dev'
assert_shared_contains header public/index.html 'github.com/kungfu-systems/kungfu'
assert_shared_lacks header public/index.html 'href="/services/index.html"'
assert_shared_lacks header public/index.html 'href="/trust/index.html"'
assert_shared_lacks header public/index.html 'href="/legal/index.html"'
assert_shared_contains footer public/index.html 'href="/services/index.html"'
assert_shared_contains footer public/index.html 'href="/trust/index.html"'
assert_shared_contains footer public/index.html 'href="/legal/index.html"'
assert_shared_contains footer public/index.html 'class="footer-links"'
assert_shared_contains footer public/index.html 'class="footer-note"'
assert_shared_contains footer public/index.html 'class="footer-copy"'
assert_shared_contains footer public/index.html 'details.nav-menu[open]'
grep -q 'shared-header:start' public/index.html
grep -q 'shared-footer:start' public/index.html
grep -q 'shared-header:start' public/why-kungfu/index.html
grep -q 'shared-footer:start' public/why-kungfu/index.html
grep -q 'The name did not begin as an acronym.' public/why-kungfu/index.html
grep -q 'KUNGFU = KUNGFU UNGFU: Never Guess. Facts Unfold.' public/why-kungfu/index.html
grep -q 'This is not a second product or runtime.' public/why-kungfu/index.html
grep -q 'docs/concepts/why-kungfu.md' public/why-kungfu/index.html
grep -q 'shared-header:start' public/about/index.html
grep -q 'shared-footer:start' public/about/index.html
grep -q 'commercial product line' public/about/index.html
grep -q 'libkungfu.dev' public/about/index.html
grep -q 'being prepared in the open' public/about/index.html
grep -q 'shared-header:start' public/services/index.html
grep -q 'shared-footer:start' public/services/index.html
grep -q 'not generally released yet' public/services/index.html
grep -q 'Commercial services will build around an open, local-first core.' public/services/index.html
grep -q 'shared-header:start' public/trust/index.html
grep -q 'shared-footer:start' public/trust/index.html
grep -q 'local-first control pane' public/trust/index.html
grep -q 'libkungfu.dev' public/trust/index.html
grep -q 'github.com/kungfu-systems/kungfu/security' public/.well-known/security.txt
grep -q 'Buildchain release passport' public/trust/index.html
grep -q 'Provider compliance' public/trust/index.html
grep -q 'honest cost attribution' public/trust/index.html
grep -q 'shared-header:start' public/legal/index.html
grep -q 'shared-footer:start' public/legal/index.html
grep -q 'github.com/kungfu-systems/kungfu/blob/dev/v4/v4.0/TRADEMARK.md' public/trust/index.html
grep -q 'github.com/kungfu-systems/kungfu/blob/dev/v4/v4.0/TRADEMARK.md' public/legal/index.html
grep -q 'Privacy posture' public/legal/index.html
grep -q 'shared-header:start' public/agent-builders/index.html
grep -q 'shared-footer:start' public/agent-builders/index.html
grep -q 'Build your Hub. Don&rsquo;t rebuild the runtime.' public/agent-builders/index.html
grep -q 'An action is a loop through reality' public/agent-builders/index.html
grep -q 'Fact Cut N+1' public/agent-builders/index.html
grep -q 'ActionBinding' public/agent-builders/index.html
grep -q 'Append-only journal authority' public/agent-builders/index.html
grep -q 'KFD responsibility boundary' public/agent-builders/index.html
grep -q 'Hub A · libkungfu adopter' public/agent-builders/index.html
grep -q 'Hub B · independent implementation' public/agent-builders/index.html
grep -q 'Delivery <b>≠</b> Admission' public/agent-builders/index.html
grep -q 'Occurrence <b>≠</b> Completion' public/agent-builders/index.html
grep -q 'Authentication <b>≠</b> Authority' public/agent-builders/index.html
grep -q 'No central KFD authority' public/agent-builders/index.html
grep -q 'Kungfu Cloud is a future option' public/agent-builders/index.html
grep -q 'first-party reference adopter' public/agent-builders/index.html
grep -q 'https://libkungfu.dev/runtime.json' public/agent-builders/index.html
grep -q 'kungfu/blob/1f3893fae1a7a666d8abe736cd9563128f48549b/docs/architecture/fact-episode-action-runtime.md' public/agent-builders/index.html
grep -q 'kfd/blob/35915676330696f888c73c154f431c99f37c19ec/protocols/agent-hub/README.md' public/agent-builders/index.html
grep -q 'github.com/kungfu-systems/kungfu/pull/1171' public/agent-builders/index.html
grep -q 'github.com/kungfu-systems/buildchain/pull/1435' public/agent-builders/index.html

if grep -RIn 'Kungfu v4\\|Developer substrate\\|substrate view\\|developer substrate' public; then
  echo "error: public copy contains internal or uncommon product wording" >&2
  exit 1
fi

if [ -d dist ]; then
  test -f dist/index.html
  test -f dist/agent-builders/index.html
  test -f dist/why-kungfu/index.html
  test -f dist/assets/site.css
  test -f dist/.well-known/security.txt
  test -f dist/about/index.html
  test -f dist/services/index.html
  test -f dist/trust/index.html
  test -f dist/legal/index.html
  grep -q 'See when your agents are making progress, getting stuck, or wasting tokens.' dist/index.html
  grep -q 'Build your Hub. Don&rsquo;t rebuild the runtime.' dist/agent-builders/index.html
  grep -q 'Never Guess. Facts Unfold.' dist/index.html
  grep -q 'The name did not begin as an acronym.' dist/why-kungfu/index.html
  grep -q 'being prepared' dist/index.html
  grep -q 'Kungfu Origin Technology Limited' dist/index.html
  grep -q 'libkungfu.dev' dist/about/index.html
  grep -q 'Buildchain release passport' dist/trust/index.html
  grep -q 'Privacy posture' dist/legal/index.html
fi

echo "site-kungfu-tech checks passed"
