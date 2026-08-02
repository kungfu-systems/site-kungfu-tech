#!/usr/bin/env node
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { loadWhitepaperSource } from "./whitepaper-source.mjs";
import { escapeAttr, escapeHtml, readLayout, renderFooter, renderHeader } from "./site-layout.mjs";

const repoRoot = process.cwd();
const source = loadWhitepaperSource(repoRoot);
const require = createRequire(import.meta.url);
const snapshotPackage = "@kungfu-tech/paper-kungfu-product-white-paper-agent-supply-chain";
const snapshotVersion = "0.1.0-alpha.10";
const snapshotPackageJsonPath = require.resolve(`${snapshotPackage}/package.json`, { paths: [repoRoot] });
const snapshotRoot = path.dirname(snapshotPackageJsonPath);
const snapshotPackageInfo = JSON.parse(fs.readFileSync(snapshotPackageJsonPath, "utf8"));
const snapshotEvidence = JSON.parse(fs.readFileSync(path.join(snapshotRoot, "site", "evidence-site.json"), "utf8"));
const narrative = snapshotEvidence.agentSupplyChain;
if (
  snapshotPackageInfo.name !== "@kungfu-tech/paper-kungfu-product-white-paper"
  || snapshotPackageInfo.version !== snapshotVersion
  || snapshotEvidence.source?.packageVersion !== snapshotVersion
  || Object.hasOwn(source.bundle, "agentSupplyChain")
  || narrative?.contract !== "kungfu-agent-supply-chain-public-narrative/v1"
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
    title: "The next software user is an Agent. Your Work should survive every Agent.",
    statement: "Agent-native software lets an Agent learn the product, recognize when durable Work matters, act after explicit confirmation, and leave verifiable state for whichever Agent comes next.",
  },
  authorityBoundary: "Humans and Hubs set goals, permissions, budgets, policy, admission, and revocation. Agents propose and act inside those boundaries. Durable Work and evidence do not belong to the chat.",
  agentNativeLoop: {
    contract: "kungfu-agent-native-product-loop/v1",
    title: "Agent-native means the product can teach, advise, act, and hand off.",
    statement: "The user keeps the Agent they already trust. The product supplies exact guidance, recommends durable Work only when it is valuable, asks once before mutation, and preserves what the next Agent needs.",
    stages: [
      {
        id: "existing-agent",
        label: "Existing Agent",
        title: "Keep the conversation surface.",
        statement: "Stay in Codex, Claude, OpenCode, Amp, or another familiar Agent instead of adopting a new daily chat interface.",
      },
      {
        id: "versioned-brief",
        label: "Versioned Brief",
        title: "Let the Agent learn the product.",
        statement: "A compact, version-matched entrypoint routes the Agent to exact installed facts, capabilities, limits, and public actions.",
      },
      {
        id: "work-advisory",
        label: "Work advisory",
        title: "Recommend Work when it matters.",
        statement: "Bounded signals identify handoff, evidence, duplication, external-write, and acceptance risk without turning every task into Work.",
      },
      {
        id: "preview-confirm",
        label: "Preview + confirm",
        title: "Ask once before mutation.",
        statement: "The Agent shows a minimal Work draft and uses the product's public action only after explicit confirmation.",
      },
      {
        id: "durable-work",
        label: "Durable Work",
        title: "Change the Agent, not the Work.",
        statement: "Product-owned state and receipts survive the process so a fresh Agent can continue without another human handoff.",
      },
    ],
    boundary: "This loop is a product contract, not a blanket release claim. Each step remains bounded by the proved-now, enabled-by-protocol, and not-claimed evidence below. Agent output alone grants no authority and proves no completion.",
  },
  distributionAdvantage: "Agent-native software can be discovered, evaluated, recommended, invoked, and continued with less bespoke interpretation, creating a new selection and distribution advantage.",
  bootstrap: {
    title: "The user's existing Agent becomes the first product guide.",
    seed: "A concrete problem still starts the loop: the user is tired of carrying context, decisions, status, and loss checks between Agents.",
    discovery: "A compact, version-matched Brief lets the existing Agent inspect the exact installed collaboration surface, capability catalog, evidence, limits, and public actions without prior KFD or Buildchain knowledge.",
    boundary: "The Brief does not create demand, grant authority, or prove an outcome. It turns one useful product entry into a repeatable learning path while the user keeps the provider-native conversation surface.",
    steps: [
      "Existing Agent receives the exact Brief",
      "Agent verifies the installed product surface",
      "Agent recognizes when durable Work has value",
      "Human previews and confirms the action",
      "Work survives the next Agent",
    ],
  },
  flywheel: [
    "A useful product solves a concrete problem without demanding a new daily conversation surface.",
    "The user's existing Agent learns the exact product surface and can recommend it while work is underway.",
    "Confirmed use produces durable, inspectable Work that another Agent can continue.",
    "Buildchain binds KFD-3 declarations and KFD-2 evidence to an exact release.",
    "More developers can ship Agent-ready software with assessable provenance.",
  ],
  flywheelBoundary: "This is an adoption mechanism enabled by the stack, not evidence that a broad network effect, external adoption, or a multi-Hub market already exists.",
};
const loopStages = readerProgression.agentNativeLoop.stages.map((stage, index) => `
        <article class="loop-stage">
          <p class="loop-order">${String(index + 1).padStart(2, "0")} · ${escapeHtml(stage.label)}</p>
          <h3>${escapeHtml(stage.title)}</h3>
          <p>${escapeHtml(stage.statement)}</p>
        </article>`).join("");
