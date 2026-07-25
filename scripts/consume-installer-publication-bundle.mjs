#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0

import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { importBootstrapPublication } from "./import-bootstrap-publication.mjs";

const SOURCE_SCHEMA = "kungfu-site-installer-publication-source/v1";
const BUNDLE_SCHEMA = "kungfu.installer-publication-bundle/v1";
const SEAL_SCHEMA = "kungfu-buildchain-installer-publication-bundle-seal/v1";
const ROOT_PATTERN = /^sha256:[a-f0-9]{64}$/;
const SHA_PATTERN = /^[a-f0-9]{40}$/;
const RELEASE_PATH =
  /^\/kungfu-systems\/kungfu\/releases\/download\/(v[^/]+)\/([^/]+)$/;

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonical(item)]),
    );
  }
  return value;
}

function digest(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function semanticRoot(value) {
  return digest(Buffer.from(JSON.stringify(canonical(value))));
}

function requiredRoot(value, label) {
  if (!ROOT_PATTERN.test(value || "")) {
    throw new Error(`${label} must be a lowercase sha256 root`);
  }
  return value;
}

function releaseUrl(value, label) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be an exact Kungfu GitHub Release URL`);
  }
  const match = RELEASE_PATH.exec(url.pathname);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "github.com" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !match
  ) {
    throw new Error(`${label} must be an exact Kungfu GitHub Release URL`);
  }
  return { href: url.href, tag: match[1], asset: match[2] };
}

function safeRelative(value, label) {
  const normalized = String(value || "").replaceAll("\\", "/");
  if (
    !normalized ||
    normalized.startsWith("/") ||
    normalized.endsWith("/") ||
    normalized.split("/").some((part) => part === "" || part === "..")
  ) {
    throw new Error(`${label} must be a safe relative path`);
  }
  return normalized;
}

function expectedContentType(assetPath) {
  if (assetPath.endsWith(".json")) return "application/json; charset=utf-8";
  if (assetPath.endsWith(".sh")) return "text/x-shellscript; charset=utf-8";
  if (assetPath.endsWith(".ps1")) return "text/plain; charset=utf-8";
  throw new Error(`unsupported installer bundle asset type: ${assetPath}`);
}

export function validateInstallerPublicationSource(source) {
  if (source?.schema !== SOURCE_SCHEMA) {
    throw new Error(
      `installer publication source schema must be ${SOURCE_SCHEMA}`,
    );
  }
  if (source.status === "unavailable") {
    if (
      source.reason !== "no-site-owned-qualified-bundle-pin" ||
      source.manifestUrl !== null ||
      source.bundleRoot !== null ||
      source.manifestDigest !== null ||
      source.buildchainSeal !== null
    ) {
      throw new Error(
        "unavailable installer source must not carry release authority",
      );
    }
    return { status: "unavailable", reason: source.reason };
  }
  if (source.status !== "available") {
    throw new Error("installer publication source status is invalid");
  }
  const manifest = releaseUrl(source.manifestUrl, "manifestUrl");
  if (manifest.asset !== "kungfu-installer-publication-bundle.json") {
    throw new Error(
      "manifestUrl must name the installer bundle manifest asset",
    );
  }
  const bundleRoot = requiredRoot(source.bundleRoot, "bundleRoot");
  const manifestDigest = requiredRoot(source.manifestDigest, "manifestDigest");
  const seal = source.buildchainSeal;
  if (
    seal?.schema !== SEAL_SCHEMA ||
    seal.bundleRoot !== bundleRoot ||
    seal.manifestDigest !== manifestDigest ||
    seal.releaseTag !== manifest.tag ||
    !SHA_PATTERN.test(seal.sourceCommit || "") ||
    !Array.isArray(seal.observations) ||
    seal.observations.length !== 7
  ) {
    throw new Error("installer source requires a matching Buildchain seal");
  }
  const sealRoot = requiredRoot(seal.sealRoot, "buildchainSeal.sealRoot");
  const unsignedSeal = Object.fromEntries(
    Object.entries(seal).filter(([key]) => key !== "sealRoot"),
  );
  if (semanticRoot(unsignedSeal) !== sealRoot) {
    throw new Error("Buildchain seal root mismatch");
  }
  return {
    status: "available",
    manifest,
    bundleRoot,
    manifestDigest,
    seal,
  };
}

async function responseBytes(fetchImpl, url, label) {
  const response = await fetchImpl(url, {
    redirect: "manual",
    cache: "no-store",
  });
  if (response.status !== 200) {
    throw new Error(`${label} fetch failed: HTTP ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

function validateManifest(manifest, source) {
  if (manifest?.schema !== BUNDLE_SCHEMA) {
    throw new Error(`installer bundle schema must be ${BUNDLE_SCHEMA}`);
  }
  const unsigned = Object.fromEntries(
    Object.entries(manifest).filter(([key]) => key !== "bundleRoot"),
  );
  if (
    manifest.bundleRoot !== source.bundleRoot ||
    semanticRoot(unsigned) !== source.bundleRoot
  ) {
    throw new Error("installer bundle manifest root mismatch");
  }
  const base = releaseUrl(
    manifest.distribution?.releaseBaseUrl +
      "/" +
      manifest.distribution?.manifestAsset,
    "bundle distribution",
  );
  if (
    base.href !== source.manifest.href ||
    manifest.package?.name !== "@kungfu-tech/site" ||
    manifest.identity?.releaseTag !== source.manifest.tag ||
    manifest.identity?.releaseTag !== `v${manifest.identity?.version}` ||
    !SHA_PATTERN.test(manifest.identity?.releaseSha || "") ||
    manifest.identity?.sourceCommit !== source.seal.sourceCommit ||
    !ROOT_PATTERN.test(manifest.identity?.channelPayloadRoot || "") ||
    !ROOT_PATTERN.test(manifest.identity?.channelFileDigest || "") ||
    manifest.identity?.releasePassport?.root !==
      source.seal.releasePassport?.root ||
    manifest.cachePolicy?.friendly !== "public,max-age=300,must-revalidate" ||
    manifest.cachePolicy?.immutable !== "public,max-age=31536000,immutable"
  ) {
    throw new Error("installer bundle authority or cache intent mismatch");
  }
  if (!Array.isArray(manifest.assets) || manifest.assets.length !== 7) {
    throw new Error("installer bundle asset set is incomplete");
  }
  const paths = new Set();
  const topLevel = new Set([
    "installer-publication.json",
    "channel-index.json",
    "trusted-keys.json",
    "install.sh",
    "install.ps1",
  ]);
  const expectedRoles = new Map([
    ["installer-publication.json", "publication-manifest"],
    ["channel-index.json", "signed-channel-index"],
    ["trusted-keys.json", "public-trust-anchors"],
    ["install.sh", "friendly-installer"],
    ["install.ps1", "friendly-installer"],
  ]);
  const immutableDirectories = new Set();
  let immutableShell = 0;
  let immutablePowerShell = 0;
  const observations = new Map(
    source.seal.observations.map((item) => [item.path, item]),
  );
  for (const asset of manifest.assets) {
    const assetPath = safeRelative(asset.path, "bundle asset path");
    const resolved = releaseUrl(
      asset.releaseUrl,
      `release URL for ${assetPath}`,
    );
    const observation = observations.get(assetPath);
    if (
      paths.has(assetPath) ||
      asset.contentType !== expectedContentType(assetPath) ||
      !Number.isSafeInteger(asset.size) ||
      asset.size < 1 ||
      !ROOT_PATTERN.test(asset.digest || "") ||
      resolved.tag !== source.manifest.tag ||
      resolved.asset !== asset.releaseAsset ||
      observation?.releaseUrl !== asset.releaseUrl ||
      observation?.size !== asset.size ||
      observation?.digest !== asset.digest
    ) {
      throw new Error(
        `installer bundle asset is invalid or unsealed: ${assetPath}`,
      );
    }
    paths.add(assetPath);
    topLevel.delete(assetPath);
    if (assetPath.includes("/") && assetPath.endsWith("/install.sh")) {
      immutableShell += 1;
      immutableDirectories.add(path.posix.dirname(assetPath));
    }
    if (assetPath.includes("/") && assetPath.endsWith("/install.ps1")) {
      immutablePowerShell += 1;
      immutableDirectories.add(path.posix.dirname(assetPath));
    }
    const expectedRole = assetPath.includes("/")
      ? "immutable-installer"
      : expectedRoles.get(assetPath);
    if (asset.role !== expectedRole) {
      throw new Error(`installer bundle asset role is invalid: ${assetPath}`);
    }
  }
  const immutableDirectory = [...immutableDirectories][0] || "";
  const immutableParts = immutableDirectory.split("/");
  if (
    paths.size !== observations.size ||
    topLevel.size !== 0 ||
    immutableShell !== 1 ||
    immutablePowerShell !== 1 ||
    immutableDirectories.size !== 1 ||
    immutableParts.length !== 5 ||
    immutableParts[0] !== "installers" ||
    immutableParts[1] !== "v1" ||
    immutableParts[2] !== manifest.identity.channel ||
    immutableParts[3] !== manifest.identity.version ||
    !/^[a-f0-9]{64}$/.test(immutableParts[4]) ||
    manifest.routes?.immutablePath !== immutableDirectory ||
    manifest.routes?.friendly?.["install.sh"] !==
      "https://kungfu.tech/install.sh" ||
    manifest.routes?.friendly?.["install.ps1"] !==
      "https://kungfu.tech/install.ps1"
  ) {
    throw new Error(
      "installer bundle asset topology or seal coverage is incomplete",
    );
  }
}

export async function resolveInstallerPublicationBundle({
  source,
  fetchImpl = globalThis.fetch,
}) {
  const validated = validateInstallerPublicationSource(source);
  if (validated.status !== "available") return validated;
  if (typeof fetchImpl !== "function") {
    throw new Error("installer publication resolution requires fetch");
  }
  const manifestBytes = await responseBytes(
    fetchImpl,
    validated.manifest.href,
    "installer bundle manifest",
  );
  if (digest(manifestBytes) !== validated.manifestDigest) {
    throw new Error("installer bundle manifest digest mismatch");
  }
  const manifest = JSON.parse(manifestBytes);
  validateManifest(manifest, validated);
  const outputRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "kungfu-site-installer-bundle-"),
  );
  const byUrl = new Map();
  try {
    for (const asset of manifest.assets) {
      let bytes = byUrl.get(asset.releaseUrl);
      if (!bytes) {
        bytes = await responseBytes(
          fetchImpl,
          asset.releaseUrl,
          `installer bundle asset ${asset.path}`,
        );
        byUrl.set(asset.releaseUrl, bytes);
      }
      if (bytes.length !== asset.size || digest(bytes) !== asset.digest) {
        throw new Error(`installer bundle asset bytes drifted: ${asset.path}`);
      }
      const destination = path.join(outputRoot, asset.path);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, bytes, { flag: "wx" });
    }
    return {
      status: "available",
      outputRoot,
      manifest,
      bundleRoot: validated.bundleRoot,
      buildchainSealRoot: validated.seal.sealRoot,
    };
  } catch (error) {
    fs.rmSync(outputRoot, { recursive: true, force: true });
    throw error;
  }
}

