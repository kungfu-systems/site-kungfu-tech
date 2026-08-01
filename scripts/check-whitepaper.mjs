#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  BUILDCHAIN_PACKAGE,
  BUILDCHAIN_VERSION,
  buildMachineLifeManifest,
  buildPublicationCatalogManifest,
  buildWhitepaperManifest,
  KFD_PACKAGE,
  KFD_VERSION,
  loadMachineLifeSource,
  loadPublicationCatalog,
  loadWhitepaperSource,
  MACHINE_LIFE_PACKAGE,
  MACHINE_LIFE_VERSION,
  PAPER_RELEASES,
  sha256File,
  WHITEPAPER_PACKAGE,
  WHITEPAPER_VERSION,
} from "./whitepaper-source.mjs";

const repoRoot = process.cwd();
const distRoot = path.join(repoRoot, "dist");
const source = loadWhitepaperSource(repoRoot);
const machineLifeSource = loadMachineLifeSource(repoRoot);
const catalog = loadPublicationCatalog(repoRoot);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(relativePath) {
  const filePath = path.join(repoRoot, relativePath);
  assert(fs.existsSync(filePath), `missing ${relativePath}`);
  return fs.readFileSync(filePath, "utf8");
}

function readDist(relativePath) {
  const filePath = path.join(distRoot, relativePath);
  assert(fs.existsSync(filePath), `missing dist/${relativePath}`);
  return fs.readFileSync(filePath, "utf8");
}

