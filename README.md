# site-kungfu-tech

Source for the Kungfu product home at `https://kungfu.tech`.

This repository manages the public site content only. It does not contain AWS
credentials, private release material, or unpublished product commitments.

## Policy

- Keep the site free of email addresses and direct mail links.
- Keep the v4 copy aligned with the public positioning: local-first,
  journal-first, agent-native, and auditable.
- Treat `main` as the production source of truth after deployment automation is
  enabled.
- Record production object versions and CloudFront invalidation IDs in release
  notes or deployment records.

## Local Check

```bash
corepack pnpm@11.7.0 install --frozen-lockfile --ignore-scripts --registry=https://registry.npmjs.org/
bash scripts/build-site.sh
bash scripts/check-site.sh
```

Header and footer content is generated from `site/shared-layout.json`. Update
that file first, then run the build so every page receives the same navigation
and footer.

## White Paper

The white paper pages are generated from the exact npm artifact
`@kungfu-tech/paper-kungfu-product-white-paper@0.1.0-alpha.1`. The upstream
`site/brand-site.json` bundle owns the title, product claims, selected sections,
routes, and evidence links. The upstream publication manifest owns the PDF
digest and source commit. This repository owns only the site layout, navigation,
responsive presentation, and machine entry rendering.

Generated routes:

- `/whitepaper/`
- `/whitepaper/kungfu-real-world-agent-work/`
- `/whitepaper/kungfu-real-world-agent-work.pdf`
- `/whitepaper/manifest.json`
- `/whitepaper/llms.txt`

The renderer keeps `kungfu.tech` links on the current preview, staging, or
production origin. Cross-site evidence links remain canonical.

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
repository commits `.buildchain/contract-lock.json` so the floating `@v2`
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
