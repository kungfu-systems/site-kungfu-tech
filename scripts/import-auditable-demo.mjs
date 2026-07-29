#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { escapeAttr, escapeHtml } from "./site-layout.mjs";

const DIGEST = /^sha256:[0-9a-f]{64}$/u;
const SHA = /^[0-9a-f]{40}$/u;
const ID = /^[1-9][0-9]*$/u;
const ARTIFACT_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$/u;
const EVIDENCE_CLASS = "exact-installed-artifact-agent-work-lab-autoplay/v1";
const REQUIRED_AUTHORIZATION_SOURCES = [
  "exact-release-passport",
  "core-policy",
  "work-or-warrant",
  "explicit-capability-grant",
  "runtime-isolation",
];
const NON_AUTHORITIES = [
  "first-party-identity",
  "system-identity",
  "kfd-compliance",
  "product-system-metadata",
  "local-bundle-presence",
  "package-metadata",
  "registry-history",
  "scan-output",
  "standalone-generation",
];
const EXPECTED_MEDIA_MEMBERS = [
  "checksums.sha256",
  "complete-transcript.txt",
  "demo.gif",
  "demo.mp4",
  "demo.webm",
  "gate-receipt.json",
  "manifest.json",
  "media-probe.json",
  "media-receipt.json",
  "poster.png",
  "public-projection.json",
  "renderer-checksums.sha256",
  "scene.json",
];

function invariant(condition, message) {
  if (!condition) throw new Error(`auditable-demo import: ${message}`);
}

function sha256(bytes) {
  return `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
}

function exactTimestamp(value, label) {
  const parsed = Date.parse(value || "");
  invariant(
    Number.isFinite(parsed) && new Date(parsed).toISOString() === value,
    `${label} must be a canonical RFC3339 timestamp`,
  );
  return value;
}

function stableJson(value) {
  const canonical = (entry) => {
    if (Array.isArray(entry)) return entry.map(canonical);
    if (!entry || typeof entry !== "object") return entry;
    return Object.fromEntries(
      Object.keys(entry).sort().map((key) => [key, canonical(entry[key])]),
    );
  };
  return `${JSON.stringify(canonical(value), null, 2)}\n`;
}

function readRegular(filePath, label, maximumBytes = 64 * 1024 * 1024) {
  const metadata = fs.lstatSync(filePath);
  invariant(
    metadata.isFile() && !metadata.isSymbolicLink(),
    `${label} must be a regular non-symlink file`,
  );
  invariant(metadata.size <= maximumBytes, `${label} is unexpectedly large`);
  return fs.readFileSync(filePath);
}

function readJson(filePath, label) {
  return JSON.parse(readRegular(filePath, label).toString("utf8"));
}

function listRegularFiles(directory) {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .map((entry) => {
      invariant(entry.isFile() && !entry.isSymbolicLink(), `unexpected media member ${entry.name}`);
      return entry.name;
    })
    .sort();
}

function verifyPassport(passport) {
  invariant(
    passport?.schema === "kungfu.auditable-demo.release-passport/v1"
      && passport.status === "qualified",
    "passport schema or status is invalid",
  );
  invariant(
    passport.root?.profile === "sorted-object-json-utf8-lf/v1"
      && DIGEST.test(passport.root?.value || ""),
    "passport root is invalid",
  );
  const { root, ...payload } = passport;
  invariant(sha256(Buffer.from(stableJson(payload))) === root.value, "passport root does not verify");
  invariant(
    passport.source?.repository === "kungfu-systems/kungfu"
      && SHA.test(passport.source?.sha || ""),
    "passport source coordinate is invalid",
  );
  invariant(
    passport.workflow?.repository === passport.source.repository
      && ID.test(passport.workflow?.runId || "")
      && ID.test(passport.workflow?.runAttempt || "")
      && passport.workflow?.url ===
        `https://github.com/${passport.source.repository}/actions/runs/${passport.workflow.runId}`,
    "passport workflow coordinate is invalid",
  );
  for (const [label, artifact] of [
    ["source", passport.source?.artifact],
    ["Gate", passport.gate?.artifact],
    ["media", passport.media?.artifact],
  ]) {
    invariant(
      ID.test(artifact?.id || "")
        && ARTIFACT_NAME.test(artifact?.name || "")
        && DIGEST.test(artifact?.digest || "")
        && artifact?.url === `${passport.workflow.url}/artifacts/${artifact.id}`,
      `${label} artifact coordinate is invalid`,
    );
    exactTimestamp(artifact.expiresAt, `${label} artifact expiry`);
  }
  invariant(
    passport.source.artifact.name === `kungfu-linux-x64-${passport.source.sha}`,
    "source artifact name is not bound to the source SHA",
  );
  invariant(passport.gate?.status === "passed" && DIGEST.test(passport.gate?.root || ""), "Gate is not qualified");
  invariant(passport.media?.status === "rendered" && DIGEST.test(passport.media?.root || ""), "media is not rendered");
  invariant(
    passport.gate.artifact.name.startsWith(
      `auditable-demo-gate-${passport.source.sha.slice(0, 12)}-${passport.gate.root.slice(7, 23)}`,
    ),
    "Gate artifact name is not bound to the source SHA and Gate root",
  );
  invariant(
    passport.media.artifact.name.startsWith(
      `auditable-demo-media-${passport.source.sha.slice(0, 12)}-${passport.media.root.slice(7, 23)}`,
    ),
    "media artifact name is not bound to the source SHA and media root",
  );
  invariant(
    SHA.test(passport.toolchain?.buildchainSha || "")
      && /^ghcr\.io\/kungfu-systems\/build-images\/demo-renderer@sha256:[0-9a-f]{64}$/u
        .test(passport.toolchain?.rendererImage || ""),
    "passport toolchain coordinate is invalid",
  );
  invariant(passport.authority?.publication === "github-artifacts-only", "unexpected publication authority");
  invariant(passport.authority?.productionDeployment === false, "source run must not claim a production deployment");
  invariant(passport.authority?.evidenceClass === EVIDENCE_CLASS, "unexpected evidence class");
  invariant(
    passport.authority?.authorization?.status === "not-granted-by-demo"
      && JSON.stringify(passport.authority.authorization.requiredSources)
        === JSON.stringify(REQUIRED_AUTHORIZATION_SOURCES)
      && JSON.stringify(passport.authority.authorization.nonAuthorities)
        === JSON.stringify(NON_AUTHORITIES),
    "identity-neutral authorization boundary is invalid",
  );
  invariant(
    Array.isArray(passport.authority.claims)
      && passport.authority.claims.length > 0
      && passport.authority.claims.every((claim) => typeof claim === "string" && claim.length > 0)
      && Array.isArray(passport.authority.nonClaims)
      && passport.authority.nonClaims.length > 0
      && passport.authority.nonClaims.every((claim) => typeof claim === "string" && claim.length > 0),
    "Passport claims and non-claims are invalid",
  );
  return passport;
}

