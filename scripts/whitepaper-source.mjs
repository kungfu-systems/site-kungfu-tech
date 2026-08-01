#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { gunzipSync } from "node:zlib";

const require = createRequire(import.meta.url);

export const WHITEPAPER_PACKAGE = "@kungfu-tech/paper-kungfu-product-white-paper";
export const WHITEPAPER_VERSION = "0.1.0-alpha.14";
export const MACHINE_LIFE_PACKAGE = "@kungfu-tech/paper-kfd-machine-life-roadmap";
export const MACHINE_LIFE_VERSION = "0.1.0-alpha.11";
export const KFD_PACKAGE = "@kungfu-tech/kfd";
export const KFD_VERSION = "1.0.0-alpha.47";
export const BUILDCHAIN_PACKAGE = "@kungfu-tech/buildchain";
export const BUILDCHAIN_VERSION = "3.0.3";
export const WHITEPAPER_CONTRACT = "kungfu-white-paper-brand-site-bundle";
export const MACHINE_LIFE_CONTRACT = "kungfu-machine-life-brand-site-bundle";
export const WHITEPAPER_CONSUMER = "kungfu.tech";
export const WHITEPAPER_ORIGIN = "https://kungfu.tech";

export const PAPER_RELEASES = [
  {
    package: WHITEPAPER_PACKAGE,
    version: WHITEPAPER_VERSION,
    slug: "kungfu-white-paper",
    localReader: true,
  },
  {
    package: MACHINE_LIFE_PACKAGE,
    version: MACHINE_LIFE_VERSION,
    slug: "kungfu-machine-life",
    localReader: true,
  },
  {
    package: "@kungfu-tech/paper-kfd-foundation-real-world-agent-work",
    version: "0.1.0-alpha.8",
    slug: "kfd-foundation-real-world-agent-work",
  },
  {
    package: "@kungfu-tech/paper-observer-declared-timelines",
    version: "0.1.0-alpha.9",
    slug: "observer-declared-timelines",
  },
  {
    package: "@kungfu-tech/paper-episodes-to-primitives",
    version: "0.1.0-alpha.2",
    slug: "episodes-to-primitives",
  },
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function extractTarEntry(archivePath, entryPath) {
  const archive = gunzipSync(fs.readFileSync(archivePath));
  for (let offset = 0; offset + 512 <= archive.length;) {
    const header = archive.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const readField = (start, end) => header.subarray(start, end).toString("utf8").replace(/\0.*$/, "").trim();
    const name = [readField(345, 500), readField(0, 100)].filter(Boolean).join("/");
    const size = Number.parseInt(readField(124, 136) || "0", 8);
    assert(Number.isSafeInteger(size) && size >= 0, `invalid source bundle entry size: ${name}`);
    const contentOffset = offset + 512;
    assert(contentOffset + size <= archive.length, `truncated source bundle entry: ${name}`);
    if (name === entryPath) return archive.subarray(contentOffset, contentOffset + size);
    offset = contentOffset + Math.ceil(size / 512) * 512;
  }
  throw new Error(`publication source bundle is missing ${entryPath}`);
}

function readPackageJson(packageRoot, packageVersion, relativePath) {
  const directPath = path.join(packageRoot, relativePath);
  if (fs.existsSync(directPath)) return readJson(directPath);

  const registry = readJson(path.join(packageRoot, ".buildchain", "publication", "publication-registry.json"));
  const version = registry.versions?.find((entry) => entry.version === packageVersion);
  const metadata = version?.metadata?.find((entry) => entry.path === relativePath);
  assert(metadata?.sha256, `publication registry does not authenticate ${relativePath}`);
  const content = extractTarEntry(
    path.join(packageRoot, ".buildchain", "publication", "source.tar.gz"),
    relativePath,
  );
  const digest = crypto.createHash("sha256").update(content).digest("hex");
  assert(digest === metadata.sha256, `publication source bundle digest mismatch for ${relativePath}`);
  return JSON.parse(content.toString("utf8"));
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

function loadBrandPaperSource({
  repoRoot,
  packageName,
  version,
  contract,
  readerRoute,
  pdfRoute,
  pdfAliases,
  manifestRoute,
  llmsRoute,
  requireWhitePaperDisplayPlan = false,
}) {
  const packageJsonPath = require.resolve(`${packageName}/package.json`, { paths: [repoRoot] });
  const packageRoot = path.dirname(packageJsonPath);
  const packageInfo = readJson(packageJsonPath);
  const bundlePath = path.join(packageRoot, "site", "brand-site.json");
  const publicationManifestPath = require.resolve(`${packageName}/publication-artifact.json`, { paths: [repoRoot] });
  const publicationManifest = readJson(publicationManifestPath);
  const pdfPackagePath = publicationManifest.publication?.primaryArtifact;
  assertString(pdfPackagePath, "publication manifest primaryArtifact");
  assert(
    !path.isAbsolute(pdfPackagePath) && !pdfPackagePath.split(/[\\/]/).includes(".."),
    "publication manifest primaryArtifact must stay inside the package",
  );
  const pdfPath = path.join(packageRoot, pdfPackagePath);
  const bundle = readPackageJson(packageRoot, packageInfo.version, "site/brand-site.json");

  assert(packageInfo.name === packageName, `unexpected brand paper package: ${packageInfo.name}`);
  assert(packageInfo.version === version, `expected ${packageName}@${version}`);
  assert(bundle.schemaVersion === 1, `${packageName} brand bundle schemaVersion must be 1`);
  assert(bundle.contract === contract, `unexpected ${packageName} brand contract: ${bundle.contract}`);
  assert(bundle.consumer === WHITEPAPER_CONSUMER, `unexpected ${packageName} consumer: ${bundle.consumer}`);
  assert(bundle.source?.package === packageName, `${packageName} brand bundle source package mismatch`);
  assert(bundle.source?.packageVersion === version, `${packageName} brand bundle source version mismatch`);
  assert(bundle.routes?.canonicalHost === WHITEPAPER_CONSUMER, "brand bundle canonical host mismatch");
  assert(siteHref(bundle.routes.indexUrl) === "/whitepaper/", "brand bundle index route mismatch");
  assert(
    siteHref(bundle.routes.canonicalUrl) === readerRoute,
    "brand bundle reader route mismatch",
  );
  assert(
    siteHref(bundle.routes.pdfUrl) === pdfRoute,
    "brand bundle PDF route mismatch",
  );
  assert(
    JSON.stringify((bundle.routes.pdfAliases || []).map(siteHref)) === JSON.stringify(pdfAliases),
    "brand bundle PDF aliases mismatch",
  );
  assert(publicationManifest.contract === "kungfu-buildchain-publication-artifact-manifest", "publication manifest contract mismatch");
  assert(publicationManifest.publication?.version === version, "publication manifest version mismatch");
  assert(publicationManifest.publication?.siteConsumers?.includes(WHITEPAPER_CONSUMER), "publication manifest must name kungfu.tech as a site consumer");
  assertString(publicationManifest.generatedAt, "publication manifest generatedAt");
  assertString(publicationManifest.source?.sha, "publication manifest source.sha");
  assertString(publicationManifest.source?.treeSha, "publication manifest source.treeSha");
  assertString(publicationManifest.publication?.archive?.routes?.immutableVersionUrl, "publication manifest immutable version URL");
  assertString(publicationManifest.publication?.archive?.publicArtifacts?.passport?.url, "publication manifest passport URL");
  assertString(publicationManifest.publication?.archive?.publicArtifacts?.sourceBundle?.url, "publication manifest source bundle URL");
  assert(fs.existsSync(pdfPath), `${packageName} package PDF is missing`);

  const publicArtifacts = publicationManifest.publication?.archive?.publicArtifacts?.artifacts || [];
  const pdfArtifact = publicArtifacts.find((artifact) => artifact.path === pdfPackagePath);
  assert(pdfArtifact, `publication manifest does not describe exported PDF ${pdfPackagePath}`);
  assert(pdfArtifact.sha256 === sha256File(pdfPath), `${packageName} PDF digest does not match publication manifest`);
  assert(pdfArtifact.bytes === fs.statSync(pdfPath).size, `${packageName} PDF byte count does not match publication manifest`);

  assertString(bundle.hero?.title, "brand bundle hero.title");
  assertString(bundle.hero?.lead, "brand bundle hero.lead");
  assert(Array.isArray(bundle.homepageSections) && bundle.homepageSections.length > 0, "brand bundle homepageSections must not be empty");
  assert(Array.isArray(bundle.principles), "brand bundle principles must be an array");
  if (requireWhitePaperDisplayPlan) {
    assert(bundle.principles.length > 0, "white paper brand bundle principles must not be empty");
    assert(
      bundle.displayPlan?.firstScreen?.join(",") === "hero,Executive Summary",
      "white paper brand bundle first-screen display plan mismatch",
    );
    assert(
      bundle.displayPlan?.primary?.join(",") === "The Problem,Product Thesis,Principles",
      "white paper brand bundle primary display plan mismatch",
    );
    assert(
      bundle.homepageSections.map((section) => section.id).join(",")
        === "00-executive-summary,01-problem,02-thesis,03-principles,05-roadmap,09-conclusion",
      "white paper brand bundle section plan mismatch",
    );
  }

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
      pdfAliases: (bundle.routes.pdfAliases || []).map(siteHref),
      evidence: bundle.routes.evidenceUrl,
      manifest: manifestRoute,
      llms: llmsRoute,
    },
  };
}

