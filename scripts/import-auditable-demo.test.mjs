// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { importAuditableDemo } from "./import-auditable-demo.mjs";

function sha256(bytes) {
  return `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
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

function fixture() {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "auditable-demo-site-"));
  const mediaDirectory = path.join(repoRoot, "site/auditable-demo/media");
  const outputRoot = path.join(repoRoot, "public");
  fs.mkdirSync(mediaDirectory, { recursive: true });
  fs.mkdirSync(path.join(outputRoot, "how-tested/auditable-demo"), { recursive: true });
  const sourceSha = "1".repeat(40);
  const gateRoot = `sha256:${"2".repeat(64)}`;
  const rendererImage =
    `ghcr.io/kungfu-systems/build-images/demo-renderer@sha256:${"3".repeat(64)}`;
  const members = {
    "complete-transcript.txt": Buffer.from("kungfu agent-work-lab autoplay\nqualified\n"),
    "demo.gif": Buffer.from("gif"),
    "demo.mp4": Buffer.from("mp4"),
    "demo.webm": Buffer.from("webm"),
    "gate-receipt.json": Buffer.from("{}\n"),
    "manifest.json": Buffer.from(stableJson({
      schema: "build-images.auditable-demo-render/v1",
      renderer: { image: rendererImage },
      policy: {
        evidenceClass: "exact-installed-artifact-agent-work-lab-autoplay/v1",
        visualClassification: "bounded-pty-replay",
        runtimeTextAuthority: "terminal-capture.json",
      },
      inputs: {
        terminalCapture: { root: `sha256:${"9".repeat(64)}` },
      },
    })),
    "media-probe.json": Buffer.from('{"passed":true}\n'),
    "media-receipt.json": Buffer.from(stableJson({
      schema: "buildchain.auditable-demo-media/v1",
      status: "passed",
      sourceSha,
      qualifiedGateRoot: gateRoot,
      rendererImage,
      rendererManifestRoot: `sha256:${"4".repeat(64)}`,
    })),
    "poster.png": Buffer.from("png"),
    "public-projection.json": Buffer.from("{}\n"),
    "renderer-checksums.sha256": Buffer.from("renderer\n"),
    "scene.json": Buffer.from(stableJson({
      schema: "build-images.demo-scene/v1",
      durationMs: 18500,
    })),
  };
  for (const [name, bytes] of Object.entries(members)) {
    fs.writeFileSync(path.join(mediaDirectory, name), bytes);
  }
  const checksums = `${Object.keys(members).sort().map((name) => `${sha256(members[name]).slice(7)}  ${name}`).join("\n")}\n`;
  fs.writeFileSync(path.join(mediaDirectory, "checksums.sha256"), checksums);
  const payload = {
    schema: "kungfu.auditable-demo.release-passport/v1",
    status: "qualified",
    source: {
      repository: "kungfu-systems/kungfu",
      sha: sourceSha,
      artifact: {
        id: "101",
        name: `kungfu-linux-x64-${sourceSha}`,
        digest: `sha256:${"5".repeat(64)}`,
        url: "https://github.com/kungfu-systems/kungfu/actions/runs/99/artifacts/101",
        expiresAt: "2026-08-08T00:00:00.000Z",
      },
    },
    gate: {
      status: "passed",
      root: gateRoot,
      artifact: {
        id: "102",
        name: `auditable-demo-gate-${sourceSha.slice(0, 12)}-${gateRoot.slice(7, 23)}`,
        digest: `sha256:${"6".repeat(64)}`,
        url: "https://github.com/kungfu-systems/kungfu/actions/runs/99/artifacts/102",
        expiresAt: "2026-08-08T00:00:00.000Z",
      },
    },
    media: {
      status: "rendered",
      root: sha256(Buffer.from(checksums)),
      artifact: {
        id: "103",
        name: `auditable-demo-media-${sourceSha.slice(0, 12)}-${sha256(Buffer.from(checksums)).slice(7, 23)}`,
        digest: `sha256:${"7".repeat(64)}`,
        url: "https://github.com/kungfu-systems/kungfu/actions/runs/99/artifacts/103",
        expiresAt: "2026-08-08T00:00:00.000Z",
      },
    },
    workflow: {
      repository: "kungfu-systems/kungfu",
      runId: "99",
      runAttempt: "1",
      url: "https://github.com/kungfu-systems/kungfu/actions/runs/99",
    },
    toolchain: {
      buildchainSha: "8".repeat(40),
      rendererImage,
    },
    authority: {
      evidenceClass: "exact-installed-artifact-agent-work-lab-autoplay/v1",
      publication: "github-artifacts-only",
      productionDeployment: false,
      authorization: {
        status: "not-granted-by-demo",
        requiredSources: [
          "exact-release-passport",
          "core-policy",
          "work-or-warrant",
          "explicit-capability-grant",
          "runtime-isolation",
        ],
        nonAuthorities: [
          "first-party-identity",
          "system-identity",
          "kfd-compliance",
          "product-system-metadata",
          "local-bundle-presence",
          "package-metadata",
          "registry-history",
          "scan-output",
          "standalone-generation",
        ],
      },
      claims: ["exact autoplay artifact ran", "bounded PTY Gate passed"],
      nonClaims: ["durability", "performance", "implicit identity authority"],
    },
  };
  const passport = {
    ...payload,
    root: {
      algorithm: "sha256",
      profile: "sorted-object-json-utf8-lf/v1",
      value: sha256(Buffer.from(stableJson(payload))),
    },
  };
  const passportPath = path.join(repoRoot, "site/auditable-demo/passport.json");
  fs.writeFileSync(passportPath, stableJson(passport));
  const sourcePath = path.join(repoRoot, "site/auditable-demo-source.json");
  fs.writeFileSync(sourcePath, stableJson({
    schema: "kungfu.site.auditable-demo-source/v1",
    passport: "site/auditable-demo/passport.json",
    mediaDirectory: "site/auditable-demo/media",
  }));
  fs.writeFileSync(
    path.join(outputRoot, "how-tested/auditable-demo/index.html"),
    "<main>\n      <!-- auditable-demo-evidence:start -->\n      fixture\n      <!-- auditable-demo-evidence:end -->\n</main>\n",
  );
  fs.writeFileSync(
    path.join(outputRoot, "index.html"),
    "<main>\n<div data-demo-carousel><div data-carousel-track>\n      <!-- auditable-demo-home:start -->\n      fixture\n      <!-- auditable-demo-home:end -->\n</div></div>\n</main>\n",
  );
  return { repoRoot, sourcePath, outputRoot, passport };
}

function rebindMedia(repoRoot) {
  const mediaDirectory = path.join(repoRoot, "site/auditable-demo/media");
  const members = fs.readdirSync(mediaDirectory).filter((name) => name !== "checksums.sha256").sort();
  const checksums = `${members.map((name) => `${sha256(fs.readFileSync(path.join(mediaDirectory, name))).slice(7)}  ${name}`).join("\n")}\n`;
  fs.writeFileSync(path.join(mediaDirectory, "checksums.sha256"), checksums);
  const passportPath = path.join(repoRoot, "site/auditable-demo/passport.json");
  const passport = JSON.parse(fs.readFileSync(passportPath, "utf8"));
  passport.media.root = sha256(Buffer.from(checksums));
  passport.media.artifact.name =
    `auditable-demo-media-${passport.source.sha.slice(0, 12)}-${passport.media.root.slice(7, 23)}`;
  const { root: ignoredRoot, ...payload } = passport;
  passport.root.value = sha256(Buffer.from(stableJson(payload)));
  fs.writeFileSync(passportPath, stableJson(passport));
}

test("imports exact media and a source-bound public projection", () => {
  const input = fixture();
  try {
    const result = importAuditableDemo(input);
    assert.equal(result.changed, true);
    assert.equal(result.passport.root.value, input.passport.root.value);
    const projection = JSON.parse(fs.readFileSync(path.join(input.outputRoot, "auditable-demo.json"), "utf8"));
    assert.equal(projection.passportRoot, input.passport.root.value);
    assert.equal(projection.sourceSha, input.passport.source.sha);
    assert.deepEqual(projection.claims, input.passport.authority.claims);
    assert.deepEqual(projection.nonClaims, input.passport.authority.nonClaims);
    assert.match(
      fs.readFileSync(path.join(input.outputRoot, "how-tested/auditable-demo/index.html"), "utf8"),
      /Watch the artifact explain itself\./u,
    );
    assert.match(
      fs.readFileSync(path.join(input.outputRoot, "how-tested/auditable-demo/index.html"), "utf8"),
      /18\.5-second animation/u,
    );
    assert.match(
      fs.readFileSync(path.join(input.outputRoot, "how-tested/auditable-demo/index.html"), "utf8"),
      /read the complete transcript/u,
    );
    assert.match(
      fs.readFileSync(path.join(input.outputRoot, "how-tested/auditable-demo/index.html"), "utf8"),
      /kungfu agent-work-lab autoplay/u,
    );
    const homepage = fs.readFileSync(path.join(input.outputRoot, "index.html"), "utf8");
    assert.match(homepage, /data-demo-carousel/u);
    assert.match(homepage, /data-carousel-track/u);
    assert.match(homepage, /data-demo-slide data-demo-title="Agent Work Lab"/u);
    assert.match(homepage, /data-autoplay-demo controls muted loop playsinline/u);
    assert.match(homepage, /Exact installed artifact · 18\.5 seconds/u);
    assert.match(homepage, new RegExp(`${result.publicPath}/demo\\.webm`, "u"));
    assert.match(homepage, new RegExp(`${result.publicPath}/complete-transcript\\.txt`, "u"));
    assert.equal(importAuditableDemo({ ...input, checkOnly: true }).changed, false);
  } finally {
    fs.rmSync(input.repoRoot, { recursive: true, force: true });
  }
});

test("rejects incomplete identity-neutral authority even under a re-rooted Passport", () => {
  const input = fixture();
  try {
    const passportPath = path.join(input.repoRoot, "site/auditable-demo/passport.json");
    const passport = JSON.parse(fs.readFileSync(passportPath, "utf8"));
    passport.authority.authorization.nonAuthorities.pop();
    const { root: ignoredRoot, ...payload } = passport;
    passport.root.value = sha256(Buffer.from(stableJson(payload)));
    fs.writeFileSync(passportPath, stableJson(passport));
    assert.throws(
      () => importAuditableDemo(input),
      /identity-neutral authorization boundary is invalid/u,
    );
  } finally {
    fs.rmSync(input.repoRoot, { recursive: true, force: true });
  }
});

test("rejects media drift before publication", () => {
  const input = fixture();
  try {
    fs.appendFileSync(path.join(input.repoRoot, "site/auditable-demo/media/demo.mp4"), "tampered");
    assert.throws(() => importAuditableDemo(input), /checksum mismatch for demo\.mp4/u);
  } finally {
    fs.rmSync(input.repoRoot, { recursive: true, force: true });
  }
});

test("rejects a cross-run artifact URL even when the Passport root is valid", () => {
  const input = fixture();
  try {
    const passportPath = path.join(input.repoRoot, "site/auditable-demo/passport.json");
    const passport = JSON.parse(fs.readFileSync(passportPath, "utf8"));
    passport.media.artifact.url =
      "https://github.com/kungfu-systems/kungfu/actions/runs/100/artifacts/103";
    const { root: ignoredRoot, ...payload } = passport;
    passport.root.value = sha256(Buffer.from(stableJson(payload)));
    fs.writeFileSync(passportPath, stableJson(passport));
    assert.throws(() => importAuditableDemo(input), /media artifact coordinate is invalid/u);
  } finally {
    fs.rmSync(input.repoRoot, { recursive: true, force: true });
  }
});

test("rejects a missing Gate expiry even when the Passport root is valid", () => {
  const input = fixture();
  try {
    const passportPath = path.join(input.repoRoot, "site/auditable-demo/passport.json");
    const passport = JSON.parse(fs.readFileSync(passportPath, "utf8"));
    passport.gate.artifact.expiresAt = "";
    const { root: ignoredRoot, ...payload } = passport;
    passport.root.value = sha256(Buffer.from(stableJson(payload)));
    fs.writeFileSync(passportPath, stableJson(passport));
    assert.throws(() => importAuditableDemo(input), /Gate artifact expiry/u);
  } finally {
    fs.rmSync(input.repoRoot, { recursive: true, force: true });
  }
});

test("rejects a scene without a bounded exact duration", () => {
  const input = fixture();
  try {
    const scenePath = path.join(input.repoRoot, "site/auditable-demo/media/scene.json");
    fs.writeFileSync(scenePath, stableJson({
      schema: "build-images.demo-scene/v1",
      durationMs: 0,
    }));
    rebindMedia(input.repoRoot);
    assert.throws(
      () => importAuditableDemo(input),
      /scene duration is invalid/u,
    );
  } finally {
    fs.rmSync(input.repoRoot, { recursive: true, force: true });
  }
});
