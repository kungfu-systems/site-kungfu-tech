# Deploy

Production deploy is modeled as an explicit Buildchain release operation. It
must be triggered manually from the GitHub Actions `Buildchain Web Surface`
workflow with `production_approved=true`; ordinary pull requests and pushes to
`main` do not publish production.

The AWS resource contract is owned by the private
`kungfu-systems/infra-kungfu-sites` repository and mirrored into this repository
as `infra/outputs.json`. Site changes may update content, Buildchain wiring, and
the mirrored outputs after an infra change, but CloudFormation templates and AWS
resource lifecycle decisions belong in the infra repository.

Default automation:

- Pull requests run Buildchain v2.4 web-surface planning and verification.
- Pushes to `main` run staging planning and verification.
- Preview, preview cleanup, and staging apply stay disabled in this repository
  workflow.
- Production apply is disabled by default and can run only through
  `workflow_dispatch` when `production_approved=true`.

Production apply prerequisites:

1. The GitHub OIDC role must exist in AWS Global with write access limited to the
   `kungfu-tech-site-727884401362-us-east-1` bucket and CloudFront distribution
   `E204MRW1P4Z1G9`.
2. The workflow must run from `main`, or from a reviewed release ref when that
   policy is added.
3. The Buildchain production plan must bind the source SHA, artifact hash,
   production bucket, CloudFront distribution, actor, run id, and rollback
   pointer.
4. The Buildchain production apply summary must record the manifest key and
   CloudFront invalidation evidence.

Release command shape:

```sh
gh workflow run buildchain-web-surface.yml \
  --repo kungfu-systems/site-kungfu-tech \
  --ref main \
  -f production_approved=true
```

Do not run the release command until the production role exists and the release
operator has reviewed the dry-run/preflight evidence.

Do not store AWS access keys or session tokens in this repository.
