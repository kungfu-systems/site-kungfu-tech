---
status: draft
period: 2026-07-20/2026-07-27
theme: kungfu-systems-public-work-evidence
doc_type: analysis
source_level: public-sources
confidence: medium
sensitivity: public
evidence_grade: B
review_state: unreviewed
last_reviewed: 2026-07-27
ai_provenance:
  model_family: GPT-5
  product_surface: Codex
  generated_at: 2026-07-27
  invisible_context_boundary: The estimate cannot observe private planning, rejected candidates, or human and Agent time.
---

# Human-readable workload analysis

## Result first

The public output is not credibly comparable to one conventional team-week.
After discounting release propagation, generated material, and duplicate
delivery paths, the visible work still spans the responsibilities of several
connected functions: runtime and storage engineering, protocol and SDK design,
developer and human-facing product surfaces, release engineering, package
distribution, qualification, technical communication, research publication,
and repository governance.

A conventional organization would normally distribute those responsibilities
across several teams or named owners, then coordinate their dependency order
through product planning, architecture review, release management, and
acceptance. This report deliberately does not convert the record into a
person-month figure. Readers can compare the functions and dependencies with
their own organizations and make their own estimate.

## Mechanical scale

The exact collection window covers 178.8 hours from `2026-07-20 00:00`
Asia/Shanghai. Public GitHub records contain:

- 1,026 merged pull requests across 15 repositories;
- 5,501 commits represented by those PRs;
- 738,437 additions and 125,367 deletions across 14,005 changed-file
  occurrences;
- 112 GitHub releases;
- 59 closed non-PR issues.

These are gross activity measures. They contain release-line propagation,
generated files, package locks, repeated channel material, and occasionally two
PR records for one exact source change.

## Noise discount

Title-level mechanical classification finds:

- 305 release-propagation PRs;
- 72 release PRs;
- 24 version-preparation PRs;
- 200 feature PRs;
- 229 fix PRs;
- 47 documentation PRs;
- 23 CI PRs;
- 8 refactor PRs;
- 6 build or test PRs.

The 401 explicit release, promotion, and version-preparation PRs are evidence
that the release system was exercised, but they must not be counted as 401
independent capabilities.

The 200 feature PRs have a median of 868 additions and 16 changed files. The
229 fix PRs have a median of 35 additions and three changed files. This makes a
simple "many tiny automated PRs" explanation insufficient, while still leaving
line counts unsuitable as a labor conversion.

## Human-readable work streams

The visible output groups into ten connected programs:

1. **Native Work Runtime foundation** — Fact durability, Action Geometry,
   Domain Profiles, explicit apply authority, Work journals, Project Cut,
   Assignment orchestration, workspace federation, and mutation authority.
2. **Human product surfaces** — full-window TUI work, GUI/TUI projection,
   streamed qualification progress, live transcripts, and a unified
   qualification lab.
3. **Embedding and language boundaries** — a layered runtime SDK, KFD Agent
   Runtime adapters, OpenCode embedding and runners, portable packages, and a
   cross-language authority membrane.
4. **KFD and Agent Hub adoption** — Agent Hub and Runtime profiles, activation
   contracts, executable onboarding, first-party qualification, a clean-room
   demo, and standalone reference binaries.
5. **Buildchain release infrastructure** — exact-source release passports,
   governance receipts, ruleset rollback, cache policy, artifact recovery,
   signed installer publication, cross-repository activation, and v3 stable
   release lines.
6. **Alpha distribution** — signed CLI bootstrap installers, one-command and
   Homebrew updates, Core npm packages, portable format packages, Linux ARM64
   libnode, build images, and runtime starter inputs.
7. **Evidence and dogfood** — continuity fixtures, auditable demo artifacts,
   append-only dogfood projection, operational feedback intake, and retained
   release evidence.
8. **Public reader surfaces** — Agent Builder and supply-chain explanations,
   installation paths, Core Spec rendering, UNGFU brand alignment, and the
   agent-native bootstrap essay.
9. **Research publication** — the product white paper, KFD foundation paper,
   observer-declared timelines, and Episodes-to-Primitives publication
   updates.
10. **Repository and community governance** — distributed ADR identities,
    CODEOWNERS, read-only governance floors, community intake, first-party
    analytics, and automated drift feedback.

## Why the comparison is not PR-count multiplication

A conventional estimate must price coherent outcomes, not Git operations. The
same capability can appear as implementation, qualification, alpha promotion,
consumer propagation, repair, and release. Conversely, a single feature PR can
cross runtime code, tests, schemas, documentation, packages, and several
language surfaces.

The comparison therefore treats the public record as connected outcomes plus
integration, qualification, documentation, and release-system work. A
conventional organization would normally need distinct responsibility for:

- runtime and storage engineering;
- SDK and cross-language integration;
- developer experience, TUI, and GUI;
- release engineering, CI, SRE, and package distribution;
- protocol and conformance design;
- frontend, technical writing, and research publication;
- QA, security review, release management, and product decisions.

Parallel staffing can shorten implementation time, but it introduces
coordination and review latency. Runtime decisions affect protocol and SDK
surfaces; those surfaces affect qualification; qualification affects
distribution; and public claims depend on exact release evidence. The reader
should account for that ordering rather than multiplying PRs by an average
ticket size.

## What the record proves and does not prove

The public record strongly proves unusually broad and continuous production of
reviewable artifacts. Even after removing explicit release PRs, qualifying
feature, fix, documentation, CI, refactor, build, and test merges occurred in
all 24 Shanghai clock hours; this describes an automated and Agent-mediated
pipeline, not continuous human attention.

It does not prove:

- that every merged capability has equal depth or user value;
- that the resulting product is generally available or production mature;
- the number of Agents or human hours used;
- that a conventional team could not choose a narrower design;
- that minimal human staffing caused the output rather than merely coincided
  with it.

The data is therefore evidence of throughput, breadth, externalized release
mechanics, and auditability. It is not by itself causal proof of the bootstrap
thesis.