const machineNarrative = {
  ...narrative,
  readerProgression,
  layers: narrative.layers.map((layer) => ({ ...layer, label: displayLayerName(layer.id) })),
};
const layerCards = narrative.layers.map((layer) => `
        <article class="layer-card">
          <div class="layer-identity">
            <p class="layer-order">${String(layer.order).padStart(2, "0")} · ${escapeHtml(layer.statusClass)}</p>
            <h3>${escapeHtml(displayLayerName(layer.id))}</h3>
            <p class="layer-owner">Owner · ${escapeHtml(layer.owner)}</p>
          </div>
          <div class="layer-purpose">
            <p>${escapeHtml(layer.statement)}</p>
            <dl><dt>Input</dt><dd>${escapeHtml(layer.input)}</dd><dt>Output</dt><dd>${escapeHtml(layer.output)}</dd></dl>
          </div>
          <div class="layer-proof">
            <details>
              <summary>Evidence and known limit</summary>
              <p class="evidence"><strong>Exact evidence</strong><code>${escapeHtml(layer.evidenceCoordinates[0])}</code></p>
              <p class="known-limit"><strong>Known limit</strong>${escapeHtml(layer.knownLimits[0])}</p>
            </details>
            <div class="layer-links"><a href="${escapeAttr(layer.humanRoute)}">Human route</a><a href="${escapeAttr(layer.agentRoute)}">Agent route</a></div>
          </div>
        </article>`).join("");
