#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const rootIndex = args.indexOf("--root");
if (rootIndex >= 0 && !args[rootIndex + 1]) {
  throw new Error("--root requires a directory");
}

const root = path.resolve(rootIndex >= 0 ? args[rootIndex + 1] : "dist");
if (!fs.existsSync(root)) {
  throw new Error(`copyable-code root does not exist: ${root}`);
}

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

function matchesWithRanges(pattern, text) {
  return [...text.matchAll(pattern)].map((match) => ({
    html: match[0],
    start: match.index,
    end: match.index + match[0].length,
  }));
}

function actionableSurfaces(html, offset = 0) {
  const preformatted = matchesWithRanges(/<pre\b[^>]*>[\s\S]*?<\/pre>/gi, html);
  const withoutPreformatted = html.replace(/<pre\b[^>]*>[\s\S]*?<\/pre>/gi, (match) => " ".repeat(match.length));
  const commandCode = matchesWithRanges(
    /<code\b[^>]*class="[^"]*\bcommand\b[^"]*"[^>]*>[\s\S]*?<\/code>/gi,
    withoutPreformatted,
  );
  return [...preformatted, ...commandCode]
    .map((surface) => ({ ...surface, start: surface.start + offset, end: surface.end + offset }))
    .sort((left, right) => left.start - right.start);
}

function hasClass(tag, className) {
  const classValue = tag.match(/\bclass="([^"]*)"/i)?.[1] ?? "";
  return classValue.split(/\s+/).includes(className);
}

const htmlFiles = listHtmlFiles(root);
const failures = [];
let pageCount = 0;
let surfaceCount = 0;

for (const htmlPath of htmlFiles) {
  const html = fs.readFileSync(htmlPath, "utf8");
  const relativePath = path.relative(root, htmlPath);
  const surfaces = actionableSurfaces(html);
  const blocks = matchesWithRanges(
    /<div\b[^>]*class="[^"]*\bcommand-block\b[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
    html,
  );

  if (surfaces.length > 0) {
    pageCount += 1;
    surfaceCount += surfaces.length;
    if (!/<script\b[^>]*src="\/assets\/command-copy(?:\.[0-9a-f]{12})?\.js"[^>]*\bdefer(?:="")?[^>]*><\/script>/i.test(html)) {
      failures.push(`${relativePath}: actionable code is missing the deferred shared command-copy script`);
    }
  }

  for (const block of blocks) {
    const blockSurfaces = actionableSurfaces(block.html, block.start);
    const buttons = [...block.html.matchAll(/<button\b[^>]*\bdata-copy-command(?:=(?:"[^"]*"|'[^']*'|[^\s>]+))?[^>]*>[\s\S]*?<\/button>/gi)];
    if (blockSurfaces.length !== 1) {
      failures.push(`${relativePath}: each command-block must contain exactly one actionable code surface`);
    }
    if (buttons.length !== 1) {
      failures.push(`${relativePath}: each command-block must contain exactly one data-copy-command button`);
      continue;
    }

    const buttonTag = buttons[0][0].match(/^<button\b[^>]*>/i)?.[0] ?? "";
    if (!hasClass(buttonTag, "copy-button")) {
      failures.push(`${relativePath}: data-copy-command button is missing the copy-button class`);
    }
    if (!/\baria-label="[^"]+"/i.test(buttonTag)) {
      failures.push(`${relativePath}: copy button requires a non-empty aria-label`);
    }
    if (!/\baria-live="polite"/i.test(buttonTag)) {
      failures.push(`${relativePath}: copy button requires aria-live="polite"`);
    }
    if (blockSurfaces.length === 1 && buttons[0].index < blockSurfaces[0].start - block.start) {
      failures.push(`${relativePath}: copy button must follow its actionable code surface`);
    }
  }

  for (const surface of surfaces) {
    const owners = blocks.filter((block) => block.start <= surface.start && block.end >= surface.end);
    if (owners.length !== 1) {
      failures.push(`${relativePath}: every actionable code surface must belong to exactly one command-block`);
    }
  }

  if (blocks.length !== surfaces.length) {
    failures.push(`${relativePath}: command-block count (${blocks.length}) must equal actionable code count (${surfaces.length})`);
  }
}

if (failures.length > 0) {
  for (const failure of [...new Set(failures)]) {
    console.error(`error: ${failure}`);
  }
  process.exit(1);
}

console.log(`verified ${surfaceCount} copyable code surfaces across ${pageCount} pages under ${root}`);
