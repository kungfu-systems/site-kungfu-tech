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
const EXACT_MARK = "Kungfu UNGFU™";
const SOFTWARE_DESCRIPTION =
  "Downloadable software for durable AI-agent work, inspection, and development workflows.";
const ALPHA3_WINDOWS_COMPATIBILITY = {
  sourceCommit: "6d99af738b78eccb48885a5fd59b88a0e5e4900a",
  version: "4.0.0-alpha.3",
  sourceDigest:
    "sha256:ee8d9f797252436a43b1c3b23282fd192744a821b855111b42c7cde4975db6a6",
  projectedDigest:
    "sha256:792c48e70c68ef6a8d8d9cafe0fb16c46bef06806ab98d84044eefbaaf66dfb0",
  sourceText: "owned outside $Launcher: $($Existing.Source)",
  projectedText: "owned outside ${Launcher}: $($Existing.Source)",
};

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
  const productVersions = new Set(
    (publication.entries || []).map((entry) => entry.version),
  );
  if (
    productVersions.size !== 1
    || !/^[0-9A-Za-z][0-9A-Za-z.+-]*$/.test([...productVersions][0] || "")
  ) {
    throw new Error("installer publication must bind one safe product version");
  }
  const productVersion = [...productVersions][0];
  const expectedInstallerPath =
    `installers/v1/alpha/${productVersion}/${channel.payloadRoot.slice(7)}`;
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

const DESKTOP_PLATFORM_LABELS = {
  darwin: "macOS",
  linux: "Linux",
  win32: "Windows",
};

const DESKTOP_ARCHITECTURE_LABELS = {
  arm64: "Apple silicon",
  x64: "x64",
};

function desktopDownloads(channel, publication, version) {
  const releasePath =
    `/kungfu-systems/kungfu/releases/download/v${version}/`;
  const channelEntries = new Map(
    (channel.entries || []).map((entry) => [
      `${entry.platform}/${entry.architecture}`,
      entry,
    ]),
  );
  const downloads = publication.entries.flatMap((publishedEntry) => {
    const identity =
      `${publishedEntry.platform}/${publishedEntry.architecture}`;
    const entry = channelEntries.get(identity);
    const platformLabel = DESKTOP_PLATFORM_LABELS[publishedEntry.platform];
    const architectureLabel =
      DESKTOP_ARCHITECTURE_LABELS[publishedEntry.architecture]
      || publishedEntry.architecture;
    const desktopArtifacts = (entry?.manifest?.artifacts || []).filter(
      (artifact) => artifact.kind === "desktop",
    );
    if (
      !entry
      || !platformLabel
      || entry.manifest?.sourceCommit !== publication.sourceCommit
      || entry.manifest?.productVersion !== version
      || entry.manifestRoot !== publishedEntry.manifestRoot
      || entry.artifactRoot !== publishedEntry.artifactRoot
    ) {
      throw new Error(`desktop download evidence is incomplete: ${identity}`);
    }
    if (desktopArtifacts.length === 0) return [];
    if (desktopArtifacts.length !== 1) {
      throw new Error(`desktop download evidence is ambiguous: ${identity}`);
    }
    const artifact = desktopArtifacts[0];
    const url = publicUrl(artifact.url, `${identity} desktop URL`);
    requireRoot(artifact.digest, `${identity} desktop digest`);
    if (
      url.hostname !== "github.com"
      || !url.pathname.startsWith(releasePath)
      || !Number.isSafeInteger(artifact.size)
      || artifact.size < 1
      || typeof artifact.signature !== "string"
      || artifact.signature.length === 0
    ) {
      throw new Error(`desktop download authority is invalid: ${identity}`);
    }
    const encodedName = url.pathname.slice(releasePath.length);
    if (!encodedName || encodedName.includes("/")) {
      throw new Error(`desktop download asset name is invalid: ${identity}`);
    }
    // GitHub normalizes spaces in uploaded release asset names to dots. The
    // signed product manifest retains the pre-upload filename, so project the
    // deterministic GitHub asset name before exposing the public download URL.
    const filename = decodeURIComponent(encodedName).replaceAll(" ", ".");
    url.pathname = `${releasePath}${filename}`;
    return [{
      id: `${publishedEntry.platform}-${publishedEntry.architecture}`,
      platform: publishedEntry.platform,
      platformLabel,
      architectureLabel,
      url: url.href,
      filename,
      size: artifact.size,
      digest: artifact.digest,
    }];
  });
  if (new Set(downloads.map((download) => download.id)).size !== downloads.length) {
    throw new Error("desktop download identities must be unique");
  }
  return downloads;
}

