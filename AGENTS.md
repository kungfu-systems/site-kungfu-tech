# AGENTS.md

This file orients coding agents and people working in `site-kungfu-tech`.
It is a router, not a duplicate of the project documentation.

## What this repository owns

`site-kungfu-tech` renders the public Kungfu product home at
`https://kungfu.tech`.

The repository owns site content, static assets, local build scripts, and the
Buildchain caller workflow. It does not own AWS infrastructure lifecycle,
private credentials, DNS policy, or product facts that belong to upstream
Kungfu packages and specifications.

## Use the site

- Start at [`README.md`](README.md) for the local build and site policy.
- Use [`docs/deploy.md`](docs/deploy.md) for the Buildchain release model.
- Use [`docs/rollback.md`](docs/rollback.md) for content rollback notes.

## Change the site

Run the local checks before opening a pull request:

```sh
corepack pnpm@11.7.0 install --frozen-lockfile --ignore-scripts --registry=https://registry.npmjs.org/
bash scripts/build-site.sh
bash scripts/check-site.sh
```

White paper product facts and the PDF come from the pinned
`@kungfu-tech/paper-kungfu-product-white-paper` package. Keep rendering and
navigation in this repository; do not copy upstream paper content into local
HTML source.

Keep the GitHub workflow thin: site releases should call the shared Buildchain
`web-surface` workflow rather than copying deployment internals into this
repository.

## Boundaries

- Do not commit AWS credentials, GitHub tokens, private release material, or
  signed URLs.
- Do not change DNS, ACM, CloudFront aliases, bucket policies, or IAM resources
  from this repository.
- Production apply must stay approval-gated through Buildchain. A merged
  `buildchain-release` pull request is the normal production approval path.
