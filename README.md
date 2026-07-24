# site-kungfu-tech

Source for the Kungfu product home at `https://kungfu.tech`.

This repository manages the public site content only. It does not contain AWS
credentials, private release material, or unpublished product commitments.

The product white-paper package owns the cross-product Agent Supply Chain
narrative contract. This site owns composition, navigation, and rendering at
`/agent-supply-chain/`; it does not duplicate KFD decisions, Buildchain release
mechanics, or Kungfu runtime qualification as local facts. Human and machine
views are generated together at `/agent-supply-chain/` and
`/agent-supply-chain.json`.

The route deliberately establishes the reader's mental model before revealing
the complete five-layer mechanism. It first explains the shift from human-led
tool operation to Agent-mediated tool selection inside explicit human and Hub
authority; then the selection advantage of Agent-first software; then the
bootstrap by which a Kungfu-managed Agent discovers the exact installed
collaboration surface and release evidence from a compact Skill envelope; then
the conditional Kungfu and Buildchain distribution flywheel. Only after those
premises are established does it render the upstream-owned KFD-3, Buildchain,
KFD-2, libkungfu, and Agent Hub portability layers. The bootstrap must preserve
the cold-start boundary: Kungfu still has to earn the first adoption by solving
a concrete problem in durable Agent work. The site owns this reading progression
and its visual composition. The white-paper package continues to own the
cross-product layer facts, evidence coordinates, maturity classes, known limits,
and adoption boundaries. Human-facing KFD names are always rendered in
uppercase; lowercase layer IDs remain stable machine identifiers.

## Policy

- Keep the site free of email addresses and direct mail links.
- Keep the v4 copy aligned with the public positioning: local-first,
  journal-first, agent-native, and auditable.
- Treat `main` as the production source of truth after deployment automation is
  enabled.
- Record production object versions and CloudFront invalidation IDs in release
  notes or deployment records.

## About And Bootstrapping

The concise `/about/` route owns the public product, protocol, commercial, and
stewardship boundary. `/about/bootstrapping/` is the deeper interpretive route:
it explains the Session-to-Work shift, constrained agent authority, the
self-bootstrap, and Kungfu's structural debt to Douglas Engelbart without
turning that tribute into an endorsement or a claim of direct succession.

The essay must remain safe for public reading. It may cite public Kungfu, KFD,
Buildchain, and Engelbart sources, but it must not expose private coordination
systems, internal paths, private work records, or unpublished operating detail.
It must also preserve the maturity ladder: design intent, merged mechanisms,
qualified evidence, released products, and independent adoption are distinct.
The reader prompt asks an agent to explain and challenge the argument, not to
accept it.

## Local Check

```bash
corepack pnpm@11.7.0 install --frozen-lockfile --ignore-scripts --registry=https://registry.npmjs.org/
bash scripts/build-site.sh
bash scripts/check-site.sh
```

Header and footer content is generated from `site/shared-layout.json`. Update
that file first, then run the build so every page receives the same navigation
and footer.

## Capital & Stewardship

The Capital section has two deliberate reading layers. `/capital/` is Kungfu's
stable statement of principles for any future relationship with capital.
`/capital/investor-perspective/` is the corresponding investor-side framework:
what is being underwritten, how a public protocol can support company value,
which evidence would strengthen that thesis, and which risks and capabilities
belong in investor fit. The homepage remains product-first, while its
"Open core. Commercial stewardship." section presents Capital & Stewardship as
a prominent, explanatory call to action. About and the shared footer provide
stable secondary discovery. The page is not a financing announcement or
securities offer and must not contain an amount, valuation, pricing,
allocation, timetable, subscription mechanics, or transaction terms.

The page keeps three goals visible together: global credibility for KFD,
commercial durability and expansion capacity for Kungfu Origin, and long-term
freedom of action for the project's author, stewards, and wider system. It must
continue to distinguish non-negotiable public-protocol boundaries from the
commercial and institutional capabilities that a compatible capital partner
could add. Any statement about entity structure, intellectual-property
ownership, trademarks, protocol governance, investor rights, or a specific
transaction requires separate verification and professional review.

