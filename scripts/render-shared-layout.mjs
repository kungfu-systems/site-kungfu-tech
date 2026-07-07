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

function renderNavItem(item) {
  if (Array.isArray(item.items) && item.items.length > 0) {
    const menuLinks = item.items
      .map((child) => `          <a${linkClass(child)} href="${escapeAttr(child.href)}">${escapeHtml(child.label)}</a>`)
      .join("\n");
    return [
      `        <details class="nav-menu">`,
      `          <summary>${escapeHtml(item.label)}</summary>`,
      `          <div class="nav-menu-panel">`,
      menuLinks,
      `          </div>`,
      `        </details>`,
    ].join("\n");
  }
  return `        <a${linkClass(item)} href="${escapeAttr(item.href)}">${escapeHtml(item.label)}</a>`;
}

function renderHeader() {
  const brand = config.brand;
  const tagline = brand.tagline
    ? `        <span class="brand-copy"><span>${escapeHtml(brand.label)}</span><span class="brand-tagline">${escapeHtml(brand.tagline)}</span></span>`
    : `        <span>${escapeHtml(brand.label)}</span>`;
  const links = config.navigation
    .map((item) => renderNavItem(item))
    .join("\n");

  return [
    `    <header class="site-header">`,
    `      <a class="brand" href="${escapeAttr(brand.href)}" aria-label="${escapeAttr(brand.label)}">`,
    `        <span class="mark" aria-hidden="true">${escapeHtml(brand.mark)}</span>`,
    tagline,
    `      </a>`,
    `      <nav class="site-nav" aria-label="Project links">`,
    links,
    `      </nav>`,
    `    </header>`,
  ].join("\n");
}

function renderFooter() {
  const links = config.footer
    .filter((item) => item.href)
    .map((item) => `        <a href="${escapeAttr(item.href)}">${escapeHtml(item.text)}</a>`)
    .join("\n");
  const license = config.footer.find((item) => item.role === "license");
  const copyright = config.footer.find((item) => item.role === "copyright");

  return [
    `    <footer class="site-footer">`,
    `      <nav class="footer-links" aria-label="Footer links">`,
    links,
    `      </nav>`,
    license ? `      <p class="footer-note">${escapeHtml(license.text)}</p>` : "",
    copyright ? `      <p class="footer-copy">${escapeHtml(copyright.text)}</p>` : "",
    `    </footer>`,
    `    <script>`,
    `      document.addEventListener("click", (event) => {`,
    `        document.querySelectorAll("details.nav-menu[open]").forEach((menu) => {`,
    `          if (!menu.contains(event.target)) menu.removeAttribute("open");`,
    `        });`,
    `      });`,
    `      document.addEventListener("keydown", (event) => {`,
    `        if (event.key === "Escape") {`,
    `          document.querySelectorAll("details.nav-menu[open]").forEach((menu) => {`,
    `            menu.removeAttribute("open");`,
    `          });`,
    `        }`,
    `      });`,
    `    </script>`,
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
