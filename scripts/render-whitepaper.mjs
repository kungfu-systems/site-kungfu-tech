#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import MarkdownIt from "markdown-it";
import {
  escapeAttr,
  escapeHtml,
  readLayout,
  renderFooter,
  renderHeader,
} from "./site-layout.mjs";
import {
  buildWhitepaperManifest,
  loadWhitepaperSource,
  siteHref,
  WHITEPAPER_ORIGIN,
} from "./whitepaper-source.mjs";

const repoRoot = process.cwd();
const distRoot = path.join(repoRoot, "dist");
const source = loadWhitepaperSource(repoRoot);
const layout = readLayout(repoRoot);
const markdown = new MarkdownIt({ html: false, linkify: true, typographer: false });

function writeText(relativePath, content) {
  const outputPath = path.join(distRoot, relativePath);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, content);
}

function stripSectionTitle(section) {
  const lines = section.markdown.replace(/\r\n/g, "\n").split("\n");
  if (lines[0]?.replace(/^#\s+/, "").trim() === section.title.trim()) lines.shift();
  while (lines[0]?.trim() === "") lines.shift();
  const normalized = lines
    .filter((line) => !/^KFD-[0-9]+\s*\|\s*/.test(line.trim()))
    .join("\n")
    .replace(/^(#{2,5})(\s+)/gm, "#$1$2")
    .trim();
  return renderAudienceTable(normalized);
}

function renderAudienceTable(sourceMarkdown) {
  const lines = sourceMarkdown.split("\n");
  const headingIndex = lines.findIndex((line) => /^###\s+What To Read For\s*$/.test(line));
  if (headingIndex === -1) return sourceMarkdown;

  let cursor = headingIndex + 1;
  while (lines[cursor]?.trim() === "") cursor += 1;
  const tableStart = cursor;
  const rows = [];

  while (cursor < lines.length && !/^#{2,6}\s+/.test(lines[cursor])) {
    const match = lines[cursor].match(/^(If you are [^|]+)\s*\|\s*(.*)$/);
    if (!match) {
      if (rows.length > 0 && lines[cursor].trim() !== "") {
        rows[rows.length - 1][1] = `${rows[rows.length - 1][1]} ${lines[cursor].trim()}`;
      }
      cursor += 1;
      continue;
    }
    rows.push([match[1].trim(), match[2].trim()]);
    cursor += 1;
  }

  if (rows.length < 2) return sourceMarkdown;
  const table = [
    "| Audience | Read for |",
    "| --- | --- |",
    ...rows.map(([audience, purpose]) => `| ${audience} | ${purpose.replaceAll("|", "\\|")} |`),
  ];
  lines.splice(tableStart, cursor - tableStart, ...table, "");
  return lines.join("\n");
}

function localizeRenderedLinks(html) {
  return html.replace(/href="https:\/\/kungfu\.tech([^"#?]*)([^"]*)"/g, (_match, pathname, suffix) => {
    return `href="${escapeAttr(siteHref(`${pathname}${suffix}`))}"`;
  });
}

function renderSection(section) {
  const principles = section.presentation === "kfd-principles"
    ? `<div class="paper-principles" aria-label="Kungfu Design Principles">
${source.bundle.principles.map((principle) => `          <article class="paper-principle">
            <span>${escapeHtml(principle.id)}</span>
            <strong>${escapeHtml(principle.text)}</strong>
          </article>`).join("\n")}
        </div>`
    : "";
  const body = localizeRenderedLinks(markdown.render(stripSectionTitle(section)));
  return `      <section class="paper-section" id="section-${escapeAttr(section.id)}">
        <p class="paper-section-role">${escapeHtml(section.role)} / ${escapeHtml(section.presentation)}</p>
        <h2>${escapeHtml(section.title)}</h2>
${principles}
        <div class="paper-prose">
${body.trim().split("\n").map((line) => `          ${line}`).join("\n")}
        </div>
      </section>`;
}

function head({ title, description, canonicalUrl }) {
  return `  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeAttr(description)}">
  <link rel="canonical" href="${escapeAttr(canonicalUrl)}">
  <link rel="alternate" type="application/json" title="White paper manifest" href="/whitepaper/manifest.json">
  <link rel="alternate" type="text/plain" title="White paper agent entrypoint" href="/whitepaper/llms.txt">
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' fill='%2314171f'/%3E%3Ctext x='32' y='39' text-anchor='middle' font-family='Arial,sans-serif' font-size='22' font-weight='700' fill='white'%3EKF%3C/text%3E%3C/svg%3E">
  <link rel="stylesheet" href="/assets/site.css">
  <link rel="stylesheet" href="/assets/whitepaper.css">`;
}

function sharedHeader() {
  return `    <!-- shared-header:start -->
${renderHeader(layout)}
    <!-- shared-header:end -->`;
}

function sharedFooter() {
  return `    <!-- shared-footer:start -->
${renderFooter(layout)}
    <!-- shared-footer:end -->`;
}

function renderIndex() {
  const { bundle, packageInfo, routes } = source;
  return `<!doctype html>
<html lang="en">
<head>
${head({
  title: "White Papers | Kungfu",
  description: "Kungfu product white papers and their public evidence paths.",
  canonicalUrl: bundle.routes.indexUrl,
})}
</head>
<body>
  <main class="whitepaper-page whitepaper-index">
${sharedHeader()}
    <section class="paper-index-hero" aria-labelledby="whitepaper-index-title">
      <p class="paper-eyebrow">Kungfu publications</p>
      <h1 id="whitepaper-index-title">White papers grounded in product evidence.</h1>
      <p>Read the product thesis here, then follow its package, PDF, source, and Buildchain evidence without leaving the public record.</p>
    </section>

    <section class="paper-catalog" aria-label="Published white papers">
      <article class="paper-listing">
        <div class="paper-listing-copy">
          <p class="paper-section-role">${escapeHtml(bundle.hero.eyebrow)} / ${escapeHtml(packageInfo.version)}</p>
          <h2><a href="${escapeAttr(routes.reader)}">${escapeHtml(bundle.hero.title)}</a></h2>
          <p>${escapeHtml(bundle.hero.lead)}</p>
          <p class="paper-stance">${escapeHtml(bundle.hero.stance)}</p>
        </div>
        <dl class="paper-listing-facts">
          <div><dt>Source</dt><dd><code>${escapeHtml(packageInfo.name)}</code></dd></div>
          <div><dt>Version</dt><dd><code>${escapeHtml(packageInfo.version)}</code></dd></div>
          <div><dt>Format</dt><dd>HTML + PDF</dd></div>
        </dl>
        <div class="paper-actions">
          <a class="paper-button primary" href="${escapeAttr(routes.reader)}">${escapeHtml(bundle.hero.primaryCta.label)}</a>
          <a class="paper-button" href="${escapeAttr(routes.pdf)}">Download PDF</a>
        </div>
      </article>
    </section>
${sharedFooter()}
  </main>
</body>
</html>
`;
}

function renderReader() {
  const { bundle, packageInfo, routes } = source;
  const toc = bundle.homepageSections
    .map((section) => `          <a href="#section-${escapeAttr(section.id)}">${escapeHtml(section.title)}</a>`)
    .join("\n");
  const sections = bundle.homepageSections.map(renderSection).join("\n\n");
  const evidenceUrl = bundle.hero.secondaryCta.href || routes.evidence;

  return `<!doctype html>
<html lang="en">
<head>
${head({
  title: `${bundle.hero.title} | Kungfu`,
  description: bundle.hero.lead,
  canonicalUrl: bundle.routes.canonicalUrl,
})}
</head>
<body>
  <main class="whitepaper-page">
${sharedHeader()}
    <p class="paper-page-kicker"><a href="${escapeAttr(routes.index)}">Back to white papers</a><span>White paper / ${escapeHtml(packageInfo.version)}</span></p>

    <header class="paper-hero">
      <p class="paper-eyebrow">${escapeHtml(bundle.hero.eyebrow)}</p>
      <h1>${escapeHtml(bundle.hero.title)}</h1>
      <p class="paper-lead">${escapeHtml(bundle.hero.lead)}</p>
      <p class="paper-stance">${escapeHtml(bundle.hero.stance)}</p>
      <div class="paper-actions">
        <a class="paper-button primary" href="${escapeAttr(routes.pdf)}">Read the PDF</a>
        <a class="paper-button" href="${escapeAttr(evidenceUrl)}">${escapeHtml(bundle.hero.secondaryCta.label)}</a>
      </div>
    </header>

    <section class="paper-preview" aria-labelledby="paper-preview-title">
      <div class="paper-preview-heading">
        <div>
          <p class="paper-section-role">Primary publication artifact</p>
          <h2 id="paper-preview-title">Read the original paper</h2>
        </div>
        <a href="${escapeAttr(routes.pdf)}">Open PDF</a>
      </div>
      <object data="${escapeAttr(`${routes.pdf}#page=1&view=FitH`)}" type="application/pdf" aria-label="First page of ${escapeAttr(bundle.hero.title)}">
        <p>Your browser cannot preview this PDF. <a href="${escapeAttr(routes.pdf)}">Open the white paper PDF.</a></p>
      </object>
    </section>

    <div class="paper-layout">
      <aside class="paper-sidebar">
        <nav class="paper-toc" aria-label="White paper sections">
          <strong>On this page</strong>
${toc}
        </nav>
        <dl class="paper-source-facts">
          <div><dt>Package</dt><dd><code>${escapeHtml(packageInfo.name)}</code></dd></div>
          <div><dt>Version</dt><dd><code>${escapeHtml(packageInfo.version)}</code></dd></div>
          <div><dt>Source SHA</dt><dd><code>${escapeHtml(source.publicationManifest.source.sha.slice(0, 12))}</code></dd></div>
        </dl>
      </aside>
      <article class="paper-article">
${sections}
      </article>
    </div>
${sharedFooter()}
  </main>
</body>
</html>
`;
}

function renderLlms(manifest) {
  const sectionLines = manifest.sections.map((section) => `- ${section.title}: ${section.href}`).join("\n");
  return `# ${manifest.title}

> ${manifest.description}

Canonical reader: ${WHITEPAPER_ORIGIN}${manifest.routes.reader}
PDF: ${WHITEPAPER_ORIGIN}${manifest.routes.pdf}
Manifest: ${WHITEPAPER_ORIGIN}${manifest.routes.manifest}
Evidence: ${manifest.routes.evidence}

Source package: ${manifest.source.package}@${manifest.source.version}
Source commit: ${manifest.source.sourceSha}
PDF SHA256: ${manifest.artifact.sha256}

## Sections

${sectionLines}
`;
}

const manifest = buildWhitepaperManifest(source);
writeText("whitepaper/index.html", renderIndex());
writeText("whitepaper/kungfu-real-world-agent-work/index.html", renderReader());
writeText("whitepaper/manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);
writeText("whitepaper/llms.txt", renderLlms(manifest));
fs.copyFileSync(source.pdfPath, path.join(distRoot, "whitepaper", "kungfu-real-world-agent-work.pdf"));

console.log(`rendered white paper from ${source.packageInfo.name}@${source.packageInfo.version}`);
