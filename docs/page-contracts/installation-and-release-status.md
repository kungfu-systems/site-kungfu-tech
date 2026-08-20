# Installation and Release Status Contract

The committed `/install/` route reflects the current reviewed publication
transaction. It presents Kungfu v4.0.0-alpha.2 as the current public v4 Alpha,
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
`curl -fsSL https://kungfu.tech/install.sh | sh`. The fetched site-owned
installer is generated from `site/managed-installer-alpha2.json` only after the
signed publication bundle is verified. It retains the exact release-channel,
platform, artifact, digest, Release Passport, and product bootstrap-verification
bindings; shortening the invocation must not weaken those checks.

## Managed Alpha.2 Transaction

The exact Alpha.2 adapter is intentionally narrow: macOS arm64, glibc Linux
x64 with glibc 2.39 or newer, and Windows x64. Unsupported architecture and a
deterministically older Linux ABI fail before the archive download. The rooted
machine catalog is published at
`/.well-known/kungfu/managed-installer.json`; immutable copies of the catalog
and both generated scripts live under its `/installers/site/v1/alpha/` path.

The installer keeps archive downloads in a content-addressed per-user cache.
An interrupted transfer leaves its `.part` file for HTTP Range resume; retries
use bounded backoff, and a complete cache entry is reused only after exact byte
size and SHA-256 verification. Interactive sessions show transferred-byte
progress, while CI output stays at phase and retry boundaries.

Extraction is confined to one reviewed top-level directory. Exact archive
entry/link counts and relative paths are checked before extraction, and the
byte-exact signed archive digest binds the reviewed link topology. The complete
archive closure is installed under a versioned directory, then the bundled
`kungfu.release_channel.verify_bootstrap_candidate` hook checks the original
signed channel bytes, trusted key, manifest root, artifact root, platform trust,
and reported product version.

Alpha.2 needs one version-specific compatibility projection because the final
signed channel and the already-built CLI archives use two generations of field
shape. `site/managed-installer/alpha2-bootstrap-adapter.py` is digest-bound in
the catalog and permits only the reviewed `artifact.name` additions, combined
archive platform labels, and the exact Darwin bundled-to-signed identity
coordinate. It does not rewrite the channel, archive, or installed product
files. Ed25519 verification and all native archive/product checks still run on
the original inputs; the native bootstrap receipt and a separately rooted
adapter receipt are retained before activation. Any other channel root,
manifest root, target closure, field value, archive digest, or bundled identity
fails closed.

Only a verified version can become current. POSIX uses atomic `current` and
`previous` symbolic-link replacement; Windows uses atomic `current.path` and
`previous.path` coordinates plus an owned launcher. `--rollback` (or
`-Rollback`) verifies both the prior managed receipt and native bootstrap
receipt, then verifies the previous command before swapping it back. Failed
product verification cannot activate anything, and failed activation restores
the prior current command and launcher. Repeating an already-active exact
installation exits without downloading or mutating its installation.

`--dry-run` / `-DryRun` performs host selection and reports the exact plan but
does not create directories, download bytes, or change activation state.
Diagnostics retain distinct categories for host/ABI, download, size/digest,
archive safety/closure, product verification, ownership, activation, and
rollback failures.

The Desktop GUI selector may use the browser's operating-system hints to choose
the initial macOS, Linux, or Windows panel. Unsupported or ambiguous clients
retain the markup default. Automatic selection must not remove the other
platform choices, steal focus, or weaken mouse and keyboard tab navigation.

The same import writes immutable acquisition HTML and JSON under
`/evidence/ungfu/alpha/<version>/<channel-root>/`, plus a mutable discovery
pointer and current release-status record under `/.well-known/kungfu/`. These
records preserve exact product and site source SHAs, channel, artifact, Release
Passport, and acquisition roots, without making first-use or legal conclusions.
