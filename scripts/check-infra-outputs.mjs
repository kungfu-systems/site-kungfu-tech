#!/usr/bin/env node
import fs from "node:fs";

const outputs = JSON.parse(fs.readFileSync("infra/outputs.json", "utf8"));
const buildchainToml = fs.readFileSync(".buildchain/buildchain.toml", "utf8");
const workflow = fs.readFileSync(".github/workflows/buildchain-web-surface.yml", "utf8");
const expectedBuildchainShellRef =
  "9e904de2c85dbea7c799780ee166510b3336d812";
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
  ["stable", ".buildchain/contract-lock.json", "v3"],
  ["alpha", ".buildchain/alpha-contract-lock.json", "v3-alpha"],
]) {
  if (!fs.existsSync(lockPath)) throw new Error(`missing Buildchain ${channel} contract lock: ${lockPath}`);
  const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
  if (
    lock.contract !== "kungfu-buildchain-contract-lock" ||
    lock.buildchain?.ref !== expectedRef ||
    lock.buildchain?.majorLine !== "v3" ||
    lock.buildchain?.compatibilityPolicy !== "major-compatible" ||
    !lock.buildchain?.resolvedSha ||
    !lock.buildchain?.contractDigest ||
    !lock.buildchain?.compatibilityDigest
  ) {
    throw new Error(`Buildchain ${channel} contract lock must accept floating ${expectedRef}`);
  }
}
if (!workflow.includes(expectedBuildchainShell)) {
  throw new Error(
    `Buildchain web-surface workflow must use exact activation shell ${expectedBuildchainShellRef}`,
  );
}
if (workflow.includes("buildchain-ref:")) {
  throw new Error(
    "Buildchain runtime must resolve from the exact reusable workflow shell, not an event-scoped override",
  );
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
const trustedPreviewGate =
  "github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository";
for (const applySwitch of ["preview-apply", "preview-cleanup-apply"]) {
  if (!workflow.includes(`${applySwitch}: \${{ ${trustedPreviewGate} }}`)) {
    throw new Error(
      `Buildchain web-surface workflow must gate ${applySwitch} to same-repository pull requests`,
    );
  }
}
if (!workflow.includes("staging-apply: true")) {
  throw new Error(
    "Buildchain web-surface workflow must enable staging-apply for the standard release flow",
  );
}
const manualProductionGate = "github.event_name == 'workflow_dispatch' && inputs.production_approved";
const mainPushProductionGate =
  "github.event_name == 'push' && github.ref == 'refs/heads/main'";
if (
  !workflow.includes(manualProductionGate) ||
  !workflow.includes(mainPushProductionGate) ||
  !workflow.includes("production-apply: true") ||
  !workflow.includes("production-release-on-main: true") ||
  !workflow.includes("production-release-label: buildchain-release") ||
  !workflow.includes("production-release-head-prefix: feature/release-")
) {
  throw new Error("Buildchain web-surface workflow must gate production apply on Buildchain release PR merge semantics");
}
const governanceJob = workflow.slice(
  workflow.indexOf("  github-governance-receipt:"),
  workflow.indexOf("  web-surface:"),
);
if (!governanceJob.includes(mainPushProductionGate)) {
  throw new Error(
    "Buildchain web-surface workflow must mint a fresh governance receipt on main pushes",
  );
}
if (!workflow.includes(`production-approved: \${{ ${manualProductionGate} }}`)) {
  throw new Error("Buildchain web-surface workflow must keep manual production approval explicit");
}
for (const activationBinding of [
  "activation_source_sha:",
  "activation_environment:",
  "activation_transaction_root:",
  "GITHUB_SHA: ${{ github.sha }}",
  "production activation requires an exact reviewed activation_source_sha",
  "production activation requires activation_source_sha to equal github.sha",
  "production approval requires activation_environment=production",
  "production activation requires activation_transaction_root",
]) {
  if (!workflow.includes(activationBinding)) {
    throw new Error(`Buildchain web-surface workflow is missing exact activation binding ${activationBinding}`);
  }
}
for (const governanceBinding of [
  "github-governance-receipt:",
  "ref: v3",
  "git -C .buildchain/governance-runtime rev-parse HEAD",
  "KUNGFU_GOVERNANCE_AUDITOR_APP_ID",
  "KUNGFU_GOVERNANCE_AUDITOR_APP_PRIVATE_KEY",
  "scripts/audit-github-governance.mjs",
  "--target-ref main",
  "--require-qualifying",
  "github-governance-receipt-json: ${{ needs.github-governance-receipt.outputs.receipt-json || '' }}",
]) {
  if (!workflow.includes(governanceBinding)) {
    throw new Error(
      `Buildchain web-surface workflow is missing live governance binding ${governanceBinding}`,
    );
  }
}
if (
  workflow.includes(
    "buildchain-ref: ${{ needs.github-governance-receipt.outputs.runtime-sha",
  )
) {
  throw new Error(
    "Buildchain web-surface workflow must keep production on the official v3 channel instead of using a PR-event SHA override",
  );
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