The Investor Perspective route must keep the value chain conditional: public
KFD credibility can enable independent adoption and a larger Agent supply-chain
market, which can create demand that Kungfu Origin may capture through products,
enterprise delivery, support, execution, and reputation. It must not claim that
independent Hubs, broad adoption, or resulting demand already exist, and it must
not present KFD control, exclusivity, or customer lock-in as a source of return.

The route also carries an explicit cross-border disclosure: Kungfu's founder
and current steward is a citizen of the People's Republic of China, and Kungfu
Origin Technology Limited is incorporated in Hong Kong. It describes potential
diligence, regulatory, institutional-policy, and geopolitical friction without
classifying any transaction as permitted, prohibited, restricted, or notifiable.
Any real transaction remains subject to current, transaction-specific
professional legal, regulatory, tax, and national-security review. Public links
to official U.S. sources provide diligence context only. The page must not offer
securities or publish financing terms, and it must reject concealment, sham
relocation, nationality-only conclusions, and geopolitical arguments for taking
control of the public protocol.

## Agent Builders

The `/agent-builders/` route is a primary path from the homepage header and
hero. The homepage keeps the continuity-first message concise and leaves the
adoption architecture to that dedicated route. The Builder route first gives
KFD a one-sentence, site-owned reader definition and links the canonical KFD
overview and KFD-3 implementation guidance. It then establishes the adoption
decision before asking readers to decode the architecture: a Hub still works
locally without KFD, but each external Hub otherwise needs a custom bridge; with
KFD, one responsibility boundary can work across conforming Hubs. The compact
Builder contract then makes the ownership boundary explicit:
Builders retain their users, accounts, billing, models, UI, Agent, cloud,
policy, and customer relationship; KFD needs no central Kungfu cloud; and
libkungfu remains a public local capability layer rather than a route into the
host product.

Four numbered chapters continue that causal path. Chapter 01 shows where
libkungfu and KFD sit between independently owned Hubs. Chapter 02 explains why
interoperability must preserve responsibility rather than merely move an RPC
payload, walks one release action from coordinates through admission, and only
then exposes the full local action model. Chapter 03 shows one auditable work
unit before aggregate dogfood metrics. Chapter 04 keeps the current claim
boundary visible and ends with one bounded reference action. This progression
is a site-owned reader contract; it must remain protocol definition → adoption
decision → ownership → topology → responsibility → concrete action → evidence
→ bounded adoption. The canonical KFD protocol authority remains
`kfd.libkungfu.dev`; this site supplies only the product-context primer and
reading paths. Exact runtime, package, qualification, and claim status remain
owned by the reviewed `site-libkungfu-dev` projection and its source
authorities. Until that site's production release is approved, this repository
links the exact source-bound fixture instead of publishing a parallel version
ledger or a staging URL.

The upstream KFD site bundle also generates `/agent-hub/` and
`/agent-hub.json`. These routes expose the direct installed-product command,
offline recheck command, fixed suite count, ownership boundary, and exact
non-certifying claim boundary. The human route answers the four immediate
questions; the JSON route and `/llms.txt` tell an Agent when to invoke the
command and require it to preserve the emitted meaning and non-claims. This
repository does not duplicate the suite or qualification verdict.

## Papers

The publication catalog is generated from exact npm artifacts:

- `@kungfu-tech/paper-kungfu-product-white-paper@0.1.0-alpha.10`
- `@kungfu-tech/paper-kfd-foundation-real-world-agent-work@0.1.0-alpha.7`
- `@kungfu-tech/paper-observer-declared-timelines@0.1.0-alpha.8`
- `@kungfu-tech/paper-episodes-to-primitives@0.1.0-alpha.2`

