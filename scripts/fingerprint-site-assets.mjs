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
const assets = [
  { name: "site", extension: "css", attribute: "href", label: "site CSS" },
  { name: "whitepaper", extension: "css", attribute: "href", label: "whitepaper CSS" },
  { name: "command-copy", extension: "js", attribute: "src", label: "command copy JS" },
  { name: "proof-reel-state", extension: "js", moduleImport: true, label: "proof reel state JS" },
].map(({ name, extension, attribute, moduleImport, label }) => {
  const sourcePath = path.join(assetDirectory, `${name}.${extension}`);
  const sourceBytes = fs.readFileSync(sourcePath);
  const fingerprint = crypto.createHash("sha256").update(sourceBytes).digest("hex").slice(0, 12);
  const fingerprintedName = `${name}.${fingerprint}.${extension}`;
  const expectedUrl = `/assets/${fingerprintedName}`;
  const expectedReference = moduleImport
    ? `from "${expectedUrl}"`
    : `${attribute}="${expectedUrl}"`;
  return {
    name,
    label,
    sourcePath,
    sourceBytes,
    fingerprintedPath: path.join(assetDirectory, fingerprintedName),
    expectedUrl,
    expectedReference,
    pattern: moduleImport
      ? new RegExp(`from "/assets/${name}(?:\\.[0-9a-f]{12})?\\.${extension}"`, "g")
      : new RegExp(`${attribute}="/assets/${name}(?:\\.[0-9a-f]{12})?\\.${extension}"`, "g"),
  };
});

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
for (const asset of assets) {
  let linkedPages = 0;

  if (checkOnly) {
    if (!fs.existsSync(asset.fingerprintedPath)) {
      throw new Error(`missing fingerprinted asset: ${asset.fingerprintedPath}`);
    }
    if (!asset.sourceBytes.equals(fs.readFileSync(asset.fingerprintedPath))) {
      throw new Error(`fingerprinted asset bytes drifted: ${asset.fingerprintedPath}`);
    }

    for (const htmlPath of htmlFiles) {
      const html = fs.readFileSync(htmlPath, "utf8");
      const links = html.match(asset.pattern) ?? [];
      linkedPages += links.length;
      if (links.some((link) => link !== asset.expectedReference)) {
        throw new Error(`stale ${asset.label} reference: ${htmlPath}`);
      }
    }
  } else {
    fs.copyFileSync(asset.sourcePath, asset.fingerprintedPath);
    for (const htmlPath of htmlFiles) {
      const before = fs.readFileSync(htmlPath, "utf8");
      const links = before.match(asset.pattern) ?? [];
      linkedPages += links.length;
      if (links.length === 0) continue;
      const after = before.replace(asset.pattern, asset.expectedReference);
      fs.writeFileSync(htmlPath, after);
    }
  }

  if (linkedPages === 0) {
    throw new Error(`no HTML pages reference the ${asset.label} under ${outputRoot}`);
  }

  console.log(`${checkOnly ? "verified" : "fingerprinted"} ${asset.label}: ${asset.expectedUrl} (${linkedPages} links)`);
}
