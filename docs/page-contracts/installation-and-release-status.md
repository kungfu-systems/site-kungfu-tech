# Installation and Release Status Contract

The committed `/install/` route reflects the current reviewed publication
transaction. It presents Kungfu v4.0.0-alpha.3 as the current public v4 Alpha,
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
it may replace only the bounded publication block. The human route presents
the shortest useful acquisition path first:

- the exact version and channel;
- the macOS/Linux and Windows command-line installers, with copy actions;
- platform-selectable Desktop GUI downloads derived from the verified signed
  channel rather than handwritten release links; and
- a compact, version-independent first-project-use notice that routes readers
  to Kungfu's canonical `.kungfu/` Git publication boundary instead of asking
  them to infer which workspace files belong in Git; and
- the **Kungfu UNGFU™** mark, acquisition description, SHA-256 values, Release
  Passport, and immutable evidence below the primary installation actions.

The macOS/Linux convenience command stays compact as
`curl -fsSL https://kungfu.tech/install.sh | sh`. The fetched site-owned shell
installer is the byte-exact projection of the pinned, Buildchain-sealed Alpha.3
publication after its signed bundle is verified. The PowerShell route is a
fail-closed Site-only compatibility projection: it is admitted only for the
exact Alpha.3 source digest, performs one checked replacement required by
PowerShell variable syntax, and publishes both the source and projected digest
in `/.well-known/kungfu/installer-compatibility.json`. The exact upstream
PowerShell bytes remain under the upstream immutable path. Both routes retain
the release-channel, platform, artifact, digest, Release Passport, and product
bootstrap-verification bindings; shortening the invocation must not weaken
those checks.

## Alpha.3 Publication Transaction

The Alpha.3 projection retains the release-owned qualified targets—macOS
arm64, Linux arm64/x64, and Windows x64—under the upstream immutable
`/installers/v1/alpha/4.0.0-alpha.3/` path. Its per-user installers verify the
signed channel bytes, trusted key, artifact digest, manifest root, artifact
root, platform trust, and product version before activation. Any byte, identity,
or target-closure mismatch fails closed.

The Desktop GUI selector may use the browser's operating-system hints to choose
the initial macOS, Linux, or Windows panel. Unsupported or ambiguous clients
retain the markup default. Automatic selection must not remove the other
platform choices, steal focus, or weaken mouse and keyboard tab navigation.

The same import writes immutable acquisition HTML and JSON under
`/evidence/ungfu/alpha/<version>/<channel-root>/`, plus a mutable discovery
pointer and current release-status record under `/.well-known/kungfu/`. These
records preserve exact product and site source SHAs, channel, artifact, Release
Passport, and acquisition roots, without making first-use or legal conclusions.
