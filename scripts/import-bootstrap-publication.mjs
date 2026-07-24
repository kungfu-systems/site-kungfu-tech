#!/usr/bin/env node

import {
  createHash,
  createPublicKey,
  verify as verifySignature,
} from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const CHANNEL_SCHEMA = "kungfu.release-channel-index/v1";
const INSTALLER_SCHEMA = "kungfu.bootstrap-installer-publication/v1";
const ARCHIVE_POLICY = "kungfu-buildchain-publication-archive-policy";
const SITE_MANIFEST = "kungfu-bootstrap-installer-web-surface/v1";
const CANONICAL_ORIGIN = "https://kungfu.tech";

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
  if (
    value === null
    || typeof value === "string"
    || typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
    return value;
  }
  throw new Error("canonical JSON contains an unsupported value");
}

function canonicalBytes(value) {
  const ascii = JSON.stringify(canonical(value)).replace(
    /[\u007f-\uffff]/g,
    (character) =>
      `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
  return Buffer.from(ascii, "ascii");
}

function sha256(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function contentRoot(value) {
  return sha256(canonicalBytes(value));
}

function readJson(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`cannot read ${label}: ${error.message}`);
  }
}

function requireRoot(value, label) {
  if (!/^sha256:[a-f0-9]{64}$/.test(value || "")) {
    throw new Error(`${label} must be a sha256 root`);
  }
  return value;
}

function safeRelative(value, label) {
  const normalized = String(value || "")
    .replaceAll("\\", "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
  if (
    !normalized
    || normalized.split("/").includes("..")
    || path.isAbsolute(normalized)
  ) {
    throw new Error(`${label} must be a safe relative path`);
  }
  return normalized;
}

function publicUrl(value, label) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be a public HTTPS URL`);
  }
  if (
    url.protocol !== "https:"
    || url.username
    || url.password
    || url.search
    || url.hash
  ) {
    throw new Error(`${label} must be a public HTTPS URL`);
  }
  return url;
}

function trustedKeyMap(value) {
  const entries = Array.isArray(value)
    ? value.map((item) => [item.keyId, item.publicKey])
    : Object.entries(value || {});
  const keys = Object.fromEntries(entries);
  for (const [keyId, publicKey] of Object.entries(keys)) {
    if (
      !/^[0-9A-Za-z][0-9A-Za-z._-]*$/.test(keyId)
      || !/^[A-Za-z0-9+/]{43}=$/.test(publicKey || "")
      || Buffer.from(publicKey, "base64").length !== 32
    ) {
      throw new Error(`trusted release-channel key is invalid: ${keyId}`);
    }
  }
  if (Object.keys(keys).length === 0) {
    throw new Error("at least one trusted release-channel key is required");
  }
  return keys;
}

function verifyChannel(channel, keys) {
  if (channel?.schema !== CHANNEL_SCHEMA) {
    throw new Error("unsupported release-channel schema");
  }
  requireRoot(channel.payloadRoot, "release-channel payloadRoot");
  const signed = Object.fromEntries(
    Object.entries(channel).filter(([key]) => key !== "signature"),
  );
  const payload = Object.fromEntries(
    Object.entries(signed).filter(([key]) => key !== "payloadRoot"),
  );
  if (contentRoot(payload) !== channel.payloadRoot) {
    throw new Error("release-channel payload root mismatch");
  }
  const signature = channel.signature;
  const rawPublicKey = keys[signature?.keyId];
  if (
    signature?.algorithm !== "ed25519"
    || typeof signature.value !== "string"
    || !rawPublicKey
  ) {
    throw new Error("release-channel signature has no trusted key");
  }
  const publicKey = createPublicKey({
    key: Buffer.concat([
      Buffer.from("302a300506032b6570032100", "hex"),
      Buffer.from(rawPublicKey, "base64"),
    ]),
    format: "der",
    type: "spki",
  });
  if (
    !verifySignature(
      null,
      canonicalBytes(signed),
      publicKey,
      Buffer.from(signature.value, "base64"),
    )
  ) {
    throw new Error("release-channel signature did not verify");
  }
}

function readAsset(sourceRoot, relativePath, expected) {
  const safePath = safeRelative(relativePath, "installer asset path");
  const absolute = path.resolve(sourceRoot, safePath);
  const root = path.resolve(sourceRoot);
  if (!absolute.startsWith(`${root}${path.sep}`)) {
    throw new Error(`installer asset escapes publication root: ${safePath}`);
  }
  const stat = fs.lstatSync(absolute);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`installer asset is not a regular file: ${safePath}`);
  }
  const bytes = fs.readFileSync(absolute);
  if (
    bytes.length !== expected.size
    || sha256(bytes) !== expected.digest
  ) {
    throw new Error(`installer asset differs from publication: ${safePath}`);
  }
  return bytes;
}

