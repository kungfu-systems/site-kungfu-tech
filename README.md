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
bash scripts/check-site.sh
```

## Current Production

- Domain: `https://kungfu.tech`
- AWS account: Global `727884401362`
- Region for regional resources: `us-east-1`
- Origin bucket: `kungfu-tech-site-727884401362-us-east-1`
- CloudFront distribution: `E204MRW1P4Z1G9`