function mebibytes(bytes) {
  return `${Math.round(bytes / 1024 / 1024)} MiB`;
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
    (item) =>
      item.version === version.version &&
      item.immutablePath === version.immutablePath,
  );
  if (!existing) publication.versions.push(version);
  publication.versions.sort(
    (left, right) =>
      left.version.localeCompare(right.version) ||
      left.immutablePath.localeCompare(right.immutablePath),
  );
}

function publicationManifest(
  outputRoot,
  publication,
  immutablePath,
  productVersion,
) {
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
    version: productVersion,
    payloadRoot: publication.channelPayloadRoot,
    immutablePath: `/${immutablePath}/`,
  });
  appendVersion(manifest, "kungfu-release-channel-alpha", {
    version: productVersion,
    payloadRoot: publication.channelPayloadRoot,
    immutablePath: `/${channelPath}/`,
  });
  appendVersion(manifest, "kungfu-ungfu-acquisition-evidence", {
    version: productVersion,
    payloadRoot: publication.channelPayloadRoot,
    immutablePath:
      `/evidence/ungfu/alpha/${productVersion}/${publication.channelPayloadRoot.slice(7)}/`,
  });
  manifest.ungfuAcquisitionEvidence =
    ".well-known/kungfu/ungfu-release-acquisition.json";
  manifest.publications.sort((left, right) => left.id.localeCompare(right.id));
  return { manifest, channelPath };
}