function verifyPublication(publication, sourceRoot, channel, channelBytes) {
  if (publication?.schema !== INSTALLER_SCHEMA) {
    throw new Error("unsupported installer-publication schema");
  }
  if (publication.channel !== "alpha" || publication.installerVersion !== "v1") {
    throw new Error("only the alpha v1 bootstrap publication is admitted");
  }
  requireRoot(publication.channelPayloadRoot, "channelPayloadRoot");
  requireRoot(publication.channelFileDigest, "channelFileDigest");
  requireRoot(publication.releasePassport?.root, "releasePassport.root");
  if (
    publication.channelPayloadRoot !== channel.payloadRoot
    || publication.channelFileDigest !== sha256(channelBytes)
    || publication.sourceCommit !== channel.sourceCommit
  ) {
    throw new Error("installer and release-channel authority differ");
  }
  if (!/^[a-f0-9]{40}$/.test(publication.sourceCommit || "")) {
    throw new Error("installer sourceCommit is invalid");
  }
  const expectedChannelUrl = `${CANONICAL_ORIGIN}/.well-known/kungfu/alpha.json`;
  if (publicUrl(publication.channelUrl, "channelUrl").href !== expectedChannelUrl) {
    throw new Error(`channelUrl must be ${expectedChannelUrl}`);
  }
  const expectedSnapshotUrl =
    `${CANONICAL_ORIGIN}/channels/alpha/${channel.payloadRoot.slice(7)}/index.json`;
  if (
    publicUrl(
      publication.channelSnapshotUrl,
      "channelSnapshotUrl",
    ).href !== expectedSnapshotUrl
  ) {
    throw new Error(`channelSnapshotUrl must be ${expectedSnapshotUrl}`);
  }
  const immutablePath = safeRelative(
    publication.immutablePath,
    "installer immutablePath",
  );
  const expectedInstallerPath =
    `installers/v1/alpha/${channel.payloadRoot.slice(7, 23)}`;
  if (immutablePath !== expectedInstallerPath) {
    throw new Error(`installer immutablePath must be ${expectedInstallerPath}`);
  }
  const identities = new Set();
  const versions = new Set();
  if (
    !Array.isArray(publication.entries)
    || publication.entries.length === 0
    || publication.entries.some(
      (entry) => {
        const identity = `${entry.platform}/${entry.architecture}`;
        const duplicate = identities.has(identity);
        identities.add(identity);
        versions.add(entry.version);
        return (
          duplicate
          || entry.sourceCommit !== publication.sourceCommit
          || !entry.artifactSignature
          || !/^sha256:[a-f0-9]{64}$/.test(entry.artifactDigest || "")
        );
      },
    )
    || versions.size !== 1
  ) {
    throw new Error("installer platform evidence is incomplete");
  }
  const expectedNames = new Set(["install.sh", "install.ps1"]);
  const assets = (publication.assets || []).map((asset) => {
    if (!expectedNames.delete(asset.name)) {
      throw new Error(`unexpected or duplicate installer asset: ${asset.name}`);
    }
    requireRoot(asset.digest, `${asset.name}.digest`);
    if (!Number.isSafeInteger(asset.size) || asset.size < 1) {
      throw new Error(`${asset.name}.size is invalid`);
    }
    const friendly = readAsset(sourceRoot, asset.name, asset);
    const immutable = readAsset(
      sourceRoot,
      `${immutablePath}/${asset.name}`,
      asset,
    );
    if (!friendly.equals(immutable)) {
      throw new Error(`friendly and immutable installer bytes differ: ${asset.name}`);
    }
    const friendlyUrl = publicUrl(asset.friendlyUrl, `${asset.name}.friendlyUrl`);
    const immutableUrl = publicUrl(
      asset.immutableUrl,
      `${asset.name}.immutableUrl`,
    );
    if (
      friendlyUrl.href !== `${CANONICAL_ORIGIN}/${asset.name}`
      || immutableUrl.href !==
        `${CANONICAL_ORIGIN}/${immutablePath}/${asset.name}`
    ) {
      throw new Error(`installer URL mapping is invalid: ${asset.name}`);
    }
    return { name: asset.name, bytes: friendly };
  });
  if (expectedNames.size !== 0) {
    throw new Error("installer publication must contain install.sh and install.ps1");
  }
  return {
    immutablePath,
    assets,
    version: [...versions][0],
    platforms: [...identities].sort(),
  };
}