export function loadWhitepaperSource(repoRoot = process.cwd()) {
  return loadBrandPaperSource({
    repoRoot,
    packageName: WHITEPAPER_PACKAGE,
    version: WHITEPAPER_VERSION,
    contract: WHITEPAPER_CONTRACT,
    readerRoute: "/whitepaper/kungfu-white-paper/",
    pdfRoute: "/whitepaper/kungfu-white-paper.pdf",
    pdfAliases: [],
    manifestRoute: "/whitepaper/manifest.json",
    llmsRoute: "/whitepaper/llms.txt",
    requireWhitePaperDisplayPlan: true,
  });
}

export function loadMachineLifeSource(repoRoot = process.cwd()) {
  return loadBrandPaperSource({
    repoRoot,
    packageName: MACHINE_LIFE_PACKAGE,
    version: MACHINE_LIFE_VERSION,
    contract: MACHINE_LIFE_CONTRACT,
    readerRoute: "/whitepaper/kungfu-machine-life/",
    pdfRoute: "/whitepaper/kungfu-machine-life.pdf",
    pdfAliases: [],
    manifestRoute: "/whitepaper/kungfu-machine-life/manifest.json",
    llmsRoute: "/whitepaper/kungfu-machine-life/llms.txt",
  });
}

function loadPublicationPaper(spec, repoRoot) {
  const packageJsonPath = require.resolve(`${spec.package}/package.json`, { paths: [repoRoot] });
  const packageRoot = path.dirname(packageJsonPath);
  const packageInfo = readJson(packageJsonPath);
  const publicationManifestPath = require.resolve(`${spec.package}/publication-artifact.json`, { paths: [repoRoot] });
  const publicationManifest = readJson(publicationManifestPath);
  const publication = publicationManifest.publication;
  const pdfPackagePath = publication?.primaryArtifact;

  assert(packageInfo.name === spec.package, `unexpected paper package: ${packageInfo.name}`);
  assert(packageInfo.version === spec.version, `expected ${spec.package}@${spec.version}`);
  assert(publicationManifest.contract === "kungfu-buildchain-publication-artifact-manifest", `${spec.package} publication manifest contract mismatch`);
  assert(publication?.kind === "paper", `${spec.package} must publish a paper artifact`);
  assert(publication?.version === spec.version, `${spec.package} publication version mismatch`);
  assertString(publication?.title, `${spec.package} publication title`);
  assertString(publication?.abstract, `${spec.package} publication abstract`);
  assertString(pdfPackagePath, `${spec.package} primaryArtifact`);
  assert(!path.isAbsolute(pdfPackagePath) && !pdfPackagePath.split(/[\\/]/).includes(".."), `${spec.package} primaryArtifact must stay inside the package`);

  const pdfPath = path.join(packageRoot, pdfPackagePath);
  assert(fs.existsSync(pdfPath), `${spec.package} PDF is missing`);
  const artifacts = publication.archive?.publicArtifacts?.artifacts || [];
  const pdfArtifact = artifacts.find((artifact) => artifact.path === pdfPackagePath);
  assert(pdfArtifact, `${spec.package} publication manifest does not describe ${pdfPackagePath}`);
  assert(pdfArtifact.sha256 === sha256File(pdfPath), `${spec.package} PDF digest mismatch`);
  assert(pdfArtifact.bytes === fs.statSync(pdfPath).size, `${spec.package} PDF byte count mismatch`);
  assertString(publication.archive?.routes?.canonicalUrl, `${spec.package} canonical URL`);
  assertString(publication.archive?.routes?.immutableVersionUrl, `${spec.package} immutable version URL`);
  assertString(publication.archive?.publicArtifacts?.passport?.url, `${spec.package} passport URL`);
  assertString(pdfArtifact.url, `${spec.package} public PDF URL`);

  return {
    ...spec,
    packageRoot,
    packageInfo,
    publicationManifest,
    publicationManifestPath,
    pdfPath,
    pdfArtifact,
    title: publication.title,
    abstract: publication.abstract,
    authors: publication.authors || [],
    routes: {
      reader: publication.archive.routes.canonicalUrl,
      pdf: pdfArtifact.url,
      evidence: publication.archive.publicArtifacts.passport.url,
      immutableVersion: publication.archive.routes.immutableVersionUrl,
    },
  };
}