function acquisitionEvidence(publication, version) {
  const root = publication.channelPayloadRoot.slice(7);
  const immutablePath = `evidence/ungfu/alpha/${version}/${root}`;
  const acquisitionUrl = `${CANONICAL_ORIGIN}/install.sh`;
  const publicUrl = `${CANONICAL_ORIGIN}/install/`;
  const renderedEvidence = `${CANONICAL_ORIGIN}/${immutablePath}/acquisition.html`;
  const evidenceIndex = `${CANONICAL_ORIGIN}/${immutablePath}/index.json`;
  const artifactRoots = [
    ...(publication.entries || []).map((entry) => ({
      name: `${entry.platform}/${entry.architecture}`,
      sha256: entry.artifactDigest,
      manifestRoot: entry.manifestRoot,
      artifactRoot: entry.artifactRoot,
    })),
    ...(publication.assets || []).map((asset) => ({
      name: asset.name,
      sha256: asset.digest,
    })),
  ];
  const index = {
    schemaVersion: 1,
    contract: "kungfu-site-ungfu-acquisition-evidence",
    id: "ungfu-public-acquisition",
    state: "released-publication",
    release: {
      sourceSha: publication.sourceCommit,
      tag: `v${version}`,
      channel: publication.channel,
      version,
      deploymentCoordinate:
        `github-release:kungfu-systems/kungfu@v${version}`,
      channelPayloadRoot: publication.channelPayloadRoot,
      channelFileDigest: publication.channelFileDigest,
      releasePassport: publication.releasePassport,
      artifactRoots,
    },
    acquisition: {
      id: "install-page",
      kind: "public-release-download",
      exactMark: EXACT_MARK,
      softwareDescription: SOFTWARE_DESCRIPTION,
      publicUrl,
      acquisitionUrl,
      renderedEvidence,
      evidenceIndex,
    },
    legalBoundary: {
      firstUseDateClaim: null,
      legalConclusion: "not-made",
      registrationStatusClaim: "none",
      counselReviewRequired: true,
    },
  };
  const rendered = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Kungfu Alpha ${escapeHtml(version)} acquisition evidence</title>
</head>
<body>
  <main>
    <section data-ungfu-release-acquisition data-version="${escapeHtml(version)}" data-channel="${escapeHtml(publication.channel)}">
      <h1>${EXACT_MARK}</h1>
      <p>${SOFTWARE_DESCRIPTION}</p>
      <p>Version <strong>${escapeHtml(version)}</strong> · Channel <strong>${escapeHtml(publication.channel)}</strong></p>
      <p><a href="${acquisitionUrl}">Install the signed Kungfu CLI</a></p>
      <p>Source <code>${escapeHtml(publication.sourceCommit)}</code></p>
      <p>Channel root <code>${escapeHtml(publication.channelPayloadRoot)}</code></p>
      <p>Release Passport <code>${escapeHtml(publication.releasePassport.ref)}</code> · <code>${escapeHtml(publication.releasePassport.root)}</code></p>
      <p><a href="${evidenceIndex}">Machine-readable evidence index</a></p>
    </section>
  </main>
</body>
</html>
`;
  return {
    immutablePath,
    index,
    rendered: Buffer.from(rendered),
  };
}

function releaseStatus(publication, version, acquisition, siteSourceSha) {
  if (!/^[0-9a-f]{40}$/.test(siteSourceSha)) {
    throw new Error("BUILDCHAIN_SITE_SOURCE_SHA must be an exact site commit");
  }
  return {
    schema: "kungfu.release-status/v1",
    status: "current-release",
    releasedUseClaim: true,
    reason: "signed-publication-and-readback-qualified",
    documentationUrl: `${CANONICAL_ORIGIN}/install/`,
    release: {
      sourceSha: publication.sourceCommit,
      siteSourceSha,
      tag: `v${version}`,
      channel: publication.channel,
      version,
      channelPayloadRoot: publication.channelPayloadRoot,
      releasePassport: publication.releasePassport,
    },
    acquisitionEvidence: {
      url: `${CANONICAL_ORIGIN}/.well-known/kungfu/ungfu-release-acquisition.json`,
      root: contentRoot(acquisition.index),
    },
    legalBoundary: {
      firstUseDateClaim: null,
      legalConclusion: "not-made",
      registrationStatusClaim: "none",
    },
  };
}

function projectSiteInstallerCompatibility(publication, verified) {
  const compatibility = ALPHA3_WINDOWS_COMPATIBILITY;
  if (
    publication.sourceCommit !== compatibility.sourceCommit
    || verified.version !== compatibility.version
  ) {
    return {
      publication,
      assets: verified.assets,
      immutablePath: verified.immutablePath,
      receipt: null,
    };
  }
  const sourceAsset = verified.assets.find((asset) => asset.name === "install.ps1");
  if (!sourceAsset || sha256(sourceAsset.bytes) !== compatibility.sourceDigest) {
    throw new Error("Alpha.3 Windows installer compatibility source digest drifted");
  }
  const source = sourceAsset.bytes.toString("utf8");
  const occurrences = source.split(compatibility.sourceText).length - 1;
  if (occurrences !== 1) {
    throw new Error("Alpha.3 Windows installer compatibility source text drifted");
  }
  const projectedBytes = Buffer.from(
    source.replace(compatibility.sourceText, compatibility.projectedText),
    "utf8",
  );
  if (sha256(projectedBytes) !== compatibility.projectedDigest) {
    throw new Error("Alpha.3 Windows installer compatibility projection digest drifted");
  }
  const immutablePath =
    `installers/site/v1/alpha/${verified.version}/${compatibility.projectedDigest.slice(7)}`;
  const assets = verified.assets.map((asset) =>
    asset.name === "install.ps1" ? { ...asset, bytes: projectedBytes } : asset,
  );
  const publicationAssets = publication.assets.map((asset) => {
    const bytes = assets.find((candidate) => candidate.name === asset.name)?.bytes;
    if (!bytes) throw new Error(`missing projected installer asset: ${asset.name}`);
    return {
      ...asset,
      size: bytes.length,
      digest: sha256(bytes),
      immutableUrl: `${CANONICAL_ORIGIN}/${immutablePath}/${asset.name}`,
    };
  });
  const sitePublication = {
    ...publication,
    immutablePath,
    assets: publicationAssets,
  };
  const receipt = {
    schema: "kungfu.site-installer-compatibility/v1",
    id: "alpha3-windows-launcher-variable-delimiter",
    release: {
      sourceCommit: publication.sourceCommit,
      version: verified.version,
      tag: `v${verified.version}`,
      upstreamImmutablePath: verified.immutablePath,
      siteImmutablePath: immutablePath,
    },
    source: {
      asset: "install.ps1",
      digest: compatibility.sourceDigest,
    },
    projection: {
      asset: "install.ps1",
      digest: compatibility.projectedDigest,
      replacementCount: occurrences,
      reason: "PowerShell variable-name delimiter required before a colon",
    },
  };
  return {
    publication: sitePublication,
    assets,
    immutablePath,
    receipt,
  };
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
  desktop,
  acquisition,
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
  const platformTabs = desktop
    .map(
      (download, index) => `
          <button type="button" role="tab" aria-selected="${index === 0}" aria-controls="desktop-panel-${escapeHtml(download.id)}" tabindex="${index === 0 ? "0" : "-1"}" data-desktop-platform="${escapeHtml(download.id)}">${escapeHtml(download.platformLabel)}</button>`,
    )
    .join("");
  const platformPanels = desktop
    .map(
      (download, index) => `
        <div class="desktop-download-panel" id="desktop-panel-${escapeHtml(download.id)}" role="tabpanel" data-desktop-panel="${escapeHtml(download.id)}"${index === 0 ? "" : " hidden"}>
          <div>
            <strong>${escapeHtml(download.platformLabel)} · ${escapeHtml(download.architectureLabel)}</strong>
            <p>${escapeHtml(download.filename)} · ${escapeHtml(mebibytes(download.size))}</p>
          </div>
          <a class="download-button" href="${escapeHtml(download.url)}">Download for ${escapeHtml(download.platformLabel)}</a>
        </div>`,
    )
    .join("");
  const desktopDigests = desktop
    .map(
      (download) => `
        <p>${escapeHtml(download.platformLabel)} GUI: <a href="${escapeHtml(download.url)}"><code>${escapeHtml(download.filename)}</code></a> · ${download.size} bytes · <code>${escapeHtml(download.digest)}</code></p>`,
    )
    .join("");
  const live = `${start}
    <div class="state release-summary">
      <span class="status-dot" aria-hidden="true"></span>
      <div>
        <strong>Alpha ${escapeHtml(version)} is ready to install.</strong>
        <p>Current signed release · ${escapeHtml(desktop.length)} desktop platforms · standalone CLI</p>
      </div>
    </div>

    <div class="grid">
      <section class="wide release-acquisition command-line-section" id="command-line" data-ungfu-release-acquisition data-version="${escapeHtml(version)}" data-channel="${escapeHtml(publication.channel)}">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Start here</p>
            <h2>Command Line</h2>
          </div>
          <span class="version-chip">${escapeHtml(version)} · ${escapeHtml(publication.channel)}</span>
        </div>
        <p class="section-lead">Install the standalone Kungfu CLI from the signed release channel. Choose the command for your operating system.</p>
        <div class="command-grid">
          <article class="command-card">
            <p class="command-platform">macOS &amp; Linux</p>
            <div class="command-block">
              <code class="command">curl -fsSL https://kungfu.tech/install.sh | sh</code>
              <button class="copy-button" type="button" data-copy-command aria-label="Copy macOS and Linux install command" aria-live="polite">Copy</button>
            </div>
            <p>Per-user install. No <code>sudo</code> and no shell-profile edits.</p>
          </article>

          <article class="command-card">
            <p class="command-platform">Windows PowerShell</p>
            <div class="command-block">
              <code class="command">irm https://kungfu.tech/install.ps1 | iex</code>
              <button class="copy-button" type="button" data-copy-command aria-label="Copy Windows PowerShell install command" aria-live="polite">Copy</button>
            </div>
            <p>Per-user install. No Administrator rights or registry edits.</p>
          </article>
        </div>
        <!-- managed-installer:start -->
        <p class="managed-installer-note">This route is projected from the reviewed release bootstrap publication.</p>
        <!-- managed-installer:end -->
      </section>

      <section class="wide desktop-downloads">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Visual workspace</p>
            <h2>Desktop GUI</h2>
          </div>
          <span class="version-chip">Alpha available</span>
        </div>
        <p class="section-lead">Choose your platform and download the qualified GUI artifact directly from the Kungfu GitHub Release.</p>
        <div class="platform-tabs" role="tablist" aria-label="Choose a desktop platform">${platformTabs}
        </div>
        <div class="desktop-download-panels">${platformPanels}
        </div>
        <p class="alpha-note">This is an Alpha, not a stable or generally available release. Existing package-manager installations remain under their current owner. The qualified Windows Alpha artifact may be unsigned; Authenticode is not a qualification requirement for this Alpha.</p>
      </section>

      <section class="wide workspace-guidance" aria-labelledby="workspace-git-heading">
        <div class="workspace-guidance-heading">
          <p class="eyebrow">First project use</p>
          <h2 id="workspace-git-heading">When <code>.kungfu/</code> appears</h2>
        </div>
        <div class="workspace-guidance-copy">
          <p>It is Kungfu's project-local workspace for durable Work and runtime state. Do not delete it or add the whole directory to Git. Before staging anything, ask your Agent to run <code>kungfu agent map --json</code> and follow its <code>workspaceGit</code> policy. Most contents stay local; Kungfu never stages, commits, or pushes files for you.</p>
          <a href="https://github.com/kungfu-systems/kungfu/blob/dev/v4/v4.0/docs/architecture/kungfu-format-contract.md#git-publication-boundary">Read workspace and Git guidance</a>
        </div>
      </section>

      <section class="wide release-evidence">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Release evidence</p>
            <h2>Inspect and verify</h2>
          </div>
          <a href="/${escapeHtml(acquisition.immutablePath)}/acquisition.html">Rendered evidence</a>
        </div>
        <p>${EXACT_MARK} · ${SOFTWARE_DESCRIPTION}</p>
        <p>Source: <code>${escapeHtml(publication.sourceCommit)}</code> · Channel root: <code>${escapeHtml(publication.channelPayloadRoot)}</code></p>
        <p>Channel: <a href="/.well-known/kungfu/alpha.json"><code>/.well-known/kungfu/alpha.json</code></a> · <code>${escapeHtml(publication.channelFileDigest)}</code></p>
        <p>Immutable channel: <a href="${escapeHtml(new URL(publication.channelSnapshotUrl).pathname)}"><code>${escapeHtml(new URL(publication.channelSnapshotUrl).pathname)}</code></a></p>
        <p>Release Passport: <code>${escapeHtml(publication.releasePassport.ref)}</code> · <code>${escapeHtml(publication.releasePassport.root)}</code></p>
        <p>Qualified targets: <code>${escapeHtml(platforms.join(", "))}</code></p>${desktopDigests}<p>Published upstream bootstrap inputs:</p>${assets}
        <p><a href="/${escapeHtml(acquisition.immutablePath)}/index.json">Machine-readable evidence index</a></p>
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
  siteSourceSha =
    process.env.BUILDCHAIN_SITE_SOURCE_SHA || undefined,
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
  const projected = projectSiteInstallerCompatibility(publication, verified);
  const { manifest, channelPath } = publicationManifest(
    destinationRoot,
    projected.publication,
    projected.immutablePath,
    verified.version,
  );
  const acquisition = acquisitionEvidence(publication, verified.version);
  const status = releaseStatus(
    projected.publication,
    verified.version,
    acquisition,
    siteSourceSha || publication.sourceCommit,
  );
  const installerPage = renderInstallerPage({
    outputRoot: destinationRoot,
    publication: projected.publication,
    version: verified.version,
    platforms: verified.platforms,
    desktop: desktopDownloads(channel, publication, verified.version),
    acquisition,
  });
  const writes = [
    ...verified.assets.map((asset) => ({
      immutable: true,
      path: `${verified.immutablePath}/${asset.name}`,
      bytes: asset.bytes,
    })),
    ...projected.assets.flatMap((asset) => [
      ...(projected.immutablePath === verified.immutablePath
        ? []
        : [{
            immutable: true,
            path: `${projected.immutablePath}/${asset.name}`,
            bytes: asset.bytes,
          }]),
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
      bytes: Buffer.from(`${JSON.stringify(projected.publication, null, 2)}\n`),
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
    {
      immutable: true,
      path: `${acquisition.immutablePath}/index.json`,
      bytes: Buffer.from(`${JSON.stringify(acquisition.index, null, 2)}\n`),
    },
    {
      immutable: true,
      path: `${acquisition.immutablePath}/acquisition.html`,
      bytes: acquisition.rendered,
    },
    {
      immutable: false,
      path: ".well-known/kungfu/ungfu-release-acquisition.json",
      bytes: Buffer.from(`${JSON.stringify(acquisition.index, null, 2)}\n`),
    },
    {
      immutable: false,
      path: ".well-known/kungfu-release-status.json",
      bytes: Buffer.from(`${JSON.stringify(status, null, 2)}\n`),
    },
    ...(projected.receipt
      ? [
          {
            immutable: true,
            path: `${projected.immutablePath}/site-installer-compatibility.json`,
            bytes: Buffer.from(`${JSON.stringify(projected.receipt, null, 2)}\n`),
          },
          {
            immutable: false,
            path: ".well-known/kungfu/installer-compatibility.json",
            bytes: Buffer.from(`${JSON.stringify(projected.receipt, null, 2)}\n`),
          },
        ]
      : []),
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
    installerImmutablePath: projected.immutablePath,
    channelImmutablePath: channelPath,
    acquisitionEvidencePath: acquisition.immutablePath,
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
