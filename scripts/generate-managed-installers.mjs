#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const POLICY_SCHEMA = "kungfu-site-managed-installer-policy/v1";
const CATALOG_SCHEMA = "kungfu.site-managed-installer-catalog/v1";
const PUBLICATION_SCHEMA = "kungfu.bootstrap-installer-publication/v1";
const CHANNEL_SCHEMA = "kungfu.release-channel-index/v1";
const ROOT = /^sha256:[a-f0-9]{64}$/;
const SHA = /^[a-f0-9]{40}$/;
const SAFE_VALUE = /^[0-9A-Za-z._:+/@=-]+$/;

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) =>
          Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8")),
        )
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

function readJson(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`cannot read ${label}: ${error.message}`);
  }
}

function requiredRoot(value, label) {
  if (!ROOT.test(value || "")) throw new Error(`${label} must be a sha256 root`);
  return value;
}

function safeTemplateValue(value, label) {
  const text = String(value ?? "");
  if (!text || !SAFE_VALUE.test(text)) {
    throw new Error(`${label} is not safe for deterministic template projection`);
  }
  return text;
}

function exactTargetMap(publication) {
  return new Map(
    publication.entries.map((entry) => [
      `${entry.platform}/${entry.architecture}`,
      entry,
    ]),
  );
}

function validatePolicy({
  policy,
  publication,
  channel,
  trustedKeys,
  source,
  adapterDigest,
}) {
  if (policy?.schema !== POLICY_SCHEMA || policy.status !== "active") {
    throw new Error(`managed installer policy must be active ${POLICY_SCHEMA}`);
  }
  if (publication?.schema !== PUBLICATION_SCHEMA) {
    throw new Error("managed installer requires a verified installer publication");
  }
  if (channel?.schema !== CHANNEL_SCHEMA) {
    throw new Error("managed installer requires a verified signed channel");
  }
  const trustedKeyMap = Array.isArray(trustedKeys)
    ? Object.fromEntries(
        trustedKeys.map((item) => [item?.keyId, item?.publicKey]),
      )
    : trustedKeys;
  if (
    source?.bundleRoot !== policy.publicationBundleRoot ||
    publication.channel !== policy.channel ||
    publication.sourceCommit !== policy.sourceCommit ||
    publication.channelPayloadRoot !== policy.channelPayloadRoot ||
    publication.channelFileDigest !== policy.channelFileDigest ||
    publication.releasePassport?.root !== policy.releasePassportRoot ||
    channel.payloadRoot !== policy.channelPayloadRoot ||
    channel.sourceCommit !== policy.sourceCommit ||
    channel.releasePassport?.root !== policy.releasePassportRoot
  ) {
    throw new Error("managed installer policy differs from verified Alpha.2 authority");
  }
  if (
    !SHA.test(policy.sourceCommit || "") ||
    !ROOT.test(policy.publicationBundleRoot || "") ||
    !ROOT.test(policy.channelPayloadRoot || "") ||
    !ROOT.test(policy.channelFileDigest || "") ||
    !ROOT.test(policy.releasePassportRoot || "") ||
    channel.signature?.keyId !== policy.trustedKey?.keyId ||
    trustedKeyMap?.[policy.trustedKey?.keyId] !== policy.trustedKey?.publicKey
  ) {
    throw new Error("managed installer policy trust binding is incomplete");
  }
  if (
    policy.compatibilityAdapter?.schema !==
      "kungfu.site-alpha2-bootstrap-adapter/v1" ||
    policy.compatibilityAdapter?.mode !== "signed-alpha2-field-projection" ||
    policy.compatibilityAdapter?.channelPayloadRoot !== policy.channelPayloadRoot ||
    policy.compatibilityAdapter?.digest !== adapterDigest
  ) {
    throw new Error("managed installer compatibility adapter binding is incomplete");
  }
  const versions = new Set(publication.entries.map((entry) => entry.version));
  if (versions.size !== 1 || !versions.has(policy.version)) {
    throw new Error("managed installer policy version differs from publication");
  }
  const entries = exactTargetMap(publication);
  const expected = Object.keys(policy.targets || {}).sort();
  if (
    expected.length !== 3 ||
    expected.join(",") !== "darwin/arm64,linux/x64,win32/x64" ||
    expected.some((identity) => !entries.has(identity)) ||
    entries.size !== expected.length
  ) {
    throw new Error("managed installer target closure differs from publication");
  }
  if (policy.targets["linux/x64"].minimumGlibc !== "2.39") {
    throw new Error("Alpha.2 Linux ABI policy must remain exact glibc 2.39");
  }
  for (const identity of expected) {
    const safety = policy.targets[identity];
    if (
      !Number.isSafeInteger(safety.archiveEntries) ||
      safety.archiveEntries < 1 ||
      !Number.isSafeInteger(safety.archiveLinks) ||
      safety.archiveLinks < 0 ||
      safety.archiveLinks > safety.archiveEntries
    ) {
      throw new Error(`archive safety observation is invalid: ${identity}`);
    }
  }
  return entries;
}