export function loadPublicationCatalog(repoRoot = process.cwd()) {
  const primary = loadWhitepaperSource(repoRoot);
  const machineLife = loadMachineLifeSource(repoRoot);
  const papers = PAPER_RELEASES.map((spec) => {
    const brandSource = spec.package === WHITEPAPER_PACKAGE
      ? primary
      : spec.package === MACHINE_LIFE_PACKAGE
        ? machineLife
        : null;
    if (!brandSource) return loadPublicationPaper(spec, repoRoot);
    return {
      ...spec,
      packageRoot: brandSource.packageRoot,
      packageInfo: brandSource.packageInfo,
      publicationManifest: brandSource.publicationManifest,
      publicationManifestPath: brandSource.publicationManifestPath,
      pdfPath: brandSource.pdfPath,
      pdfArtifact: brandSource.pdfArtifact,
      title: brandSource.publicationManifest.publication.title,
      abstract: brandSource.publicationManifest.publication.abstract,
      authors: brandSource.publicationManifest.publication.authors || [],
      routes: {
        reader: brandSource.routes.reader,
        pdf: brandSource.routes.pdf,
        evidence: brandSource.routes.evidence,
        immutableVersion: brandSource.publicationManifest.publication.archive.routes.immutableVersionUrl,
      },
    };
  });

  const kfdPackagePath = require.resolve(`${KFD_PACKAGE}/package.json`, { paths: [repoRoot] });
  const kfdPackage = readJson(kfdPackagePath);
  const kfdSite = readJson(require.resolve(`${KFD_PACKAGE}/site/kfd-site.json`, { paths: [repoRoot] }));
  assert(kfdPackage.name === KFD_PACKAGE && kfdPackage.version === KFD_VERSION, `expected ${KFD_PACKAGE}@${KFD_VERSION}`);
  assert(kfdSite.contract === "kfd-site-bundle", "KFD site bundle contract mismatch");
  assert(kfdSite.source?.package === KFD_PACKAGE, "KFD site bundle package mismatch");

  const buildchainPackagePath = require.resolve(`${BUILDCHAIN_PACKAGE}/package.json`, { paths: [repoRoot] });
  const buildchainPackage = readJson(buildchainPackagePath);
  const buildchainSite = readJson(require.resolve(`${BUILDCHAIN_PACKAGE}/site/buildchain-site.json`, { paths: [repoRoot] }));
  assert(buildchainPackage.name === BUILDCHAIN_PACKAGE && buildchainPackage.version === BUILDCHAIN_VERSION, `expected ${BUILDCHAIN_PACKAGE}@${BUILDCHAIN_VERSION}`);
  assert(buildchainSite.contract === "kungfu-buildchain-site-bundle", "Buildchain site bundle contract mismatch");
  assert(buildchainSite.package?.name === BUILDCHAIN_PACKAGE, "Buildchain site bundle package mismatch");
  assert(buildchainSite.package?.version === BUILDCHAIN_VERSION, "Buildchain site bundle version mismatch");

  return {
    primary,
    machineLife,
    papers,
    kfd: {
      packageInfo: kfdPackage,
      site: kfdSite,
      title: kfdSite.homepage.title,
      summary: kfdSite.homepage.futurePicture.engineeringAnswer,
      commitments: kfdSite.homepage.foundationTriad.commitments,
      url: "https://kfd.libkungfu.dev/",
    },
    buildchain: {
      packageInfo: buildchainPackage,
      site: buildchainSite,
      title: buildchainSite.product.formalName,
      summary: buildchainSite.homepage.mechanismSummary.find((line) => line.startsWith("Buildchain Release Passport is")),
      url: "https://buildchain.libkungfu.dev/",
    },
  };
}

