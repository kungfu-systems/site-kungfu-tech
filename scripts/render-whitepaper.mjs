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
  buildPublicationCatalogManifest,
  buildWhitepaperManifest,
  loadPublicationCatalog,
  loadWhitepaperSource,
  siteHref,
  WHITEPAPER_PACKAGE,
  WHITEPAPER_ORIGIN,
} from "./whitepaper-source.mjs";

const repoRoot = process.cwd();
const distRoot = path.join(repoRoot, "dist");
const source = loadWhitepaperSource(repoRoot);
const catalog = loadPublicationCatalog(repoRoot);
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
  const renderedPrinciples = new Set(
    source.bundle.principles.map((principle) => `${principle.id} | ${principle.text}`),
  );
  const normalized = lines
    .filter((line) => !renderedPrinciples.has(line.trim()))
    .join("\n")
    .replace(/^(#{2,5})(\s+)/gm, "#$1$2")
    .trim();
  return renderStructuredTables(normalized);
}

function structuredRow(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("|") || /^[-*+]\s+/.test(trimmed)) return null;
  const cells = trimmed.split("|").map((cell) => cell.trim());
  return cells.length >= 2 && cells.every(Boolean) ? cells : null;
}

function renderStructuredTables(sourceMarkdown) {
  const lines = sourceMarkdown.split("\n");
  const output = [];

  for (let index = 0; index < lines.length;) {
    if (!structuredRow(lines[index])) {
      output.push(lines[index]);
      index += 1;
      continue;
    }

    const rows = [];
    let cursor = index;
    while (cursor < lines.length && lines[cursor].trim() !== "" && !/^#{2,6}\s+/.test(lines[cursor])) {
      const cells = structuredRow(lines[cursor]);
      if (cells) {
        rows.push(cells);
      } else if (rows.length > 0 && !/^[-*+]\s+/.test(lines[cursor].trim())) {
        const lastCell = rows[rows.length - 1].length - 1;
        rows[rows.length - 1][lastCell] = `${rows[rows.length - 1][lastCell]} ${lines[cursor].trim()}`;
      } else {
        break;
      }
      cursor += 1;
    }

    if (rows.length < 2) {
      output.push(...lines.slice(index, cursor));
      index = cursor;
      continue;
    }

    const width = Math.max(...rows.map((row) => row.length));
    const hasSourceHeader = ["Decision", "Surface"].includes(rows[0][0]);
    const header = hasSourceHeader
      ? rows.shift()
      : width === 2
        ? ["Responsibility", "Meaning"]
        : ["Item", "Status", "Responsibility"];
    const escapeCell = (cell = "") => cell.replaceAll("|", "\\|");
    output.push(
      `| ${header.map(escapeCell).join(" | ")} |`,
      `| ${Array.from({ length: width }, () => "---").join(" | ")} |`,
      ...rows.map((row) => `| ${Array.from({ length: width }, (_, cell) => escapeCell(row[cell])).join(" | ")} |`),
      "",
    );
    index = cursor;
  }

  return output.join("\n");
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

function head({ title, description, canonicalUrl, manifestHref = "/whitepaper/manifest.json" }) {
  return `  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeAttr(description)}">
  <link rel="canonical" href="${escapeAttr(canonicalUrl)}">
  <link rel="alternate" type="application/json" title="Publication manifest" href="${escapeAttr(manifestHref)}">
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
  const paperListings = catalog.papers.map((paper) => {
    const isWhitePaper = paper.packageInfo.name === WHITEPAPER_PACKAGE;
    const typeLabel = isWhitePaper ? "White Paper" : "Research Paper";
    return `      <article class="paper-listing${isWhitePaper ? " featured-whitepaper" : " research-paper"}">
        <div class="paper-listing-copy">
          <p class="paper-type-badge${isWhitePaper ? " whitepaper" : ""}">${typeLabel}</p>
          <p class="paper-section-role">${isWhitePaper ? "Product thesis" : "Research publication"} / ${escapeHtml(paper.packageInfo.version)}</p>
          <h2><a href="${escapeAttr(paper.routes.reader)}">${escapeHtml(paper.title)}</a></h2>
          <p>${escapeHtml(paper.abstract)}</p>
        </div>
        <dl class="paper-listing-facts">
          <div><dt>Source</dt><dd><code>${escapeHtml(paper.packageInfo.name)}</code></dd></div>
          <div><dt>Version</dt><dd><code>${escapeHtml(paper.packageInfo.version)}</code></dd></div>
          <div><dt>PDF SHA256</dt><dd><code>${escapeHtml(paper.pdfArtifact.sha256.slice(0, 16))}&hellip;</code></dd></div>
        </dl>
        <div class="paper-actions">
          <a class="paper-button primary" href="${escapeAttr(paper.routes.reader)}">${isWhitePaper ? "Read the White Paper" : "Read paper"}</a>
          <a class="paper-button" href="${escapeAttr(paper.routes.pdf)}">Open PDF</a>
          <a class="paper-button" href="${escapeAttr(paper.routes.evidence)}">Inspect evidence</a>
        </div>
      </article>`;
  }).join("\n");
  const kfdCommitments = catalog.kfd.commitments
    .map((commitment) => `<li><strong>${escapeHtml(commitment.id)}</strong> ${escapeHtml(commitment.text)}</li>`)
    .join("");
  return `<!doctype html>
<html lang="en">
<head>
${head({
  title: "Papers | Kungfu",
  description: "Kungfu papers and their public evidence paths.",
  canonicalUrl: `${WHITEPAPER_ORIGIN}/whitepaper/`,
  manifestHref: "/whitepaper/catalog.json",
})}
</head>
<body>
  <main class="whitepaper-page whitepaper-index">
${sharedHeader()}
    <section class="paper-index-hero" aria-labelledby="whitepaper-index-title">
      <p class="paper-eyebrow">Kungfu publication library</p>
      <h1 id="whitepaper-index-title">Start with the White Paper. Continue into the research.</h1>
      <p>The White Paper presents the product thesis. The Foundation Model, Observer, and Episodes papers develop specific systems arguments, each with an exact package, PDF, source revision, and Buildchain evidence path.</p>
    </section>

    <section class="paper-catalog" aria-label="Published white papers">
${paperListings}
    </section>

    <section class="paper-source-catalog" aria-labelledby="paper-source-heading">
      <div class="paper-source-heading">
        <p class="paper-eyebrow">Upstream contracts</p>
        <h2 id="paper-source-heading">Generated from KFD and Buildchain facts.</h2>
        <p>The catalog is built from exact package-owned site bundles, not a parallel hand-maintained version ledger.</p>
      </div>
      <div class="paper-source-grid">
        <article class="paper-source-card">
          <p class="paper-section-role">${escapeHtml(catalog.kfd.packageInfo.name)} / ${escapeHtml(catalog.kfd.packageInfo.version)}</p>
          <h3><a href="${escapeAttr(catalog.kfd.url)}">${escapeHtml(catalog.kfd.title)}</a></h3>
          <p>${escapeHtml(catalog.kfd.summary)}</p>
          <ul>${kfdCommitments}</ul>
        </article>
        <article class="paper-source-card">
          <p class="paper-section-role">${escapeHtml(catalog.buildchain.packageInfo.name)} / ${escapeHtml(catalog.buildchain.packageInfo.version)}</p>
          <h3><a href="${escapeAttr(catalog.buildchain.url)}">${escapeHtml(catalog.buildchain.title)}</a></h3>
          <p>${escapeHtml(catalog.buildchain.summary)}</p>
          <p><a href="${escapeAttr(catalog.buildchain.url)}">Inspect the release-passport system</a></p>
        </article>
      </div>
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
  const paperLines = catalog.papers.map((paper) => `- ${paper.title}: ${paper.packageInfo.name}@${paper.packageInfo.version} | ${paper.routes.reader} | PDF ${paper.pdfArtifact.sha256}`).join("\n");
  return `# ${manifest.title}

> ${manifest.description}

Canonical reader: ${WHITEPAPER_ORIGIN}${manifest.routes.reader}
PDF: ${WHITEPAPER_ORIGIN}${manifest.routes.pdf}
Manifest: ${WHITEPAPER_ORIGIN}${manifest.routes.manifest}
Evidence: ${manifest.routes.evidence}

Source package: ${manifest.source.package}@${manifest.source.version}
Source commit: ${manifest.source.sourceSha}
PDF SHA256: ${manifest.artifact.sha256}

## Publication catalog

${paperLines}

KFD source: ${catalog.kfd.packageInfo.name}@${catalog.kfd.packageInfo.version} | ${catalog.kfd.url}
Buildchain source: ${catalog.buildchain.packageInfo.name}@${catalog.buildchain.packageInfo.version} | ${catalog.buildchain.url}

## Sections

${sectionLines}
`;
}

const manifest = buildWhitepaperManifest(source);
const catalogManifest = buildPublicationCatalogManifest(catalog);
writeText("whitepaper/index.html", renderIndex());
writeText("whitepaper/kungfu-white-paper/index.html", renderReader());
writeText("whitepaper/manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);
writeText("whitepaper/catalog.json", `${JSON.stringify(catalogManifest, null, 2)}\n`);
writeText("whitepaper/llms.txt", renderLlms(manifest));
fs.copyFileSync(source.pdfPath, path.join(distRoot, "whitepaper", "kungfu-white-paper.pdf"));

console.log(`rendered white paper from ${source.packageInfo.name}@${source.packageInfo.version}`);