function appendVersion(manifest, publicationId, version) {
  let publication = manifest.publications.find(
    (item) => item.id === publicationId,
  );
  if (!publication) {
    publication = { id: publicationId, versions: [] };
    manifest.publications.push(publication);
  }
  const existing = publication.versions.find(
    (item) => item.version === version.version,
  );
  if (existing && existing.immutablePath !== version.immutablePath) {
    throw new Error(`append-only publication version moved: ${version.version}`);
  }
  if (!existing) publication.versions.push(version);
  publication.versions.sort((left, right) =>
    left.version.localeCompare(right.version),
  );
}

function publicationManifest(outputRoot, publication, immutablePath) {
  const manifestPath = path.join(outputRoot, "manifest.json");
  const manifest = fs.existsSync(manifestPath)
    ? readJson(manifestPath, "existing publication archive manifest")
    : {
        schemaVersion: 1,
        contract: SITE_MANIFEST,
        archivePolicy: {
          contract: ARCHIVE_POLICY,
          deploymentBoundary: "append-only immutable version prefixes",
        },
        installerPublication: "installer-publication.json",
        publications: [],
      };
  if (
    manifest.schemaVersion !== 1
    || manifest.contract !== SITE_MANIFEST
    || manifest.archivePolicy?.contract !== ARCHIVE_POLICY
    || manifest.installerPublication !== "installer-publication.json"
    || !Array.isArray(manifest.publications)
  ) {
    throw new Error("existing publication archive manifest is incompatible");
  }
  const channelPath = `channels/alpha/${publication.channelPayloadRoot.slice(7)}`;
  appendVersion(manifest, "kungfu-bootstrap-installer-alpha", {
    version: publication.channelPayloadRoot,
    immutablePath: `/${immutablePath}/`,
  });
  appendVersion(manifest, "kungfu-release-channel-alpha", {
    version: publication.channelPayloadRoot,
    immutablePath: `/${channelPath}/`,
  });
  manifest.publications.sort((left, right) => left.id.localeCompare(right.id));
  return { manifest, channelPath };
}

function assertImmutable(destination, bytes) {
  if (!fs.existsSync(destination)) return;
  if (!fs.lstatSync(destination).isFile()) {
    throw new Error(`immutable destination is not a regular file: ${destination}`);
  }
  if (!fs.readFileSync(destination).equals(bytes)) {
    throw new Error(`immutable destination already has different bytes: ${destination}`);
  }
}

function atomicWrite(destination, bytes) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, bytes);
  fs.renameSync(temporary, destination);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderInstallerPage({
  outputRoot,
  publication,
  version,
  platforms,
}) {
  const pagePath = path.join(outputRoot, "install", "index.html");
  const page = fs.readFileSync(pagePath, "utf8");
  const start = "    <!-- bootstrap-publication:start -->";
  const end = "    <!-- bootstrap-publication:end -->";
  const startIndex = page.indexOf(start);
  const endIndex = page.indexOf(end);
  if (
    startIndex < 0
    || endIndex < 0
    || endIndex <= startIndex
    || page.indexOf(start, startIndex + start.length) >= 0
    || page.indexOf(end, endIndex + end.length) >= 0
  ) {
    throw new Error("installer page has no unique publication projection block");
  }
  const assets = publication.assets
    .map(
      (asset) => `
        <p><a href="${escapeHtml(new URL(asset.immutableUrl).pathname)}"><code>${escapeHtml(asset.name)}</code></a> · ${asset.size} bytes · <code>${escapeHtml(asset.digest)}</code></p>`,
    )
    .join("");
  const live = `${start}
    <div class="state">
      <strong>Signed Alpha ${escapeHtml(version)} is publicly available.</strong>
      <p>The canonical channel, immutable installers, release artifacts, and public read-back bind source <code>${escapeHtml(publication.sourceCommit)}</code> and channel root <code>${escapeHtml(publication.channelPayloadRoot)}</code>.</p>
    </div>

    <div class="grid">
      <section>
        <h2>macOS and Linux</h2>
        <p>Convenience install from the revalidated canonical route:</p>
        <code class="command">curl --fail --proto '=https' --tlsv1.2 https://kungfu.tech/install.sh | sh</code>
        <p>For higher assurance, download the immutable script below, compare its digest, inspect it, then execute it.</p>
      </section>

      <section>
        <h2>Windows PowerShell</h2>
        <p>Convenience install from the revalidated canonical route:</p>
        <code class="command">irm https://kungfu.tech/install.ps1 | iex</code>
        <p>The selected Windows archive is also required to carry valid Authenticode trust evidence.</p>
      </section>

      <section class="wide">
        <h2>Inspect and pin before execution</h2>
        <p>Channel: <a href="/.well-known/kungfu/alpha.json"><code>/.well-known/kungfu/alpha.json</code></a> · <code>${escapeHtml(publication.channelFileDigest)}</code></p>
        <p>Immutable channel: <a href="${escapeHtml(new URL(publication.channelSnapshotUrl).pathname)}"><code>${escapeHtml(new URL(publication.channelSnapshotUrl).pathname)}</code></a></p>
        <p>Release Passport: <code>${escapeHtml(publication.releasePassport.ref)}</code> · <code>${escapeHtml(publication.releasePassport.root)}</code></p>
        <p>Qualified targets: <code>${escapeHtml(platforms.join(", "))}</code></p>${assets}
      </section>
    ${end}`;
  return Buffer.from(
    `${page.slice(0, startIndex)}${live}${page.slice(endIndex + end.length)}`,
  );
}

