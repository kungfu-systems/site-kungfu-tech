#!/usr/bin/env node
import fs from "node:fs";

const outputs = JSON.parse(fs.readFileSync("infra/outputs.json", "utf8"));
const buildchainToml = fs.readFileSync(".buildchain/buildchain.toml", "utf8");
const workflow = fs.readFileSync(".github/workflows/buildchain-web-surface.yml", "utf8");
const expectedBuildchainShellRef = "v2";
const expectedBuildchainShell = `kungfu-systems/buildchain/.github/workflows/.web-surface.yml@${expectedBuildchainShellRef}`;

function parseTomlSections(text) {
  const sections = {};
  let current = "";
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const section = line.match(/^\[([^\]]+)\]$/);
    if (section) {
      current = section[1];
      sections[current] = sections[current] || {};
      continue;
    }
    const pair = line.match(/^([A-Za-z0-9_-]+)\s*=\s*"(.*)"$/);
    if (pair && current) sections[current][pair[1]] = pair[2];
  }
  return sections;
}

function expectEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label} mismatch: expected ${expected}, got ${actual}`);
  }
}

if (outputs.contract !== "kungfu-site-infra-outputs") {
  throw new Error("infra outputs contract mismatch");
}
if (outputs.site !== "site-kungfu-tech") {
  throw new Error("infra outputs site mismatch");
}
if (fs.existsSync("buildchain.toml") || fs.existsSync("buildchain.contract-lock.json")) {
  throw new Error("legacy Buildchain root layout files are not allowed");
}
for (const [channel, lockPath, expectedRef] of [
  ["stable", ".buildchain/contract-lock.json", "v2"],
  ["alpha", ".buildchain/alpha-contract-lock.json", "v2-alpha"],
]) {
  if (!fs.existsSync(lockPath)) throw new Error(`missing Buildchain ${channel} contract lock: ${lockPath}`);
  const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
  if (
    lock.contract !== "kungfu-buildchain-contract-lock" ||
    lock.buildchain?.ref !== expectedRef ||
    lock.buildchain?.majorLine !== "v2" ||
    lock.buildchain?.compatibilityPolicy !== "major-compatible" ||
    !lock.buildchain?.resolvedSha ||
    !lock.buildchain?.contractDigest ||
    !lock.buildchain?.compatibilityDigest
  ) {
    throw new Error(`Buildchain ${channel} contract lock must accept floating ${expectedRef}`);
  }
}
if (!workflow.includes(expectedBuildchainShell)) {
  throw new Error(`Buildchain web-surface workflow must use stable ${expectedBuildchainShellRef} shell`);
}
for (const lockInput of [
  "buildchain-contract-lock-path: ${{",
  ".buildchain/alpha-contract-lock.json",
  ".buildchain/contract-lock.json",
  "buildchain-contract-compatibility-policy: major-compatible",
  "buildchain-contract-drift-issue-mode: compatible-and-breaking",
]) {
  if (!workflow.includes(lockInput)) {
    throw new Error(`Buildchain web-surface workflow is missing ${lockInput}`);
  }
}
for (const applySwitch of ["preview-apply", "preview-cleanup-apply", "staging-apply"]) {
  if (!workflow.includes(`${applySwitch}: true`)) {
    throw new Error(`Buildchain web-surface workflow must enable ${applySwitch} for the standard release flow`);
  }
}
const manualProductionGate = "github.event_name == 'workflow_dispatch' && inputs.production_approved";
if (
  !workflow.includes(manualProductionGate) ||
  !workflow.includes("production-apply: true") ||
  !workflow.includes("production-release-on-main: true") ||
  !workflow.includes("production-release-label: buildchain-release") ||
  !workflow.includes("production-release-head-prefix: feature/release-")
) {
  throw new Error("Buildchain web-surface workflow must gate production apply on Buildchain release PR merge semantics");
}
if (!workflow.includes(`production-approved: \${{ ${manualProductionGate} }}`)) {
  throw new Error("Buildchain web-surface workflow must keep manual production approval explicit");
}

const config = parseTomlSections(buildchainToml);
for (const channel of ["preview", "staging", "production"]) {
  const deploy = config[`deploy.${channel}`];
  const expected = outputs.channels[channel];
  if (!deploy) throw new Error(`missing buildchain deploy.${channel}`);
  expectEqual(deploy.bucket, expected.bucket, `${channel} bucket`);
  expectEqual(
    deploy.cloudfront_distribution,
    expected.cloudfrontDistribution,
    `${channel} CloudFront distribution`,
  );
  if (expected.roleArn && !workflow.includes(expected.roleArn)) {
    throw new Error(`${channel} workflow role ARN is not wired to infra outputs`);
  }
}

console.log("infra outputs checks passed");
