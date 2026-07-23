#!/bin/bash
set -eu

repo_root=$(cd "$(dirname "$0")/.." && pwd)
cd "$repo_root"

node scripts/check-infra-outputs.mjs
node scripts/render-shared-layout.mjs --check
node scripts/check-whitepaper.mjs
node scripts/check-dogfood-proof.mjs
node scripts/check-trademark-use.mjs
node scripts/check-trademark-use.mjs --self-test

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

assert_before() {
  page_path=$1
  first=$2
  second=$3
  first_line=$(grep -n -m 1 -F "$first" "$page_path" | cut -d: -f1)
  second_line=$(grep -n -m 1 -F "$second" "$page_path" | cut -d: -f1)
  if [ "$first_line" -ge "$second_line" ]; then
    echo "error: ${page_path} must place ${first} before ${second}" >&2
    exit 1
  fi
}

if grep -RInE 'mailto:|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' \
  README.md docs public site; then
  echo "error: email address or mailto link found" >&2
  exit 1
fi

test -f public/index.html
test -f public/404.html
if grep -qi '<meta[^>]*name="robots"[^>]*noindex' public/404.html; then
  echo "error: public/404.html must remain indexable for production nested-route health checks" >&2
  exit 1
fi
grep -q 'href="/"' public/404.html
test -f public/how-tested/continuity/index.html
test -f public/agent-builders/index.html
test -f public/why-kungfu/index.html
test -f public/assets/site.css
test -f public/.well-known/security.txt
test -f public/about/index.html
test -f public/capital/index.html
test -f public/capital/investor-perspective/index.html
test -f public/services/index.html
test -f public/trust/index.html
test -f public/legal/index.html
test -f site/public-dogfood-proof.json
for page in public/index.html public/how-tested/continuity/index.html public/agent-builders/index.html public/why-kungfu/index.html public/about/index.html public/capital/index.html public/capital/investor-perspective/index.html public/services/index.html public/trust/index.html public/legal/index.html; do
  grep -q 'href="/assets/site.css"' "$page"
done
if grep -RInE '^    \\.(site-header|brand|mark|site-nav|site-footer|nav-menu)\\b' \
  public/index.html public/about/index.html public/capital/index.html public/capital/investor-perspective/index.html public/services/index.html public/trust/index.html public/legal/index.html; then
  echo "error: shared header/footer CSS must live in public/assets/site.css" >&2
  exit 1
fi
grep -q "Your agent shouldn't start over when the chat ends." public/index.html
grep -q 'fresh agent continue the same work' public/index.html
grep -q 'Same task. New chat. No re-explanation.' public/index.html
grep -q 'Continuation unsupported' public/index.html
grep -q 'Continuation oracle passed' public/index.html
grep -q 'prefers-reduced-motion: reduce' public/index.html
grep -q 'href="/how-tested/continuity/"' public/index.html
grep -q 'Never Guess. Facts Unfold.' public/index.html
grep -q 'href="/why-kungfu/"' public/index.html
grep -q 'durable work facts between sessions' public/index.html
grep -q 'class="primary-builder-action" href="/agent-builders/">For Agent Builders</a>' public/index.html
grep -q 'href="/agent-supply-chain/">Explore the Agent Supply Chain</a>' public/index.html
grep -q 'KFD-3</span><i aria-hidden="true">→</i>' public/index.html
grep -q 'Not claimed:</strong> a live multi-Hub market or external vendor adoption' public/index.html
grep -q 'Build and own your Hub. Kungfu stays beneath it.' public/index.html
grep -q 'it does not compete for the Hub' public/index.html
grep -q 'Your Hub stays yours' public/index.html
grep -q '7eeb5bd1b45492f4da27eaacbe63eddfd6245176/examples/opencode-kungfu/quickstart' public/index.html
grep -q 'Coming soon' public/index.html
grep -q 'being prepared' public/index.html
if grep -q 'class="control-pane"\|class="triangle"\|Cost, state, and proof' public/index.html; then
  echo "error: homepage still contains the retired Cost / State / Proof first-screen treatment" >&2
  exit 1