function catalogFrom({ policy, publication, source, implementation }) {
  const entries = publication.entries
    .map((entry) => {
      const identity = `${entry.platform}/${entry.architecture}`;
      const safety = policy.targets[identity];
      return {
        platform: entry.platform,
        architecture: entry.architecture,
        version: entry.version,
        sourceCommit: entry.sourceCommit,
        manifestRoot: requiredRoot(entry.manifestRoot, `${identity}.manifestRoot`),
        artifactRoot: requiredRoot(entry.artifactRoot, `${identity}.artifactRoot`),
        releaseCutRoot: requiredRoot(entry.releaseCutRoot, `${identity}.releaseCutRoot`),
        platformSliceRoot: requiredRoot(entry.platformSliceRoot, `${identity}.platformSliceRoot`),
        artifactUrl: safeTemplateValue(entry.artifactUrl, `${identity}.artifactUrl`),
        artifactSize: entry.artifactSize,
        artifactDigest: requiredRoot(entry.artifactDigest, `${identity}.artifactDigest`),
        archiveName: safeTemplateValue(entry.archiveName, `${identity}.archiveName`),
        archiveBase: safeTemplateValue(entry.archiveBase, `${identity}.archiveBase`),
        compatibility: {
          minimumGlibc: safety.minimumGlibc,
        },
        archiveSafety: {
          exactDigestQualified: true,
          topLevel: entry.archiveBase,
          entries: safety.archiveEntries,
          links: safety.archiveLinks,
          policy: "one-relative-root-no-escape",
        },
      };
    })
    .sort((left, right) =>
      `${left.platform}/${left.architecture}`.localeCompare(
        `${right.platform}/${right.architecture}`,
      ),
    );
  for (const entry of entries) {
    if (!Number.isSafeInteger(entry.artifactSize) || entry.artifactSize < 1) {
      throw new Error(`artifact size is invalid: ${entry.platform}/${entry.architecture}`);
    }
  }
  const unsigned = {
    schema: CATALOG_SCHEMA,
    authority: {
      publicationBundleRoot: policy.publicationBundleRoot,
      installerPublicationRoot: semanticRoot(publication),
      channelPayloadRoot: policy.channelPayloadRoot,
      channelFileDigest: policy.channelFileDigest,
      releasePassportRoot: policy.releasePassportRoot,
      sourceCommit: policy.sourceCommit,
    },
    release: {
      channel: policy.channel,
      version: policy.version,
      tag: `v${policy.version}`,
    },
    trust: {
      algorithm: "ed25519",
      keyId: policy.trustedKey.keyId,
      publicKey: policy.trustedKey.publicKey,
      productVerification: "kungfu.release_channel.verify_bootstrap_candidate",
      compatibilityAdapter: policy.compatibilityAdapter,
    },
    transaction: {
      cache: "content-addressed-sha256",
      resume: "http-range",
      retries: policy.download,
      activation: "atomic-current-previous",
      rollback: "verified-previous",
    },
    implementation,
    entries,
    sourcePinRoot: semanticRoot(source),
  };
  return { ...unsigned, catalogRoot: semanticRoot(unsigned) };
}

