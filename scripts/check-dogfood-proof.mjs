#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

const proof = JSON.parse(fs.readFileSync("site/public-dogfood-proof.json", "utf8"));
const page = fs.readFileSync("public/agent-builders/index.html", "utf8");

assert.equal(proof.schema, "kungfu.tech/public-dogfood-proof/v1");
assert.equal(
  Date.parse(proof.window.endInclusive) - Date.parse(proof.window.startInclusive),
  30 * 24 * 60 * 60 * 1000,
  "dogfood proof window must span exactly 30 days",
);
assert.match(proof.upstream.sourceCommit, /^[0-9a-f]{40}$/);
assert.match(proof.upstream.evidenceSha256, /^[0-9a-f]{64}$/);
assert.deepEqual(proof.boundaries, [
  "pull-request-not-feature",
  "author-account-not-agent-actor",
  "review-search-not-approval",
]);

for (const value of Object.values(proof.metrics)) {
  assert.ok(page.includes(new Intl.NumberFormat("en-US").format(value)), `missing dogfood metric: ${value}`);
}
for (const requiredText of [
  "The mechanism is building Kungfu itself.",
  "Public work → exact Cut → independent review → release",
  "A PR is a work item, not a feature count.",
  "An account is not an Agent actor.",
  "A review-search match is not an approval.",
]) {
  assert.ok(page.includes(requiredText), `missing dogfood proof text: ${requiredText}`);
}
for (const url of [proof.upstream.humanPage, proof.upstream.machineEvidence]) {
  assert.ok(page.includes(url), `missing dogfood proof URL: ${url}`);
}

console.log(`public dogfood proof valid: ${proof.snapshotId}`);
