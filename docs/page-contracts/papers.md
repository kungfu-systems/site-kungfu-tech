# Papers Contract

The publication catalog is generated from exact npm artifacts:

- `@kungfu-tech/paper-kungfu-product-white-paper@0.1.0-alpha.14`
- `@kungfu-tech/paper-kfd-machine-life-roadmap@0.1.0-alpha.11`
- `@kungfu-tech/paper-kfd-foundation-real-world-agent-work@0.1.0-alpha.8`
- `@kungfu-tech/paper-observer-declared-timelines@0.1.0-alpha.9`
- `@kungfu-tech/paper-episodes-to-primitives@0.1.0-alpha.2`

The standalone Agent Supply Chain page retains the structured narrative
snapshot from White Paper `0.1.0-alpha.10`, pinned through an npm alias, because
the `0.1.0-alpha.14` brand and evidence bundles no longer export that
presentation contract. White Paper pages, PDF, metadata, and evidence use
`0.1.0-alpha.14` exclusively.

The `0.1.0-alpha.14` tarball authenticates its current brand and evidence
bundles inside the package-owned publication source archive even though those
files are absent from the top-level package tree. The renderer verifies each
extracted byte sequence against that version's publication-registry metadata;
it never falls back to an older unverified presentation bundle.

## Human and Machine Catalogs

The human page presents the two defining papers:

- the White Paper as Kungfu now; and
- Machine Life as Kungfu's future direction.

They use distinct but paired card treatments and route deeper research to
[`papers.libkungfu.dev`](https://papers.libkungfu.dev). The machine catalog and
Agent entrypoint retain the complete package-backed set so existing consumers
do not lose exact publication facts.

Package-owned site bundles own selected reader content. Publication manifests
own titles, abstracts, PDF digests, source commits, canonical routes, and
evidence links. The catalog also renders source-contract facts from
`@kungfu-tech/kfd@1.0.0-alpha.47` and `@kungfu-tech/buildchain@3.0.3`. This
repository owns layout, navigation, responsive presentation, and machine entry
rendering only.

## Generated Routes

- `/whitepaper/`
- `/whitepaper/kungfu-white-paper/`
- `/whitepaper/kungfu-white-paper.pdf`
- `/whitepaper/kungfu-machine-life/`
- `/whitepaper/kungfu-machine-life.pdf`
- `/whitepaper/kungfu-machine-life/manifest.json`
- `/whitepaper/kungfu-machine-life/llms.txt`
- `/whitepaper/manifest.json`
- `/whitepaper/catalog.json`
- `/whitepaper/llms.txt`
- `/agent-hub/`
- `/agent-hub.json`
- `/llms.txt`

White Paper and Machine Life readers remain on the active preview, staging, or
Production `kungfu.tech` origin. Publication evidence and immutable archives
remain on `papers.libkungfu.dev`; supporting research papers retain their
canonical readers there.