fi
grep -q 'Kungfu Origin Technology Limited' public/index.html
grep -q 'Apache License 2.0' public/index.html
grep -q 'journal-first' public/index.html
grep -q 'libkungfu.dev' public/index.html
grep -q 'class="capital-callout" href="/capital/"' public/index.html
grep -q 'Capital should expand the ecosystem, not control the standard.' public/index.html
grep -q 'Read the principles that would govern any future relationship with capital' public/index.html
assert_before public/index.html 'class="capital-callout" href="/capital/"' '<p><a href="/about/index.html">About</a>'
grep -q 'href="/about/index.html"' public/index.html
grep -q 'href="/services/index.html"' public/index.html
grep -q 'href="/trust/index.html"' public/index.html
grep -q 'href="/legal/index.html"' public/index.html
assert_shared_contains header public/index.html 'href="/about/index.html"'
assert_shared_contains header public/index.html 'href="/whitepaper/"'
assert_shared_contains header public/index.html 'class="nav-menu"'
assert_shared_contains header public/index.html 'href="/agent-builders/"'
assert_shared_contains header public/index.html 'href="/agent-supply-chain/"'
assert_shared_contains header public/index.html 'libkungfu.dev'
assert_shared_contains header public/index.html 'github.com/kungfu-systems/kungfu'
assert_shared_lacks header public/index.html 'href="/services/index.html"'
assert_shared_lacks header public/index.html 'href="/capital/"'
assert_shared_lacks header public/index.html 'href="/trust/index.html"'
assert_shared_lacks header public/index.html 'href="/legal/index.html"'
assert_shared_contains footer public/index.html 'href="/services/index.html"'
assert_shared_contains footer public/index.html 'href="/capital/"'
assert_shared_contains footer public/index.html 'href="/trust/index.html"'
assert_shared_contains footer public/index.html 'href="/legal/index.html"'
assert_shared_contains footer public/index.html 'class="footer-links"'
assert_shared_contains footer public/index.html 'class="footer-note"'
assert_shared_contains footer public/index.html 'class="footer-copy"'
assert_shared_contains footer public/index.html 'details.nav-menu[open]'
grep -q 'shared-header:start' public/index.html
grep -q 'shared-footer:start' public/index.html
grep -q 'shared-header:start' public/how-tested/continuity/index.html
grep -q 'shared-footer:start' public/how-tested/continuity/index.html
grep -q 'deterministic fixture-worker smoke test' public/how-tested/continuity/index.html
grep -q 'public-projection.json' public/how-tested/continuity/index.html
grep -q 'raw-evidence-index.json' public/how-tested/continuity/index.html
grep -q 'animation-pack.json' public/how-tested/continuity/index.html
grep -q 'shared-header:start' public/why-kungfu/index.html
grep -q 'shared-footer:start' public/why-kungfu/index.html
grep -q 'The name did not begin as an acronym.' public/why-kungfu/index.html
grep -q 'KUNGFU = KUNGFU UNGFU: Never Guess. Facts Unfold.' public/why-kungfu/index.html
grep -q 'UNGFU is not a second product or runtime.' public/why-kungfu/index.html
grep -q 'docs/concepts/why-kungfu.md' public/why-kungfu/index.html
grep -q 'shared-header:start' public/about/index.html
grep -q 'shared-footer:start' public/about/index.html
grep -q 'Work should survive the agent that started it.' public/about/index.html
grep -q 'Continuity for Agent Work' public/about/index.html
grep -q 'KFD is the open protocol' public/about/index.html
grep -q 'libkungfu.dev' public/about/index.html
grep -q 'Kungfu does not compete for the Hub' public/about/index.html
grep -q 'href="/capital/"' public/about/index.html
grep -q 'shared-header:start' public/capital/index.html
grep -q 'shared-footer:start' public/capital/index.html
grep -q 'Capital should expand the ecosystem, not control the standard.' public/capital/index.html
grep -q 'Kungfu is not announcing a financing round.' public/capital/index.html
grep -q 'it is not an offer to sell securities or an invitation to subscribe for them.' public/capital/index.html
grep -q 'Global credibility for KFD' public/capital/index.html
grep -q 'A durable Kungfu Origin' public/capital/index.html
grep -q 'Long-term freedom of action' public/capital/index.html
grep -q 'This is a goal, not a claim that KFD is already an industry standard or independently adopted.' public/capital/index.html
grep -q 'Returns should come from expanding the ecosystem.' public/capital/index.html
grep -q 'Non-negotiable boundaries' public/capital/index.html
grep -q 'Capabilities we would welcome' public/capital/index.html
grep -q 'Public protocol, commercial company' public/capital/index.html
grep -q 'class="investor-link" href="/capital/investor-perspective/"' public/capital/index.html
grep -q 'Understand the investment thesis—and the risks capital must be able to carry.' public/capital/index.html
grep -q 'These principles do not establish or alter entity structure' public/capital/index.html
grep -q 'They are not channels for financing proposals or transaction instructions.' public/capital/index.html
grep -q 'This page states no financing amount, valuation, security type, price, allocation, timetable, subscription process, or transaction terms.' public/capital/index.html
grep -q 'shared-header:start' public/capital/investor-perspective/index.html
grep -q 'shared-footer:start' public/capital/investor-perspective/index.html
grep -q 'How an open protocol can create commercial value.' public/capital/investor-perspective/index.html
grep -q 'The protocol stays open. The company wins by making the ecosystem useful.' public/capital/investor-perspective/index.html
grep -q 'It is not a claim that independent Hubs, broad adoption, or resulting demand already exist.' public/capital/investor-perspective/index.html
grep -q 'Ecosystem scale × Kungfu Origin' public/capital/investor-perspective/index.html
grep -q "Kungfu's founder and current steward is a citizen of the People's Republic of China." public/capital/investor-perspective/index.html
grep -q 'Kungfu Origin Technology Limited is incorporated in Hong Kong.' public/capital/investor-perspective/index.html
grep -q 'These facts do not, by themselves, establish that any particular investment' public/capital/investor-perspective/index.html
grep -q 'transaction-specific professional legal, regulatory, tax, and national-security review' public/capital/investor-perspective/index.html
grep -q 'It does not remove the jurisdictional risks of the founder, company, commercial activity, counterparties, or a specific transaction.' public/capital/investor-perspective/index.html
grep -q 'The right investor must contribute coordination capacity, not only money.' public/capital/investor-perspective/index.html
grep -q 'No investor can coordinate U.S.-China relations.' public/capital/investor-perspective/index.html
grep -q 'No concealment or misrepresentation' public/capital/investor-perspective/index.html
grep -q 'No sham relocation' public/capital/investor-perspective/index.html
grep -q 'No geopolitical protocol capture' public/capital/investor-perspective/index.html
grep -q 'No identity-only conclusions' public/capital/investor-perspective/index.html
grep -q 'Outbound Investment Security Program' public/capital/investor-perspective/index.html
grep -q 'Hong Kong export controls' public/capital/investor-perspective/index.html
grep -q 'CFIUS laws and guidance' public/capital/investor-perspective/index.html
grep -q 'not an offer to sell securities' public/capital/investor-perspective/index.html
grep -q 'contains no financing terms' public/capital/investor-perspective/index.html
grep -q 'href="/capital/"' public/capital/investor-perspective/index.html
grep -q 'shared-header:start' public/services/index.html
grep -q 'shared-footer:start' public/services/index.html
grep -q 'not generally released yet' public/services/index.html
grep -q 'Commercial services will build around an open, local-first core.' public/services/index.html
grep -q 'shared-header:start' public/trust/index.html
grep -q 'shared-footer:start' public/trust/index.html
grep -q 'local-first control plane' public/trust/index.html
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
grep -q 'Kungfu does not compete for your Hub.' public/agent-builders/index.html
grep -q 'Your users stay yours.' public/agent-builders/index.html
grep -q 'Your accounts and billing stay yours.' public/agent-builders/index.html
grep -q 'Your models, UI, and Agent stay yours.' public/agent-builders/index.html
grep -q 'Your cloud stays yours.' public/agent-builders/index.html
grep -q 'Your customer relationship stays yours.' public/agent-builders/index.html
grep -q 'KFD requires no central Kungfu cloud.' public/agent-builders/index.html
grep -q 'not a wedge into your Hub' public/agent-builders/index.html
grep -q 'Integration is not a channel into your customer relationship.' public/agent-builders/index.html
grep -q 'libkungfu lives inside an adopting Hub. KFD connects its edge' public/agent-builders/index.html
grep -q 'Host Runtime API · actions + local outcomes' public/agent-builders/index.html
grep -q 'works locally without KFD' public/agent-builders/index.html
grep -q 'Optional Hub edge' public/agent-builders/index.html
grep -q 'KFD adapter + exchange store' public/agent-builders/index.html
grep -q 'Independent conforming implementation · not yet claimed as adopted' public/agent-builders/index.html
grep -q 'rooted proposal →' public/agent-builders/index.html
grep -q '← transport receipt' public/agent-builders/index.html
grep -q '← receiver verdict' public/agent-builders/index.html
grep -q 'delivery ≠ admission' public/agent-builders/index.html
grep -q 'Single-vendor cloud' public/agent-builders/index.html
grep -q 'Multi-organization federation' public/agent-builders/index.html
grep -q 'Offline device' public/agent-builders/index.html
grep -q 'Without KFD, your Hub still works. It stays an island.' public/agent-builders/index.html
grep -q 'Every external Hub connection needs a custom bridge.' public/agent-builders/index.html
grep -q 'One protocol boundary works across conforming Hubs.' public/agent-builders/index.html
grep -q 'Each side keeps its runtime, policy, cloud, users, and admission authority.' public/agent-builders/index.html
assert_before public/agent-builders/index.html 'id="adoption-tradeoff-heading"' 'id="hub-promise-heading"'
assert_before public/agent-builders/index.html 'id="hub-promise-heading"' 'id="hub-network-heading"'
assert_before public/agent-builders/index.html 'id="hub-network-heading"' 'id="action-world-heading"'
assert_before public/agent-builders/index.html 'id="action-world-heading"' 'id="dogfood-proof-heading"'
assert_before public/agent-builders/index.html 'id="dogfood-proof-heading"' 'id="adoption-heading"'
test "$(grep -c 'data-builder-chapter="[0-9][0-9]"' public/agent-builders/index.html)" -eq 4
grep -q '<span class="chapter-number">01</span><span>The KFD-libkungfu network</span>' public/agent-builders/index.html
grep -q '<span class="chapter-number">02</span><span>Why action semantics are necessary</span>' public/agent-builders/index.html
grep -q '<span class="chapter-number">03</span><span>Dogfood · public and auditable</span>' public/agent-builders/index.html
grep -q '<span class="chapter-number">04</span><span>A bounded starting path</span>' public/agent-builders/index.html
grep -q '<p class="eyebrow">The Builder contract</p>' public/agent-builders/index.html
grep -q 'One protocol boundary. Independently owned Hubs.' public/agent-builders/index.html
grep -q 'A KFD exchange cannot be only an RPC payload.' public/agent-builders/index.html
grep -q 'One concrete delegated action' public/agent-builders/index.html
grep -q 'Release an exact, reviewed build.' public/agent-builders/index.html
grep -q 'ActionBinding → Act' public/agent-builders/index.html
grep -q 'Episode → Inspect + admit' public/agent-builders/index.html
grep -q 'Read one proof unit before the rolling 30-day totals.' public/agent-builders/index.html
grep -q 'Start with one bounded adapter.' public/agent-builders/index.html
assert_before public/agent-builders/index.html 'data-builder-chapter="01"' 'data-builder-chapter="02"'
assert_before public/agent-builders/index.html 'data-builder-chapter="02"' 'data-builder-chapter="03"'
assert_before public/agent-builders/index.html 'data-builder-chapter="03"' 'data-builder-chapter="04"'
assert_before public/agent-builders/index.html 'One concrete delegated action' 'ActionBinding → Act'
assert_before public/agent-builders/index.html 'Read one proof unit before the rolling 30-day totals.' 'id="dogfood-prs"'
assert_before public/agent-builders/index.html 'id="evidence-heading"' 'Start with one bounded adapter.'
assert_before public/agent-builders/index.html 'id="adoption-heading"' 'id="evidence-heading"'
grep -q 'An action is a loop through reality' public/agent-builders/index.html
grep -q 'Fact Cut N+1' public/agent-builders/index.html
grep -q 'ActionBinding' public/agent-builders/index.html
grep -q 'Append-only journal authority' public/agent-builders/index.html
grep -q 'Qualified first-party reference adopter' public/agent-builders/index.html
grep -q 'Independent conforming implementation · not yet claimed as adopted' public/agent-builders/index.html
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
grep -q 'https://libkungfu.dev/dogfood/' public/agent-builders/index.html
grep -q 'https://libkungfu.dev/dogfood-evidence.json' public/agent-builders/index.html

