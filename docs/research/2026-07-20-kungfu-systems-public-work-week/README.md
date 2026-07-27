---
status: draft
period: 2026-07-20/2026-07-27
theme: kungfu-systems-public-work-evidence
doc_type: analysis
source_level: public-sources
confidence: medium
sensitivity: public
evidence_grade: A
review_state: unreviewed
last_reviewed: 2026-07-27
ai_provenance:
  model_family: GPT-5
  product_surface: Codex
  generated_at: 2026-07-27
  invisible_context_boundary: Public GitHub records do not expose private planning or human and Agent time.
---

# Kungfu Systems public work evidence · 2026-07-20 to 2026-07-27

This directory preserves the public GitHub evidence used to assess one week of
Kungfu Systems work. It is an auditable research cache, not an authoritative
statement of labor, productivity, or product maturity.

## Fixed window

- Start: `2026-07-19T16:00:00Z` (`2026-07-20 00:00` Asia/Shanghai)
- End: recorded in `collection.json`
- Organization: `kungfu-systems`

## Files

- `collection.json`: collection method, exact window, and interpretation limits
- `pull-requests.json`: merged PR metadata, including additions, deletions,
  changed files, commits, authors, reviewers, labels, and repository
- `closed-issues.json`: non-PR issues closed inside the window
- `releases.json`: public GitHub releases published inside the window
- `repositories.json`: repository metadata used to interpret the activity
- `summary.json`: mechanical totals by repository, Shanghai date, and author
- `workload-analysis.md`: human-readable grouping and conventional
  organization comparison

## Refresh

The collector requires an authenticated `gh` client with access to public
organization data:

```bash
KUNGFU_RESEARCH_START=2026-07-19T16:00:00Z \
KUNGFU_RESEARCH_END=2026-07-27T02:48:00Z \
node docs/research/2026-07-20-kungfu-systems-public-work-week/collect.mjs
```

Use a fixed end timestamp when reproducing an analysis. A later refresh is a
different observation and must update the recorded window.

## Interpretation boundary

Merged PR volume is not feature volume. Release trains can represent one
capability through several PRs, while a single feature PR can contain weeks of
work. Gross additions and deletions may include generated files, package locks,
and repeated propagation across release lines. Any human-equivalent estimate
must first group PRs into coherent work streams and distinguish implementation,
qualification, release propagation, and documentation.
