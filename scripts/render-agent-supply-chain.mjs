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
const displayLayerName = (id) => ({
  "kfd-3": "KFD-3",
  buildchain: "Buildchain",
  "kfd-2": "KFD-2",
  libkungfu: "libkungfu",
  "agent-hub-portability": "Agent Hub portability",
})[id] || id;
const readerProgression = {
  contract: "kungfu-agent-supply-chain-reader-progression/v1",
  premise: {
    title: "The next software user is an Agent.",
    statement: "Software use is shifting from humans directly choosing and operating every tool to Agents discovering, evaluating, selecting, and invoking tools within delegated authority.",
  },
  authorityBoundary: "Humans and Hubs continue to set goals, permissions, budgets, policy, admission, and revocation. Agents increasingly perform day-to-day tool selection inside those boundaries.",
  distributionAdvantage: "Agent-first software can be discovered, evaluated, invoked, and continued with less bespoke interpretation, creating a new selection and distribution advantage.",
  bootstrap: {
    title: "Kungfu gives the first Agent a way to understand the stack.",
    seed: "A user first chooses Kungfu for concrete utility: continuity across long-running Agent work.",
    discovery: "When Kungfu launches an Agent, a compact, versioned Skill envelope points to the exact installed context, capability catalog, and KFD-3 collaboration interface. From those local entrypoints the Agent can inspect the KFD-2 evidence and Buildchain-bound release provenance available for that artifact.",
    boundary: "Kungfu must still solve a real problem well enough to earn the first adoption. The envelope does not create demand or assume prior KFD knowledge; it turns one initial product proof into a repeatable learning and distribution loop.",
    steps: [
      "User chooses Kungfu for durable Agent work",
      "Kungfu manages the Agent",
      "Skill envelope points to local discovery",
      "Agent inspects the exact installed facts",
      "Informed use can reinforce demand",
    ],
  },
  flywheel: [
    "A user chooses Kungfu because continuity for durable Agent work solves a concrete problem.",
    "A Kungfu-managed Agent receives a compact Skill envelope and discovers the exact installed collaboration surface and evidence.",
    "Successful Agent-mediated use can increase demand for KFD-3-compatible software.",
    "Buildchain binds KFD-3 declarations and KFD-2 evidence to an exact release.",
    "More developers can ship Agent-ready software with assessable provenance.",
  ],
  flywheelBoundary: "This is an adoption mechanism enabled by the stack, not evidence that a broad network effect, external adoption, or a multi-Hub market already exists.",
};
const machineNarrative = {
  ...narrative,
  readerProgression,
  layers: narrative.layers.map((layer) => ({ ...layer, label: displayLayerName(layer.id) })),
};
const layerCards = narrative.layers.map((layer) => `
        <article class="layer-card">
          <p class="layer-order">${String(layer.order).padStart(2, "0")} · ${escapeHtml(layer.statusClass)} · ${escapeHtml(layer.owner)}</p>
          <h3>${escapeHtml(displayLayerName(layer.id))}</h3>
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
  <meta name="description" content="As Agents gain delegated tool choice, Agent-first software gains a new distribution advantage. See how Kungfu connects discovery, exact-release evidence, trust, continuity, and portability.">
  <meta property="og:type" content="website">
  <meta property="og:title" content="Agent Supply Chain | Kungfu">
  <meta property="og:description" content="The software user is changing. Kungfu is an open supply chain for Agent-mediated discovery, trust, use, continuity, and portability.">
  <meta property="og:url" content="https://kungfu.tech/agent-supply-chain/">
  <meta name="twitter:card" content="summary">
  <link rel="canonical" href="https://kungfu.tech/agent-supply-chain/">
  <link rel="alternate" type="application/json" title="Agent Supply Chain contract" href="/agent-supply-chain.json">
  <link rel="alternate" type="text/plain" title="Kungfu agent entrypoint" href="/llms.txt">
  <link rel="stylesheet" href="/assets/site.css">
  <style>
    main { width: min(1180px, calc(100% - 40px)); margin: 0 auto; padding: 34px 0 64px; }
    .hero { display: grid; gap: 20px; min-height: 540px; align-content: center; padding: 64px 0 76px; }
    .eyebrow, .layer-order { margin: 0; color: var(--accent); font-size: 13px; font-weight: 700; text-transform: uppercase; }
    h1 { max-width: 980px; margin: 0; font-size: clamp(48px, 8vw, 92px); line-height: .96; }
    .lead { max-width: 900px; margin: 0; color: var(--muted); font-size: 20px; }
    .claim-boundary { padding: 18px; border-left: 4px solid var(--accent); background: var(--panel-soft); color: var(--fg); }
    .authority-note { max-width: 920px; margin: 4px 0 0; padding: 16px 18px; border-left: 3px solid var(--accent); background: var(--panel-soft); }
    .chapter { padding: 74px 0; border-top: 1px solid var(--line); }
    .section-heading { max-width: 900px; margin: 0 0 28px; }
    .section-heading h2 { margin: 0; font-size: clamp(28px, 4vw, 46px); }
    .section-heading p { max-width: 760px; margin: 14px 0 0; color: var(--muted); font-size: 18px; }
    .era-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
    .era-card { padding: 26px; border: 1px solid var(--line); background: var(--surface); }
    .era-card h3 { margin: 6px 0 14px; font-size: 24px; }
    .era-card p { margin: 0; color: var(--muted); }
    .era-card.agent-era { border-color: var(--accent); background: var(--panel); }
    .flow { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 20px; font-size: 14px; font-weight: 650; }
    .flow span { padding: 7px 9px; border: 1px solid var(--line); background: var(--panel-soft); }
    .flow i { color: var(--accent); font-style: normal; }
    .advantage-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
    .advantage-card { padding: 22px; border-top: 3px solid var(--accent); background: var(--panel); }
    .advantage-card h3 { margin: 0 0 8px; font-size: 20px; }
    .advantage-card p { margin: 0; color: var(--muted); }
    .bootstrap-grid { display: grid; grid-template-columns: 1fr 1.45fr; gap: 18px; }
    .bootstrap-card { padding: 26px; border: 1px solid var(--line); background: var(--surface); }
    .bootstrap-card.discovery { border-color: var(--accent); background: var(--panel); }
    .bootstrap-card h3 { margin: 6px 0 12px; font-size: 24px; }
    .bootstrap-card p { margin: 0; color: var(--muted); }
    .bootstrap-flow { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; margin-top: 18px; padding: 18px; border: 1px solid var(--line); background: var(--panel-soft); font-size: 14px; font-weight: 650; }
    .bootstrap-flow span { position: relative; display: grid; place-items: center; min-height: 58px; padding: 8px 10px; border: 1px solid var(--line); background: var(--surface); text-align: center; }
    .bootstrap-flow span:not(:last-child)::after { content: "→"; position: absolute; z-index: 2; top: 50%; right: -19px; width: 24px; color: var(--accent); transform: translateY(-50%); }
    .bootstrap-boundary { margin: 18px 0 0; padding: 16px 18px; border-left: 3px solid var(--warn); background: var(--panel-soft); color: var(--muted); }
    .flywheel-intro { max-width: 880px; margin: 0 0 28px; padding: 24px; border: 1px solid var(--line); background: var(--panel); font-size: 18px; }
    .flywheel-intro strong { color: var(--accent); }
    .flywheel { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin: 0; padding: 0; list-style: none; counter-reset: flywheel; }
    .flywheel li { position: relative; min-height: 174px; padding: 22px 18px; border: 1px solid var(--line); background: var(--surface); counter-increment: flywheel; }
    .flywheel li::before { content: "0" counter(flywheel); display: block; margin-bottom: 14px; color: var(--accent); font-size: 13px; font-weight: 800; }
    .flywheel li:not(:last-child)::after { content: "→"; position: absolute; z-index: 2; top: 50%; right: -17px; width: 24px; color: var(--accent); font-size: 20px; font-weight: 800; text-align: center; }
    .flywheel-boundary { margin: 18px 0 0; padding: 16px 18px; border-left: 3px solid var(--warn); background: var(--panel-soft); color: var(--muted); }
    .layer-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; }
    .layer-card { display: grid; gap: 12px; align-content: start; min-height: 270px; padding: 20px; border: 1px solid var(--line); background: var(--panel); overflow: hidden; }
    .layer-card h3, .layer-card p { margin: 0; }
    .layer-card h3 { font-size: 22px; }
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
    @media (max-width: 980px) { .advantage-grid { grid-template-columns: repeat(2, 1fr); } .flywheel { grid-template-columns: repeat(2, 1fr); } .flywheel li:not(:last-child)::after { display: none; } .layer-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 640px) { main { width: min(100% - 28px, 640px); } .hero { min-height: 0; padding: 50px 0 62px; } .chapter { padding: 56px 0; } .era-grid, .advantage-grid, .bootstrap-grid, .bootstrap-flow, .flywheel, .layer-grid, .maturity-grid, .decision-grid { grid-template-columns: 1fr; } .bootstrap-flow { gap: 18px; } .bootstrap-flow span:not(:last-child)::after { content: "↓"; top: auto; right: 50%; bottom: -22px; transform: translateX(50%); } .layer-card, .flywheel li { min-height: 0; } }
  </style>
</head>
<body>
  <main>
    <!-- shared-header:start -->
${renderHeader(layout)}
    <!-- shared-header:end -->
    <section class="hero">
      <p class="eyebrow">Agent Supply Chain</p>
      <h1>${escapeHtml(readerProgression.premise.title)}</h1>
      <p class="lead">${escapeHtml(readerProgression.premise.statement)}</p>
      <p class="authority-note"><strong>Human authority remains explicit.</strong> ${escapeHtml(readerProgression.authorityBoundary)}</p>
    </section>
    <section class="chapter" aria-labelledby="era-heading">
      <div class="section-heading">
        <p class="eyebrow">01 · The transition</p>
        <h2 id="era-heading">Software distribution is becoming Agent-mediated.</h2>
        <p>The important shift is not that Agents remove human authority. It is that more tool choice happens after a human or Hub defines the operating boundary.</p>
      </div>
      <div class="era-grid">
        <article class="era-card">
          <p class="eyebrow">Human-led software use</p>
          <h3>Attention comes before operation.</h3>
          <p>Software must first reach a person, who then evaluates it, learns it, and operates it directly.</p>
          <div class="flow" aria-label="Human-led software flow"><span>Marketing</span><i>→</i><span>Human awareness</span><i>→</i><span>Install</span><i>→</i><span>Learn</span><i>→</i><span>Use</span></div>
        </article>
        <article class="era-card agent-era">
          <p class="eyebrow">Agent-mediated software use</p>
          <h3>Authority comes before selection.</h3>
          <p>A person or Hub sets the boundary; the Agent can then inspect and select tools while work is underway.</p>
          <div class="flow" aria-label="Agent-mediated software flow"><span>Human sets boundary</span><i>→</i><span>Agent discovers</span><i>→</i><span>Evaluates</span><i>→</i><span>Selects</span><i>→</i><span>Invokes</span><i>→</i><span>Records</span></div>
        </article>
      </div>
    </section>
    <section class="chapter" aria-labelledby="advantage-heading">
      <div class="section-heading">
        <p class="eyebrow">02 · The selection advantage</p>
        <h2 id="advantage-heading">Agent-first software can earn distribution through use.</h2>
        <p>${escapeHtml(readerProgression.distributionAdvantage)} An Agent cannot choose what it cannot understand.</p>
      </div>
      <div class="advantage-grid">
        <article class="advantage-card"><h3>Discoverable</h3><p>Value, constraints, choices, commands, Exit, and records are inspectable rather than hidden in marketing pages or prompts.</p></article>
        <article class="advantage-card"><h3>Evaluable</h3><p>The Agent can compare a tool with the current goal, permissions, policy, and evidence before use.</p></article>
        <article class="advantage-card"><h3>Invocable</h3><p>Documented machine interfaces reduce bespoke interpretation between product discovery and action.</p></article>
        <article class="advantage-card"><h3>Continuable</h3><p>Durable work facts let a later Agent continue useful work without reconstructing it from chat history.</p></article>
      </div>
      <p class="claim-boundary"><strong>KFD-3 is the collaboration surface.</strong> It makes product-owned value, constraints, choices, commands, Exit, and record declarations inspectable to humans and Agents. It does not manufacture product value or force adoption.</p>
    </section>
    <section class="chapter" aria-labelledby="bootstrap-heading">
      <div class="section-heading">
        <p class="eyebrow">03 · The bootstrap</p>
        <h2 id="bootstrap-heading">${escapeHtml(readerProgression.bootstrap.title)}</h2>
        <p>Agent-first distribution does not require the first Agent to arrive with prior knowledge of KFD or Buildchain. It requires one useful product to provide a trustworthy way in.</p>
      </div>
      <div class="bootstrap-grid">
        <article class="bootstrap-card">
          <p class="eyebrow">First adoption</p>
          <h3>One real problem starts the loop.</h3>
          <p>${escapeHtml(readerProgression.bootstrap.seed)}</p>
        </article>
        <article class="bootstrap-card discovery">
          <p class="eyebrow">Managed discovery</p>
          <h3>The envelope points. The Agent inspects.</h3>
          <p>${escapeHtml(readerProgression.bootstrap.discovery)}</p>
        </article>
      </div>
      <div class="bootstrap-flow" aria-label="Kungfu Agent understanding bootstrap">${readerProgression.bootstrap.steps.map((step) => `<span>${escapeHtml(step)}</span>`).join("")}</div>
      <p class="bootstrap-boundary"><strong>One seed, not two miracles.</strong> ${escapeHtml(readerProgression.bootstrap.boundary)}</p>
    </section>
    <section class="chapter" aria-labelledby="flywheel-heading">
      <div class="section-heading">
        <p class="eyebrow">04 · The conditional flywheel</p>
        <h2 id="flywheel-heading">Useful Agent-first software can create its own demand signal.</h2>
        <p>The inner loop turns concrete utility into informed Agent use. The outer loop turns successful use into demand for a shared collaboration interface and a repeatable release supply chain.</p>
      </div>
      <p class="flywheel-intro"><strong>The strategic consequence:</strong> demand can move from one useful product, to a shared Agent-first interface, to an exact-release supply chain that other developers can adopt without rebuilding the underlying trust machinery.</p>
      <ol class="flywheel" aria-label="Conditional Agent Supply Chain flywheel">${readerProgression.flywheel.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>
      <p class="flywheel-boundary"><strong>Enabled, not claimed.</strong> ${escapeHtml(readerProgression.flywheelBoundary)}</p>
    </section>
    <section class="chapter" aria-labelledby="mechanism-heading">
      <div class="section-heading">
        <p class="eyebrow">05 · The complete mechanism</p>
        <h2 id="mechanism-heading">Five responsibilities. Independent owners. One inspectable path.</h2>
        <p>${escapeHtml(narrative.categoryStatement)}</p>
      </div>
      <section class="layer-grid" aria-label="Five Agent Supply Chain layers">${layerCards}
      </section>
    </section>
    <section class="maturity-grid" aria-label="Maturity claims matrix">
      <article class="decision-card"><p class="eyebrow">Proved now</p><h2>${provedNow.length} exact layers</h2><p>${escapeHtml(provedNow.map((layer) => displayLayerName(layer.id)).join(" · "))}</p></article>
      <article class="decision-card"><p class="eyebrow">Enabled by protocol</p><h2>${enabledByProtocol.length} bounded layer</h2><p>${escapeHtml(enabledByProtocol.map((layer) => displayLayerName(layer.id)).join(" · "))}</p></article>
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

## The shift in software use

${readerProgression.premise.title}

${readerProgression.premise.statement}

Authority boundary: ${readerProgression.authorityBoundary}

## How the first Agent understands the stack

${readerProgression.bootstrap.seed}

${readerProgression.bootstrap.discovery}

Boundary: ${readerProgression.bootstrap.boundary}

## The conditional distribution flywheel

${readerProgression.flywheel.map((step, index) => `${index + 1}. ${step}`).join("\n")}

Boundary: ${readerProgression.flywheelBoundary}

Agent Supply Chain: https://kungfu.tech/agent-supply-chain/
Machine contract: https://kungfu.tech/agent-supply-chain.json
Builder evaluation: https://kungfu.tech/agent-builders/
Evidence surface: https://libkungfu.dev/

## Five layers

${narrative.layers.map((layer) => `${layer.order}. ${displayLayerName(layer.id)} [${layer.statusClass}] — owner: ${layer.owner}; input: ${layer.input}; output: ${layer.output}; evidence: ${layer.evidenceCoordinates[0]}; known limit: ${layer.knownLimits[0]}`).join("\n")}

## Claim boundary

${narrative.claimBoundary}

Not claimed: ${narrative.notClaimed.join("; ")}.

Next action: ${narrative.vendorNextAction}
`;

const outputDir = path.join(repoRoot, "dist", "agent-supply-chain");
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, "index.html"), html);
fs.writeFileSync(path.join(repoRoot, "dist", "agent-supply-chain.json"), `${JSON.stringify(machineNarrative, null, 2)}\n`);
fs.writeFileSync(path.join(repoRoot, "dist", "llms.txt"), llms);
console.log("rendered Agent Supply Chain route and machine contract");
