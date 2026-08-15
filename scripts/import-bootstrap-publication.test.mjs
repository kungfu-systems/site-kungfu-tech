#!/usr/bin/env node

import assert from "node:assert/strict";
import {
  createHash,
  generateKeyPairSync,
  sign,
} from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { importBootstrapPublication } from "./import-bootstrap-publication.mjs";

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) =>
          Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8")),
        )
        .map(([key, item]) => [key, canonical(item)]),
    );
  }
  return value;
}

function canonicalBytes(value) {
  return Buffer.from(JSON.stringify(canonical(value)), "ascii");
}

function sha256(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function contentRoot(value) {
  return sha256(canonicalBytes(value));
}

function fixture(root, { sourceCharacter = "a", version = "4.0.0-alpha.1" } = {}) {
  const publicationRoot = path.join(root, `publication-${sourceCharacter}`);
  fs.mkdirSync(publicationRoot, { recursive: true });
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const keyId = `kungfu-alpha-fixture-${sourceCharacter}`;
  const rawPublicKey = publicKey
    .export({ format: "der", type: "spki" })
    .subarray(-32)
    .toString("base64");
  const trustedKeysPath = path.join(root, `trusted-${sourceCharacter}.json`);
  fs.writeFileSync(
    trustedKeysPath,
    `${JSON.stringify({ [keyId]: rawPublicKey })}\n`,
  );
  const sourceCommit = sourceCharacter.repeat(40);
  const payload = {
    schema: "kungfu.release-channel-index/v1",
    generatedAt: "2026-07-24T00:00:00Z",
    expiresAt: "2026-08-24T00:00:00Z",
    sourceCommit,
    releasePassport: {
      ref: `buildchain:release-candidate-passport/${sourceCommit}`,
      root: `sha256:${"3".repeat(64)}`,
    },
    entries: [
      {
        channel: "alpha",
        platform: "linux",
        architecture: "x64",
        installSource: "archive",
        rollout: "current",
        manifest: {
          productVersion: version,
          sourceCommit,
          artifacts: [
            {
              kind: "desktop",
              url:
                `https://github.com/kungfu-systems/kungfu/releases/download/v${version}/Kungfu%20Episodes-${version}.AppImage`,
              size: 2048,
              digest: `sha256:${"7".repeat(64)}`,
              signature: "fixture-desktop-signature",
            },
          ],
        },
        manifestRoot: `sha256:${"4".repeat(64)}`,
        artifactRoot: `sha256:${"5".repeat(64)}`,
        documentationUrl: "https://kungfu.tech/install/",
      },
    ],
  };
  const signed = { ...payload, payloadRoot: contentRoot(payload) };
  const channel = {
    ...signed,
    signature: {
      algorithm: "ed25519",
      keyId,
      value: sign(null, canonicalBytes(signed), privateKey).toString("base64"),
    },
  };
  const channelBytes = Buffer.from(`${JSON.stringify(channel, null, 2)}\n`);
  const channelIndexPath = path.join(root, `channel-${sourceCharacter}.json`);
  fs.writeFileSync(channelIndexPath, channelBytes);
  const assets = [
    ["install.sh", Buffer.from("#!/bin/sh\nexit 0\n")],
    ["install.ps1", Buffer.from("exit 0\n")],
  ].map(([name, bytes]) => ({
    name,
    contentType:
      name === "install.sh"
        ? "text/x-shellscript; charset=utf-8"
        : "text/plain; charset=utf-8",
    bytes,
    size: bytes.length,
    digest: sha256(bytes),
  }));
  const immutablePath =
    `installers/v1/alpha/${version}/${channel.payloadRoot.slice(7)}`;
  for (const asset of assets) {
    fs.mkdirSync(path.join(publicationRoot, immutablePath), {
      recursive: true,
    });
    fs.writeFileSync(path.join(publicationRoot, asset.name), asset.bytes);
    fs.writeFileSync(
      path.join(publicationRoot, immutablePath, asset.name),
      asset.bytes,
    );
  }
  const publication = {
    schema: "kungfu.bootstrap-installer-publication/v1",
    installerVersion: "v1",
    channel: "alpha",
    sourceCommit,
    channelUrl: "https://kungfu.tech/.well-known/kungfu/alpha.json",
    channelSnapshotUrl:
      `https://kungfu.tech/channels/alpha/${channel.payloadRoot.slice(7)}/index.json`,
    channelPayloadRoot: channel.payloadRoot,
    channelFileDigest: sha256(channelBytes),
    releasePassport: channel.releasePassport,
    immutablePath,
    entries: [
      {
        platform: "linux",
        architecture: "x64",
        version,
        sourceCommit,
        manifestRoot: `sha256:${"4".repeat(64)}`,
        artifactRoot: `sha256:${"5".repeat(64)}`,
        artifactUrl:
          `https://github.com/kungfu-systems/kungfu/releases/download/v${version}/kungfu-cli-linux-x64.tar.gz`,
        artifactSize: 1024,
        artifactDigest: `sha256:${"6".repeat(64)}`,
        artifactSignature: "fixture-signature",
      },
    ],
    assets: assets.map(({ bytes: _bytes, ...asset }) => ({
      ...asset,
      friendlyUrl: `https://kungfu.tech/${asset.name}`,
      immutableUrl:
        `https://kungfu.tech/${immutablePath}/${asset.name}`,
    })),
  };
  fs.writeFileSync(
    path.join(publicationRoot, "installer-publication.json"),
    `${JSON.stringify(publication, null, 2)}\n`,
  );
  return {
    publicationRoot,
    channelIndexPath,
    trustedKeysPath,
    channel,
    publication,
  };
}

function prepareOutput(outputRoot) {
  fs.mkdirSync(path.join(outputRoot, "install"), { recursive: true });
  fs.writeFileSync(
    path.join(outputRoot, "install", "index.html"),
    [
      "<main>",
      "    <!-- bootstrap-publication:start -->",
      "    <p>Public installer not released yet.</p>",
      "    <!-- bootstrap-publication:end -->",
      "</main>",
      "",
    ].join("\n"),
  );
}

test("imports signed channel and installers into mutable and immutable routes", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "kungfu-site-import-"));
  try {
    const input = fixture(root);
    const outputRoot = path.join(root, "public");
    prepareOutput(outputRoot);
    const result = importBootstrapPublication({
      ...input,
      outputRoot,
      siteSourceSha: input.publication.sourceCommit,
    });
    assert.equal(result.channelPayloadRoot, input.channel.payloadRoot);
    assert.deepEqual(result.files, [...result.files].sort());
    assert.deepEqual(
      fs.readFileSync(path.join(outputRoot, "install.sh")),
      fs.readFileSync(
        path.join(
          outputRoot,
          input.publication.immutablePath,
          "install.sh",
        ),
      ),
    );
    const page = fs.readFileSync(
      path.join(outputRoot, "install", "index.html"),
      "utf8",
    );
    assert.match(page, /Alpha 4\.0\.0-alpha\.1 is ready to install/);
    assert.match(page, /data-ungfu-release-acquisition/);
    assert.match(page, /Kungfu UNGFU™/);
    assert.match(
      page,
      /Downloadable software for durable AI-agent work, inspection, and development workflows\./,
    );
    assert.match(page, /4\.0\.0-alpha\.1 · alpha/);
    assert.match(
      page,
      /curl -fsSL https:\/\/kungfu\.tech\/install\.sh \| sh/,
    );
    assert.match(page, /Choose your platform/);
    assert.match(page, /Download for Linux/);
    assert.match(page, /When <code>\.kungfu\/<\/code> appears/);
    assert.match(page, /kungfu agent map --json/);
    assert.match(page, /workspaceGit/);
    assert.match(page, /Kungfu never stages, commits, or pushes files for you/);
    assert.match(page, /kungfu-format-contract\.md#git-publication-boundary/);
    const desktopPosition = page.indexOf("<h2>Desktop GUI</h2>");
    const workspacePosition = page.indexOf('id="workspace-git-heading"');
    const evidencePosition = page.indexOf("<h2>Inspect and verify</h2>");
    assert.ok(
      desktopPosition >= 0
        && desktopPosition < workspacePosition
        && workspacePosition < evidencePosition,
    );
    assert.match(
      page,
      /Kungfu\.Episodes-4\.0\.0-alpha\.1\.AppImage/,
    );
    assert.match(
      page,
      /releases\/download\/v4\.0\.0-alpha\.1\/Kungfu\.Episodes-4\.0\.0-alpha\.1\.AppImage/,
    );
    assert.match(page, /Linux GUI:[\s\S]*sha256:777777/);
    assert.equal((page.match(/data-copy-command/g) || []).length, 2);
    assert.equal((page.match(/class="command-block"/g) || []).length, 2);
    assert.match(
      page,
      new RegExp(
        `/installers/v1/alpha/4\\.0\\.0-alpha\\.1/${input.channel.payloadRoot.slice(7)}/`,
      ),
    );
    assert.doesNotMatch(page, /Public installer not released yet/);
    assert.deepEqual(
      fs.readFileSync(
        path.join(outputRoot, ".well-known/kungfu/alpha.json"),
      ),
      fs.readFileSync(
        path.join(
          outputRoot,
          "channels",
          "alpha",
          input.channel.payloadRoot.slice(7),
          "index.json",
        ),
      ),
    );
    const manifest = JSON.parse(
      fs.readFileSync(path.join(outputRoot, "manifest.json"), "utf8"),
    );
    assert.equal(
      manifest.archivePolicy.contract,
      "kungfu-buildchain-publication-archive-policy",
    );
    assert.equal(
      manifest.ungfuAcquisitionEvidence,
      ".well-known/kungfu/ungfu-release-acquisition.json",
    );
    assert.deepEqual(
      manifest.publications.map((publication) => publication.id),
      [
        "kungfu-bootstrap-installer-alpha",
        "kungfu-release-channel-alpha",
        "kungfu-ungfu-acquisition-evidence",
      ],
    );
    const evidenceRoot = path.join(
      outputRoot,
      result.acquisitionEvidencePath,
    );
    const evidence = JSON.parse(
      fs.readFileSync(path.join(evidenceRoot, "index.json"), "utf8"),
    );
    assert.equal(
      evidence.contract,
      "kungfu-site-ungfu-acquisition-evidence",
    );
    assert.equal(evidence.release.sourceSha, input.publication.sourceCommit);
    assert.equal(evidence.release.version, "4.0.0-alpha.1");
    assert.equal(evidence.release.channel, "alpha");
    assert.equal(evidence.acquisition.exactMark, "Kungfu UNGFU™");
    assert.equal(evidence.acquisition.acquisitionUrl, "https://kungfu.tech/install.sh");
    assert.equal(evidence.legalBoundary.firstUseDateClaim, null);
    assert.equal(evidence.legalBoundary.legalConclusion, "not-made");
    assert.match(
      fs.readFileSync(path.join(evidenceRoot, "acquisition.html"), "utf8"),
      /data-ungfu-release-acquisition/,
    );
    assert.deepEqual(
      fs.readFileSync(
        path.join(
          outputRoot,
          ".well-known/kungfu/ungfu-release-acquisition.json",
        ),
      ),
      fs.readFileSync(path.join(evidenceRoot, "index.json")),
    );
    const status = JSON.parse(
      fs.readFileSync(
        path.join(outputRoot, ".well-known/kungfu-release-status.json"),
        "utf8",
      ),
    );
    assert.equal(status.schema, "kungfu.release-status/v1");
    assert.equal(status.status, "current-release");
    assert.equal(status.releasedUseClaim, true);
    assert.equal(status.release.sourceSha, input.publication.sourceCommit);
    assert.equal(status.release.siteSourceSha, input.publication.sourceCommit);
    assert.equal(status.release.releasePassport.root, input.publication.releasePassport.root);
    assert.match(status.acquisitionEvidence.url, /ungfu-release-acquisition\.json$/);
    assert.match(status.acquisitionEvidence.root, /^sha256:[0-9a-f]{64}$/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("preserves prior immutable coordinates and rejects byte replacement", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "kungfu-site-history-"));
  try {
    const outputRoot = path.join(root, "public");
    prepareOutput(outputRoot);
    const first = fixture(root, {
      sourceCharacter: "a",
      version: "4.0.0-alpha.1",
    });
    const second = fixture(root, {
      sourceCharacter: "b",
      version: "4.0.0-alpha.2",
    });
    const repairedSecond = fixture(root, {
      sourceCharacter: "c",
      version: "4.0.0-alpha.2",
    });
    importBootstrapPublication({ ...first, outputRoot });
    importBootstrapPublication({ ...second, outputRoot });
    importBootstrapPublication({ ...repairedSecond, outputRoot });
    const manifest = JSON.parse(
      fs.readFileSync(path.join(outputRoot, "manifest.json"), "utf8"),
    );
    for (const publication of manifest.publications) {
      assert.equal(publication.versions.length, 3);
      assert.deepEqual(
        publication.versions.map((item) => item.version),
        ["4.0.0-alpha.1", "4.0.0-alpha.2", "4.0.0-alpha.2"],
      );
      assert.equal(
        new Set(publication.versions.map((item) => item.immutablePath)).size,
        3,
      );
      assert.match(
        publication.versions[0].payloadRoot,
        /^sha256:[a-f0-9]{64}$/,
      );
    }
    const immutable = path.join(
      outputRoot,
      first.publication.immutablePath,
      "install.sh",
    );
    fs.writeFileSync(immutable, "different bytes\n");
    assert.throws(
      () => importBootstrapPublication({ ...first, outputRoot }),
      /immutable destination already has different bytes/,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("fails before projection when channel bytes or signature drift", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "kungfu-site-reject-"));
  try {
    const input = fixture(root);
    const outputRoot = path.join(root, "public");
    const channel = JSON.parse(
      fs.readFileSync(input.channelIndexPath, "utf8"),
    );
    channel.sourceCommit = "b".repeat(40);
    fs.writeFileSync(
      input.channelIndexPath,
      `${JSON.stringify(channel, null, 2)}\n`,
    );
    assert.throws(
      () => importBootstrapPublication({ ...input, outputRoot }),
      /payload root mismatch|signature did not verify/,
    );
    assert.equal(fs.existsSync(outputRoot), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("the committed page remains truthful for the configured publication", () => {
  const source = JSON.parse(
    fs.readFileSync("site/installer-publication-source.json", "utf8"),
  );
  const page = fs.readFileSync(
    path.resolve("public/install/index.html"),
    "utf8",
  );
  assert.equal((page.match(/data-copy-command/g) || []).length, 2);
  assert.match(page, /src="\/assets\/command-copy\.js" defer/);
  const status = JSON.parse(
    fs.readFileSync(
      "public/.well-known/kungfu-release-status.json",
      "utf8",
    ),
  );
  assert.equal(status.schema, "kungfu.release-status/v1");
  if (source.status === "available") {
    assert.match(page, /is ready to install\./);
    assert.match(page, /data-ungfu-release-acquisition/);
    assert.match(page, /curl -fsSL https:\/\/kungfu\.tech\/install\.sh \| sh/);
    assert.match(page, /Download for macOS/);
    assert.match(page, /Download for Linux/);
    assert.match(page, /Download for Windows/);
    assert.equal(
      fs.existsSync(
        "public/.well-known/kungfu/ungfu-release-acquisition.json",
      ),
      true,
    );
    assert.equal(status.status, "current-release");
    assert.equal(status.releasedUseClaim, true);
    assert.equal(status.release.sourceSha, source.buildchainSeal.sourceCommit);
  } else {
    assert.match(page, /Public installer not released yet\./);
    assert.match(page, /machine-readable <code>unavailable<\/code> result/);
    assert.doesNotMatch(page, /data-ungfu-release-acquisition/);
    const unavailable = {
      schema: "kungfu.bootstrap-installer-availability/v1",
      status: "unavailable",
      reason: "no-qualified-cli-publication",
      documentationUrl: "https://kungfu.tech/install/",
    };
    assert.equal(
      fs.readFileSync("public/install.sh", "utf8").includes(
        JSON.stringify(unavailable),
      ),
      true,
    );
    assert.equal(
      fs.readFileSync("public/install.ps1", "utf8").includes(
        JSON.stringify(unavailable),
      ),
      true,
    );
    assert.equal(
      fs.existsSync(
        "public/.well-known/kungfu/ungfu-release-acquisition.json",
      ),
      false,
    );
    assert.equal(status.status, "unavailable");
    assert.equal(status.releasedUseClaim, false);
    assert.equal(status.release, null);
    assert.equal(status.acquisitionEvidence, null);
  }
});
