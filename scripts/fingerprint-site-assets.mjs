#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const rootIndex = args.indexOf("--root");
const outputRoot = path.resolve(rootIndex >= 0 ? args[rootIndex + 1] : "dist");

if (rootIndex >= 0 && !args[rootIndex + 1]) {
  throw new Error("--root requires a directory");
}

const assetDirectory = path.join(outputRoot, "assets");
const sourcePath = path.join(assetDirectory, "site.css");
const sourceBytes = fs.readFileSync(sourcePath);
const fingerprint = crypto.createHash("sha256").update(sourceBytes).digest("hex").slice(0, 12);
const fingerprintedName = `site.${fingerprint}.css`;
const fingerprintedPath = path.join(assetDirectory, fingerprintedName);
const expectedHref = `/assets/${fingerprintedName}`;
const stylesheetPattern = /href="\/assets\/site(?:\.[0-9a-f]{12})?\.css"/g;

function listHtmlFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...listHtmlFiles(entryPath));
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      files.push(entryPath);
    }
  }
  return files;
}

const htmlFiles = listHtmlFiles(outputRoot);
let linkedPages = 0;

if (checkOnly) {
  if (!fs.existsSync(fingerprintedPath)) {
    throw new Error(`missing fingerprinted stylesheet: ${fingerprintedPath}`);
  }
  if (!sourceBytes.equals(fs.readFileSync(fingerprintedPath))) {
    throw new Error(`fingerprinted stylesheet bytes drifted: ${fingerprintedPath}`);
  }

  for (const htmlPath of htmlFiles) {
    const html = fs.readFileSync(htmlPath, "utf8");
    const links = html.match(stylesheetPattern) ?? [];
    linkedPages += links.length;
    if (links.some((link) => link !== `href="${expectedHref}"`)) {
      throw new Error(`stale shared stylesheet reference: ${htmlPath}`);
    }
  }
} else {
  fs.copyFileSync(sourcePath, fingerprintedPath);
  for (const htmlPath of htmlFiles) {
    const before = fs.readFileSync(htmlPath, "utf8");
    const links = before.match(stylesheetPattern) ?? [];
    linkedPages += links.length;
    if (links.length === 0) continue;
    const after = before.replace(stylesheetPattern, `href="${expectedHref}"`);
    fs.writeFileSync(htmlPath, after);
  }
}

if (linkedPages === 0) {
  throw new Error(`no HTML pages reference the shared stylesheet under ${outputRoot}`);
}

console.log(`${checkOnly ? "verified" : "fingerprinted"} shared CSS: ${expectedHref} (${linkedPages} links)`);
