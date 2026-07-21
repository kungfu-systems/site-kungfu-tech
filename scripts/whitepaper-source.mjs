#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);

export const WHITEPAPER_PACKAGE = "@kungfu-tech/paper-kungfu-product-white-paper";
export const WHITEPAPER_VERSION = "0.1.0-alpha.8";
export const WHITEPAPER_CONTRACT = "kungfu-white-paper-brand-site-bundle";
export const WHITEPAPER_CONSUMER = "kungfu.tech";
export const WHITEPAPER_ORIGIN = "https://kungfu.tech";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertString(value, name) {
  assert(typeof value === "string" && value.trim() !== "", `${name} must be a non-empty string`);
}

export function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

export function siteHref(value) {
  assertString(value, "href");
  const url = new URL(value, WHITEPAPER_ORIGIN);
  assert(["http:", "https:"].includes(url.protocol), `unsupported link protocol: ${url.protocol}`);
  if (url.origin !== WHITEPAPER_ORIGIN) return value;

  const pathHasExtension = /\.[a-z0-9]+$/i.test(url.pathname);
  const pathname = pathHasExtension || url.pathname.endsWith("/")
    ? url.pathname
    : `${url.pathname}/`;
  return `${pathname}${url.search}${url.hash}`;
}

export function loadWhitepaperSource(repoRoot = process.cwd()) {
  const packageJsonPath = require.resolve(`${WHITEPAPER_PACKAGE}/package.json`, { paths: [repoRoot] });
  const packageRoot = path.dirname(packageJsonPath);
  const packageInfo = readJson(packageJsonPath);
  const bundlePath = path.join(packageRoot, "site", "brand-site.json");
  const publicationManifestPath = require.resolve(`${WHITEPAPER_PACKAGE}/publication-artifact.json`, { paths: [repoRoot] });
  const publicationManifest = readJson(publicationManifestPath);
  const pdfPackagePath = publicationManifest.publication?.primaryArtifact;
  assertString(pdfPackagePath, "publication manifest primaryArtifact");
  assert(
    !path.isAbsolute(pdfPackagePath) && !pdfPackagePath.split(/[\\/]/).includes(".."),
    "publication manifest primaryArtifact must stay inside the package",
  );
  const pdfPath = path.join(packageRoot, pdfPackagePath);
  const bundle = readJson(bundlePath);

  assert(packageInfo.name === WHITEPAPER_PACKAGE, `unexpected white paper package: ${packageInfo.name}`);
  assert(packageInfo.version === WHITEPAPER_VERSION, `expected ${WHITEPAPER_PACKAGE}@${WHITEPAPER_VERSION}`);
  assert(bundle.schemaVersion === 1, "white paper brand bundle schemaVersion must be 1");
  assert(bundle.contract === WHITEPAPER_CONTRACT, `unexpected white paper contract: ${bundle.contract}`);
  assert(bundle.consumer === WHITEPAPER_CONSUMER, `unexpected white paper consumer: ${bundle.consumer}`);
  assert(bundle.source?.package === WHITEPAPER_PACKAGE, "brand bundle source package mismatch");
  assert(bundle.source?.packageVersion === WHITEPAPER_VERSION, "brand bundle source version mismatch");
  assert(bundle.routes?.canonicalHost === WHITEPAPER_CONSUMER, "brand bundle canonical host mismatch");
  assert(siteHref(bundle.routes.indexUrl) === "/whitepaper/", "brand bundle index route mismatch");
  assert(
    siteHref(bundle.routes.canonicalUrl) === "/whitepaper/kungfu-white-paper/",
    "brand bundle reader route mismatch",
  );
  assert(
    siteHref(bundle.routes.pdfUrl) === "/whitepaper/kungfu-white-paper.pdf",
    "brand bundle PDF route mismatch",
  );
  assert(publicationManifest.contract === "kungfu-buildchain-publication-artifact-manifest", "publication manifest contract mismatch");
  assert(publicationManifest.publication?.version === WHITEPAPER_VERSION, "publication manifest version mismatch");
  assert(publicationManifest.publication?.siteConsumers?.includes(WHITEPAPER_CONSUMER), "publication manifest must name kungfu.tech as a site consumer");
  assertString(publicationManifest.generatedAt, "publication manifest generatedAt");
  assertString(publicationManifest.source?.sha, "publication manifest source.sha");
  assertString(publicationManifest.source?.treeSha, "publication manifest source.treeSha");
  assertString(publicationManifest.publication?.archive?.routes?.immutableVersionUrl, "publication manifest immutable version URL");
  assertString(publicationManifest.publication?.archive?.publicArtifacts?.passport?.url, "publication manifest passport URL");
  assertString(publicationManifest.publication?.archive?.publicArtifacts?.sourceBundle?.url, "publication manifest source bundle URL");
  assert(fs.existsSync(pdfPath), "white paper package PDF is missing");

  const publicArtifacts = publicationManifest.publication?.archive?.publicArtifacts?.artifacts || [];
  const pdfArtifact = publicArtifacts.find((artifact) => artifact.path === pdfPackagePath);
  assert(pdfArtifact, `publication manifest does not describe exported PDF ${pdfPackagePath}`);
  assert(pdfArtifact.sha256 === sha256File(pdfPath), "white paper PDF digest does not match publication manifest");
  assert(pdfArtifact.bytes === fs.statSync(pdfPath).size, "white paper PDF byte count does not match publication manifest");

  assertString(bundle.hero?.title, "brand bundle hero.title");
  assertString(bundle.hero?.lead, "brand bundle hero.lead");
  assert(Array.isArray(bundle.homepageSections) && bundle.homepageSections.length > 0, "brand bundle homepageSections must not be empty");
  assert(Array.isArray(bundle.principles) && bundle.principles.length > 0, "brand bundle principles must not be empty");

  const sectionIds = new Set();
  for (const section of bundle.homepageSections) {
    assertString(section.id, "homepage section id");
    assertString(section.title, `homepage section ${section.id} title`);
    assertString(section.markdown, `homepage section ${section.id} markdown`);
    assert(!sectionIds.has(section.id), `duplicate homepage section id: ${section.id}`);
    sectionIds.add(section.id);
  }

  return {
    repoRoot,
    packageRoot,
    packageInfo,
    bundle,
    bundlePath,
    publicationManifest,
    publicationManifestPath,
    pdfPath,
    pdfArtifact,
    routes: {
      index: siteHref(bundle.routes.indexUrl),
      reader: siteHref(bundle.routes.canonicalUrl),
      pdf: siteHref(bundle.routes.pdfUrl),
      evidence: bundle.routes.evidenceUrl,
      manifest: "/whitepaper/manifest.json",
      llms: "/whitepaper/llms.txt",
    },
  };
}

