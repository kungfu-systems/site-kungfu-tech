#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

const proof = JSON.parse(fs.readFileSync("site/public-dogfood-proof.json", "utf8"));
const page = fs.readFileSync("public/agent-builders/index.html", "utf8");

assert.equal(proof.schema, "kungfu.tech/public-dogfood-proof/v2");
assert.equal(proof.projection.mode, "client-latest");
assert.equal(proof.projection.fallback, "retained-copy");
for (const forbidden of ["snapshotId", "window", "metrics", "sourceCommit", "sourceFixtureSha256", "publishedEvidenceSha256"]) {
  assert.ok(!(forbidden in proof) && !(forbidden in proof.upstream), `downstream proof must not pin ${forbidden}`);
}
assert.deepEqual(proof.boundaries, [
  "pull-request-not-feature",
  "author-account-not-agent-actor",
  "review-search-not-approval",
]);

assert.ok(page.includes('fetch("https://libkungfu.dev/dogfood-evidence.json"'), "page must project the upstream latest channel");
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

console.log("public dogfood proof valid: upstream latest projection");
