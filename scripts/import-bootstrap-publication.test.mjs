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
    `installers/v1/alpha/${channel.payloadRoot.slice(7, 23)}`;
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
    const result = importBootstrapPublication({ ...input, outputRoot });
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
    assert.match(page, /Signed Alpha 4\.0\.0-alpha\.1 is publicly available/);
    assert.match(page, /installers\/v1\/alpha\//);
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
    assert.deepEqual(
      manifest.publications.map((publication) => publication.id),
      [
        "kungfu-bootstrap-installer-alpha",
        "kungfu-release-channel-alpha",
      ],
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("preserves prior immutable versions and rejects replacement", () => {
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
    importBootstrapPublication({ ...first, outputRoot });
    importBootstrapPublication({ ...second, outputRoot });
    const manifest = JSON.parse(
      fs.readFileSync(path.join(outputRoot, "manifest.json"), "utf8"),
    );
    for (const publication of manifest.publications) {
      assert.equal(publication.versions.length, 2);
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