function verifyMedia(mediaDirectory, passport) {
  invariant(
    JSON.stringify(listRegularFiles(mediaDirectory)) === JSON.stringify(EXPECTED_MEDIA_MEMBERS),
    "media bundle member set is not exact",
  );
  const checksumBytes = readRegular(path.join(mediaDirectory, "checksums.sha256"), "media checksums");
  invariant(sha256(checksumBytes) === passport.media.root, "media root does not match the passport");
  const rows = checksumBytes.toString("utf8").trimEnd().split("\n");
  const declared = [];
  for (const row of rows) {
    const match = /^([0-9a-f]{64})  ([A-Za-z0-9._-]+)$/u.exec(row);
    invariant(match, `invalid checksum row ${row}`);
    const member = match[2];
    invariant(member !== "checksums.sha256", "checksums cannot cover themselves");
    invariant(!declared.includes(member), `duplicate checksum member ${member}`);
    declared.push(member);
    invariant(
      sha256(readRegular(path.join(mediaDirectory, member), member)).slice(7) === match[1],
      `checksum mismatch for ${member}`,
    );
  }
  invariant(
    JSON.stringify(declared.sort()) === JSON.stringify(EXPECTED_MEDIA_MEMBERS.filter((name) => name !== "checksums.sha256")),
    "checksums do not cover every media member exactly once",
  );
  const receipt = readJson(path.join(mediaDirectory, "media-receipt.json"), "media receipt");
  invariant(
    receipt.schema === "buildchain.auditable-demo-media/v1"
      && receipt.status === "passed"
      && receipt.sourceSha === passport.source.sha
      && receipt.qualifiedGateRoot === passport.gate.root
      && receipt.rendererImage === passport.toolchain.rendererImage,
    "media receipt does not bind the passport",
  );
  const scene = readJson(path.join(mediaDirectory, "scene.json"), "scene");
  invariant(
    scene.schema === "build-images.demo-scene/v1"
      && Number.isInteger(scene.durationMs)
      && scene.durationMs >= 500
      && scene.durationMs <= 60000,
    "scene duration is invalid",
  );
  const manifest = readJson(path.join(mediaDirectory, "manifest.json"), "renderer manifest");
  invariant(
    manifest.schema === "build-images.auditable-demo-render/v1"
      && manifest.renderer?.image === passport.toolchain.rendererImage
      && manifest.policy?.evidenceClass === passport.authority.evidenceClass
      && manifest.policy?.visualClassification === "bounded-pty-replay"
      && manifest.policy?.runtimeTextAuthority === "terminal-capture.json"
      && DIGEST.test(manifest.inputs?.terminalCapture?.root || ""),
    "renderer manifest does not prove the qualified PTY replay",
  );
  return scene;
}