export function importBootstrapPublication({
  publicationRoot,
  channelIndexPath,
  trustedKeysPath,
  outputRoot,
}) {
  const sourceRoot = path.resolve(publicationRoot);
  const destinationRoot = path.resolve(outputRoot);
  const publicationPath = path.join(sourceRoot, "installer-publication.json");
  const publicationBytes = fs.readFileSync(publicationPath);
  const publication = JSON.parse(publicationBytes);
  const channelBytes = fs.readFileSync(path.resolve(channelIndexPath));
  const channel = JSON.parse(channelBytes);
  const keys = trustedKeyMap(
    readJson(path.resolve(trustedKeysPath), "trusted release-channel keys"),
  );
  verifyChannel(channel, keys);
  const verified = verifyPublication(
    publication,
    sourceRoot,
    channel,
    channelBytes,
  );
  const { manifest, channelPath } = publicationManifest(
    destinationRoot,
    publication,
    verified.immutablePath,
  );
  const installerPage = renderInstallerPage({
    outputRoot: destinationRoot,
    publication,
    version: verified.version,
    platforms: verified.platforms,
  });
  const writes = [
    ...verified.assets.flatMap((asset) => [
      {
        immutable: true,
        path: `${verified.immutablePath}/${asset.name}`,
        bytes: asset.bytes,
      },
      { immutable: false, path: asset.name, bytes: asset.bytes },
    ]),
    {
      immutable: true,
      path: `${channelPath}/index.json`,
      bytes: channelBytes,
    },
    {
      immutable: false,
      path: ".well-known/kungfu/alpha.json",
      bytes: channelBytes,
    },
    {
      immutable: false,
      path: "installer-publication.json",
      bytes: publicationBytes,
    },
    {
      immutable: false,
      path: "manifest.json",
      bytes: Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`),
    },
    {
      immutable: false,
      path: "install/index.html",
      bytes: installerPage,
    },
  ];
  for (const item of writes.filter((item) => item.immutable)) {
    assertImmutable(path.join(destinationRoot, item.path), item.bytes);
  }
  for (const item of writes) {
    atomicWrite(path.join(destinationRoot, item.path), item.bytes);
  }
  return {
    contract: "kungfu-bootstrap-installer-site-projection/v1",
    channel: publication.channel,
    sourceCommit: publication.sourceCommit,
    channelPayloadRoot: publication.channelPayloadRoot,
    channelFileDigest: publication.channelFileDigest,
    installerImmutablePath: verified.immutablePath,
    channelImmutablePath: channelPath,
    files: writes.map((item) => item.path).sort(),
  };
}

function parseArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === "--publication-root") options.publicationRoot = args[++index];
    else if (value === "--channel-index") options.channelIndexPath = args[++index];
    else if (value === "--trusted-keys") options.trustedKeysPath = args[++index];
    else if (value === "--output-root") options.outputRoot = args[++index];
    else throw new Error(`unknown argument: ${value}`);
  }
  for (const field of [
    "publicationRoot",
    "channelIndexPath",
    "trustedKeysPath",
    "outputRoot",
  ]) {
    if (!options[field]) throw new Error(`${field} is required`);
  }
  return options;
}

if (
  process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const result = importBootstrapPublication(parseArgs(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`import-bootstrap-publication: ${error.message}\n`);
    process.exitCode = 1;
  }
}
