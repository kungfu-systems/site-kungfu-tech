#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function escapeAttr(value) {
  return escapeHtml(value).replaceAll("'", "&#39;");
}

export function readLayout(repoRoot = process.cwd()) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, "site/shared-layout.json"), "utf8"));
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
      "        <details class=\"nav-menu\">",
      `          <summary>${escapeHtml(item.label)}</summary>`,
      "          <div class=\"nav-menu-panel\">",
      menuLinks,
      "          </div>",
      "        </details>",
    ].join("\n");
  }
  return `        <a${linkClass(item)} href="${escapeAttr(item.href)}">${escapeHtml(item.label)}</a>`;
}

export function renderHeader(config) {
  const brand = config.brand;
  const tagline = brand.tagline
    ? `        <span class="brand-copy"><span>${escapeHtml(brand.label)}</span><span class="brand-tagline">${escapeHtml(brand.tagline)}</span></span>`
    : `        <span>${escapeHtml(brand.label)}</span>`;
  const links = config.navigation.map((item) => renderNavItem(item)).join("\n");

  return [
    "    <header class=\"site-header\">",
    `      <a class="brand" href="${escapeAttr(brand.href)}" aria-label="${escapeAttr(brand.label)}">`,
    `        <span class="mark" aria-hidden="true">${escapeHtml(brand.mark)}</span>`,
    tagline,
    "      </a>",
    "      <nav class=\"site-nav\" aria-label=\"Project links\">",
    links,
    "      </nav>",
    "    </header>",
  ].join("\n");
}

export function renderFooter(config) {
  const links = config.footer
    .filter((item) => item.href)
    .map((item) => `        <a href="${escapeAttr(item.href)}">${escapeHtml(item.text)}</a>`)
    .join("\n");
  const license = config.footer.find((item) => item.role === "license");
  const copyright = config.footer.find((item) => item.role === "copyright");

  return [
    "    <footer class=\"site-footer\">",
    "      <nav class=\"footer-links\" aria-label=\"Footer links\">",
    links,
    "      </nav>",
    license ? `      <p class="footer-note">${escapeHtml(license.text)}</p>` : "",
    copyright ? `      <p class="footer-copy">${escapeHtml(copyright.text)}</p>` : "",
    "    </footer>",
    "    <script>",
    "      document.addEventListener(\"click\", (event) => {",
    "        document.querySelectorAll(\"details.nav-menu[open]\").forEach((menu) => {",
    "          if (!menu.contains(event.target)) menu.removeAttribute(\"open\");",
    "        });",
    "      });",
    "      document.addEventListener(\"keydown\", (event) => {",
    "        if (event.key === \"Escape\") {",
    "          document.querySelectorAll(\"details.nav-menu[open]\").forEach((menu) => {",
    "            menu.removeAttribute(\"open\");",
    "          });",
    "        }",
    "      });",
    "    </script>",
  ].join("\n");
}

export function replaceSharedBlock(source, name, rendered) {
  const pattern = new RegExp(
    `    <!-- shared-${name}:start -->[\\s\\S]*?    <!-- shared-${name}:end -->`,
    "m",
  );
  if (!pattern.test(source)) {
    throw new Error(`missing shared ${name} markers`);
  }
  return source.replace(pattern, `    <!-- shared-${name}:start -->\n${rendered}\n    <!-- shared-${name}:end -->`);
}