function templateValues(catalog, adapter) {
  const byIdentity = new Map(
    catalog.entries.map((entry) => [
      `${entry.platform}/${entry.architecture}`,
      entry,
    ]),
  );
  const values = {
    CATALOG_ROOT: catalog.catalogRoot,
    CHANNEL: catalog.release.channel,
    VERSION: catalog.release.version,
    SOURCE_COMMIT: catalog.authority.sourceCommit,
    CHANNEL_ROOT: catalog.authority.channelPayloadRoot.slice(7),
    CHANNEL_DIGEST: catalog.authority.channelFileDigest.slice(7),
    TRUSTED_KEY: `${catalog.trust.keyId}=${catalog.trust.publicKey}`,
    RELEASE_PASSPORT_ROOT: catalog.authority.releasePassportRoot,
    ALPHA2_ADAPTER: adapter,
    ALPHA2_ADAPTER_DIGEST:
      catalog.trust.compatibilityAdapter.digest.slice(7),
  };
  for (const [prefix, identity] of [
    ["DARWIN_ARM64", "darwin/arm64"],
    ["LINUX_X64", "linux/x64"],
    ["WIN32_X64", "win32/x64"],
  ]) {
    const entry = byIdentity.get(identity);
    for (const [key, value] of Object.entries({
      MANIFEST_ROOT: entry.manifestRoot,
      ARTIFACT_ROOT: entry.artifactRoot,
      RELEASE_CUT_ROOT: entry.releaseCutRoot,
      PLATFORM_SLICE_ROOT: entry.platformSliceRoot,
      ARTIFACT_URL: entry.artifactUrl,
      ARTIFACT_SIZE: entry.artifactSize,
      ARTIFACT_DIGEST: entry.artifactDigest.slice(7),
      ARCHIVE_NAME: entry.archiveName,
      ARCHIVE_BASE: entry.archiveBase,
      ARCHIVE_ENTRIES: entry.archiveSafety.entries,
      ARCHIVE_LINKS: entry.archiveSafety.links,
      MINIMUM_GLIBC: entry.compatibility.minimumGlibc || "none",
    })) {
      values[`${prefix}_${key}`] = safeTemplateValue(value, `${prefix}_${key}`);
    }
  }
  return values;
}

function renderTemplate(template, values, label) {
  const rendered = template.replace(/@@([A-Z0-9_]+)@@/g, (_match, key) => {
    if (!(key in values)) throw new Error(`${label} has unknown placeholder ${key}`);
    return values[key];
  });
  if (/@@[A-Z0-9_]+@@/.test(rendered)) {
    throw new Error(`${label} retains an unresolved placeholder`);
  }
  return Buffer.from(rendered);
}

function atomicWrite(destination, bytes) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, bytes);
  fs.renameSync(temporary, destination);
}

