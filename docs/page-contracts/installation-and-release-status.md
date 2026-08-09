# Installation and Release Status Contract

The committed `/install/` route reflects the current reviewed publication
transaction. It presents Kungfu v4.0.0-alpha.1 as the first public v4 Alpha,
with exact acquisition evidence, while preserving the boundary that an Alpha
is neither stable nor generally available.

`site/installer-publication-source.json` is the only site-owned publication pin
consumed by the build. While it declares `unavailable`, local and deployment
builds must preserve non-installing scripts and must not expose installer files
or imply released acquisition evidence.

The machine-readable release truth is available at
`/.well-known/kungfu-release-status.json`. An installed Kungfu can explain it:

```sh
kungfu release status
kungfu release explain
```

The first command reports whether the current release has passed publication,
site read-back, and installed-product qualification. The second preserves the
boundary that this evidence is not a trademark registration, legal conclusion,
or first-use-date claim.

When no reviewed publication is active, the endpoint must return `unavailable`;
it must never infer a release from source files or a candidate manifest.

## Activation Boundary

A separately reviewed site pull request may change the publication pin to
`available` only when it names an exact Kungfu GitHub Release manifest
digest/root and a complete Buildchain read-back seal.

`scripts/consume-installer-publication-bundle.mjs` downloads the closed-world
bundle, rejects unsafe paths, duplicate entries, byte/MIME/cache drift, missing
seal coverage, and authority mismatch, then passes the verified local bundle to
`scripts/import-bootstrap-publication.mjs`.

Kungfu's publication workflow must not check out, mutate, commit, push, or
deploy this repository.

After the site-owned consumer verifies and imports a signed Alpha publication,
it may replace only the bounded publication block with:

- the adjacent **Kungfu UNGFU™** mark;
- a plain downloadable-software description;
- the exact version and channel; and
- a working installer action.

The same import writes immutable acquisition HTML and JSON under
`/evidence/ungfu/alpha/<version>/<channel-root>/`, plus a mutable discovery
pointer and current release-status record under `/.well-known/kungfu/`. These
records preserve exact product and site source SHAs, channel, artifact, Release
Passport, and acquisition roots, without making first-use or legal conclusions.
