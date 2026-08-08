#!/bin/bash
set -eu

repo_root=$(cd "$(dirname "$0")/.." && pwd)
cd "$repo_root"

node --test scripts/import-bootstrap-publication.test.mjs
node --test scripts/consume-installer-publication-bundle.test.mjs
node --test scripts/import-auditable-demo.test.mjs
node --test scripts/homepage-proof-reel.test.mjs
node --test scripts/structured-markdown.test.mjs
node --test scripts/check-copyable-code.test.mjs
node --test scripts/paper-propagation.test.mjs
node scripts/consume-installer-publication-bundle.mjs \
  --source site/installer-publication-source.json \
  --output-root public
node scripts/import-auditable-demo.mjs --check
node scripts/check-infra-outputs.mjs
node scripts/render-shared-layout.mjs --check
node --check scripts/publish-bootstrap-evidence.mjs
node --check docs/research/2026-07-20-kungfu-systems-public-work-week/collect.mjs
grep -q '"label": "Verify Agent Hub"' site/shared-layout.json
grep -q '"href": "/agent-hub/"' site/shared-layout.json
grep -q '"label": "Get Kungfu"' site/shared-layout.json
grep -q '"class": "nav-cta"' site/shared-layout.json
grep -q '"public/about/bootstrapping/index.html"' site/shared-layout.json
grep -q '"public/about/bootstrapping/evidence/index.html"' site/shared-layout.json
grep -q '.site-nav > \*:not(:first-child):not(.nav-cta)::before' public/assets/site.css
node scripts/check-whitepaper.mjs
node scripts/check-dogfood-proof.mjs
node scripts/check-trademark-use.mjs
node scripts/check-trademark-use.mjs --self-test
node --check public/assets/command-copy.js
node --check scripts/check-copyable-code.mjs
node scripts/check-copyable-code.mjs --root public

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
test -f public/how-tested/auditable-demo/index.html
test -f public/auditable-demo.json
test -f public/agent-builders/index.html
test -f public/agent-builders/hub-starter/index.html
test -f public/why-kungfu/index.html
test -f public/assets/site.css
test -f public/assets/command-copy.js
test -s public/assets/fonts/instrument-sans-latin-wght-normal.6219bc4b.woff2
test -s public/assets/fonts/ibm-plex-mono-latin-400-normal.c36f509c.woff2
test -s public/assets/fonts/ibm-plex-mono-latin-600-normal.ad4580d8.woff2
test -s public/assets/fonts/ibm-plex-mono-latin-700-normal.9e1455e6.woff2
test -s public/assets/fonts/OFL-Instrument-Sans.txt
test -s public/assets/fonts/OFL-IBM-Plex-Mono.txt
grep -q -- '--font-display: "Instrument Sans"' public/assets/site.css
grep -q -- '--font-mono: "IBM Plex Mono"' public/assets/site.css
if grep -RInE 'fonts\.(googleapis|gstatic)\.com' public scripts site; then
  echo "error: site typography must remain self-hosted" >&2
  exit 1
fi
test -f public/.well-known/security.txt
test -f public/.well-known/kungfu-release-status.json
node -e 'const fs=require("fs"); const s=JSON.parse(fs.readFileSync("public/.well-known/kungfu-release-status.json","utf8")); if(s.schema!=="kungfu.release-status/v1" || s.status!=="unavailable" || s.releasedUseClaim!==false || s.release!==null || s.acquisitionEvidence!==null) throw new Error("pre-release status endpoint is not truthful")'
test -f public/about/index.html
test -f public/about/bootstrapping/index.html
test -f public/about/bootstrapping/evidence/index.html
test -f public/capital/index.html
test -f public/capital/investor-perspective/index.html
test -f public/services/index.html
test -f public/trust/index.html
test -f public/legal/index.html
test -f public/install/index.html
grep -q 'width: min(1040px, calc(100% - 40px));' public/install/index.html
grep -q 'padding: 34px 0 64px;' public/install/index.html
test -f site/public-dogfood-proof.json
for page in public/index.html public/how-tested/continuity/index.html public/how-tested/auditable-demo/index.html public/agent-builders/index.html public/agent-builders/hub-starter/index.html public/why-kungfu/index.html public/about/index.html public/about/bootstrapping/index.html public/about/bootstrapping/evidence/index.html public/capital/index.html public/capital/investor-perspective/index.html public/services/index.html public/trust/index.html public/legal/index.html public/install/index.html; do
  grep -q 'href="/assets/site.css"' "$page"
done
if grep -RInE '^    \\.(site-header|brand|mark|site-nav|site-footer|nav-menu)\\b' \
  public/index.html public/about/index.html public/capital/index.html public/capital/investor-perspective/index.html public/services/index.html public/trust/index.html public/legal/index.html; then
  echo "error: shared header/footer CSS must live in public/assets/site.css" >&2
  exit 1
fi
grep -q "Your agents don't hand off the&nbsp;work. You&nbsp;do." public/index.html
grep -q 'Every switch means copying context, re-explaining decisions, chasing updates, and checking what got lost.' public/index.html
grep -q 'Kungfu keeps the same work moving, no matter which agent takes over.' public/index.html
grep -q 'prefers-reduced-motion: reduce' public/index.html
grep -q 'href="/how-tested/auditable-demo/#demo-agent-work-lab-autoplay-heading">Evidence</a>' public/index.html
grep -q 'Can Work survive a new Agent?' public/index.html
grep -q 'Can Work survive failure?' public/index.html
grep -q 'Who is allowed to complete Work?' public/index.html
grep -Eq 'Exact installed artifact · [0-9]+(\.[0-9]+)? seconds' public/index.html
grep -q 'class="demo-showcase"' public/index.html
grep -q 'data-demo-carousel' public/index.html
grep -q 'data-carousel-track' public/index.html
grep -q 'data-demo-title="The pain" data-active' public/index.html
grep -q 'data-carousel-status>The problem · 1 of 4<' public/index.html
grep -q 'data-carousel-previous' public/index.html
grep -q 'data-carousel-playback' public/index.html
grep -q 'data-carousel-next' public/index.html
grep -q 'class="demo-carousel-arrows" aria-label="Scene playback controls"' public/index.html
grep -q 'aria-label="Previous scene" data-carousel-previous' public/index.html
grep -q 'aria-label="Pause scene playback" aria-pressed="true" data-carousel-playback' public/index.html
grep -q 'data-playback-icon>Ⅱ</span>' public/index.html
grep -q 'aria-label="Next scene" data-carousel-next' public/index.html
grep -q 'PROOF_SCENE_TRANSITION_DURATION_MS' public/index.html
grep -q 'data-proof-transitioning' public/index.html
grep -q 'scale(0.985)' public/index.html
grep -q 'scale(1.015)' public/index.html
grep -q 'PROBLEM_AUTOMATION_DELAY_MS = 7000' public/assets/proof-reel-state.js
grep -q 'PROOF_PRELUDE_DELAY_MS = 5000' public/assets/proof-reel-state.js
grep -q 'class="demo-carousel-phase">The problem · then 3 proofs</span>' public/index.html
grep -q 'data-carousel-chapter="1">New Agent</button>' public/index.html
grep -q 'data-carousel-chapter="2">Failure</button>' public/index.html
grep -q 'data-carousel-chapter="3">Approval</button>' public/index.html
if grep -q 'data-proof-toggle\|data-proof-skip\|Pause proof\|Skip proof\|data-carousel-previous disabled' public/index.html; then
  echo "error: homepage duplicates native video and chapter navigation controls" >&2
  exit 1
