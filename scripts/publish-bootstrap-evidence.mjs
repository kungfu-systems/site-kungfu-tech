#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const sourceRoot = path.join(
  repoRoot,
  "docs/research/2026-07-20-kungfu-systems-public-work-week",
);
const outputRoot = path.join(
  repoRoot,
  "dist/about/bootstrapping/evidence/data",
);
const publicRoot = "/about/bootstrapping/evidence/data";

const sourceFiles = [
  "collection.json",
  "summary.json",
  "pull-requests.json",
  "closed-issues.json",
  "releases.json",
  "repositories.json",
  "collect.mjs",
  "README.md",
  "workload-analysis.md",
];

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(sourceRoot, name), "utf8"));
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

const collection = readJson("collection.json");
const summary = readJson("summary.json");
const pullRequests = readJson("pull-requests.json");
const closedIssues = readJson("closed-issues.json");
const releases = readJson("releases.json");
const repositories = readJson("repositories.json");

const expectedTotals = {
  pullRequests: pullRequests.length,
  closedIssues: closedIssues.length,
  releases: releases.length,
  repositories: repositories.length,
};

for (const [name, expected] of Object.entries(expectedTotals)) {
  if (summary.totals[name] !== expected) {
    throw new Error(
      `bootstrap evidence mismatch: summary.totals.${name}=${summary.totals[name]}, expected ${expected}`,
    );
  }
}

if (
  summary.window.start !== collection.window.start ||
  summary.window.end !== collection.window.end
) {
  throw new Error("bootstrap evidence mismatch: summary and collection windows differ");
}

const featurePrefixedPullRequests = pullRequests.filter((pullRequest) =>
  /^feat(?:\([^)]*\))?:/i.test(pullRequest.title),
).length;

fs.mkdirSync(outputRoot, { recursive: true });
for (const name of sourceFiles) {
  fs.copyFileSync(path.join(sourceRoot, name), path.join(outputRoot, name));
}

const files = sourceFiles.map((name) => {
  const filePath = path.join(outputRoot, name);
  return {
    name,
    url: `${publicRoot}/${name}`,
    bytes: fs.statSync(filePath).size,
    sha256: sha256(filePath),
  };
});

const manifest = {
  schema: "kungfu.bootstrap-public-work-evidence/v1",
  page: "https://kungfu.tech/about/bootstrapping/evidence/",
  organization: collection.organization,
  window: collection.window,
  collectedAt: collection.collectedAt,
  statementBoundary: {
    publiclyVerifiable: [
      "Public GitHub accounts and repository identities",
      "Pull request, issue, release, timestamp, author, merge, and size metadata in the sample",
    ],
    firstPartyDeclaration: [
      "One human independently organized the entire body of work represented by the sample",
      "Software Agents performed the operational execution under human direction, judgment, and authority",
      "The Agent toolset included Codex, Claude, Cursor, Amp, and other mainstream Agent systems",
    ],
    notEstablished: [
      "That no second human contributed",
      "That the bootstrap method caused the observed output",
      "That the method is superior or generally applicable",
      "That every visible capability has equal depth, maturity, or user value",
    ],
  },
  mechanicalSummary: {
    ...summary.totals,
    featurePrefixedPullRequests,
    featurePrefixRule: "case-insensitive conventional title prefix: feat: or feat(scope):",
  },
  interpretation: {
    warning:
      "Merged pull requests are not independent features and must not be converted directly into labor.",
    invitation:
      "Reproduce the totals, choose different classifications, compare the visible functions with your own organization, and publish independent findings.",
  },
  files,
};

fs.writeFileSync(
  path.join(outputRoot, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);

console.log(`published bootstrap evidence: ${files.length} source files + manifest`);
