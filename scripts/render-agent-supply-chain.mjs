#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { loadWhitepaperSource } from "./whitepaper-source.mjs";
import { escapeAttr, escapeHtml, readLayout, renderFooter, renderHeader } from "./site-layout.mjs";

const repoRoot = process.cwd();
const source = loadWhitepaperSource(repoRoot);
const narrative = source.bundle.agentSupplyChain;
if (
  narrative?.contract !== "kungfu-agent-supply-chain-public-narrative/v1"
  || narrative.layers?.map((layer) => layer.id).join(",") !== "kfd-3,buildchain,kfd-2,libkungfu,agent-hub-portability"
  || narrative.maturityVocabulary?.join(",") !== "proved-now,enabled-by-protocol,not-claimed"
  || narrative.notClaimed?.includes("two independent production Hubs") !== true
  || narrative.notClaimed?.includes("external vendor adoption or endorsement") !== true
  || !narrative.vendorNextAction?.includes("30-day assessment")
  || narrative.layers.some((layer) => !layer.owner || !layer.input || !layer.output)
  || narrative.layers.some((layer) => !layer.evidenceCoordinates?.length || !layer.knownLimits?.length)
) {
  throw new Error("white-paper package does not expose the expected Agent Supply Chain contract");
}

const layout = readLayout(repoRoot);
const layerCards = narrative.layers.map((layer) => `
        <article class="layer-card">
          <p class="layer-order">${String(layer.order).padStart(2, "0")} · ${escapeHtml(layer.statusClass)} · ${escapeHtml(layer.owner)}</p>
          <h2>${escapeHtml(layer.id)}</h2>
          <p>${escapeHtml(layer.statement)}</p>
          <dl><dt>Input</dt><dd>${escapeHtml(layer.input)}</dd><dt>Output</dt><dd>${escapeHtml(layer.output)}</dd></dl>
          <p class="evidence"><strong>Exact evidence</strong><code>${escapeHtml(layer.evidenceCoordinates[0])}</code></p>
          <p class="known-limit"><strong>Known limit</strong>${escapeHtml(layer.knownLimits[0])}</p>
          <div class="layer-links"><a href="${escapeAttr(layer.humanRoute)}">Human route</a><a href="${escapeAttr(layer.agentRoute)}">Agent route</a></div>
        </article>`).join("");
const notClaimed = narrative.notClaimed.map((claim) => `<li>${escapeHtml(claim)}</li>`).join("");
const provedNow = narrative.layers.filter((layer) => layer.statusClass === "proved-now");
const enabledByProtocol = narrative.layers.filter((layer) => layer.statusClass === "enabled-by-protocol");

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Agent Supply Chain | Kungfu</title>
  <meta name="description" content="The open five-layer Agent Supply Chain: discovery, exact-artifact evidence, purpose-bound trust, durable work facts, and independent Hub portability.">
  <meta property="og:type" content="website">
  <meta property="og:title" content="Agent Supply Chain | Kungfu">
  <meta property="og:description" content="Five independently owned layers from discovery to evidence-bound Agent portability.">
  <meta property="og:url" content="https://kungfu.tech/agent-supply-chain/">
  <meta name="twitter:card" content="summary">
  <link rel="canonical" href="https://kungfu.tech/agent-supply-chain/">
  <link rel="alternate" type="application/json" title="Agent Supply Chain contract" href="/agent-supply-chain.json">
  <link rel="alternate" type="text/plain" title="Kungfu agent entrypoint" href="/llms.txt">
  <link rel="stylesheet" href="/assets/site.css">
  <style>
    main { width: min(1180px, calc(100% - 40px)); margin: 0 auto; padding: 34px 0 64px; }
    .hero { display: grid; gap: 20px; padding: 32px 0 42px; }
    .eyebrow, .layer-order { margin: 0; color: var(--accent); font-size: 13px; font-weight: 700; text-transform: uppercase; }
    h1 { max-width: 1050px; margin: 0; font-size: clamp(44px, 7vw, 84px); line-height: .98; }
    .lead { max-width: 900px; margin: 0; color: var(--muted); font-size: 20px; }
    .claim-boundary { padding: 18px; border-left: 4px solid var(--accent); background: var(--panel-soft); color: var(--fg); }
    .section-heading { margin: 10px 0 18px; }
    .section-heading h2 { margin: 0; font-size: clamp(28px, 4vw, 46px); }
    .layer-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; }
    .layer-card { display: grid; gap: 12px; align-content: start; min-height: 270px; padding: 20px; border: 1px solid var(--line); background: var(--panel); overflow: hidden; }
    .layer-card h2, .layer-card p { margin: 0; }
    .layer-card h2 { font-size: 22px; }
    .layer-card > p:not(.layer-order) { color: var(--muted); }
    .layer-card dl { display: grid; gap: 5px; margin: 0; }
    .layer-card dt { color: var(--accent); font-size: 12px; font-weight: 700; text-transform: uppercase; }
    .layer-card dd { margin: 0 0 7px; color: var(--muted); font-size: 14px; }
    .layer-card strong { display: block; margin-bottom: 5px; color: var(--fg); font-size: 12px; text-transform: uppercase; }
    .layer-card code { display: block; overflow-wrap: anywhere; color: var(--muted); font-size: 11px; }
    .known-limit { font-size: 13px; }
    .layer-links { display: flex; flex-wrap: wrap; gap: 10px; margin-top: auto; font-size: 13px; font-weight: 650; }
    .maturity-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-top: 28px; }
    .decision-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 18px; }
    .decision-card { padding: 24px; border: 1px solid var(--line); background: var(--surface); }
    .decision-card h2 { margin-top: 0; }
    .decision-card p, .decision-card li { color: var(--muted); }
    .action { display: inline-flex; padding: 10px 14px; border: 1px solid var(--accent); background: var(--accent); color: white; text-decoration: none; font-weight: 700; }
    @media (max-width: 980px) { .layer-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 640px) { main { width: min(100% - 28px, 640px); } .layer-grid, .maturity-grid, .decision-grid { grid-template-columns: 1fr; } .layer-card { min-height: 0; } }
  </style>
