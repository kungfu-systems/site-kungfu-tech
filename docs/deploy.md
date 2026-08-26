# Deploy

Production deploy is modeled as an explicit Buildchain release operation. It
is approved by merging a final release pull request. The GitHub merge button is
the human approval act; Buildchain then verifies that the `main` push came from
a same-repository, merged pull request labeled `buildchain-release` whose head
branch starts with `feature/release-`, and only then applies production.

The AWS resource contract is owned by the private
`kungfu-systems/infra-kungfu-sites` repository and mirrored into this repository
as `infra/outputs.json`. Site changes may update content, Buildchain wiring, and
the mirrored outputs after an infra change, but CloudFormation templates and AWS
resource lifecycle decisions belong in the infra repository.

## GitHub Pages Disaster Mirror

`https://kungfu.systems` is a non-canonical disaster mirror, not another
Buildchain channel. `.github/workflows/pages-disaster-mirror.yml` reacts only
to a successful GitHub `production` deployment status or an exact manual
replay. Before Pages receives any bytes, it proves that the source run is a
successful `Buildchain Web Surface` push on `main`, the deployment status came
from that run, and the run contains exactly one production Release Passport
and one artifact. The projector recomputes Buildchain's artifact hash and
requires it to match the passport.

The projected output preserves `kungfu.tech` canonical URLs, adds
`noindex,follow` and a visible disaster banner to duplicate HTML pages, and
writes a public status document plus SHA-256 sidecar. The unique `/incident/`
entry is `index,follow`, self-canonical, and the only URL in `sitemap.xml`;
`robots.txt` keeps duplicate pages crawlable so their `noindex` directives can
be observed. A scheduled readback verifies this discovery boundary over public
HTTP as well as routes, canonical links, banners, status, and status digest.

Incident entry:

1. Verify the primary from more than one network.
2. Open `https://kungfu.systems/incident/` and inspect
   `/.well-known/kungfu-mirror-status.json`.
3. Use the mirror only for read-only documentation and downloads.
4. Do not infer primary health or release qualification from mirror health.
5. Return readers to the primary after recovery. DNS enable/disable steps are
   owned by the infrastructure repository runbook.

Default automation:

- Pull requests run Buildchain v3 web-surface planning, verification, and
  preview apply for `pr-N.preview.kungfu.tech`.
- Fork pull requests still build and plan, but skip AWS-backed preview apply
  because GitHub does not provide OIDC identity to fork events.
- Preview uses the existing `site-kungfu-tech-preview-prefix` CloudFront
  Function as an external directory-index and alias-prefix router. Do not
  replace that viewer-request association with the Buildchain directory-index
  function unless Buildchain also owns the preview alias-prefix routing logic.
- Preview therefore keeps `directory_index_rewrite = "external"`. Staging and
  Production use Buildchain-managed directory-index rewrites.
- Preview, Staging, and Production serve `/install.sh` and `/install.ps1` from
  the exact web-surface artifact. The build verifies the pinned Alpha.3
  Buildchain-sealed publication bundle, then projects its exact installer bytes,
  signed channel, immutable evidence path, and release-status record into that
  artifact. The site never redirects the convenience routes to an unverified
  upstream URL.
- Closing or merging a pull request runs preview cleanup for the PR alias.
- Ordinary pushes to `main` run staging planning, verification, and apply to
  `https://staging.kungfu.tech`.
- Staging is protected by managed network access, not a Buildchain-managed
  Basic Auth secret.
- Release PR pages show the staging review URL. After staging is verified,
  merging the release PR is the production approval event.
- Release PR merges into `main` run production planning and apply.
- Manual `workflow_dispatch` with `production_approved=true` remains available
  as an explicit operator fallback. Production fallback dispatches must also
  provide the exact reviewed `activation_source_sha`, select the `production`
  environment, and provide the activation transaction root. Partial or
  shadow-labeled production coordinates fail before Buildchain is invoked.

The build installs the exact KFD, Buildchain, and paper packages from
`pnpm-lock.yaml`. It renders the publication catalog from package-owned facts
and copies the product white paper PDF only after its digest matches the
upstream Buildchain publication manifest. Research-paper readers and evidence
retain their canonical `papers.libkungfu.dev` routes.

Production apply prerequisites:

1. The GitHub OIDC role must exist in AWS Global with write access limited to the
   `kungfu-tech-site-727884401362-us-east-1` bucket and CloudFront distribution
   `E204MRW1P4Z1G9`.
2. The release pull request must be same-repository, merged into `main`, labeled
   `buildchain-release`, and use a `feature/release-*` source branch.
3. The Buildchain production plan must bind the source SHA, artifact hash,
   production bucket, CloudFront distribution, actor, run id, and rollback
   pointer.
4. The Buildchain production apply summary must record the manifest key and
   CloudFront invalidation evidence.

Release PR shape:

```sh
git switch -c feature/release-YYYYMMDD-topic
git push origin feature/release-YYYYMMDD-topic
gh pr create --base main --head feature/release-YYYYMMDD-topic --label buildchain-release
```

After the release PR checks pass, merging that PR publishes production. Do not
merge the release PR until the production role exists and the release operator
has reviewed staging from the release PR page plus the Buildchain plan and
preflight evidence.

Manual fallback:

```sh
gh workflow run buildchain-web-surface.yml \
  --repo kungfu-systems/site-kungfu-tech \
  --ref main \
  -f production_approved=true \
  -f activation_source_sha=<exact-reviewed-40-character-sha> \
  -f activation_environment=production \
  -f activation_transaction_root=sha256:<activation-transaction-root>
```

The caller requires `activation_source_sha` to equal the dispatch context's
immutable `github.sha`; Buildchain v3 derives its production checkout from that
same context rather than accepting a separate source override. After deploy and
public read-back, `/.well-known/kungfu-release-status.json` is the canonical
truthful status record and can be checked with `kungfu release status`.

Do not store AWS access keys or session tokens in this repository.

## Buildchain Runtime Management

The repository uses the canonical Buildchain `.buildchain/` layout:

- `.buildchain/buildchain.toml` is the web-surface configuration.
- `.buildchain/contract-lock.json` and `.buildchain/alpha-contract-lock.json`
  retain the accepted v3 compatibility contracts.
- The caller workflow pins the reusable workflow shell to one exact reviewed
  Buildchain commit and leaves `buildchain-ref` unset so the runtime resolves
  from that same shell without invoking the manual-override path. Updating the
  shell is a reviewed activation change, not a floating production mutation.

Root-level `buildchain.toml` and `buildchain.contract-lock.json` are legacy
layout files and should not be reintroduced.

Local planning with a reviewed Buildchain checkout:

```bash
BUILDCHAIN_DIR=/path/to/buildchain
bash scripts/build-site.sh
node "$BUILDCHAIN_DIR/scripts/web-surface.mjs" --mode validate --cwd .
node "$BUILDCHAIN_DIR/scripts/web-surface.mjs" --mode deploy-plan --cwd . --channel preview --source-sha "$(git rev-parse HEAD)"
node "$BUILDCHAIN_DIR/scripts/web-surface.mjs" --mode deploy-plan --cwd . --channel staging --source-sha "$(git rev-parse HEAD)"
node "$BUILDCHAIN_DIR/scripts/web-surface.mjs" --mode deploy-plan --cwd . --channel production --source-sha "$(git rev-parse HEAD)"
node "$BUILDCHAIN_DIR/scripts/web-surface.mjs" --mode cleanup-plan --cwd . --channel preview --pull-number 3 --source-sha "$(git rev-parse HEAD)" --dry-run false
```
