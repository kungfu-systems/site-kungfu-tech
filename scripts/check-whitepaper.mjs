#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  buildWhitepaperManifest,
  loadWhitepaperSource,
  sha256File,
  WHITEPAPER_PACKAGE,
  WHITEPAPER_VERSION,
} from "./whitepaper-source.mjs";

const repoRoot = process.cwd();
const distRoot = path.join(repoRoot, "dist");
const source = loadWhitepaperSource(repoRoot);

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
assert(packageJson.dependencies?.[WHITEPAPER_PACKAGE] === WHITEPAPER_VERSION, "site must pin the exact white paper package version");

const pnpmLock = read("pnpm-lock.yaml");
assert(pnpmLock.includes(`'${WHITEPAPER_PACKAGE}':`), "pnpm lock must include the white paper importer");
assert(pnpmLock.includes(`${WHITEPAPER_PACKAGE}@${WHITEPAPER_VERSION}`), "pnpm lock must resolve the exact white paper version");

const indexHtml = readDist("whitepaper/index.html");
const readerHtml = readDist("whitepaper/kungfu-real-world-agent-work/index.html");
const llms = readDist("whitepaper/llms.txt");
const manifest = JSON.parse(readDist("whitepaper/manifest.json"));
const expectedManifest = buildWhitepaperManifest(source);
const pdfPath = path.join(distRoot, "whitepaper", "kungfu-real-world-agent-work.pdf");

assert(JSON.stringify(manifest) === JSON.stringify(expectedManifest), "generated white paper manifest drifted from the source package");
assert(manifest.evidence.immutableVersionUrl.includes(`/v${WHITEPAPER_VERSION}/`), "machine manifest must expose the immutable publication version URL");
assert(fs.existsSync(pdfPath), "generated white paper PDF is missing");
assert(sha256File(pdfPath) === source.pdfArtifact.sha256, "generated white paper PDF digest mismatch");
assert(fs.statSync(pdfPath).size === source.pdfArtifact.bytes, "generated white paper PDF byte count mismatch");

for (const [name, html] of [["white paper index", indexHtml], ["white paper reader", readerHtml]]) {
  assert(html.includes("shared-header:start"), `${name} must use the shared header`);
  assert(html.includes("shared-footer:start"), `${name} must use the shared footer`);
  assert(html.includes("/assets/whitepaper.css"), `${name} must load the white paper stylesheet`);
  assert(!/<a[^>]+href="https:\/\/kungfu\.tech\/whitepaper/i.test(html), `${name} must keep same-site navigation in the active deployment`);
  assert(!/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(html), `${name} must not expose an email address`);
  assertLocalLinksResolve(html, name);
}

assert(indexHtml.includes(source.bundle.hero.title), "white paper index must render the upstream title");
assert(indexHtml.includes(WHITEPAPER_VERSION), "white paper index must render the upstream version");
assert(readerHtml.includes(source.bundle.hero.lead), "white paper reader must render the upstream lead");
assert(readerHtml.includes(`data="${source.routes.pdf}#page=1&amp;view=FitH"`), "white paper reader must preview the package PDF");
assert(!readerHtml.includes("KFD-1 |"), "structured KFD principles must not render as raw pipe-separated text");
assert(readerHtml.includes("<table>"), "white paper reader must render structured source rows as an HTML table");
assert(!readerHtml.includes("If you are a user |"), "white paper audience guidance must not render as raw pipe-separated text");

for (const section of source.bundle.homepageSections) {
  assert(readerHtml.includes(`id="section-${section.id}"`), `white paper reader is missing section ${section.id}`);
  assert(readerHtml.includes(`href="#section-${section.id}"`), `white paper navigation is missing section ${section.id}`);
}

assert(llms.includes(`${WHITEPAPER_PACKAGE}@${WHITEPAPER_VERSION}`), "llms.txt must identify the exact source package");
assert(llms.includes(source.pdfArtifact.sha256), "llms.txt must expose the PDF digest");
assert(llms.includes(source.routes.evidence), "llms.txt must expose the evidence surface");

console.log(`white paper checks passed for ${WHITEPAPER_PACKAGE}@${WHITEPAPER_VERSION}`);