function assertHonestUnavailable(outputRoot) {
  const shell = fs.readFileSync(path.join(outputRoot, "install.sh"), "utf8");
  const powershell = fs.readFileSync(
    path.join(outputRoot, "install.ps1"),
    "utf8",
  );
  if (
    !shell.includes('"status":"unavailable"') ||
    !shell.includes("exit 69") ||
    !powershell.includes('"status":"unavailable"') ||
    !powershell.includes(
      "throw 'Kungfu CLI bootstrap installer is unavailable",
    ) ||
    fs.existsSync(path.join(outputRoot, "installer-publication.json"))
  ) {
    throw new Error("site installer surface is not honestly unavailable");
  }
}

export async function consumeInstallerPublicationBundle({
  source,
  outputRoot,
  fetchImpl = globalThis.fetch,
}) {
  const destination = path.resolve(outputRoot);
  const resolved = await resolveInstallerPublicationBundle({
    source,
    fetchImpl,
  });
  if (resolved.status === "unavailable") {
    assertHonestUnavailable(destination);
    return resolved;
  }
  try {
    const projection = importBootstrapPublication({
      publicationRoot: resolved.outputRoot,
      channelIndexPath: path.join(resolved.outputRoot, "channel-index.json"),
      trustedKeysPath: path.join(resolved.outputRoot, "trusted-keys.json"),
      outputRoot: destination,
    });
    return {
      status: "available",
      bundleRoot: resolved.bundleRoot,
      buildchainSealRoot: resolved.buildchainSealRoot,
      projection,
    };
  } finally {
    fs.rmSync(resolved.outputRoot, { recursive: true, force: true });
  }
}

function parseArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === "--source") options.sourcePath = args[++index];
    else if (value === "--output-root") options.outputRoot = args[++index];
    else throw new Error(`unknown argument: ${value}`);
  }
  if (!options.sourcePath || !options.outputRoot) {
    throw new Error("--source and --output-root are required");
  }
  return options;
}

async function main(args) {
  const options = parseArgs(args);
  const source = JSON.parse(fs.readFileSync(path.resolve(options.sourcePath)));
  const result = await consumeInstallerPublicationBundle({
    source,
    outputRoot: options.outputRoot,
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(
      `consume-installer-publication-bundle: ${error.message}\n`,
    );
    process.exitCode = 1;
  });
}