The catalog preserves this reader order: White Paper, Foundation Model,
Observer, then Episodes. The White Paper is the product-level thesis and uses
an explicit label, distinct card treatment, and dedicated primary action; the
other entries are labeled Research Paper so the catalog cannot be mistaken for
four equivalent academic papers.

The product white paper's upstream `site/brand-site.json` bundle owns its
selected HTML reader content. Every paper's publication manifest owns its title,
abstract, PDF digest, source commit, canonical route, and evidence links. The
catalog also renders source-contract facts from `@kungfu-tech/kfd@1.0.0-alpha.47`
and `@kungfu-tech/buildchain@2.14.14-alpha.4`. This repository owns only site layout,
navigation, responsive presentation, and machine entry rendering.

Generated routes:

- `/whitepaper/`
- `/whitepaper/kungfu-white-paper/`
- `/whitepaper/kungfu-white-paper.pdf`
- `/whitepaper/manifest.json`
- `/whitepaper/catalog.json`
- `/whitepaper/llms.txt`
- `/agent-hub/`
- `/agent-hub.json`
- `/llms.txt`

The product white paper keeps its `kungfu.tech` reader on the active preview,
staging, or production origin. Research papers retain their canonical
`papers.libkungfu.dev` readers and evidence paths.

## Buildchain

This site is a Buildchain `web-surface` project. Pull requests and pushes use
the shared Buildchain v2 web-surface workflow for the standard release flow:
feature PRs publish preview, normal merges publish staging, and release PR
pages show the staging review URL before production approval. Production apply
is owned by Buildchain release PR semantics: a pull request labeled
`buildchain-release` from a `feature/release-*` branch becomes the production
approval when it is merged into `main`. Manual workflow dispatch with
`production_approved=true` remains available as an explicit operator fallback.

Staging is protected by managed network access, not by a Buildchain-managed
Basic Auth secret.

Preview keeps `directory_index_rewrite = "external"` because the preview
CloudFront distribution already uses `site-kungfu-tech-preview-prefix` to route
`pr-N.preview.kungfu.tech` host aliases into matching S3 prefixes. Staging and
production use Buildchain-managed directory index rewrites.

The AWS delivery contract is mirrored in `infra/outputs.json` from the private
`kungfu-systems/infra-kungfu-sites` repository. `bash scripts/check-site.sh`
verifies that `.buildchain/buildchain.toml` and the GitHub Actions role assumptions still
match that contract, that preview and staging apply are enabled through the
shared Buildchain workflow, and that production apply remains bound to
Buildchain release PR semantics.

Buildchain is managed through the canonical `.buildchain/` layout. The
repository commits `.buildchain/contract-lock.json` so the floating `@v2-alpha`
workflow can detect compatible or breaking Buildchain runtime drift before
build, deploy planning, or apply.

```bash
BUILDCHAIN_DIR=/path/to/buildchain
bash scripts/build-site.sh
node "$BUILDCHAIN_DIR/scripts/web-surface.mjs" --mode validate --cwd .
node "$BUILDCHAIN_DIR/scripts/web-surface.mjs" --mode deploy-plan --cwd . --channel preview --source-sha "$(git rev-parse HEAD)"
node "$BUILDCHAIN_DIR/scripts/web-surface.mjs" --mode deploy-plan --cwd . --channel staging --source-sha "$(git rev-parse HEAD)"
node "$BUILDCHAIN_DIR/scripts/web-surface.mjs" --mode deploy-plan --cwd . --channel production --source-sha "$(git rev-parse HEAD)"
node "$BUILDCHAIN_DIR/scripts/web-surface.mjs" --mode cleanup-plan --cwd . --channel preview --pull-number 3 --source-sha "$(git rev-parse HEAD)" --dry-run false
```

## Current Production

- Domain: `https://kungfu.tech`
- AWS account: Global `727884401362`
- Region for regional resources: `us-east-1`
- Origin bucket: `kungfu-tech-site-727884401362-us-east-1`
- CloudFront distribution: `E204MRW1P4Z1G9`
- GitHub OIDC role: `site-kungfu-tech-production-github-actions`