function formatDuration(durationMs) {
  const seconds = durationMs / 1000;
  return Number.isInteger(seconds) ? `${seconds}` : seconds.toFixed(1);
}

function renderEvidence(passport, publicPath, scene) {
  const runUrl = passport.workflow.url;
  const sourceUrl = `https://github.com/${passport.source.repository}/commit/${passport.source.sha}`;
  const artifactLinks = [
    ["Exact source artifact", passport.source.artifact.url],
    ["Passing Gate artifact", passport.gate.artifact.url],
    ["Rendered media artifact", passport.media.artifact.url],
    ["GitHub Actions run", runUrl],
    ["Exact source commit", sourceUrl],
  ];
  const claims = passport.authority.claims
    .map((claim) => `<li>${escapeHtml(claim)}</li>`)
    .join("");
  const nonClaims = passport.authority.nonClaims
    .map((claim) => `<li>${escapeHtml(claim)}</li>`)
    .join("");
  return `      <!-- auditable-demo-evidence:start -->
      <section class="demo-player" aria-labelledby="demo-heading">
        <div>
          <p class="eyebrow">Exact installed artifact · bounded Linux proof</p>
          <h1 id="demo-heading">Watch the artifact explain itself.</h1>
          <p class="lead">No account, hosted session, or hand-authored transcript is required. This ${formatDuration(scene.durationMs)}-second animation replays the bounded PTY output of the installed <code>kungfu agent-work-lab autoplay</code> command after the reusable Buildchain Gate passed.</p>
        </div>
        <video controls playsinline preload="metadata" aria-label="Exact installed Kungfu Agent Work Lab autoplay demonstration" poster="${escapeAttr(publicPath)}/poster.png">
          <source src="${escapeAttr(publicPath)}/demo.webm" type="video/webm">
          <source src="${escapeAttr(publicPath)}/demo.mp4" type="video/mp4">
          <p><a href="${escapeAttr(publicPath)}/demo.mp4">Download the MP4 recording.</a></p>
        </video>
        <p class="fallback">Static fallback: <a href="${escapeAttr(publicPath)}/poster.png">open the exact poster</a>. Text alternative: <a href="${escapeAttr(publicPath)}/complete-transcript.txt">read the complete transcript</a>. The page never autoplays media.</p>
      </section>

      <section class="proof-grid" aria-label="Auditable demo proof">
        <article><h2>What ran</h2><p>The installed Linux artifact executed its own <code>kungfu agent-work-lab autoplay</code> launcher in a disposable bounded PTY.</p></article>
        <article><h2>What passed</h2><p>The exact terminal capture, transcript, public projection, and scene passed an isolated renderer smoke before full media was allowed.</p></article>
        <article><h2>What is retained</h2><p>Source, Gate, media, toolchain, expiry, run, and canonical Passport roots remain machine-readable.</p></article>
        <article><h2>Authority boundary</h2><p>The capture grants no authority. Authorization still requires the exact Passport, Core policy, Work or Warrant, an explicit capability grant, and runtime isolation.</p></article>
      </section>

      <section class="coordinates">
        <h2>Claims from the exact Passport</h2>
        <ul>${claims}</ul>
        <h2>Explicit non-claims</h2>
        <ul>${nonClaims}</ul>
      </section>

      <section class="coordinates">
        <h2>Release Passport</h2>
        <dl>
          <div><dt>Source SHA</dt><dd><code>${escapeHtml(passport.source.sha)}</code></dd></div>
          <div><dt>Gate root</dt><dd><code>${escapeHtml(passport.gate.root)}</code></dd></div>
          <div><dt>Media root</dt><dd><code>${escapeHtml(passport.media.root)}</code></dd></div>
          <div><dt>Passport root</dt><dd><code>${escapeHtml(passport.root.value)}</code></dd></div>
          <div><dt>Buildchain</dt><dd><code>${escapeHtml(passport.toolchain.buildchainSha)}</code></dd></div>
          <div><dt>Renderer</dt><dd><code>${escapeHtml(passport.toolchain.rendererImage)}</code></dd></div>
          <div><dt>Source expires</dt><dd><time datetime="${escapeAttr(passport.source.artifact.expiresAt)}">${escapeHtml(passport.source.artifact.expiresAt)}</time></dd></div>
          <div><dt>Gate expires</dt><dd><time datetime="${escapeAttr(passport.gate.artifact.expiresAt)}">${escapeHtml(passport.gate.artifact.expiresAt)}</time></dd></div>
          <div><dt>Media expires</dt><dd><time datetime="${escapeAttr(passport.media.artifact.expiresAt)}">${escapeHtml(passport.media.artifact.expiresAt)}</time></dd></div>
        </dl>
        <nav class="evidence-links" aria-label="Exact evidence links">
          ${artifactLinks.map(([label, href]) => `<a href="${escapeAttr(href)}">${escapeHtml(label)}</a>`).join("\n          ")}
          <a href="${escapeAttr(publicPath)}/passport.json">Machine-readable Passport</a>
          <a href="/auditable-demo.json">Public site projection</a>
        </nav>
        <p class="retention-note">The original GitHub Artifacts are explicitly retained for 14 days. This site projection copies the verified public media and Passport; it does not rewrite their roots or claim that the originating workflow deployed production.</p>
      </section>
      <!-- auditable-demo-evidence:end -->`;
}

