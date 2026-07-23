#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

const proof = JSON.parse(fs.readFileSync("site/public-dogfood-proof.json", "utf8"));
const page = fs.readFileSync("public/agent-builders/index.html", "utf8");

assert.equal(proof.schema, "kungfu.tech/public-dogfood-proof/v3");
assert.equal(proof.projection.mode, "verified-parent-bridge");
assert.equal(proof.projection.fallback, "retained-copy");
for (const forbidden of ["snapshotId", "window", "metrics", "sourceCommit", "sourceFixtureSha256", "publishedEvidenceSha256"]) {
  assert.ok(!(forbidden in proof) && !(forbidden in proof.upstream), `downstream proof must not pin ${forbidden}`);
}
assert.deepEqual(proof.boundaries, [
  "pull-request-not-feature",
  "author-account-not-agent-actor",
  "review-search-not-approval",
]);

for (const bridgeContract of [
  'data-src="https://libkungfu.dev/dogfood/?projection=kungfu-tech"',
  '"kungfu.dogfood.timeline/v1"',
  '"kungfu.dogfood.timeline.request/v1"',
  '"kungfu.dogfood.snapshot.request/v1"',
  '"kungfu.dogfood.snapshot.response/v1"',
  'event.origin !== "https://libkungfu.dev" || event.source !== bridge.contentWindow',
]) {
  assert.ok(page.includes(bridgeContract), `page must enforce dogfood projection bridge contract: ${bridgeContract}`);
}
assert.match(
  page,
  /\.dogfood-history-controls, \.dogfood-metrics,[\s\S]{0,160}\.kfd-primer \{\n        grid-template-columns: 1fr;/,
  "mobile layout must preserve both dogfood history controls and the KFD primer after mainline integration",
);
for (const requiredText of [
  "The mechanism is building Kungfu itself.",
  "Public work → exact Cut → independent review → release",
  "Observation period",
  "Overlapping P30D windows—not new work in a week.",
  "A PR is a work item, not a feature count.",
  "An account is not an Agent actor.",
  "A review-search match is not an approval.",
]) {
  assert.ok(page.includes(requiredText), `missing dogfood proof text: ${requiredText}`);
}
for (const url of [proof.upstream.humanPage, proof.upstream.machineEvidence]) {
  assert.ok(page.includes(url), `missing dogfood proof URL: ${url}`);
}

console.log("public dogfood proof valid: upstream append-only history projection");
