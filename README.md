# site-kungfu-tech

Source for the public Kungfu product home at [kungfu.tech](https://kungfu.tech).

## Disaster Mirror

[`mirror.kungfu.tech`](https://mirror.kungfu.tech) is the stable, read-only
disaster mirror. During a declared primary-site incident, start at
[`/incident/`](https://mirror.kungfu.tech/incident/) and inspect the public
source binding at
[`/.well-known/kungfu-mirror-status.json`](https://mirror.kungfu.tech/.well-known/kungfu-mirror-status.json).

The mirror never deploys from an ordinary branch build. It accepts only the
exact artifact and production Release Passport from the same successful
Buildchain production workflow run, then adds a visible disaster banner,
`noindex`, and canonical links back to `kungfu.tech`. Mirror availability is
not production, certification, qualification, security, SLA, or fitness
evidence, and AWS remains the canonical production delivery path.

This repository owns the site's content, composition, navigation, static assets,
local build scripts, and thin Buildchain caller. It does not own AWS
infrastructure lifecycle, credentials, private release material, or product
facts that belong to upstream Kungfu packages and specifications.

## Product Reading Path

The public site follows one deliberate progression:

1. The homepage begins with the human cost of switching Agents while manually
   carrying context, decisions, status, and missing details between them.
2. [Agent Supply Chain](https://kungfu.tech/agent-supply-chain/) explains how
   persistent, product-owned Work can turn continuity into demand for
   Agent-native software.
3. [Agent Builders](https://kungfu.tech/agent-builders/) shows product teams how
   to adopt that model without surrendering their users, Agents,
   infrastructure, billing, or customer relationships.

Kungfu is the ignition source in this account, not the permanent center of the
market. Once Agents can recognize better software, builders can receive that
demand signal, Buildchain can help products ship assessable KFD declarations
and evidence, and more Agent-native products can reach more Agents.

Detailed, reviewable page contracts live under
[`docs/page-contracts/`](docs/page-contracts/README.md). Keep those contracts
aligned with the rendered human routes and their machine-readable companions.

## Source-of-Truth Boundaries

| Concern | Authority |
| --- | --- |
| Site composition, navigation, responsive presentation, and reader progression | This repository |
| Shared header and footer | [`site/shared-layout.json`](site/shared-layout.json) |
| Agent Supply Chain cross-product facts and maturity boundaries | Product white-paper package |
| KFD protocol definitions | [`kfd.libkungfu.dev`](https://kfd.libkungfu.dev) and exact KFD packages |
| Buildchain release mechanics and source cards | Exact Buildchain package and reusable workflow |
| Paper metadata, PDFs, digests, and evidence | Exact `@kungfu-tech/paper-*` artifacts |
| AWS resource lifecycle | Private `infra-kungfu-sites` repository; mirrored coordinates in `infra/outputs.json` |

Do not copy upstream publication, protocol, qualification, or release-system
facts into handwritten site content. Consume exact package-owned bundles and
preserve their evidence and non-claim boundaries.

## Local Development

Prerequisites: Corepack and a Node.js version compatible with pnpm 11.

```bash
corepack pnpm@11.7.0 install --frozen-lockfile --ignore-scripts --registry=https://registry.npmjs.org/
bash scripts/build-site.sh
bash scripts/check-site.sh
```

The build writes the static site to `dist/`. The check script validates the
rendered routes, source-bound publication facts, shared layout, release
boundaries, and Buildchain contract.

For shared navigation or footer changes, edit `site/shared-layout.json` first
and rebuild so every page receives the same layout.

## Repository Map

```text
.buildchain/        Buildchain web-surface configuration and contract locks
.github/            Pull request and reusable workflow entrypoints
docs/               Page contracts, deployment, and rollback guidance
infra/outputs.json  Mirrored AWS delivery coordinates
scripts/            Importers, renderers, build scripts, and checks
site/               Site-owned source pins, descriptors, and shared layout
dist/               Generated static site output
```

Start with:

- [`docs/page-contracts/README.md`](docs/page-contracts/README.md) for the
  product and page reading contracts.
- [`docs/deploy.md`](docs/deploy.md) for preview, staging, and production
  release semantics.
- [`docs/rollback.md`](docs/rollback.md) for content rollback.
- [`AGENTS.md`](AGENTS.md) for repository ownership and contribution
  boundaries.

## Site Policy

- Keep the site free of email addresses and direct mail links.
- Keep public copy aligned with the local-first, journal-first, Agent-native,
  and auditable positioning.
- Preserve the distinction between design intent, merged mechanisms, qualified
  evidence, released products, and independent adoption.
- Treat `main` as the deployed source of truth. Normal merges publish staging;
  Production remains approval-gated by the Buildchain release-PR flow.
- Record Production object versions and CloudFront invalidation IDs in release
  notes or deployment records, not in this README.
- Do not expose credentials, signed URLs, private coordination systems,
  internal paths, or unpublished product commitments.

## Release Summary

Pull requests build and publish a preview when credentials are available.
Normal merges publish staging. Production requires merging a separately
reviewed `buildchain-release` pull request from a `feature/release-*` branch.
Manual dispatch remains an explicit operator fallback.

See [`docs/deploy.md`](docs/deploy.md) for the complete release contract and
current infrastructure coordinates.