fi
grep -q 'data-carousel-proof>Watch the Work survive →</button>' public/index.html
grep -q '.demo-carousel-track .hero-demo-bar { display: none; }' public/index.html
grep -q 'width: 100%;' public/index.html
grep -q 'border-bottom: 1px solid var(--line);' public/index.html
grep -q 'min-height: 70px' public/index.html
grep -q 'padding: 10px 15px;' public/index.html
grep -q 'linear-gradient(135deg, #fffdf8 0%, #f0eee8 56%, #e3ece8 100%)' public/index.html
grep -q -- '--bg: #f5f2ec;' public/assets/site.css
grep -q -- '--panel: #fffdfc;' public/assets/site.css
grep -q -- '--accent: #0b6f68;' public/assets/site.css
grep -q -- '--accent-2: #4f6094;' public/assets/site.css
grep -q 'border-top-color: var(--evidence)' public/agent-builders/index.html
grep -q 'border-left: 5px solid var(--protocol)' public/agent-builders/hub-starter/index.html
grep -q 'border: 0' public/index.html
grep -q 'box-shadow: none' public/index.html
grep -q 'transition: opacity 720ms ease' public/index.html
grep -q 'container-type: inline-size' public/index.html
grep -q 'calc(177.777dvh - 380px)' public/index.html
grep -q '5.8cqw' public/index.html
grep -q 'Use the best Agent when it matters. Use a cheaper one when it does not.' public/index.html
grep -q 'class="hero-actions" aria-label="Explore Kungfu"' public/index.html
grep -q 'class="brand-motto">Never Guess. Facts Unfold.</span>' public/index.html
grep -q 'window.setTimeout' public/index.html
grep -q 'PROBLEM_AUTOMATION_DELAY_MS = 7000' public/assets/proof-reel-state.js
grep -q 'event.key === "ArrowLeft"' public/index.html
grep -q 'event.key === "ArrowRight"' public/index.html
grep -q 'addEventListener("touchstart"' public/index.html
grep -q 'addEventListener("touchend"' public/index.html
grep -q 'data-proof-video data-passive-proof controls muted playsinline preload="none"' public/index.html
grep -q 'window.matchMedia("(prefers-reduced-motion: reduce)")' public/index.html
node - <<'NODE'
const fs = require("node:fs");
const html = fs.readFileSync("public/index.html", "utf8");
const projection = JSON.parse(fs.readFileSync("public/auditable-demo.json", "utf8"));
const assertMp4BeforeWebm = (document, label) => {
  const videos = [...document.matchAll(/<video\b[\s\S]*?<\/video>/giu)]
    .map(([video]) => video)
    .filter((video) => video.includes('type="video/mp4"') && video.includes('type="video/webm"'));
  if (videos.length === 0
    || videos.some((video) => video.indexOf('type="video/mp4"') > video.indexOf('type="video/webm"'))) {
    throw new Error(`${label} must prefer MP4 before its WebM fallback`);
  }
};
assertMp4BeforeWebm(html, "homepage auditable demo");
assertMp4BeforeWebm(
  fs.readFileSync("public/how-tested/auditable-demo/index.html", "utf8"),
  "auditable demo evidence page",
);
for (const [media, file] of [
  ["(max-width: 767px)", "demo-720p.mp4"],
  ["(max-width: 767px)", "demo-720p.webm"],
  ["(min-width: 768px)", "demo.mp4"],
  ["(min-width: 768px)", "demo.webm"],
]) {
  if (!html.includes(`media="${media}"`) || !html.includes(`/${file}"`)) {
    throw new Error(`homepage is missing qualified responsive source ${media} -> ${file}`);
  }
}
const qualifiedMediaProfiles = new Set([
  "responsive-web-delivery-v1",
  "responsive-long-form-web-delivery-v1",
]);
if (projection.schema !== "kungfu.site.auditable-demo/v2"
  || !qualifiedMediaProfiles.has(projection.mediaProfile)
  || !/^sha256:[0-9a-f]{64}$/u.test(projection.mediaQualificationRoot || "")) {
  throw new Error("auditable demo projection is missing responsive qualification authority");
}
if (projection.renditions?.["responsive-primary-video"]?.width !== 1280
  || projection.renditions?.["responsive-primary-video"]?.height !== 720
  || projection.renditions?.["primary-video"]?.width !== 1920
  || projection.renditions?.["primary-video"]?.height !== 1080) {
  throw new Error("auditable demo projection has invalid responsive rendition dimensions");
}
if (!html.includes("grid-column: 1 / -1;")) {
  throw new Error("homepage demo showcase is not assigned to a full-width grid row");
}
if (/class="continuity-demo"|Same task\. New chat\. No re-explanation\./u.test(html)) {
  throw new Error("homepage still contains the retired static continuity card");
}
const slides = html.match(/<article\b[^>]*data-demo-slide[^>]*>/giu) || [];
if (slides.length !== 4 || slides.some((slide) => !/\bdata-demo-title="[^"]+"/u.test(slide))) {
  throw new Error("homepage reel requires Problem and three titled proof chapters");
}
if (!/data-demo-title="The pain"[^>]*data-active/u.test(slides[0])
  || !/data-demo-title="Continuity"/u.test(slides[1])
  || !/data-demo-title="Failure retention"/u.test(slides[2])
  || !/data-demo-title="Review and settlement"/u.test(slides[3])) {
  throw new Error("homepage reel must open on the human pain before three ordered proof chapters");
}
if (html.includes('class="hero-copy"')
  || html.indexOf('class="brand-principle"') < html.indexOf('<!-- auditable-demo-home:end -->')) {
  throw new Error("homepage supporting copy must remain below the complete demonstration reel");
}
const heroActions = html.match(/<div class="hero-actions"[\s\S]*?<\/div>/u)?.[0] || "";
if (!heroActions
  || heroActions.includes('href="/install/"')
  || !heroActions.includes('href="/agent-supply-chain/#agent-native-loop"')
  || !heroActions.includes('href="/agent-builders/"')
  || html.includes("Copilot")
  || /\.hero-actions a:first-child\s*\{/u.test(html)) {
  throw new Error("homepage supporting row must keep installation in the header and expose only neutral tested-product links");
}
if (!/\.summary \{[\s\S]*?justify-self: center;[\s\S]*?text-align: left;/u.test(html)
  || !/\.hero-actions \{[\s\S]*?flex-direction: column;[\s\S]*?align-items: flex-end;[\s\S]*?justify-self: end;/u.test(html)) {
  throw new Error("homepage supporting row does not preserve its centered left-aligned copy block and stacked right-aligned actions");
}
if (!/\.brand-principle \{[\s\S]*?display: grid;[\s\S]*?gap: 6px;/u.test(html)
  || !/\.brand-principle strong \{[\s\S]*?display: grid;[\s\S]*?gap: 2px;/u.test(html)
  || !/<span class="brand-signature">Kungfu UNGFU™<\/span><span class="brand-motto">Never Guess\. Facts Unfold\.<\/span>/u.test(html)) {
  throw new Error("homepage brand principle does not preserve its explicit three-line structure");
}
if (!/\.builder-entry h2,\s*\.trust h2 \{[\s\S]*?font-size: clamp\(28px, 4vw, 44px\);/u.test(html)
  || !/\.trust \{[\s\S]*?align-items: center;[\s\S]*?padding: 28px;/u.test(html)
  || !/\.trust \{[\s\S]*?border-right: 1px solid transparent;[\s\S]*?border-left: 1px solid transparent;/u.test(html)
  || !/\.builder-entry, \.trust \{ padding: 20px; \}/u.test(html)) {
  throw new Error("homepage stewardship card does not share the builder title scale, padding, and vertical alignment");
}
if (html.includes('class="demo-showcase-heading"')
  || (html.match(/class="demo-carousel-controls"/gu) || []).length !== 1
  || html.indexOf('class="demo-carousel-controls"') > html.indexOf('data-carousel-track')
  || !/\.demo-carousel-controls \{[\s\S]*?position: relative;[\s\S]*?grid-template-columns: minmax\(0, 1fr\) auto minmax\(0, 1fr\);[\s\S]*?width: 100%;[\s\S]*?border-bottom: 1px solid var\(--line\);/u.test(html)
  || !/\.demo-carousel-arrows \{[\s\S]*?justify-self: end;/u.test(html)
  || !/data-carousel-previous[\s\S]*?data-carousel-playback[\s\S]*?data-carousel-next/u.test(html)
  || !html.includes(".demo-carousel-track .hero-demo-bar { display: none; }")) {
  throw new Error("homepage carousel controls must replace the in-slide status bar at the top of the demonstration card");
}
if (!html.includes("min-height: 70px")
  || !html.includes("padding: 10px 15px;")) {
  throw new Error("homepage caption does not preserve compact spacing below the top controls");
}
if (!html.includes("@media (min-width: 1800px) and (min-height: 1200px)")
  || !html.includes("@media (min-width: 3000px) and (min-height: 1800px)")) {
  throw new Error("homepage is missing its 2K and 4K landscape sizing contracts");
}
if (!html.includes("width: min(100%, max(480px, calc(177.777dvh - 380px)))")
  || !/@media \(min-width: 821px\) \{\s*\.demo-carousel-viewport \{/u.test(html)
  || !/\.demo-showcase \{[\s\S]*?border: 1px solid var\(--line\);[\s\S]*?linear-gradient\(135deg, #fffdf8 0%, #f0eee8 56%, #e3ece8 100%\);[\s\S]*?box-shadow: 0 24px 60px/u.test(html)
  || !/\.hero-demo \{[\s\S]*?border: 0;[\s\S]*?background: transparent;[\s\S]*?box-shadow: none;/u.test(html)
  || !/\.claim-demo-title \{[\s\S]*?color: var\(--fg\);/u.test(html)
  || !/\.claim-demo-tagline \{[\s\S]*?color: var\(--muted\);/u.test(html)
  || !html.includes("@media (prefers-color-scheme: dark)")
  || !html.includes("margin-top: -28px")
  || !html.includes("font-size: clamp(30px, 5.8cqw, 86px)")) {
  throw new Error("homepage carousel does not preserve its header-tight viewport-height contract");
}
for (const member of ["poster.png", "demo.webm", "demo.mp4", "complete-transcript.txt"]) {
  const expected = `${projection.publicEvidencePath}/${member}`;
  if (!html.includes(expected)) throw new Error(`homepage demo is not source-bound to ${expected}`);
}
const videoTags = [...html.matchAll(/<video\b[^>]*data-proof-video[^>]*>/giu)].map(([tag]) => tag);
if (videoTags.length !== 3) throw new Error("homepage is missing its three proof videos");
if (videoTags.some((videoTag) => /\s(?:autoplay|loop)(?=\s|=|>|\/)/iu.test(videoTag.replace(/"[^"]*"|'[^']*'/gu, "")))) {
  throw new Error("homepage proof media must remain non-looping and defer autoplay to the reduced-motion-aware controller");
}
NODE
grep -q 'prefers-reduced-motion: reduce' public/how-tested/auditable-demo/index.html
grep -q 'Watch the artifact explain itself.' public/how-tested/auditable-demo/index.html
grep -q 'Authority boundary' public/how-tested/auditable-demo/index.html
grep -q 'exact Passport, Core policy, Work or Warrant, an explicit capability grant, and runtime isolation' public/how-tested/auditable-demo/index.html
grep -q 'Machine-readable Passport' public/how-tested/auditable-demo/index.html
grep -q 'read the complete transcript' public/how-tested/auditable-demo/index.html
if node - public/how-tested/auditable-demo/index.html <<'NODE'
const fs = require("node:fs");
const html = fs.readFileSync(process.argv[2], "utf8");
const hasAutoplayAttribute = [...html.matchAll(/<video\b[^>]*>/giu)].some(
  ([tag]) =>
    /\bautoplay\b/iu.test(tag.replace(/"[^"]*"|'[^']*'/gu, "")),
);
process.exit(hasAutoplayAttribute ? 0 : 1);
NODE
then
  echo "error: auditable demo media must never autoplay" >&2
  exit 1
fi
grep -q 'kungfu.site.auditable-demo/v2' public/auditable-demo.json
grep -q 'Never Guess. Facts Unfold.' public/index.html
grep -q 'href="/why-kungfu/"' public/index.html
grep -q 'Keep the same Work across Codex, Claude, OpenCode, or your own execution surface.' public/index.html
grep -q 'class="primary-builder-action" href="/agent-builders/">For Agent Builders</a>' public/index.html
grep -q 'href="/agent-supply-chain/#agent-native-loop">See the Agent-native loop</a>' public/index.html
grep -q 'href="/agent-hub/">Run the installed Agent Hub proof</a>' public/index.html
grep -q 'href="/agent-hub/">Verify Kungfu' public/index.html
grep -q 'KFD-3</span><i aria-hidden="true">→</i>' public/index.html
grep -q 'Not claimed:</strong> a live multi-Hub market or external vendor adoption' public/index.html
grep -q 'Build and own your Hub. Kungfu stays beneath it.' public/index.html
grep -q 'it does not compete for the Hub' public/index.html
grep -q 'Your Hub stays yours' public/index.html
grep -q '7eeb5bd1b45492f4da27eaacbe63eddfd6245176/examples/opencode-kungfu/quickstart' public/index.html
grep -q 'Coming soon' public/install/index.html
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
assert_shared_contains header public/index.html 'class="nav-cta" href="/install/">Get Kungfu</a>'
assert_shared_contains header public/index.html 'href="/agent-builders/"'
assert_shared_contains header public/index.html 'href="/agent-builders/hub-starter/"'
assert_shared_contains header public/index.html 'href="/agent-hub/"'
assert_shared_contains header public/index.html 'href="/agent-supply-chain/"'
assert_shared_contains header public/index.html 'href="https://kfd.libkungfu.dev/"'
assert_shared_contains header public/index.html '>Developer Platform</a>'
assert_shared_contains header public/index.html 'github.com/kungfu-systems/kungfu'
assert_shared_lacks header public/index.html '>Install CLI</a>'
assert_before public/index.html '<summary>Agent Builders</summary>' '<summary>Developers</summary>'
assert_before public/index.html '<summary>Developers</summary>' '<a href="/whitepaper/">Papers</a>'
assert_before public/index.html '<a href="/whitepaper/">Papers</a>' '<a href="/about/index.html">About</a>'
assert_before public/index.html '<a href="/about/index.html">About</a>' '<a class="nav-cta" href="/install/">Get Kungfu</a>'
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
grep -q 'href="/about/bootstrapping/"' public/about/index.html
grep -q 'minimal human sovereign core' public/about/index.html
grep -q 'Participation should scale only after those capabilities exist as machine-readable Work infrastructure.' public/about/index.html
grep -q 'href="/capital/"' public/about/index.html
grep -q 'class="public-commitment"' public/about/index.html
grep -q 'class="public-commitment-copy"' public/about/index.html
grep -q 'class="capital-stewardship"' public/about/index.html
assert_before public/about/index.html '<h2>Public and auditable</h2>' '<h2>Commercial stewardship</h2>'
assert_before public/about/index.html '<h2>Commercial stewardship</h2>' '<h2>Capital &amp; stewardship</h2>'
grep -q 'shared-header:start' public/about/bootstrapping/index.html
grep -q 'shared-footer:start' public/about/bootstrapping/index.html
grep -q 'A larger human team would have hidden the problem.' public/about/bootstrapping/index.html
grep -q 'Read this with your agent' public/about/bootstrapping/index.html
grep -q 'Separate current evidence, strategic hypotheses, and long-term aspirations.' public/about/bootstrapping/index.html
grep -q 'This is not ordinary dogfood' public/about/bootstrapping/index.html
grep -q 'The human organization is the hidden Work Runtime' public/about/bootstrapping/index.html
grep -q 'Begin with a minimal sovereign core' public/about/bootstrapping/index.html
grep -q 'Externalize capability before scaling participation.' public/about/bootstrapping/index.html
grep -q 'What is Kungfu trying to make real?' public/about/bootstrapping/index.html
grep -q 'One ordinary piece of Work' public/about/bootstrapping/index.html
grep -q 'When the runtime stays human' public/about/bootstrapping/index.html
grep -q 'When responsibility is externalized' public/about/bootstrapping/index.html
grep -q 'site pull request #163' public/about/bootstrapping/index.html
grep -q 'href="https://buildchain.libkungfu.dev/">Buildchain</a>' public/about/bootstrapping/index.html
grep -q 'partial bootstrap evidence—not proof that the finished Kungfu Work Runtime already exists.' public/about/bootstrapping/index.html
grep -q 'href="/about/bootstrapping/evidence/"' public/about/bootstrapping/index.html
grep -q 'Examine the public work sample and reanalyze it with your Agent' public/about/bootstrapping/index.html
grep -q 'Why could this begin here?' public/about/bootstrapping/index.html
grep -q 'The strongest objection' public/about/bootstrapping/index.html
python3 - <<'PY'
from pathlib import Path

page = Path("public/about/bootstrapping/index.html").read_text()
agent_note = page.index("Read this with your agent")
first_argument = page.index("What is Kungfu trying to make real?")
if agent_note > first_argument:
    raise SystemExit("error: the agent reading invitation must precede the article argument")
PY
grep -q 'Scale after the runtime exists' public/about/bootstrapping/index.html
if grep -Fq 'building infrastructure for durable agent work while using agents to build more of that infrastructure' \
  public/about/index.html public/about/bootstrapping/index.html; then
  echo "error: bootstrap entry points must not collapse the thesis into ordinary dogfood" >&2
  exit 1
fi
grep -q 'With gratitude to Douglas Engelbart' public/about/bootstrapping/index.html
grep -q 'The product is not a smarter Session. It is a machine-readable common reality that survives Sessions.' public/about/bootstrapping/index.html
grep -q 'Kungfu v4 is coming soon.' public/about/bootstrapping/index.html
if grep -q 'docs/concepts/bootstrapping-agent-work.md' public/about/bootstrapping/index.html; then
  echo "error: preview thesis must not point readers to the unsynchronized repository essay" >&2
  exit 1
fi
grep -q 'shared-header:start' public/about/bootstrapping/evidence/index.html
grep -q 'shared-footer:start' public/about/bootstrapping/evidence/index.html
grep -q 'href="/about/bootstrapping/">← Back to the Bootstrap argument</a>' public/about/bootstrapping/evidence/index.html
grep -q '<article aria-labelledby="report-title">' public/about/bootstrapping/evidence/index.html
grep -q '<h1 id="report-title">One human organized the work. Agents executed it.</h1>' public/about/bootstrapping/evidence/index.html
grep -q 'One human organized the work. Agents executed it.' public/about/bootstrapping/evidence/index.html
grep -q 'First-party declaration' public/about/bootstrapping/evidence/index.html
grep -q 'Readers are not required to accept that part of the statement.' public/about/bootstrapping/evidence/index.html
grep -q 'Codex, Claude, Cursor, Amp' public/about/bootstrapping/evidence/index.html
grep -q 'Three different kinds of claim' public/about/bootstrapping/evidence/index.html
grep -q 'Publicly verifiable' public/about/bootstrapping/evidence/index.html
grep -q 'First-party declared' public/about/bootstrapping/evidence/index.html
grep -q 'Not established' public/about/bootstrapping/evidence/index.html
grep -q '1,026' public/about/bootstrapping/evidence/index.html
grep -q '<h3><a href="https://buildchain.libkungfu.dev/">Buildchain</a>, release, and distribution</h3>' public/about/bootstrapping/evidence/index.html
grep -q 'What a conventional organization would usually require' public/about/bootstrapping/evidence/index.html
grep -q 'We do not assign a person-month total.' public/about/bootstrapping/evidence/index.html
grep -q 'This collection and its first analysis were also performed by an Agent.' public/about/bootstrapping/evidence/index.html
grep -q 'href="/about/bootstrapping/evidence/data/manifest.json"' public/about/bootstrapping/evidence/index.html
grep -q 'This is evidence, not proof of the method' public/about/bootstrapping/evidence/index.html
grep -q 'We welcome independent analysis, comparison, criticism, and replication.' public/about/bootstrapping/evidence/index.html
grep -q 'href="https://libkungfu.dev/dogfood/"' public/about/bootstrapping/evidence/index.html
grep -q 'That record does not establish one-human bootstrap causality.' public/about/bootstrapping/evidence/index.html
assert_before public/about/bootstrapping/evidence/index.html 'Read this with your Agent' 'Three different kinds of claim'
assert_before public/about/bootstrapping/evidence/index.html '← Back to the Bootstrap argument' 'One human organized the work. Agents executed it.'
assert_before public/about/bootstrapping/evidence/index.html 'First-party declaration' 'The bounded public sample'
if grep -Eq '[0-9]+[–-][0-9]+ (senior )?person-months|[0-9]+[–-][0-9]+ calendar months' \
  public/about/bootstrapping/evidence/index.html \
  docs/research/2026-07-20-kungfu-systems-public-work-week/workload-analysis.md; then
  echo "error: bootstrap evidence must compare organizational functions without a person-month estimate" >&2
  exit 1
fi
grep -q '\[Buildchain\](https://buildchain.libkungfu.dev/) release infrastructure' \
  docs/research/2026-07-20-kungfu-systems-public-work-week/workload-analysis.md
node - <<'NODE'
const fs = require("fs");
const root = "docs/research/2026-07-20-kungfu-systems-public-work-week";
const collection = JSON.parse(fs.readFileSync(`${root}/collection.json`, "utf8"));
const summary = JSON.parse(fs.readFileSync(`${root}/summary.json`, "utf8"));
const pullRequests = JSON.parse(fs.readFileSync(`${root}/pull-requests.json`, "utf8"));
const closedIssues = JSON.parse(fs.readFileSync(`${root}/closed-issues.json`, "utf8"));
const releases = JSON.parse(fs.readFileSync(`${root}/releases.json`, "utf8"));
const repositories = JSON.parse(fs.readFileSync(`${root}/repositories.json`, "utf8"));
if (collection.window.start !== "2026-07-19T16:00:00Z") throw new Error("unexpected evidence start");
if (collection.window.end !== "2026-07-27T02:48:00Z") throw new Error("unexpected evidence end");
const expected = {
  pullRequests: 1026,
  additions: 738437,
  deletions: 125367,
  changedFiles: 14005,
  commits: 5501,
  closedIssues: 59,
  releases: 112,
  repositories: 18,
  repositoriesWithMergedPullRequests: 15,
};
for (const [key, value] of Object.entries(expected)) {
  if (summary.totals[key] !== value) throw new Error(`unexpected ${key}: ${summary.totals[key]}`);
}
if (pullRequests.length !== summary.totals.pullRequests) throw new Error("PR record count mismatch");
if (closedIssues.length !== summary.totals.closedIssues) throw new Error("issue record count mismatch");
if (releases.length !== summary.totals.releases) throw new Error("release record count mismatch");
if (repositories.length !== summary.totals.repositories) throw new Error("repository record count mismatch");
const featurePrefixed = pullRequests.filter((pullRequest) =>
  /^feat(?:\([^)]*\))?:/i.test(pullRequest.title)
).length;
if (featurePrefixed !== 200) throw new Error(`unexpected feat-prefixed count: ${featurePrefixed}`);
NODE
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
grep -q 'See how Agent Work creates the current product path, how Machine Life extends the long-term horizon' public/capital/index.html
grep -q 'These principles do not establish or alter entity structure' public/capital/index.html
grep -q 'They are not channels for financing proposals or transaction instructions.' public/capital/index.html
grep -q 'This page states no financing amount, valuation, security type, price, allocation, timetable, subscription process, or transaction terms.' public/capital/index.html
grep -q 'shared-header:start' public/capital/investor-perspective/index.html
grep -q 'shared-footer:start' public/capital/investor-perspective/index.html
grep -q 'How an open protocol can create commercial value.' public/capital/investor-perspective/index.html
grep -q 'The protocol stays open. The company can win by making the ecosystem useful.' public/capital/investor-perspective/index.html
grep -q 'From Agent Work to Machine Life.' public/capital/investor-perspective/index.html
grep -q 'href="/whitepaper/kungfu-white-paper/"' public/capital/investor-perspective/index.html
grep -q 'href="/whitepaper/kungfu-machine-life/"' public/capital/investor-perspective/index.html
grep -q 'Machine Life is a functional, falsifiable research horizon—not a claim that biological life, sentience, unrestricted autonomy, or a completed self-sustaining Kungfu organism already exists.' public/capital/investor-perspective/index.html
grep -q 'It is not present revenue, adoption, or valuation proof.' public/capital/investor-perspective/index.html
assert_before public/capital/investor-perspective/index.html 'From Agent Work to Machine Life.' 'The underwriting question'
grep -q 'If KFD earns public credibility, company value can grow from it.' public/capital/investor-perspective/index.html
grep -q 'It is not a claim that independent Hubs, broad adoption, or resulting demand already exist.' public/capital/investor-perspective/index.html
grep -q 'Ecosystem scale × Kungfu Origin' public/capital/investor-perspective/index.html
grep -q 'Why Kungfu Origin can lead without owning KFD.' public/capital/investor-perspective/index.html
grep -q 'Where the thesis stands today.' public/capital/investor-perspective/index.html
grep -q 'Capital should change the rate of execution, not the source of legitimacy.' public/capital/investor-perspective/index.html
grep -q 'preserving the option not to raise is more valuable.' public/capital/investor-perspective/index.html
assert_before public/capital/investor-perspective/index.html 'Why Kungfu Origin can lead without owning KFD.' 'Evidence before narrative'
assert_before public/capital/investor-perspective/index.html 'Where the thesis stands today.' 'Why capital'
assert_before public/capital/investor-perspective/index.html 'Why capital' 'Cross-border reality'
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
grep -q 'https://kungfu.tech/install.sh' public/install/index.html
grep -q 'https://kungfu.tech/install.ps1' public/install/index.html
grep -q '<title>Get Kungfu | Kungfu UNGFU™</title>' public/install/index.html
grep -q '<h1>Get Kungfu.</h1>' public/install/index.html
grep -q '<h2>Desktop GUI</h2>' public/install/index.html
grep -q 'Agent Work Management' public/install/index.html
if grep -qi 'Mission Control\\|Agent Qualification Lab\\|Work graph' public/install/index.html; then
  echo "Get Kungfu must describe stable user value without internal product-route names" >&2
  exit 1
fi
grep -q 'No public GUI download is released today.' public/install/index.html
grep -q '<h2>Command Line</h2>' public/install/index.html
grep -q 'id="command-line"' public/install/index.html
grep -q 'bootstrap-publication:start' public/install/index.html
grep -q 'bootstrap-publication:end' public/install/index.html
if [ -f public/installer-publication.json ]; then
  grep -q 'is publicly available.' public/install/index.html
  grep -q 'data-ungfu-release-acquisition' public/install/index.html
  grep -q 'Kungfu UNGFU™' public/install/index.html
  grep -q 'Downloadable software for durable AI-agent work, inspection, and development workflows.' public/install/index.html
  grep -q 'href="https://kungfu.tech/install.sh"' public/install/index.html
  grep -q 'Qualified targets:' public/install/index.html
  test -f public/.well-known/kungfu/alpha.json
  test -f public/manifest.json
  test -f public/install.sh
  test -f public/install.ps1
  test -f public/.well-known/kungfu/ungfu-release-acquisition.json
else
  grep -q 'Public installer not released yet.' public/install/index.html
  grep -q 'machine-readable <code>unavailable</code> result' public/install/index.html
  test -f public/install.sh
  test -f public/install.ps1
  unavailable_json='{"schema":"kungfu.bootstrap-installer-availability/v1","status":"unavailable","reason":"no-qualified-cli-publication","documentationUrl":"https://kungfu.tech/install/"}'
  shell_output=$(sh public/install.sh 2>&1) && {
    echo "error: unavailable POSIX installer must exit nonzero" >&2
    exit 1
  }
  test "$shell_output" = "$unavailable_json"
  grep -Fxq "[Console]::Out.WriteLine('${unavailable_json}')" public/install.ps1
  grep -Fq "throw 'Kungfu CLI bootstrap installer is unavailable" public/install.ps1
  if grep -q 'data-ungfu-release-acquisition' public/install/index.html; then
    echo "error: pre-release install page must not project released acquisition evidence" >&2
    exit 1
  fi
fi
grep -q 'shared-header:start' public/install/index.html
grep -q 'shared-footer:start' public/install/index.html
grep -q 'shared-header:start' public/agent-builders/index.html
grep -q 'shared-footer:start' public/agent-builders/index.html
grep -q 'Build your Hub. Don&rsquo;t rebuild the runtime.' public/agent-builders/index.html
grep -q 'href="/agent-builders/hub-starter/">Open Hub Starter</a>' public/agent-builders/index.html
grep -q 'KFD in one sentence' public/agent-builders/index.html
grep -q 'KFD&mdash;Kung Fu Decisions&mdash;is an open engineering standard' public/agent-builders/index.html
grep -q 'href="https://kfd.libkungfu.dev/">Understand KFD</a>' public/agent-builders/index.html
grep -q 'href="https://kfd.libkungfu.dev/3/usage/">Implement KFD-3</a>' public/agent-builders/index.html
grep -q 'Kungfu does not compete for your Hub.' public/agent-builders/index.html
grep -q 'Your users stay yours.' public/agent-builders/index.html
grep -q 'Your accounts and billing stay yours.' public/agent-builders/index.html
grep -q 'Your models, UI, and Agent stay yours.' public/agent-builders/index.html
grep -q 'Your cloud stays yours.' public/agent-builders/index.html
grep -q 'Your customer relationship stays yours.' public/agent-builders/index.html
grep -q 'KFD requires no central Kungfu cloud.' public/agent-builders/index.html
grep -q '<strong><a href="https://kfd.libkungfu.dev/">KFD · open protocol</a></strong>' public/agent-builders/index.html
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
assert_before public/agent-builders/index.html 'id="kfd-primer-heading"' 'id="adoption-tradeoff-heading"'
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
grep -q 'Ask the installed product first.' public/agent-builders/index.html
grep -q 'href="/agent-hub/">Open the executable proof path</a>' public/agent-builders/index.html
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
grep -q 'Audit the exact Agent Hub alpha profile' public/agent-builders/index.html
grep -q 'github.com/kungfu-systems/kungfu/pull/1171' public/agent-builders/index.html
grep -q 'github.com/kungfu-systems/buildchain/pull/1435' public/agent-builders/index.html
grep -q 'https://libkungfu.dev/dogfood/' public/agent-builders/index.html
grep -q 'https://libkungfu.dev/dogfood-evidence.json' public/agent-builders/index.html
grep -q 'id="dogfood-bootstrap-link" href="/about/bootstrapping/evidence/"' public/agent-builders/index.html
grep -q 'Read the bounded bootstrap interpretation' public/agent-builders/index.html
grep -q 'shared-header:start' public/agent-builders/hub-starter/index.html
grep -q 'shared-footer:start' public/agent-builders/hub-starter/index.html
grep -q 'See a real Hub before you build your own.' public/agent-builders/hub-starter/index.html
grep -q 'Apache-2.0 course-business reference' public/agent-builders/hub-starter/index.html
grep -q 'role="tablist" aria-label="Hub Starter command mode"' public/agent-builders/hub-starter/index.html
grep -q 'data-command-tab="install"' public/agent-builders/hub-starter/index.html
grep -q 'data-command-tab="update"' public/agent-builders/hub-starter/index.html
grep -q 'data-command-panel="update" hidden' public/agent-builders/hub-starter/index.html
test "$(grep -c '<button class="copy-button"' public/agent-builders/hub-starter/index.html)" -eq 4
grep -q 'src="/assets/command-copy.js" defer' public/agent-builders/hub-starter/index.html
grep -q 'navigator.clipboard.writeText' public/assets/command-copy.js
grep -q 'button.textContent = "Copied"' public/assets/command-copy.js
grep -q 'button.setAttribute("aria-label", "Command copied")' public/assets/command-copy.js
grep -q 'docker compose -f oci://ghcr.io/kungfu-systems/runtime-images/hub-starter:compose-preview up --wait' public/agent-builders/hub-starter/index.html
grep -q 'HUB_PORT=9090 docker compose' public/agent-builders/hub-starter/index.html
grep -q 'PostgreSQL · private network only' public/agent-builders/hub-starter/index.html
grep -q 'Mock by default' public/agent-builders/hub-starter/index.html
grep -q 'Update the image without losing your courses.' public/agent-builders/hub-starter/index.html
grep -q 'up --pull always --wait' public/agent-builders/hub-starter/index.html
grep -q 'compose-v&lt;VERSION&gt;' public/agent-builders/hub-starter/index.html
grep -q 'do not run <code>docker compose down -v</code>' public/agent-builders/hub-starter/index.html
grep -q 'docs/UPGRADING.md' public/agent-builders/hub-starter/index.html
grep -q 'The product, the model, and the work runtime are separate authorities.' public/agent-builders/hub-starter/index.html
grep -q 'Ask your Agent to explain the repository first.' public/agent-builders/hub-starter/index.html
grep -q 'kungfu agent brief' public/agent-builders/hub-starter/index.html
grep -q 'Not claimed by this alpha' public/agent-builders/hub-starter/index.html

if grep -RIn 'Kungfu v4\\|Developer substrate\\|substrate view\\|developer substrate' public; then
  echo "error: public copy contains internal or uncommon product wording" >&2
  exit 1
fi

if [ -d dist ]; then
  node scripts/fingerprint-site-assets.mjs --root dist --check
  node scripts/check-copyable-code.mjs --root dist
  test -f dist/index.html
  test -s dist/favicon.ico
  node -e 'const b = require("node:fs").readFileSync("dist/favicon.ico"); if (b.length < 6 || b.readUInt16LE(0) !== 0 || b.readUInt16LE(2) !== 1 || b.readUInt16LE(4) < 1) process.exit(1)'
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
  test -f dist/why-kungfu/index.html
  test -f dist/assets/site.css
  test -f dist/assets/proof-reel-state.js
  test -s dist/assets/fonts/instrument-sans-latin-wght-normal.6219bc4b.woff2
  test -s dist/assets/fonts/ibm-plex-mono-latin-400-normal.c36f509c.woff2
  test -s dist/assets/fonts/ibm-plex-mono-latin-600-normal.ad4580d8.woff2
  test -s dist/assets/fonts/ibm-plex-mono-latin-700-normal.9e1455e6.woff2
  test -f dist/.well-known/security.txt
  test -f dist/about/index.html
  test -f dist/about/bootstrapping/index.html
  test -f dist/about/bootstrapping/evidence/index.html
  test -f dist/about/bootstrapping/evidence/data/manifest.json
  test -f dist/about/bootstrapping/evidence/data/collect.mjs
  test -f dist/about/bootstrapping/evidence/data/summary.json
  test -f dist/about/bootstrapping/evidence/data/pull-requests.json
  test -f dist/about/bootstrapping/evidence/data/closed-issues.json
  test -f dist/about/bootstrapping/evidence/data/releases.json
  test -f dist/about/bootstrapping/evidence/data/repositories.json
  test -f dist/about/bootstrapping/evidence/data/workload-analysis.md
  test -f dist/capital/index.html
  test -f dist/capital/investor-perspective/index.html
  test -f dist/services/index.html
  test -f dist/trust/index.html
  test -f dist/legal/index.html
  grep -q "Your agents don't hand off the&nbsp;work. You&nbsp;do." dist/index.html
  grep -q 'Every switch means copying context, re-explaining decisions, chasing updates, and checking what got lost.' dist/index.html
  grep -q 'Can Work survive a new Agent?' dist/index.html
  grep -q 'Can Work survive failure?' dist/index.html
  grep -q 'Who is allowed to complete Work?' dist/index.html
  grep -q 'data-demo-carousel' dist/index.html
  grep -q 'data-demo-title="The pain" data-active' dist/index.html
  grep -q 'data-demo-slide data-demo-title="Continuity"' dist/index.html
  grep -q 'data-demo-slide data-demo-title="Failure retention"' dist/index.html
  grep -q 'data-demo-slide data-demo-title="Review and settlement"' dist/index.html
  grep -q 'The problem · 1 of 4' dist/index.html
  grep -q 'data-carousel-previous' dist/index.html
  grep -q 'data-carousel-playback' dist/index.html
  grep -q 'data-carousel-next' dist/index.html
  grep -q 'data-proof-video data-passive-proof controls muted playsinline preload="none"' dist/index.html
  grep -q 'exact standalone Kungfu artifact proves only' dist/index.html
  if grep -q 'class="continuity-demo"\|Same task. New chat. No re-explanation.' dist/index.html; then
    echo "error: dist homepage still contains the retired static continuity card" >&2
    exit 1
  fi
  grep -q 'How continuity was tested' dist/how-tested/continuity/index.html
  grep -q 'Watch the artifact explain itself.' dist/how-tested/auditable-demo/index.html
  grep -q 'Kungfu does not compete for your Hub.' dist/agent-builders/index.html
  grep -q 'When Agents learn to recognize better software, they start creating demand for it.' dist/agent-supply-chain/index.html
  grep -q 'One useful product can change what an Agent expects.' dist/agent-supply-chain/index.html
  grep -q 'Agent-assisted activation' dist/agent-supply-chain/index.html
  grep -q 'The product has already been chosen.' dist/agent-supply-chain/index.html
  grep -q 'Agent-mediated distribution' dist/agent-supply-chain/index.html
  grep -q 'The Agent can help make the choice.' dist/agent-supply-chain/index.html
  grep -q 'One useful product' dist/agent-supply-chain/index.html
  grep -q 'One onboarded Agent' dist/agent-supply-chain/index.html
  grep -q 'One new expectation' dist/agent-supply-chain/index.html
  grep -q 'The Agent is no longer just an operator. It becomes a distribution channel.' dist/agent-supply-chain/index.html
  grep -q 'Because the Work stays with the product—not the chat—every new Agent can inspect it, continue it, and recognize the difference.' dist/agent-supply-chain/index.html
  grep -q 'Kungfu can leave the center. The loop keeps compounding.' dist/agent-supply-chain/index.html
  grep -q '02 · The self-accelerating market' dist/agent-supply-chain/index.html
  grep -q 'Ignition only' dist/agent-supply-chain/index.html
  grep -q 'No Kungfu dependency inside the cycle' dist/agent-supply-chain/index.html
  grep -q 'Agents recommend. Humans or Hubs authorize.' dist/agent-supply-chain/index.html
  grep -q 'Each new Agent-native product can restart the same loop without routing through Kungfu.' dist/agent-supply-chain/index.html
  grep -q 'Self-accelerating is not self-starting.' dist/agent-supply-chain/index.html
  grep -q 'Every product still needs a first introduction and explicit authorization.' dist/agent-supply-chain/index.html
  grep -q 'Once you see the loop, the infrastructure stops looking abstract.' dist/agent-supply-chain/index.html
  grep -q 'How does an Agent know what a product can do?' dist/agent-supply-chain/index.html
  grep -q 'How does it assess what the product claims?' dist/agent-supply-chain/index.html
  grep -q 'How do builders ship those qualities in an exact release?' dist/agent-supply-chain/index.html
  grep -q 'How can bounded Work move across independently governed Agent Hubs?' dist/agent-supply-chain/index.html
  grep -q 'Explore KFD-3' dist/agent-supply-chain/index.html
  grep -q 'Explore KFD-2' dist/agent-supply-chain/index.html
  grep -q 'Explore Buildchain' dist/agent-supply-chain/index.html
  grep -q 'Explore Agent Hub' dist/agent-supply-chain/index.html
  grep -q 'Enabled, not claimed.' dist/agent-supply-chain/index.html
  grep -q '04 · The evidence behind the thesis' dist/agent-supply-chain/index.html
  grep -q 'Five responsibilities. Independent owners.' dist/agent-supply-chain/index.html
  assert_before dist/agent-supply-chain/index.html 'Change what good software feels like.' 'Agent-assisted activation'
  assert_before dist/agent-supply-chain/index.html 'Agent-mediated distribution' 'The Agent is no longer just an operator. It becomes a distribution channel.'
  assert_before dist/agent-supply-chain/index.html 'The Agent is no longer just an operator. It becomes a distribution channel.' 'Kungfu can leave the center. The loop keeps compounding.'
  assert_before dist/agent-supply-chain/index.html 'Kungfu can leave the center. The loop keeps compounding.' 'Once you see the loop, the infrastructure stops looking abstract.'
  assert_before dist/agent-supply-chain/index.html 'Once you see the loop, the infrastructure stops looking abstract.' 'Five responsibilities. Independent owners.'
  grep -q 'kungfu-agent-supply-chain-public-narrative/v1' dist/agent-supply-chain.json
  grep -q 'kungfu-agent-supply-chain-reader-progression/v1' dist/agent-supply-chain.json
  grep -q 'kungfu-agent-mediated-distribution-boundary/v1' dist/agent-supply-chain.json
  grep -q 'kungfu-agent-native-product-loop/v1' dist/agent-supply-chain.json
  grep -q 'kungfu-agent-native-market-ignition/v1' dist/agent-supply-chain.json
  grep -q 'kungfu-agent-native-market-flywheel/v1' dist/agent-supply-chain.json
  grep -q '"id": "work-advisory"' dist/agent-supply-chain.json
  grep -q '"id": "builder-response"' dist/agent-supply-chain.json
  grep -q '"id": "buildchain-supply"' dist/agent-supply-chain.json
  if grep -q 'Kungfu manages the Agent\|When Kungfu launches an Agent' dist/agent-supply-chain/index.html dist/agent-supply-chain.json; then
    echo "error: Agent Supply Chain still contains the retired managed-Agent bootstrap" >&2
    exit 1
  fi
  grep -q '"label": "KFD-3"' dist/agent-supply-chain.json
  grep -q '"label": "KFD-2"' dist/agent-supply-chain.json
  grep -q '30-day assessment' dist/agent-supply-chain/index.html
  grep -q 'external vendor adoption or endorsement' dist/agent-supply-chain/index.html
  grep -q "Ask Kungfu to prove its Agent Hub capability." dist/agent-hub/index.html
  grep -q 'kungfu agent hub qualify --output-dir ./kungfu-agent-hub-check' dist/agent-hub/index.html
  grep -q 'What does it not mean?' dist/agent-hub/index.html
  grep -q 'kungfu-agent-hub-public-entry/v1' dist/agent-hub.json
  grep -q '"run": "kungfu agent hub qualify --output-dir <new-directory>"' dist/agent-hub.json
  grep -q 'Machine route: https://kungfu.tech/agent-hub.json' dist/llms.txt
  grep -q 'property="og:title" content="Agent Supply Chain | Kungfu UNGFU™"' dist/agent-supply-chain/index.html
  grep -q '<title>Kungfu UNGFU™ — Continuity for Agent Work</title>' dist/index.html
  grep -q 'aria-label="Kungfu UNGFU™"' dist/index.html
  grep -q '^# Kungfu UNGFU™$' dist/llms.txt
  grep -q '"signature": "Kungfu UNGFU™"' dist/agent-hub.json
  grep -q 'Authenticode is not a qualification requirement for this Alpha.' dist/install/index.html
  grep -q 'Maturity claims matrix' dist/agent-supply-chain/index.html
  grep -q 'Exact evidence' dist/agent-supply-chain/index.html
  grep -q 'Known limit' dist/agent-supply-chain/index.html
  if sed -E 's#<code>[^<]*</code>##g; s#href="[^"]*"##g' dist/agent-supply-chain/index.html | grep -Eq '\bkfd-[0-9]'; then
    echo "error: Agent Supply Chain reader contains lowercase KFD prose" >&2
    exit 1
  fi
  grep -q 'two public strategic axes' dist/llms.txt
  grep -q 'When Agents learn to recognize better software, they start creating demand for it.' dist/llms.txt
  if grep -q 'When Agents can recognize better software, they can create the market for it.' dist/agent-supply-chain/index.html dist/llms.txt; then
    echo "error: Agent Supply Chain still contains the retired market-creation headline" >&2
    exit 1
  fi
  grep -q 'How Kungfu ignites the first loop' dist/llms.txt
  grep -q 'Agent-first activation starts after a product is chosen.' dist/llms.txt
  grep -q 'Because the Work stays with the product—not the chat—every new Agent can inspect it, continue it, and recognize the difference.' dist/llms.txt
  grep -q 'The self-accelerating market' dist/llms.txt
  grep -q 'Every product still needs a first introduction and explicit authorization.' dist/llms.txt
  if grep -q 'self-running market' dist/agent-supply-chain/index.html dist/llms.txt; then
    echo "error: Agent Supply Chain still uses the overstated self-running market label" >&2
    exit 1
  fi
  grep -q 'The infrastructure questions' dist/llms.txt
  grep -q 'KFD-3 \[proved-now\]' dist/llms.txt
  grep -q 'KFD-2 \[proved-now\]' dist/llms.txt
  grep -q 'npm:@kungfu-tech/kfd@1.0.0-alpha.41' dist/llms.txt
  grep -q 'Never Guess. Facts Unfold.' dist/index.html
  grep -q 'The name did not begin as an acronym.' dist/why-kungfu/index.html
  grep -q 'being prepared' dist/index.html
  grep -q 'Kungfu Origin Technology Limited' dist/index.html
  grep -q 'libkungfu.dev' dist/about/index.html
  grep -q 'One human organized the work. Agents executed it.' dist/about/bootstrapping/evidence/index.html
  grep -q 'kungfu.bootstrap-public-work-evidence/v1' dist/about/bootstrapping/evidence/data/manifest.json
  grep -q '"featurePrefixedPullRequests": 200' dist/about/bootstrapping/evidence/data/manifest.json
  grep -q '"relationship": "maintained-evidence-chain"' dist/about/bootstrapping/evidence/data/manifest.json
  grep -q '"claimBoundary": "The rolling dogfood record does not establish one-human bootstrap causality."' dist/about/bootstrapping/evidence/data/manifest.json
  grep -q 'How an open protocol can create commercial value.' dist/capital/investor-perspective/index.html
  grep -q 'Kungfu Origin Technology Limited is incorporated in Hong Kong.' dist/capital/investor-perspective/index.html
  grep -q 'Buildchain release passport' dist/trust/index.html
  grep -q 'Privacy posture' dist/legal/index.html
fi

echo "site-kungfu-tech checks passed"