const notClaimed = narrative.notClaimed.map((claim) => `<li>${escapeHtml(claim)}</li>`).join("");
const provedNow = narrative.layers.filter((layer) => layer.statusClass === "proved-now");
const enabledByProtocol = narrative.layers.filter((layer) => layer.statusClass === "enabled-by-protocol");

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Agent Supply Chain | Kungfu UNGFU™</title>
  <meta name="description" content="The next software user is an Agent. See how agent-native products teach, advise, act, and preserve durable Work for whichever Agent comes next.">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Kungfu UNGFU™">
  <meta property="og:title" content="Agent Supply Chain | Kungfu UNGFU™">
  <meta property="og:description" content="Agent-native products let Agents learn, recommend, act with explicit authority, and leave durable Work for the next Agent.">
  <meta property="og:url" content="https://kungfu.tech/agent-supply-chain/">
  <meta name="twitter:card" content="summary">
  <link rel="canonical" href="https://kungfu.tech/agent-supply-chain/">
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="alternate" type="application/json" title="Agent Supply Chain contract" href="/agent-supply-chain.json">
  <link rel="alternate" type="text/plain" title="Kungfu agent entrypoint" href="/llms.txt">
  <link rel="stylesheet" href="/assets/site.css">
  <style>
    main { width: min(1180px, calc(100% - 40px)); margin: 0 auto; padding: 34px 0 64px; }
    .hero { display: grid; gap: 20px; min-height: 540px; align-content: center; padding: 64px 0 76px; }
    .eyebrow, .loop-order, .layer-order { margin: 0; color: var(--accent); font-size: 13px; font-weight: 700; text-transform: uppercase; }
    h1 { max-width: 980px; margin: 0; font-size: clamp(48px, 8vw, 92px); line-height: .96; }
    .lead { max-width: 900px; margin: 0; color: var(--muted); font-size: 20px; }
    .claim-boundary { padding: 18px; border-left: 4px solid var(--accent); background: var(--panel-soft); color: var(--fg); }
    .flywheel-heading { margin-top: 64px; }
    .authority-note { max-width: 920px; margin: 4px 0 0; padding: 16px 18px; border-left: 3px solid var(--accent); background: var(--panel-soft); }
    .chapter { padding: 74px 0; border-top: 1px solid var(--line); }
    .section-heading { max-width: 900px; margin: 0 0 28px; }
    .section-heading h2 { margin: 0; font-size: clamp(28px, 4vw, 46px); }
    .section-heading p { max-width: 760px; margin: 14px 0 0; color: var(--muted); font-size: 18px; }
    .loop-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; }
    .loop-stage { position: relative; min-height: 230px; padding: 22px; border: 1px solid var(--line); background: var(--surface); }
    .loop-stage:nth-child(2), .loop-stage:nth-child(4) { background: var(--panel); }
    .loop-stage:not(:last-child)::after { content: "→"; position: absolute; z-index: 2; top: 50%; right: -18px; width: 24px; color: var(--accent); font-size: 20px; font-weight: 800; text-align: center; }
    .loop-stage h3 { margin: 12px 0 10px; font-size: 22px; line-height: 1.08; }
    .loop-stage > p:last-child { margin: 0; color: var(--muted); }
    .loop-boundary { margin: 18px 0 0; padding: 16px 18px; border-left: 3px solid var(--warn); background: var(--panel-soft); color: var(--muted); }
    .era-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-bottom: 18px; }
    .era-card { padding: 26px; border: 1px solid var(--line); background: var(--surface); }
    .era-card h3 { margin: 6px 0 14px; font-size: 24px; }
    .era-card p { margin: 0; color: var(--muted); }
    .era-card.agent-era { border-color: var(--accent); background: var(--panel); }
    .flow { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 20px; font-size: 14px; font-weight: 650; }
    .flow span { padding: 7px 9px; border: 1px solid var(--line); background: var(--panel-soft); }
    .flow i { color: var(--accent); font-style: normal; }
    .advantage-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 14px; }
    .advantage-card { padding: 22px; border-top: 3px solid var(--accent); background: var(--panel); }
    .advantage-card h3 { margin: 0 0 8px; font-size: 20px; }
    .advantage-card p { margin: 0; color: var(--muted); }
    .flywheel-intro { max-width: 880px; margin: 0 0 28px; padding: 24px; border: 1px solid var(--line); background: var(--panel); font-size: 18px; }
    .flywheel-intro strong { color: var(--accent); }
    .flywheel { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin: 0; padding: 0; list-style: none; counter-reset: flywheel; }
    .flywheel li { position: relative; min-height: 174px; padding: 22px 18px; border: 1px solid var(--line); background: var(--surface); counter-increment: flywheel; }
    .flywheel li::before { content: "0" counter(flywheel); display: block; margin-bottom: 14px; color: var(--accent); font-size: 13px; font-weight: 800; }
    .flywheel li:not(:last-child)::after { content: "→"; position: absolute; z-index: 2; top: 50%; right: -17px; width: 24px; color: var(--accent); font-size: 20px; font-weight: 800; text-align: center; }
    .flywheel-boundary { margin: 18px 0 0; padding: 16px 18px; border-left: 3px solid var(--warn); background: var(--panel-soft); color: var(--muted); }
    .layer-grid { display: grid; gap: 12px; }
    .layer-card { display: grid; grid-template-columns: minmax(170px, .65fr) minmax(300px, 1.5fr) minmax(230px, 1fr); gap: 24px; align-items: start; padding: 24px; border: 1px solid var(--line); background: var(--panel); }
    .layer-card h3, .layer-card p { margin: 0; }
    .layer-card h3 { margin-top: 7px; font-size: 25px; }
    .layer-owner { margin-top: 8px !important; color: var(--muted); font-size: 13px; }
    .layer-purpose > p { color: var(--fg); font-size: 17px; }
    .layer-card dl { display: grid; gap: 5px; margin: 14px 0 0; }
    .layer-card dt { color: var(--accent); font-size: 12px; font-weight: 700; text-transform: uppercase; }
    .layer-card dd { margin: 0 0 7px; color: var(--muted); font-size: 14px; }
    .layer-proof details { border-top: 1px solid var(--line); }
    .layer-proof summary { padding: 10px 0; color: var(--fg); font-size: 13px; font-weight: 700; cursor: pointer; }
    .layer-proof details p { margin-top: 10px; color: var(--muted); }
    .layer-card strong { display: block; margin-bottom: 5px; color: var(--fg); font-size: 12px; text-transform: uppercase; }
    .layer-card code { display: block; overflow-wrap: anywhere; color: var(--muted); font-size: 11px; }
    .known-limit { font-size: 13px; }
    .layer-links { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; font-size: 13px; font-weight: 650; }
    .maturity-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-top: 28px; }
    .decision-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 18px; }
    .decision-card { padding: 24px; border: 1px solid var(--line); background: var(--surface); }
    .decision-card h2 { margin-top: 0; }
    .decision-card p, .decision-card li { color: var(--muted); }
    .action { display: inline-flex; padding: 10px 14px; border: 1px solid var(--accent); background: var(--accent); color: white; text-decoration: none; font-weight: 700; }
    @media (max-width: 980px) { .loop-grid, .advantage-grid { grid-template-columns: repeat(2, 1fr); } .loop-stage:not(:last-child)::after { display: none; } .flywheel { grid-template-columns: repeat(2, 1fr); } .flywheel li:not(:last-child)::after { display: none; } .layer-card { grid-template-columns: minmax(150px, .65fr) 1.5fr; } .layer-proof { grid-column: 1 / -1; } }
    @media (max-width: 640px) { main { width: min(100% - 28px, 640px); } .hero { min-height: 0; padding: 50px 0 62px; } .chapter { padding: 56px 0; } .loop-grid, .era-grid, .advantage-grid, .flywheel, .layer-card, .maturity-grid, .decision-grid { grid-template-columns: 1fr; } .loop-stage, .flywheel li { min-height: 0; } .layer-proof { grid-column: auto; } }
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
    <section class="chapter" aria-labelledby="loop-heading" id="agent-native-loop">
      <div class="section-heading">
        <p class="eyebrow">01 · The product loop</p>
        <h2 id="loop-heading">${escapeHtml(readerProgression.agentNativeLoop.title)}</h2>
        <p>${escapeHtml(readerProgression.agentNativeLoop.statement)}</p>
      </div>
      <div class="loop-grid" aria-label="Agent-native product loop">${loopStages}
      </div>
      <p class="loop-boundary"><strong>Maturity and authority boundary.</strong> ${escapeHtml(readerProgression.agentNativeLoop.boundary)}</p>
    </section>
    <section class="chapter" aria-labelledby="selection-heading">
      <div class="section-heading">
        <p class="eyebrow">02 · The selection shift</p>
        <h2 id="selection-heading">Agent-native software can earn selection while work is underway.</h2>
        <p>${escapeHtml(readerProgression.distributionAdvantage)} An Agent cannot choose what it cannot understand—and should not recommend what the product cannot bound.</p>
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
          <p>A person or Hub sets the boundary; the Agent can inspect, recommend, and invoke products while work is underway.</p>
          <div class="flow" aria-label="Agent-mediated software flow"><span>Human sets boundary</span><i>→</i><span>Agent discovers</span><i>→</i><span>Evaluates</span><i>→</i><span>Recommends</span><i>→</i><span>Invokes</span><i>→</i><span>Records</span></div>
        </article>
      </div>
      <div class="advantage-grid">
        <article class="advantage-card"><h3>Discoverable</h3><p>Value, constraints, choices, commands, Exit, and records are inspectable rather than hidden in marketing pages or prompts.</p></article>
        <article class="advantage-card"><h3>Evaluable</h3><p>The Agent can compare a tool with the current goal, permissions, policy, and evidence before use.</p></article>
        <article class="advantage-card"><h3>Advisable</h3><p>Bounded signals let the Agent explain when the product has value without nagging or manufacturing demand.</p></article>
        <article class="advantage-card"><h3>Invocable</h3><p>Documented machine interfaces reduce bespoke interpretation between product discovery and action.</p></article>
        <article class="advantage-card"><h3>Continuable</h3><p>Durable work facts let a later Agent continue useful work without reconstructing it from chat history.</p></article>
      </div>
      <p class="claim-boundary"><strong>KFD-3 is the collaboration surface.</strong> It makes product-owned value, constraints, choices, commands, Exit, and record declarations inspectable to humans and Agents. It does not manufacture product value or force adoption.</p>
      <div class="section-heading flywheel-heading">
        <p class="eyebrow">The conditional flywheel</p>
        <h2 id="flywheel-heading">Useful Agent-first software can create its own demand signal.</h2>
        <p>The inner loop turns concrete utility into informed Agent use. The outer loop turns successful use into demand for a shared collaboration interface and a repeatable release supply chain.</p>
      </div>
      <p class="flywheel-intro"><strong>The strategic consequence:</strong> demand can move from one useful product, to a shared Agent-first interface, to an exact-release supply chain that other developers can adopt without rebuilding the underlying trust machinery.</p>
      <ol class="flywheel" aria-label="Conditional Agent Supply Chain flywheel">${readerProgression.flywheel.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>
      <p class="flywheel-boundary"><strong>Enabled, not claimed.</strong> ${escapeHtml(readerProgression.flywheelBoundary)}</p>
    </section>
    <section class="chapter" aria-labelledby="mechanism-heading">
      <div class="section-heading">
        <p class="eyebrow">03 · The trustable mechanism</p>
        <h2 id="mechanism-heading">Five responsibilities. Independent owners. One inspectable path.</h2>
        <p>The product loop becomes trustworthy when discovery, exact-release evidence, assessment, durable facts, and portability stay independently inspectable. ${escapeHtml(narrative.categoryStatement)}</p>
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

const llms = `# Kungfu UNGFU™

Kungfu has two public strategic axes: continuity for durable Agent work, and an open Agent Supply Chain for product discovery, exact-artifact evidence, purpose-bound trust, durable work facts, and portability across independently owned Hubs.

Brand boundary: Kungfu is the product name. Kungfu UNGFU™ is its source-identifying signature; UNGFU is not a second product or runtime, and ™ makes no registration-status claim.

## The shift in software use

${readerProgression.premise.title}

${readerProgression.premise.statement}

Authority boundary: ${readerProgression.authorityBoundary}

## The agent-native product loop

${readerProgression.agentNativeLoop.title}

${readerProgression.agentNativeLoop.statement}

${readerProgression.agentNativeLoop.stages.map((stage, index) => `${index + 1}. ${stage.label}: ${stage.title} ${stage.statement}`).join("\n")}

Boundary: ${readerProgression.agentNativeLoop.boundary}

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