function replaceEvidence(page, rendered) {
  const pattern = /      <!-- auditable-demo-evidence:start -->[\s\S]*?      <!-- auditable-demo-evidence:end -->/mu;
  invariant(pattern.test(page), "page is missing auditable-demo evidence markers");
  return page.replace(pattern, rendered);
}

export function importAuditableDemo({
  repoRoot,
  sourcePath,
  outputRoot,
  checkOnly = false,
}) {
  const source = readJson(sourcePath, "source descriptor");
  invariant(source.schema === "kungfu.site.auditable-demo-source/v1", "source descriptor schema is invalid");
  const passportPath = path.resolve(repoRoot, source.passport);
  const mediaDirectory = path.resolve(repoRoot, source.mediaDirectory);
  invariant(passportPath.startsWith(`${repoRoot}${path.sep}`), "passport path escapes repository");
  invariant(mediaDirectory.startsWith(`${repoRoot}${path.sep}`), "media path escapes repository");
  const passport = verifyPassport(readJson(passportPath, "passport"));
  const scene = verifyMedia(mediaDirectory, passport);

  const rootName = passport.root.value.slice(7);
  const publicPath = `/evidence/auditable-demo/${rootName}`;
  const evidenceDirectory = path.join(outputRoot, publicPath);
  const pagePath = path.join(outputRoot, "how-tested/auditable-demo/index.html");
  const projectionPath = path.join(outputRoot, "auditable-demo.json");
  const expected = new Map();
  for (const member of EXPECTED_MEDIA_MEMBERS) {
    expected.set(path.join(evidenceDirectory, member), readRegular(path.join(mediaDirectory, member), member));
  }
  expected.set(path.join(evidenceDirectory, "passport.json"), Buffer.from(stableJson(passport)));
  expected.set(
    projectionPath,
    Buffer.from(stableJson({
      schema: "kungfu.site.auditable-demo/v1",
      status: "qualified",
      sourceSha: passport.source.sha,
      evidenceClass: passport.authority.evidenceClass,
      gateRoot: passport.gate.root,
      mediaRoot: passport.media.root,
      passportRoot: passport.root.value,
      buildchainSha: passport.toolchain.buildchainSha,
      rendererImage: passport.toolchain.rendererImage,
      workflowUrl: passport.workflow.url,
      publicEvidencePath: publicPath,
      claims: passport.authority.claims,
      nonClaims: passport.authority.nonClaims,
    })),
  );
  const pageBefore = readRegular(pagePath, "auditable demo page").toString("utf8");
  expected.set(pagePath, Buffer.from(replaceEvidence(pageBefore, renderEvidence(passport, publicPath, scene))));

  const drift = [];
  for (const [target, bytes] of expected) {
    if (!fs.existsSync(target) || !readRegular(target, path.relative(repoRoot, target)).equals(bytes)) {
      drift.push(target);
      if (!checkOnly) {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, bytes);
      }
    }
  }
  if (checkOnly) {
    invariant(drift.length === 0, `generated publication drift: ${drift.map((item) => path.relative(repoRoot, item)).join(", ")}`);
  }
  return { passport, publicPath, changed: drift.length > 0 };
}

function parseArguments(argv) {
  const checkOnly = argv.includes("--check");
  const values = argv.filter((entry) => entry !== "--check");
  invariant(values.length === 0 || (values.length === 2 && values[0] === "--source"), "usage: import-auditable-demo.mjs [--source PATH] [--check]");
  return { checkOnly, source: values[1] || "site/auditable-demo-source.json" };
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  try {
    const args = parseArguments(process.argv.slice(2));
    const repoRoot = process.cwd();
    const result = importAuditableDemo({
      repoRoot,
      sourcePath: path.resolve(repoRoot, args.source),
      outputRoot: path.join(repoRoot, "public"),
      checkOnly: args.checkOnly,
    });
    console.log(`${result.changed ? "imported" : "verified"} auditable demo ${result.passport.root.value}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
