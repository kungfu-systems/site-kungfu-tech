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
bash scripts/build-site.sh
bash scripts/check-site.sh
```

## Buildchain

This site is a Buildchain `web-surface` project. Pull requests use the shared
Buildchain v2.4 web-surface workflow for mutation-free preview, cleanup,
staging, and production plans. Live apply remains disabled by default.

Staging is protected by managed network access, not by a Buildchain-managed
Basic Auth secret.

The AWS delivery contract is mirrored in `infra/outputs.json` from the private
`kungfu-systems/infra-kungfu-sites` repository. `bash scripts/check-site.sh`
verifies that `buildchain.toml` and the GitHub Actions role assumptions still
match that contract, and that the shared workflow keeps apply switches off by
default.

```bash
BUILDCHAIN_DIR=/path/to/buildchain
bash scripts/build-site.sh
node "$BUILDCHAIN_DIR/scripts/web-surface.mjs" --mode validate --cwd .
node "$BUILDCHAIN_DIR/scripts/web-surface.mjs" --mode deploy-plan --cwd . --channel preview --source-sha "$(git rev-parse HEAD)"
node "$BUILDCHAIN_DIR/scripts/web-surface.mjs" --mode deploy-plan --cwd . --channel staging --source-sha "$(git rev-parse HEAD)"
node "$BUILDCHAIN_DIR/scripts/web-surface.mjs" --mode cleanup-plan --cwd . --channel preview --pull-number 3 --source-sha "$(git rev-parse HEAD)" --dry-run false
```

## Current Production

- Domain: `https://kungfu.tech`
- AWS account: Global `727884401362`
- Region for regional resources: `us-east-1`
- Origin bucket: `kungfu-tech-site-727884401362-us-east-1`
- CloudFront distribution: `E204MRW1P4Z1G9`
