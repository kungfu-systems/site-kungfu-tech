# Deploy

Production deploy currently uses the AWS Global account manually from the
trusted operator environment.

The AWS resource contract is owned by the private
`kungfu-systems/infra-kungfu-sites` repository and mirrored into this repository
as `infra/outputs.json`. Site changes may update content, Buildchain wiring, and
the mirrored outputs after an infra change, but CloudFormation templates and AWS
resource lifecycle decisions belong in the infra repository.

Planned automation:

1. Configure a GitHub OIDC role in AWS Global with write access limited to the
   `kungfu-tech-site-727884401362-us-east-1` bucket and CloudFront distribution
   `E204MRW1P4Z1G9`.
2. Add a manual `workflow_dispatch` release workflow.
3. Deploy only from `main` or an annotated release tag.
4. Record S3 object versions and CloudFront invalidation IDs after every
   production release.

Do not store AWS access keys or session tokens in this repository.