export function buildWhitepaperManifest(source) {
  const { bundle, packageInfo, pdfArtifact, publicationManifest, routes } = source;
  return {
    schemaVersion: 1,
    contract: "kungfu-white-paper-brand-site-manifest",
    generatedAt: publicationManifest.generatedAt,
    timestampPolicy: "upstream-publication-artifact",
    title: bundle.hero.title,
    description: bundle.hero.lead,
    routes,
    source: {
      package: packageInfo.name,
      version: packageInfo.version,
      siteBundle: "site/brand-site.json",
      repository: bundle.source.repository,
      sourceSha: publicationManifest.source.sha,
      sourceTreeSha: publicationManifest.source.treeSha,
      publicationManifest: ".buildchain/publication/publication-artifact.json",
    },
    renderer: {
      repository: "https://github.com/kungfu-systems/site-kungfu-tech",
      contract: "site-kungfu-tech-white-paper-renderer-v1",
    },
    artifact: {
      role: "primary",
      path: routes.pdf,
      sourcePath: pdfArtifact.path,
      bytes: pdfArtifact.bytes,
      sha256: pdfArtifact.sha256,
    },
    sections: bundle.homepageSections.map((section) => ({
      id: section.id,
      title: section.title,
      role: section.role,
      presentation: section.presentation,
      priority: section.priority,
      sourcePath: section.sourcePath,
      href: `${routes.reader}#section-${section.id}`,
    })),
    evidence: {
      url: routes.evidence,
      publicationVersion: publicationManifest.publication.version,
      immutableVersionUrl: publicationManifest.publication.archive.routes.immutableVersionUrl,
      passportUrl: publicationManifest.publication.archive.publicArtifacts.passport.url,
      sourceBundleUrl: publicationManifest.publication.archive.publicArtifacts.sourceBundle.url,
    },
  };
}
