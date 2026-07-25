// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  resolveInstallerPublicationBundle,
  validateInstallerPublicationSource,
} from "./consume-installer-publication-bundle.mjs";

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonical(item)]),
    );
  }
  return value;
}

function digest(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function fixture({ mutateAssets } = {}) {
  const version = "4.0.0-alpha.2";
  const releaseTag = `v${version}`;
  const sourceCommit = "1".repeat(40);
  const releaseBase = `https://github.com/kungfu-systems/kungfu/releases/download/${releaseTag}`;
  const manifestUrl = `${releaseBase}/kungfu-installer-publication-bundle.json`;
  const immutablePath = `installers/v1/alpha/${version}/${"9".repeat(64)}`;
  const bytesByAsset = new Map([
    [
      "kungfu-installer-publication.json",
      Buffer.from('{"publication":true}\n'),
    ],
    ["kungfu-installer-channel-index.json", Buffer.from('{"channel":true}\n')],
    ["kungfu-installer-trusted-keys.json", Buffer.from('{"keys":true}\n')],
    ["kungfu-install.sh", Buffer.from("#!/bin/sh\nexit 0\n")],
    ["kungfu-install.ps1", Buffer.from("exit 0\r\n")],
  ]);
  const metadata = [
    [
      "installer-publication.json",
      "publication-manifest",
      "kungfu-installer-publication.json",
    ],
    [
      "channel-index.json",
      "signed-channel-index",
      "kungfu-installer-channel-index.json",
    ],
    [
      "trusted-keys.json",
      "public-trust-anchors",
      "kungfu-installer-trusted-keys.json",
    ],
    ["install.sh", "friendly-installer", "kungfu-install.sh"],
    ["install.ps1", "friendly-installer", "kungfu-install.ps1"],
    [`${immutablePath}/install.sh`, "immutable-installer", "kungfu-install.sh"],
    [
      `${immutablePath}/install.ps1`,
      "immutable-installer",
      "kungfu-install.ps1",
    ],
  ];
  const assets = metadata.map(([assetPath, role, releaseAsset]) => {
    const bytes = bytesByAsset.get(releaseAsset);
    return {
      path: assetPath,
      role,
      contentType: assetPath.endsWith(".json")
        ? "application/json; charset=utf-8"
        : assetPath.endsWith(".sh")
          ? "text/x-shellscript; charset=utf-8"
          : "text/plain; charset=utf-8",
      size: bytes.length,
      digest: digest(bytes),
      releaseAsset,
      releaseUrl: `${releaseBase}/${releaseAsset}`,
    };
  });
  mutateAssets?.(assets);
  const releasePassport = { root: `sha256:${"4".repeat(64)}` };
  const unsigned = {
    schema: "kungfu.installer-publication-bundle/v1",
    package: { name: "@kungfu-tech/site", version: "4.0.0-alpha.1" },
    identity: {
      channel: "alpha",
      version,
      releaseTag,
      sourceCommit,
      releaseSha: "2".repeat(40),
      channelPayloadRoot: `sha256:${"3".repeat(64)}`,
      channelFileDigest: `sha256:${"5".repeat(64)}`,
      releasePassport,
    },
    distribution: {
      releaseBaseUrl: releaseBase,
      manifestAsset: "kungfu-installer-publication-bundle.json",
    },
    routes: {
      friendly: {
        "install.sh": "https://kungfu.tech/install.sh",
        "install.ps1": "https://kungfu.tech/install.ps1",
      },
      immutablePath,
    },
    cachePolicy: {
      friendly: "public,max-age=300,must-revalidate",
      immutable: "public,max-age=31536000,immutable",
    },
    assets,
  };
  const bundleRoot = digest(Buffer.from(JSON.stringify(canonical(unsigned))));
  const manifest = { ...unsigned, bundleRoot };
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  const manifestDigest = digest(manifestBytes);
  const seal = {
    schema: "kungfu-buildchain-installer-publication-bundle-seal/v1",
    bundleRoot,
    manifestDigest,
    sourceCommit,
    releaseTag,
    releasePassport,
    observations: assets.map((asset) => ({
      path: asset.path,
      releaseUrl: asset.releaseUrl,
      size: asset.size,
      digest: asset.digest,
    })),
  };
  const source = {
    schema: "kungfu-site-installer-publication-source/v1",
    status: "available",
    manifestUrl,
    bundleRoot,
    manifestDigest,
    buildchainSeal: {
      ...seal,
      sealRoot: digest(Buffer.from(JSON.stringify(canonical(seal)))),
    },
  };
  const responseBytes = new Map([[manifestUrl, manifestBytes]]);
  for (const asset of assets) {
    responseBytes.set(asset.releaseUrl, bytesByAsset.get(asset.releaseAsset));
  }
  const fetchImpl = async (url) => ({
    status: responseBytes.has(url) ? 200 : 404,
    async arrayBuffer() {
      return responseBytes.get(url) || Buffer.alloc(0);
    },
  });
  return { source, fetchImpl, responseBytes };
}

test("unavailable source carries no delegated publication authority", () => {
  assert.deepEqual(
    validateInstallerPublicationSource({
      schema: "kungfu-site-installer-publication-source/v1",
      status: "unavailable",
      reason: "no-site-owned-qualified-bundle-pin",
      manifestUrl: null,
      bundleRoot: null,
      manifestDigest: null,
      buildchainSeal: null,
    }),
    {
      status: "unavailable",
      reason: "no-site-owned-qualified-bundle-pin",
    },
  );
});

test("site resolves only a pinned and Buildchain-sealed package bundle", async () => {
  const value = fixture();
  const resolved = await resolveInstallerPublicationBundle(value);
  try {
    assert.equal(resolved.status, "available");
    assert.equal(resolved.bundleRoot, value.source.bundleRoot);
    for (const file of [
      "installer-publication.json",
      "channel-index.json",
      "trusted-keys.json",
      "install.sh",
      "install.ps1",
    ]) {
      assert.equal(
        fs.lstatSync(path.join(resolved.outputRoot, file)).isFile(),
        true,
      );
    }
  } finally {
    fs.rmSync(resolved.outputRoot, { recursive: true, force: true });
  }
});

test("site rejects unsealed, unsafe, and byte-drifted bundles", async () => {
  const unsealed = fixture();
  unsealed.source.buildchainSeal = null;
  assert.throws(
    () => validateInstallerPublicationSource(unsealed.source),
    /requires a matching Buildchain seal/,
  );

  const unsafe = fixture({
    mutateAssets(assets) {
      assets[0].path = "../installer-publication.json";
    },
  });
  await assert.rejects(
    resolveInstallerPublicationBundle(unsafe),
    /safe relative path/,
  );

  const drifted = fixture();
  const shellUrl =
    "https://github.com/kungfu-systems/kungfu/releases/download/" +
    "v4.0.0-alpha.2/kungfu-install.sh";
  drifted.responseBytes.set(shellUrl, Buffer.from("tampered\n"));
  await assert.rejects(
    resolveInstallerPublicationBundle(drifted),
    /asset bytes drifted/,
  );
});