function outputPathForHref(href) {
  const pathname = decodeURIComponent(href.split(/[?#]/, 1)[0]);
  if (!pathname.startsWith("/")) return null;
  if (pathname === "/") return path.join(distRoot, "index.html");
  if (pathname.endsWith("/")) return path.join(distRoot, pathname.slice(1), "index.html");
  if (/\.[a-z0-9]+$/i.test(pathname)) return path.join(distRoot, pathname.slice(1));
  return path.join(distRoot, pathname.slice(1), "index.html");
}

function assertLocalLinksResolve(html, pageName) {
  const hrefs = [...html.matchAll(/\shref="([^"]+)"/g)].map((match) => match[1]);
  for (const href of hrefs) {
    if (href.startsWith("#") || /^[a-z]+:/i.test(href)) continue;
    const outputPath = outputPathForHref(href);
    assert(outputPath && fs.existsSync(outputPath), `${pageName} has unresolved local link: ${href}`);
  }
}

const packageJson = JSON.parse(read("package.json"));
assert(packageJson.packageManager === "pnpm@11.7.0", "site packageManager must match the Buildchain pnpm runtime");
const expectedDependencies = [
  [KFD_PACKAGE, KFD_VERSION],
  [BUILDCHAIN_PACKAGE, BUILDCHAIN_VERSION],
  ...PAPER_RELEASES.map((paper) => [paper.package, paper.version]),
];
for (const [packageName, version] of expectedDependencies) {
  assert(packageJson.dependencies?.[packageName] === version, `site must pin ${packageName}@${version}`);
}

const pnpmLock = read("pnpm-lock.yaml");
for (const [packageName, version] of expectedDependencies) {
  assert(pnpmLock.includes(`'${packageName}':`), `pnpm lock must include ${packageName}`);
  assert(pnpmLock.includes(`${packageName}@${version}`), `pnpm lock must resolve ${packageName}@${version}`);
}

const indexHtml = readDist("whitepaper/index.html");
const readerHtml = readDist("whitepaper/kungfu-white-paper/index.html");
const machineLifeHtml = readDist("whitepaper/kungfu-machine-life/index.html");
const llms = readDist("whitepaper/llms.txt");
const machineLifeLlms = readDist("whitepaper/kungfu-machine-life/llms.txt");
const manifest = JSON.parse(readDist("whitepaper/manifest.json"));
const machineLifeManifest = JSON.parse(readDist("whitepaper/kungfu-machine-life/manifest.json"));
const catalogManifest = JSON.parse(readDist("whitepaper/catalog.json"));
const expectedManifest = buildWhitepaperManifest(source);
const expectedMachineLifeManifest = buildMachineLifeManifest(machineLifeSource);
const expectedCatalogManifest = buildPublicationCatalogManifest(catalog);
const pdfPath = path.join(distRoot, "whitepaper", "kungfu-white-paper.pdf");
const machineLifePdfPath = path.join(distRoot, "whitepaper", "kungfu-machine-life.pdf");
const whitepaperPdfHref = `${source.routes.pdf}?v=${encodeURIComponent(WHITEPAPER_VERSION)}`;
const machineLifePdfHref = `${machineLifeSource.routes.pdf}?v=${encodeURIComponent(MACHINE_LIFE_VERSION)}`;
const removedRoutes = [
  "whitepaper/kungfu-real-world-agent-work",
  "whitepaper/kungfu-real-world-agent-work.pdf",
  "whitepaper/kfd-machine-life-roadmap",
  "whitepaper/kfd-machine-life-roadmap.pdf",
];
const expectedDisplayOrder = [
  WHITEPAPER_PACKAGE,
  MACHINE_LIFE_PACKAGE,
  "@kungfu-tech/paper-kfd-foundation-real-world-agent-work",
  "@kungfu-tech/paper-observer-declared-timelines",
  "@kungfu-tech/paper-episodes-to-primitives",
];

assert(JSON.stringify(manifest) === JSON.stringify(expectedManifest), "generated white paper manifest drifted from the source package");
assert(JSON.stringify(machineLifeManifest) === JSON.stringify(expectedMachineLifeManifest), "generated Machine Life manifest drifted from the source package");
assert(JSON.stringify(catalogManifest) === JSON.stringify(expectedCatalogManifest), "generated publication catalog drifted from source packages");
assert(manifest.evidence.immutableVersionUrl.includes(`/v${WHITEPAPER_VERSION}/`), "white paper manifest must expose the immutable publication version URL");
assert(machineLifeManifest.evidence.immutableVersionUrl.includes(`/v${MACHINE_LIFE_VERSION}/`), "Machine Life manifest must expose the immutable publication version URL");
assert(fs.existsSync(pdfPath), "generated white paper PDF is missing");
assert(sha256File(pdfPath) === source.pdfArtifact.sha256, "generated white paper PDF digest mismatch");
assert(fs.statSync(pdfPath).size === source.pdfArtifact.bytes, "generated white paper PDF byte count mismatch");
assert(fs.existsSync(machineLifePdfPath), "generated Machine Life PDF is missing");
assert(sha256File(machineLifePdfPath) === machineLifeSource.pdfArtifact.sha256, "generated Machine Life PDF digest mismatch");
assert(fs.statSync(machineLifePdfPath).size === machineLifeSource.pdfArtifact.bytes, "generated Machine Life PDF byte count mismatch");
for (const route of removedRoutes) {
  assert(!fs.existsSync(path.join(distRoot, route)), `removed white paper route must not be generated: ${route}`);
}
assert(
  catalog.papers.map((paper) => paper.packageInfo.name).join(",") === expectedDisplayOrder.join(","),
  "publication catalog order must be White Paper, Machine Life, Foundation Model, Observer, Episodes",
);

for (const [name, html] of [
  ["white paper index", indexHtml],
  ["white paper reader", readerHtml],
  ["Machine Life reader", machineLifeHtml],
]) {
  assert(html.includes("shared-header:start"), `${name} must use the shared header`);
  assert(html.includes("shared-footer:start"), `${name} must use the shared footer`);
  const stylesheetHref = html.match(/\/assets\/whitepaper\.[0-9a-f]{12}\.css/)?.[0];
  assert(stylesheetHref, `${name} must load the fingerprinted white paper stylesheet`);
  assert(fs.existsSync(path.join(distRoot, stylesheetHref.slice(1))), `${name} white paper stylesheet must resolve`);
  assert(!/<a[^>]+href="https:\/\/kungfu\.tech\/whitepaper/i.test(html), `${name} must keep same-site navigation in the active deployment`);
  assert(!/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(html), `${name} must not expose an email address`);
  assertLocalLinksResolve(html, name);
}

assert(indexHtml.includes(source.bundle.hero.title), "white paper index must render the upstream title");
assert(indexHtml.includes(WHITEPAPER_VERSION), "white paper index must render the upstream version");
assert(indexHtml.includes("Two papers frame Kungfu."), "publication index must lead with the now-and-future frame");
assert(indexHtml.includes('data-paper-moment="now" data-paper-package="@kungfu-tech/paper-kungfu-product-white-paper"'), "publication index must frame the White Paper as now");
assert(indexHtml.includes('data-paper-moment="future" data-paper-package="@kungfu-tech/paper-kfd-machine-life-roadmap"'), "publication index must frame Machine Life as future");
assert(indexHtml.includes("Now · White Paper"), "White Paper card must carry the now label");
assert(indexHtml.includes("Future · Machine Life"), "Machine Life card must carry the future label");
assert(indexHtml.includes(">Read the White Paper</a>"), "White Paper card must use a distinct primary action");
assert(indexHtml.includes(">Read Machine Life</a>"), "Machine Life card must use a distinct primary action");
assert(indexHtml.includes(`href="${machineLifeSource.routes.reader}"`), "Machine Life primary action must use the same-site reader");
assert(indexHtml.includes(`href="${machineLifePdfHref}"`), "Machine Life PDF action must use the versioned same-site artifact");
assert(!indexHtml.includes('href="https://papers.libkungfu.dev/kfd-machine-life-roadmap/">Read Machine Life</a>'), "Machine Life primary action must not leave kungfu.tech");
assert(indexHtml.includes('href="https://papers.libkungfu.dev/"'), "publication index must route deeper research to papers.libkungfu.dev");
assert(!indexHtml.includes('class="paper-source-catalog"'), "publication index must not expose source-contract cards on the main human page");
const supportingPapers = catalog.papers.filter((paper) => ![WHITEPAPER_PACKAGE, MACHINE_LIFE_PACKAGE].includes(paper.packageInfo.name));
for (const paper of supportingPapers) {
  assert(!indexHtml.includes(paper.title), `main publication page must defer ${paper.packageInfo.name} to papers.libkungfu.dev`);
}
for (const paper of catalog.papers) {
  assert(llms.includes(`${paper.packageInfo.name}@${paper.packageInfo.version}`), `llms.txt must identify ${paper.packageInfo.name}`);
  assert(llms.includes(paper.pdfArtifact.sha256), `llms.txt must expose ${paper.packageInfo.name} PDF digest`);
}
assert(llms.includes(`${MACHINE_LIFE_PACKAGE}@${MACHINE_LIFE_VERSION}`), "llms.txt must identify the exact Machine Life source package");
assert(machineLifeLlms.includes(`${MACHINE_LIFE_PACKAGE}@${MACHINE_LIFE_VERSION}`), "Machine Life llms.txt must identify its exact source package");
assert(machineLifeLlms.includes(machineLifeSource.pdfArtifact.sha256), "Machine Life llms.txt must expose the local PDF digest");
assert(machineLifeLlms.includes(machineLifeSource.routes.evidence), "Machine Life llms.txt must preserve the external evidence surface");
assert(machineLifeHtml.includes("<th><strong>Approach</strong></th>"), "Machine Life comparison table must preserve its four-column source header");
assert(!machineLifeHtml.includes("| Item | Status | Responsibility |"), "Machine Life reader must not expose an unparsed table scaffold");
assert(!machineLifeHtml.match(/ML(?:Indigo|White|Panel|PaperSoft)/), "Machine Life reader must remove publication-only table style tokens");
assert(!machineLifeHtml.match(/\s[.,;:]<\/td>/), "Machine Life table cells must not retain conversion whitespace before punctuation");
assert(
  machineLifeHtml.match(/<\/table>\s*<p>An agent can be intelligent without being a persistent subject\./),
  "Machine Life comparison prose must remain outside the preceding table",
);
assert(llms.includes(`${KFD_PACKAGE}@${KFD_VERSION}`), "llms.txt must identify the KFD source package");
assert(llms.includes(`${BUILDCHAIN_PACKAGE}@${BUILDCHAIN_VERSION}`), "llms.txt must identify the Buildchain source package");
assert(readerHtml.includes(source.bundle.hero.lead), "white paper reader must render the upstream lead");
assert(indexHtml.includes(`href="${whitepaperPdfHref}"`), "white paper PDF action must use the versioned same-site artifact");
assert(readerHtml.includes(`data="${whitepaperPdfHref}#page=1&amp;view=FitH"`), "white paper reader must preview the versioned package PDF");
assert(source.routes.reader === "/whitepaper/kungfu-white-paper/", "white paper reader and PDF must share the canonical basename");
assert(source.routes.pdf === "/whitepaper/kungfu-white-paper.pdf", "white paper PDF must use the canonical public filename");
assert(source.routes.pdfAliases.length === 0, "white paper must not retain PDF aliases");
assert(machineLifeSource.routes.reader === "/whitepaper/kungfu-machine-life/", "Machine Life reader and PDF must share the canonical basename");
assert(machineLifeSource.routes.pdf === "/whitepaper/kungfu-machine-life.pdf", "Machine Life PDF must use the canonical public filename");
assert(machineLifeSource.routes.pdfAliases.length === 0, "Machine Life must not retain PDF aliases");
assert(readerHtml.includes("Conversation Is Not Work State"), "white paper reader must preserve the upstream problem model");
assert(readerHtml.includes("Project, Work, and Agent"), "white paper reader must preserve the upstream first-layer product model");
assert(readerHtml.includes("Review Before Completion"), "white paper reader must preserve the upstream review boundary");
assert(readerHtml.includes("From Work Continuity to Subject Continuity"), "white paper reader must preserve the upstream conclusion boundary");

for (const section of source.bundle.homepageSections) {
  assert(readerHtml.includes(`id="section-${section.id}"`), `white paper reader is missing section ${section.id}`);
  assert(readerHtml.includes(`href="#section-${section.id}"`), `white paper navigation is missing section ${section.id}`);
}

assert(machineLifeHtml.includes(machineLifeSource.bundle.hero.lead), "Machine Life reader must render the upstream lead");
assert(machineLifeHtml.includes(`data="${machineLifePdfHref}#page=1&amp;view=FitH"`), "Machine Life reader must preview the versioned package PDF");
assert(machineLifeHtml.includes(`href="${machineLifeSource.routes.evidence}"`), "Machine Life reader must preserve the publication evidence link");
assert(machineLifeHtml.includes("Figure available in the primary PDF"), "Machine Life reader must preserve figure boundaries from the source bundle");
assert(machineLifeSource.bundle.homepageSections.length === 11, "Machine Life source bundle must expose all eleven sections");
for (const section of machineLifeSource.bundle.homepageSections) {
  assert(machineLifeHtml.includes(`id="section-${section.id}"`), `Machine Life reader is missing section ${section.id}`);
  assert(machineLifeHtml.includes(`href="#section-${section.id}"`), `Machine Life navigation is missing section ${section.id}`);
}

assert(llms.includes(`${WHITEPAPER_PACKAGE}@${WHITEPAPER_VERSION}`), "llms.txt must identify the exact source package");
assert(llms.includes(source.pdfArtifact.sha256), "llms.txt must expose the PDF digest");
assert(llms.includes(source.routes.evidence), "llms.txt must expose the evidence surface");

console.log(`white paper checks passed for ${WHITEPAPER_PACKAGE}@${WHITEPAPER_VERSION}`);