if grep -RIn 'Kungfu v4\\|Developer substrate\\|substrate view\\|developer substrate' public; then
  echo "error: public copy contains internal or uncommon product wording" >&2
  exit 1
fi

if [ -d dist ]; then
  test -f dist/index.html
  test -f dist/how-tested/continuity/index.html
  test -f dist/agent-builders/index.html
  test -f dist/agent-supply-chain/index.html
  test -f dist/agent-supply-chain.json
  test -f dist/llms.txt
  test -f dist/why-kungfu/index.html
  test -f dist/assets/site.css
  test -f dist/.well-known/security.txt
  test -f dist/about/index.html
  test -f dist/capital/index.html
  test -f dist/capital/investor-perspective/index.html
  test -f dist/services/index.html
  test -f dist/trust/index.html
  test -f dist/legal/index.html
  grep -q "Your agent shouldn't start over when the chat ends." dist/index.html
  grep -q 'How continuity was tested' dist/how-tested/continuity/index.html
  grep -q 'Kungfu does not compete for your Hub.' dist/agent-builders/index.html
  grep -q 'The next software user is an Agent.' dist/agent-supply-chain/index.html
  grep -q 'Software distribution is becoming Agent-mediated.' dist/agent-supply-chain/index.html
  grep -q 'Human sets boundary' dist/agent-supply-chain/index.html
  grep -q 'Agent-first software can earn distribution through use.' dist/agent-supply-chain/index.html
  grep -q '03 · The bootstrap' dist/agent-supply-chain/index.html
  grep -q 'Kungfu gives the first Agent a way to understand the stack.' dist/agent-supply-chain/index.html
  grep -q 'The envelope points. The Agent inspects.' dist/agent-supply-chain/index.html
  grep -q 'One seed, not two miracles.' dist/agent-supply-chain/index.html
  grep -q 'The envelope does not create demand or assume prior KFD knowledge' dist/agent-supply-chain/index.html
  grep -q 'Useful Agent-first software can create its own demand signal.' dist/agent-supply-chain/index.html
  grep -q 'Enabled, not claimed.' dist/agent-supply-chain/index.html
  grep -q '05 · The complete mechanism' dist/agent-supply-chain/index.html
  grep -q 'Five responsibilities. Independent owners.' dist/agent-supply-chain/index.html
  assert_before dist/agent-supply-chain/index.html 'Agent-first software can earn distribution through use.' 'Kungfu gives the first Agent a way to understand the stack.'
  assert_before dist/agent-supply-chain/index.html 'Kungfu gives the first Agent a way to understand the stack.' 'Useful Agent-first software can create its own demand signal.'
  assert_before dist/agent-supply-chain/index.html 'Useful Agent-first software can create its own demand signal.' 'Five responsibilities. Independent owners.'
  assert_before dist/agent-supply-chain/index.html 'Software distribution is becoming Agent-mediated.' 'Five responsibilities. Independent owners.'
  assert_before dist/agent-supply-chain/index.html 'Agent-first software can earn distribution through use.' 'Five responsibilities. Independent owners.'
  grep -q 'kungfu-agent-supply-chain-public-narrative/v1' dist/agent-supply-chain.json
  grep -q 'kungfu-agent-supply-chain-reader-progression/v1' dist/agent-supply-chain.json
  grep -q '"title": "Kungfu gives the first Agent a way to understand the stack."' dist/agent-supply-chain.json
  grep -q '"discovery": "When Kungfu launches an Agent' dist/agent-supply-chain.json
  grep -q '"label": "KFD-3"' dist/agent-supply-chain.json
  grep -q '"label": "KFD-2"' dist/agent-supply-chain.json
  grep -q '30-day assessment' dist/agent-supply-chain/index.html
  grep -q 'external vendor adoption or endorsement' dist/agent-supply-chain/index.html
  grep -q 'property="og:title" content="Agent Supply Chain | Kungfu"' dist/agent-supply-chain/index.html
  grep -q 'Maturity claims matrix' dist/agent-supply-chain/index.html
  grep -q 'Exact evidence' dist/agent-supply-chain/index.html
  grep -q 'Known limit' dist/agent-supply-chain/index.html
  if sed -E 's#<code>[^<]*</code>##g; s#href="[^"]*"##g' dist/agent-supply-chain/index.html | grep -Eq '\bkfd-[0-9]'; then
    echo "error: Agent Supply Chain reader contains lowercase KFD prose" >&2
    exit 1
  fi
  grep -q 'two public strategic axes' dist/llms.txt
  grep -q 'The next software user is an Agent.' dist/llms.txt
  grep -q 'How the first Agent understands the stack' dist/llms.txt
  grep -q 'compact, versioned Skill envelope' dist/llms.txt
  grep -q 'KFD-3 \[proved-now\]' dist/llms.txt
  grep -q 'KFD-2 \[proved-now\]' dist/llms.txt
  grep -q 'npm:@kungfu-tech/kfd@1.0.0-alpha.41' dist/llms.txt
  grep -q 'Never Guess. Facts Unfold.' dist/index.html
  grep -q 'The name did not begin as an acronym.' dist/why-kungfu/index.html
  grep -q 'being prepared' dist/index.html
  grep -q 'Kungfu Origin Technology Limited' dist/index.html
  grep -q 'libkungfu.dev' dist/about/index.html
  grep -q 'How an open protocol can create commercial value.' dist/capital/investor-perspective/index.html
  grep -q 'Kungfu Origin Technology Limited is incorporated in Hong Kong.' dist/capital/investor-perspective/index.html
  grep -q 'Buildchain release passport' dist/trust/index.html
  grep -q 'Privacy posture' dist/legal/index.html
fi

echo "site-kungfu-tech checks passed"
