# Deploy

Production deploy is modeled as an explicit Buildchain release operation. It
is approved by merging a final release pull request. The GitHub merge button is
the human approval act; Buildchain then verifies that the `main` push came from
a same-repository, merged pull request labeled `buildchain-release` whose head
branch starts with `release/`, and only then applies production.

The AWS resource contract is owned by the private
`kungfu-systems/infra-kungfu-sites` repository and mirrored into this repository
as `infra/outputs.json`. Site changes may update content, Buildchain wiring, and
the mirrored outputs after an infra change, but CloudFormation templates and AWS
resource lifecycle decisions belong in the infra repository.

Default automation:

- Pull requests run Buildchain `@v2` web-surface planning, verification, and
  preview apply for `pr-N.preview.kungfu.tech`.
- Closing or merging a pull request runs preview cleanup for the PR alias.
- Ordinary pushes to `main` run staging planning, verification, and apply to
  `https://staging.kungfu.tech`.
- Release PR pages show the staging review URL. After staging is verified,
  merging the release PR is the production approval event.
- Release PR merges into `main` run production planning and apply.
- Manual `workflow_dispatch` with `production_approved=true` remains available
  as an explicit operator fallback.

Production apply prerequisites:

1. The GitHub OIDC role must exist in AWS Global with write access limited to the
   `kungfu-tech-site-727884401362-us-east-1` bucket and CloudFront distribution
   `E204MRW1P4Z1G9`.
2. The release pull request must be same-repository, merged into `main`, labeled
   `buildchain-release`, and use a `release/` source branch.
3. The Buildchain production plan must bind the source SHA, artifact hash,
   production bucket, CloudFront distribution, actor, run id, and rollback
   pointer.
4. The Buildchain production apply summary must record the manifest key and
   CloudFront invalidation evidence.

Release PR shape:

```sh
git switch -c release/production-<source-sha>
git push origin release/production-<source-sha>
gh pr create --base main --head release/production-<source-sha> --label buildchain-release
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
  -f production_approved=true
```

Do not store AWS access keys or session tokens in this repository.
