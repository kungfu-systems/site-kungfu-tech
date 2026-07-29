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
const stylesheets = ["site", "whitepaper"].map((name) => {
  const sourcePath = path.join(assetDirectory, `${name}.css`);
  const sourceBytes = fs.readFileSync(sourcePath);
  const fingerprint = crypto.createHash("sha256").update(sourceBytes).digest("hex").slice(0, 12);
  const fingerprintedName = `${name}.${fingerprint}.css`;
  return {
    name,
    sourcePath,
    sourceBytes,
    fingerprintedPath: path.join(assetDirectory, fingerprintedName),
    expectedHref: `/assets/${fingerprintedName}`,
    pattern: new RegExp(`href="/assets/${name}(?:\\.[0-9a-f]{12})?\\.css"`, "g"),
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
for (const stylesheet of stylesheets) {
  let linkedPages = 0;

  if (checkOnly) {
    if (!fs.existsSync(stylesheet.fingerprintedPath)) {
      throw new Error(`missing fingerprinted stylesheet: ${stylesheet.fingerprintedPath}`);
    }
    if (!stylesheet.sourceBytes.equals(fs.readFileSync(stylesheet.fingerprintedPath))) {
      throw new Error(`fingerprinted stylesheet bytes drifted: ${stylesheet.fingerprintedPath}`);
    }

    for (const htmlPath of htmlFiles) {
      const html = fs.readFileSync(htmlPath, "utf8");
      const links = html.match(stylesheet.pattern) ?? [];
      linkedPages += links.length;
      if (links.some((link) => link !== `href="${stylesheet.expectedHref}"`)) {
        throw new Error(`stale ${stylesheet.name} stylesheet reference: ${htmlPath}`);
      }
    }
  } else {
    fs.copyFileSync(stylesheet.sourcePath, stylesheet.fingerprintedPath);
    for (const htmlPath of htmlFiles) {
      const before = fs.readFileSync(htmlPath, "utf8");
      const links = before.match(stylesheet.pattern) ?? [];
      linkedPages += links.length;
      if (links.length === 0) continue;
      const after = before.replace(stylesheet.pattern, `href="${stylesheet.expectedHref}"`);
      fs.writeFileSync(htmlPath, after);
    }
  }

  if (linkedPages === 0) {
    throw new Error(`no HTML pages reference the ${stylesheet.name} stylesheet under ${outputRoot}`);
  }

  console.log(`${checkOnly ? "verified" : "fingerprinted"} ${stylesheet.name} CSS: ${stylesheet.expectedHref} (${linkedPages} links)`);
}