export function buildPublicationCatalogManifest(catalog) {
  const generatedAt = [
    ...catalog.papers.map((paper) => paper.publicationManifest.generatedAt),
    catalog.buildchain.site.generatedAt,
  ].sort().at(-1);
  return {
    schemaVersion: 1,
    contract: "kungfu-publication-catalog",
    generatedAt,
    timestampPolicy: "latest-upstream-source-artifact",
    papers: catalog.papers.map((paper) => ({
      id: paper.slug,
      title: paper.title,
      abstract: paper.abstract,
      authors: paper.authors,
      package: paper.packageInfo.name,
      version: paper.packageInfo.version,
      sourceSha: paper.publicationManifest.source.sha,
      artifact: {
        bytes: paper.pdfArtifact.bytes,
        sha256: paper.pdfArtifact.sha256,
      },
      routes: paper.routes,
      hosting: paper.localReader ? "kungfu.tech-reader" : "canonical-publication-site",
    })),
    systemSources: {
      kfd: {
        package: catalog.kfd.packageInfo.name,
        version: catalog.kfd.packageInfo.version,
        contract: catalog.kfd.site.contract,
        url: catalog.kfd.url,
      },
      buildchain: {
        package: catalog.buildchain.packageInfo.name,
        version: catalog.buildchain.packageInfo.version,
        contract: catalog.buildchain.site.contract,
        sourceRevision: catalog.buildchain.site.sourceRevision,
        url: catalog.buildchain.url,
      },
    },
  };
}

function buildBrandPaperManifest(source, { contract, rendererContract }) {
  const { bundle, packageInfo, pdfArtifact, publicationManifest, routes } = source;
  return {
    schemaVersion: 1,
    contract,
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
      contract: rendererContract,
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

export function buildWhitepaperManifest(source) {
  return buildBrandPaperManifest(source, {
    contract: "kungfu-white-paper-brand-site-manifest",
    rendererContract: "site-kungfu-tech-white-paper-renderer-v1",
  });
}

export function buildMachineLifeManifest(source) {
  return buildBrandPaperManifest(source, {
    contract: "kungfu-machine-life-brand-site-manifest",
    rendererContract: "site-kungfu-tech-machine-life-renderer-v1",
  });
}