</head>
<body>
  <main>
    <!-- shared-header:start -->
${renderHeader(layout)}
    <!-- shared-header:end -->
    <section class="hero">
      <p class="eyebrow">Agent Supply Chain · public narrative contract</p>
      <h1>Agent products should compete above an open responsibility boundary.</h1>
      <p class="lead">${escapeHtml(narrative.categoryStatement)}</p>
      <p class="claim-boundary"><strong>Current boundary:</strong> ${escapeHtml(narrative.claimBoundary)}</p>
    </section>
    <div class="section-heading"><h2>Five responsibilities. Independent owners. One inspectable path.</h2></div>
    <section class="layer-grid" aria-label="Five Agent Supply Chain layers">${layerCards}
    </section>
    <section class="maturity-grid" aria-label="Maturity claims matrix">
      <article class="decision-card"><p class="eyebrow">Proved now</p><h2>${provedNow.length} exact layers</h2><p>${escapeHtml(provedNow.map((layer) => layer.id).join(" · "))}</p></article>
      <article class="decision-card"><p class="eyebrow">Enabled by protocol</p><h2>${enabledByProtocol.length} bounded layer</h2><p>${escapeHtml(enabledByProtocol.map((layer) => layer.id).join(" · "))}</p></article>
      <article class="decision-card"><p class="eyebrow">Not claimed</p><h2>${narrative.notClaimed.length} explicit boundaries</h2><p>Capability, conformance, adoption, and endorsement remain separate claims.</p></article>
    </section>
    <section class="decision-grid">
      <article class="decision-card">
        <p class="eyebrow">Not claimed</p>
        <h2>Protocol capability is not market adoption.</h2>
        <ul>${notClaimed}</ul>
      </article>
      <article class="decision-card">
        <p class="eyebrow">Bounded evaluation</p>
        <h2>Make one exact decision, not a platform bet.</h2>
        <p>${escapeHtml(narrative.vendorNextAction)}</p>
        <a class="action" href="/agent-builders/">Open the builder path</a>
      </article>
    </section>
    <!-- shared-footer:start -->
${renderFooter(layout)}
    <!-- shared-footer:end -->
  </main>
</body>
</html>
`;

const llms = `# Kungfu

Kungfu has two public strategic axes: continuity for durable Agent work, and an open Agent Supply Chain for product discovery, exact-artifact evidence, purpose-bound trust, durable work facts, and portability across independently owned Hubs.

Agent Supply Chain: https://kungfu.tech/agent-supply-chain/
Machine contract: https://kungfu.tech/agent-supply-chain.json
Builder evaluation: https://kungfu.tech/agent-builders/
Evidence surface: https://libkungfu.dev/

## Five layers

${narrative.layers.map((layer) => `${layer.order}. ${layer.id} [${layer.statusClass}] — owner: ${layer.owner}; input: ${layer.input}; output: ${layer.output}; evidence: ${layer.evidenceCoordinates[0]}; known limit: ${layer.knownLimits[0]}`).join("\n")}

## Claim boundary

${narrative.claimBoundary}

Not claimed: ${narrative.notClaimed.join("; ")}.

Next action: ${narrative.vendorNextAction}
`;

const outputDir = path.join(repoRoot, "dist", "agent-supply-chain");
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, "index.html"), html);
fs.writeFileSync(path.join(repoRoot, "dist", "agent-supply-chain.json"), `${JSON.stringify(narrative, null, 2)}\n`);
fs.writeFileSync(path.join(repoRoot, "dist", "llms.txt"), llms);
console.log("rendered Agent Supply Chain route and machine contract");
