# Agent Builders Contract

`Agent Builders` is the implementation-facing continuation of the homepage and
Agent Supply Chain thesis. It translates demand for Agent-native software into
a bounded adoption model for product teams.

## Routes

- `/agent-builders/` explains the adoption architecture and ownership boundary.
- `/agent-builders/hub-starter/` provides a runnable Apache-2.0 course-business
  reference with one-command OCI Compose startup, in-place image refresh, and
  exact-version rollback guidance.
- `/agent-hub/` retains the installed Kungfu capability proof.
- `/agent-hub.json` is its machine-readable companion.

## Reader Progression

The overview first gives KFD a one-sentence, site-owned reader definition and
links to the canonical KFD overview and KFD-3 implementation guidance. It then
establishes the adoption decision before presenting the architecture:

- A Hub can operate locally without KFD.
- Without KFD, each external Hub requires a custom bridge.
- With KFD, one responsibility boundary can operate across conforming Hubs.

The page then makes ownership explicit. Builders retain their users, accounts,
billing, models, UI, Agent, cloud, policy, and customer relationship. KFD
requires no central Kungfu cloud. libkungfu is a public local capability layer,
not a route into the host product.

Four numbered chapters continue the sequence:

1. Show where libkungfu and KFD sit between independently owned Hubs.
2. Explain why interoperability must preserve responsibility, walk one release
   action from coordinates through admission, and then expose the local action
   model.
3. Show one auditable Work unit before aggregate dogfood metrics.
4. Preserve the current claim boundary and finish with one bounded reference
   action.

The complete reader contract is:

```text
protocol definition -> adoption decision -> ownership -> topology ->
responsibility -> concrete action -> evidence -> bounded adoption
```

## Authority Boundary

The canonical KFD protocol authority is
[`kfd.libkungfu.dev`](https://kfd.libkungfu.dev). This site supplies product
context and reading paths only. Exact runtime, package, qualification, and claim
status come from the reviewed `site-libkungfu-dev` projection and its source
authorities; do not create a parallel version ledger here.

The upstream KFD site bundle generates `/agent-hub/` and `/agent-hub.json` with
the direct installed-product command, offline recheck command, suite count,
ownership boundary, and non-certifying claim boundary. The human route answers
the immediate questions. The JSON route and `/llms.txt` tell an Agent when to
invoke the command and require it to preserve the emitted meaning and
non-claims. This repository does not duplicate the qualification verdict.