function managedPublication(publication, immutablePath, scripts) {
  const assets = publication.assets
    .map((asset) => {
      const bytes = scripts[asset.name];
      if (!bytes) throw new Error(`managed publication has no ${asset.name}`);
      const immutableUrl = new URL(asset.immutableUrl);
      immutableUrl.pathname = `/${immutablePath}/${asset.name}`;
      return {
        ...asset,
        size: bytes.length,
        digest: digest(bytes),
        immutableUrl: immutableUrl.href,
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
  return { ...publication, immutablePath, assets };
}

function managedManifest(outputRoot, catalog, immutablePath) {
  const manifestPath = path.join(outputRoot, "manifest.json");
  if (!fs.existsSync(manifestPath)) return null;
  const manifest = readJson(manifestPath, "site publication manifest");
  const publication = {
    id: "kungfu-site-managed-installer-alpha",
    versions: [
      {
        version: catalog.release.version,
        payloadRoot: catalog.catalogRoot,
        immutablePath: `/${immutablePath}/`,
      },
    ],
  };
  const publications = (manifest.publications || []).filter(
    (item) => item.id !== publication.id,
  );
  publications.push(publication);
  return Buffer.from(
    `${JSON.stringify({ ...manifest, publications }, null, 2)}\n`,
  );
}

function assertImmutable(destination, bytes) {
  if (!fs.existsSync(destination)) return;
  if (!fs.lstatSync(destination).isFile() || !fs.readFileSync(destination).equals(bytes)) {
    throw new Error(`managed installer immutable path already has different bytes: ${destination}`);
  }
}

function managedPage(outputRoot, catalog, immutablePath, scripts) {
  const pagePath = path.join(outputRoot, "install", "index.html");
  if (!fs.existsSync(pagePath)) return null;
  const page = fs.readFileSync(pagePath, "utf8");
  const start = "        <!-- managed-installer:start -->";
  const end = "        <!-- managed-installer:end -->";
  const startIndex = page.indexOf(start);
  const endIndex = page.indexOf(end);
  if (
    startIndex < 0 ||
    endIndex <= startIndex ||
    page.indexOf(start, startIndex + start.length) >= 0 ||
    page.indexOf(end, endIndex + end.length) >= 0
  ) {
    throw new Error("installer page has no unique managed-installer block");
  }
  const shellDigest = digest(scripts["install.sh"]);
  const powerShellDigest = digest(scripts["install.ps1"]);
  const live = `${start}
        <div class="managed-installer-note" data-managed-installer-catalog="${catalog.catalogRoot}">
          <strong>Site-managed installation transaction.</strong>
          <p>The friendly commands use resumable content-addressed downloads, exact archive and signed-product verification, versioned installation, atomic current/previous activation, and verified rollback.</p>
          <p>Catalog: <a href="/.well-known/kungfu/managed-installer.json"><code>${catalog.catalogRoot}</code></a></p>
          <p>Site installer evidence: <a href="/${immutablePath}/install.sh"><code>install.sh</code></a> · <code>${shellDigest}</code> · <a href="/${immutablePath}/install.ps1"><code>install.ps1</code></a> · <code>${powerShellDigest}</code></p>
        </div>
${end}`;
  return Buffer.from(
    `${page.slice(0, startIndex)}${live}${page.slice(endIndex + end.length)}`,
  );
}

export function generateManagedInstallers({
  policy,
  publication,
  channel,
  trustedKeys,
  source,
  outputRoot,
  templateRoot,
}) {
  const templates = {
    "install.sh": fs.readFileSync(path.join(templateRoot, "install.sh.tmpl"), "utf8"),
    "install.ps1": fs.readFileSync(path.join(templateRoot, "install.ps1.tmpl"), "utf8"),
  };
  const adapter = fs.readFileSync(
    path.join(templateRoot, "alpha2-bootstrap-adapter.py"),
    "utf8",
  );
  const adapterBytes = Buffer.from(adapter);
  const adapterDigest = digest(adapterBytes);
  const implementation = {
    schema: "kungfu.site-managed-installer-implementation/v1",
    generator: digest(fs.readFileSync(new URL(import.meta.url))),
    templates: Object.fromEntries(
      Object.entries(templates).map(([name, template]) => [
        name,
        digest(Buffer.from(template)),
      ]),
    ),
    compatibilityAdapter: adapterDigest,
  };
  validatePolicy({
    policy,
    publication,
    channel,
    trustedKeys,
    source,
    adapterDigest,
  });
  const catalog = catalogFrom({ policy, publication, source, implementation });
  const values = templateValues(catalog, adapter.trimEnd());
  const scripts = Object.fromEntries(
    Object.entries(templates).map(([name, template]) => [
      name,
      renderTemplate(template, values, name),
    ]),
  );
  const immutablePath =
    `installers/site/v1/${catalog.release.channel}/${catalog.release.version}/${catalog.catalogRoot.slice(7)}`;
  const catalogBytes = Buffer.from(`${JSON.stringify(catalog, null, 2)}\n`);
  const publicationBytes = Buffer.from(
    `${JSON.stringify(managedPublication(publication, immutablePath, scripts), null, 2)}\n`,
  );
  const upstreamPublicationBytes = Buffer.from(
    `${JSON.stringify(publication, null, 2)}\n`,
  );
  const manifestBytes = managedManifest(outputRoot, catalog, immutablePath);
  const pageBytes = managedPage(outputRoot, catalog, immutablePath, scripts);
  const writes = [
    ...Object.entries(scripts).flatMap(([name, bytes]) => [
      { path: name, bytes, immutable: false },
      { path: `${immutablePath}/${name}`, bytes, immutable: true },
    ]),
    {
      path: ".well-known/kungfu/managed-installer.json",
      bytes: catalogBytes,
      immutable: false,
    },
    { path: `${immutablePath}/catalog.json`, bytes: catalogBytes, immutable: true },
    {
      path: `${immutablePath}/upstream-installer-publication.json`,
      bytes: upstreamPublicationBytes,
      immutable: true,
    },
    {
      path: `${immutablePath}/alpha2-bootstrap-adapter.py`,
      bytes: adapterBytes,
      immutable: true,
    },
    { path: "installer-publication.json", bytes: publicationBytes, immutable: false },
    ...(manifestBytes
      ? [{ path: "manifest.json", bytes: manifestBytes, immutable: false }]
      : []),
    ...(pageBytes
      ? [{ path: "install/index.html", bytes: pageBytes, immutable: false }]
      : []),
  ];
  for (const item of writes.filter((item) => item.immutable)) {
    assertImmutable(path.join(outputRoot, item.path), item.bytes);
  }
  for (const item of writes) atomicWrite(path.join(outputRoot, item.path), item.bytes);
  return {
    schema: "kungfu.site-managed-installer-projection/v1",
    catalogRoot: catalog.catalogRoot,
    immutablePath,
    files: writes.map((item) => item.path).sort(),
    scriptDigests: Object.fromEntries(
      Object.entries(scripts).map(([name, bytes]) => [name, digest(bytes)]),
    ),
  };
}

function parseArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === "--policy") options.policy = args[++index];
    else if (value === "--publication") options.publication = args[++index];
    else if (value === "--channel") options.channel = args[++index];
    else if (value === "--trusted-keys") options.trustedKeys = args[++index];
    else if (value === "--source") options.source = args[++index];
    else if (value === "--output-root") options.outputRoot = args[++index];
    else if (value === "--template-root") options.templateRoot = args[++index];
    else throw new Error(`unknown argument: ${value}`);
  }
  for (const field of [
    "policy",
    "publication",
    "channel",
    "trustedKeys",
    "source",
    "outputRoot",
    "templateRoot",
  ]) {
    if (!options[field]) throw new Error(`--${field.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)} is required`);
  }
  return options;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const result = generateManagedInstallers({
      policy: readJson(options.policy, "managed installer policy"),
      publication: readJson(options.publication, "installer publication"),
      channel: readJson(options.channel, "signed channel"),
      trustedKeys: readJson(options.trustedKeys, "trusted keys"),
      source: readJson(options.source, "publication source"),
      outputRoot: path.resolve(options.outputRoot),
      templateRoot: path.resolve(options.templateRoot),
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`generate-managed-installers: ${error.message}\n`);
    process.exitCode = 1;
  }
}
