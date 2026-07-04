#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const configPath = path.join(repoRoot, "site/shared-layout.json");
const checkOnly = process.argv.includes("--check");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("'", "&#39;");
}

function linkClass(item) {
  return item.class ? ` class="${escapeAttr(item.class)}"` : "";
}

function renderHeader() {
  const brand = config.brand;
  const links = config.navigation
    .map((item) => `        <a${linkClass(item)} href="${escapeAttr(item.href)}">${escapeHtml(item.label)}</a>`)
    .join("\n");

  return [
    `    <header class="site-header">`,
    `      <a class="brand" href="${escapeAttr(brand.href)}" aria-label="${escapeAttr(brand.label)}">`,
    `        <span class="mark" aria-hidden="true">${escapeHtml(brand.mark)}</span>`,
    `        <span>${escapeHtml(brand.label)}</span>`,
    `      </a>`,
    `      <nav class="site-nav" aria-label="Project links">`,
    links,
    `      </nav>`,
    `    </header>`,
  ].join("\n");
}

function renderFooter() {
  const items = config.footer
    .map((item) => {
      if (item.href) {
        return `      <span><a href="${escapeAttr(item.href)}">${escapeHtml(item.text)}</a></span>`;
      }
      return `      <span>${escapeHtml(item.text)}</span>`;
    })
    .join("\n");

  return [
    `    <footer class="site-footer">`,
    items,
    `    </footer>`,
  ].join("\n");
}

function replaceBlock(source, name, rendered) {
  const pattern = new RegExp(
    `    <!-- shared-${name}:start -->[\\s\\S]*?    <!-- shared-${name}:end -->`,
    "m",
  );
  if (!pattern.test(source)) {
    throw new Error(`missing shared ${name} markers`);
  }
  return source.replace(pattern, `    <!-- shared-${name}:start -->\n${rendered}\n    <!-- shared-${name}:end -->`);
}

const blocks = {
  header: renderHeader(),
  footer: renderFooter(),
};

let drift = false;
for (const page of config.pages) {
  const pagePath = path.join(repoRoot, page);
  const before = fs.readFileSync(pagePath, "utf8");
  let after = replaceBlock(before, "header", blocks.header);
  after = replaceBlock(after, "footer", blocks.footer);

  if (after !== before) {
    drift = true;
    if (checkOnly) {
      console.error(`error: ${page} shared layout is stale; run bash scripts/build-site.sh`);
    } else {
      fs.writeFileSync(pagePath, after);
      console.log(`rendered shared layout: ${page}`);
    }
  }
}

if (checkOnly && drift) {
  process.exit(1);
}

if (!drift) {
  console.log("shared layout is current");
}
