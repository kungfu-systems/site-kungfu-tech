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
    title: "When Agents learn to recognize better software, they start creating demand for it.",
    statement: "Kungfu onboards the Agent you already use. The Agent experiences explicit capabilities, inspectable evidence, and durable Work—then starts expecting those qualities from every product.",
  },
  authorityBoundary: "Humans and Hubs set goals, permissions, budgets, policy, admission, and revocation. Agents propose and act inside those boundaries. Durable Work and evidence do not belong to the chat.",
  activationBoundary: {
    contract: "kungfu-agent-mediated-distribution-boundary/v1",
    title: "Agent-first activation starts after a product is chosen. Agent-mediated distribution changes who can help choose it.",
    activation: "A person or upstream channel discovers and selects the product. The Agent compresses the path from that choice to first value.",
    distribution: "The product becomes legible enough for an Agent to evaluate and recommend. A human or Hub still authorizes adoption.",
  },
  agentNativeLoop: {
    contract: "kungfu-agent-native-product-loop/v1",
    title: "Kungfu lights the first loop inside work.",
    statement: "The user keeps the Agent they already trust. Kungfu supplies exact guidance, recommends durable Work only when it is valuable, asks once before mutation, and preserves what the next Agent needs.",
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
  ignition: {
    contract: "kungfu-agent-native-market-ignition/v1",
    title: "One useful product can change what an Agent expects.",
    statement: "Kungfu earns the first use by solving a concrete problem. The surprise comes next: the experience changes how the Agent evaluates every product that follows.",
    stages: [
      {
        id: "useful-product",
        label: "One useful product",
        title: "Solve the pain already in front of the user.",
        statement: "Kungfu earns attention by keeping Work alive across the Agents the user already chooses.",
      },
      {
        id: "onboarded-agent",
        label: "One onboarded Agent",
        title: "Let the Agent experience the difference.",
        statement: "A version-matched Brief exposes exact capabilities, evidence, limits, public actions, and durable state inside the existing conversation.",
      },
      {
        id: "new-expectation",
        label: "One new expectation",
        title: "Change what good software feels like.",
        statement: "After one useful handoff, the Agent can recognize—and ask for—the same qualities in every product it encounters.",
      },
    ],
    aha: "The Agent is no longer just an operator. It becomes a distribution channel.",
    ahaSupport: "Because the Work stays with the product—not the chat—every new Agent can inspect it, continue it, and recognize the difference.",
  },
  marketFlywheel: {
    contract: "kungfu-agent-native-market-flywheel/v1",
    title: "Kungfu can leave the center. The loop keeps compounding.",
    statement: "Kungfu does not need to own the loop. It only needs to make the first difference legible.",
    ignitionRole: "Kungfu solves one real problem and onboards the first Agent. It is the spark, not a permanent dependency.",
    steps: [
      {
        id: "agent-experience",
        label: "Agent experience",
        title: "Agents recognize the difference.",
        statement: "Explicit capabilities, inspectable evidence, and durable Work become a product expectation.",
      },
      {
        id: "demand-signal",
        label: "Demand signal",
        title: "Agents recommend. Humans or Hubs authorize.",
        statement: "A bounded recommendation during real work turns one useful experience into visible demand without granting the Agent adoption authority.",
      },
      {
        id: "builder-response",
        label: "Builder response",
        title: "Builders see what the market now expects.",
        statement: "A shared product interface becomes a distribution advantage instead of bespoke integration work.",
      },
      {
        id: "buildchain-supply",
        label: "Buildchain supply",
        title: "More products can ship the qualities.",
        statement: "Buildchain binds KFD-3 declarations and KFD-2 evidence to exact releases that Agents can inspect.",
      },
      {
        id: "agent-native-products",
        label: "More products",
        title: "The next Agent encounters a larger market.",
        statement: "Each new Agent-native product can restart the same loop without routing through Kungfu.",
      },
    ],
    returnStatement: "Next product → next Agent → the same expectation compounds.",
    selfStartBoundary: "Every product still needs a first introduction and explicit authorization. What compounds is what happens after the first useful, trusted use.",
  },
  conceptQuestions: [
    { layerId: "kfd-3", question: "How does an Agent know what a product can do?", linkLabel: "Explore KFD-3" },
    { layerId: "kfd-2", question: "How does it assess what the product claims?", linkLabel: "Explore KFD-2" },
    { layerId: "buildchain", question: "How do builders ship those qualities in an exact release?", linkLabel: "Explore Buildchain" },
    { layerId: "agent-hub-portability", question: "How can bounded Work move across independently governed Agent Hubs?", linkLabel: "Explore Agent Hub" },
  ],
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
    "Agents recognize explicit capabilities, inspectable evidence, and durable Work as a better product experience.",
    "Agents recommend products they can assess while real work is underway.",
    "Builders receive a demand signal for a shared Agent-native product interface.",
    "Buildchain binds KFD-3 declarations and KFD-2 evidence to exact releases.",
    "More Agent-native products reach more Agents and restart the loop without Kungfu.",
  ],
  flywheelBoundary: "This is a causal adoption thesis enabled by the stack, not evidence that a broad network effect, external adoption, or a multi-Hub market already exists.",
};
const ignitionStages = readerProgression.ignition.stages.map((stage, index) => `
        <article class="ignition-stage">
          <p class="loop-order">${String(index + 1).padStart(2, "0")} · ${escapeHtml(stage.label)}</p>
          <h3>${escapeHtml(stage.title)}</h3>
          <p>${escapeHtml(stage.statement)}</p>
        </article>`).join("");
const flywheelNodes = readerProgression.marketFlywheel.steps.map((step) => `
              <li>
                <p class="loop-order">${escapeHtml(step.label)}</p>
                <h3>${escapeHtml(step.title)}</h3>
                <p>${escapeHtml(step.statement)}</p>
              </li>`).join("");
const conceptCards = readerProgression.conceptQuestions.map((concept) => {
  const layer = narrative.layers.find((candidate) => candidate.id === concept.layerId);
  if (!layer) throw new Error(`missing Agent Supply Chain layer for ${concept.layerId}`);
  return `
        <article class="concept-card">
          <p class="eyebrow">${escapeHtml(displayLayerName(layer.id))}</p>
          <h3>${escapeHtml(concept.question)}</h3>
          <p>${escapeHtml(layer.statement)}</p>
          <a href="${escapeAttr(layer.humanRoute)}">${escapeHtml(concept.linkLabel)} →</a>
        </article>`;
}).join("");
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
  <meta name="description" content="When Agents learn to recognize better software, they start creating demand for it. See how Kungfu lights the first Agent-native market loop.">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Kungfu UNGFU™">
  <meta property="og:title" content="Agent Supply Chain | Kungfu UNGFU™">
  <meta property="og:description" content="Kungfu lights the first loop. Agents, builders, Buildchain, and KFD can keep it running without Kungfu.">
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
    .claim-boundary { margin-top: 24px; padding: 18px; border-left: 4px solid var(--accent); background: var(--panel-soft); color: var(--fg); }
    .chapter { padding: 74px 0; border-top: 1px solid var(--line); }
    .section-heading { max-width: 900px; margin: 0 0 28px; }
    .section-heading h2 { margin: 0; font-size: clamp(28px, 4vw, 46px); }
    .section-heading p { max-width: 760px; margin: 14px 0 0; color: var(--muted); font-size: 18px; }
    .distribution-contrast { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 18px; }
    .contrast-card { padding: 22px 24px; border: 1px solid var(--line); background: var(--surface); }
    .contrast-card.distribution { border-color: var(--accent); background: var(--panel); }
    .contrast-card h3 { margin: 8px 0 10px; font-size: 22px; }
    .contrast-card p:last-child { margin: 0; color: var(--muted); }
    .ignition-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
    .ignition-stage { position: relative; min-height: 230px; padding: 24px; border: 1px solid var(--line); background: var(--surface); }
    .ignition-stage:nth-child(2) { background: var(--panel); }
    .ignition-stage:not(:last-child)::after { content: "→"; position: absolute; z-index: 2; top: 50%; right: -19px; width: 24px; color: var(--accent); font-size: 21px; font-weight: 800; text-align: center; }
    .ignition-stage h3 { margin: 12px 0 10px; font-size: 24px; line-height: 1.08; }
    .ignition-stage > p:last-child { margin: 0; color: var(--muted); }
    .loop-boundary { margin: 18px 0 0; padding: 16px 18px; border-left: 3px solid var(--warn); background: var(--panel-soft); color: var(--muted); }
    .aha { margin-top: 24px; padding: clamp(30px, 5vw, 58px); background: var(--fg); color: var(--bg); }
    .aha p { max-width: 980px; margin: 0; font-size: clamp(31px, 5vw, 58px); font-weight: 750; line-height: 1.02; letter-spacing: -.03em; }
    .aha .aha-support { max-width: 840px; margin-top: 24px; color: var(--bg); font-size: clamp(20px, 2.5vw, 30px); font-weight: 550; line-height: 1.15; opacity: .76; }
    .flywheel-shell { display: grid; grid-template-columns: minmax(190px, .45fr) minmax(0, 2fr); gap: 18px; align-items: stretch; }
    .ignition-source { position: relative; display: grid; align-content: center; padding: 26px; border: 1px dashed var(--accent); background: var(--panel-soft); }
    .ignition-source::after { content: "→"; position: absolute; top: 50%; right: -25px; z-index: 3; width: 32px; color: var(--accent); font-size: 26px; font-weight: 800; text-align: center; }
    .ignition-source h3 { margin: 8px 0 12px; font-size: 28px; }
    .ignition-source p { margin: 0; color: var(--muted); }
    .loop-panel { padding: 22px; border: 2px solid var(--accent); background: var(--panel); }
    .loop-panel-header { display: flex; justify-content: space-between; gap: 18px; align-items: baseline; margin-bottom: 18px; }
    .loop-panel-header strong { font-size: 18px; }
    .loop-panel-header span { color: var(--muted); font-size: 13px; }
    .flywheel { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin: 0; padding: 0; list-style: none; }
    .flywheel li { position: relative; min-height: 210px; padding: 20px 16px; border: 1px solid var(--line); background: var(--surface); }
    .flywheel li h3 { margin: 10px 0 9px; font-size: 19px; line-height: 1.08; }
    .flywheel li > p:last-child { margin: 0; color: var(--muted); font-size: 14px; }
    .flywheel li:not(:last-child)::after { content: "→"; position: absolute; z-index: 2; top: 50%; right: -17px; width: 24px; color: var(--accent); font-size: 20px; font-weight: 800; text-align: center; }
    .loop-return { margin: 14px 0 0; padding-top: 14px; border-top: 1px solid var(--accent); color: var(--accent); font-size: 14px; font-weight: 750; text-align: right; }
    .flywheel-boundary { margin: 18px 0 0; padding: 16px 18px; border-left: 3px solid var(--warn); background: var(--panel-soft); color: var(--muted); }
    .boundary-line { display: block; margin-top: 8px; }
    .concept-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
    .concept-card { padding: 26px; border: 1px solid var(--line); background: var(--surface); }
    .concept-card h3 { margin: 8px 0 12px; font-size: 25px; }
    .concept-card > p:not(.eyebrow) { color: var(--muted); }
    .concept-card a { font-weight: 700; }
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
    .path-actions { display: flex; flex-wrap: wrap; gap: 10px; }
    .action { display: inline-flex; padding: 10px 14px; border: 1px solid var(--accent); color: var(--accent); text-decoration: none; font-weight: 700; }
    .action.primary { background: var(--accent); color: white; }
    @media (max-width: 980px) { .ignition-grid { grid-template-columns: repeat(3, 1fr); } .flywheel-shell { grid-template-columns: 1fr; } .ignition-source::after { content: "↓"; top: auto; right: 50%; bottom: -26px; transform: translateX(50%); } .flywheel { grid-template-columns: repeat(2, 1fr); } .flywheel li:not(:last-child)::after { display: none; } .layer-card { grid-template-columns: minmax(150px, .65fr) 1.5fr; } .layer-proof { grid-column: 1 / -1; } }
    @media (max-width: 640px) { main { width: min(100% - 28px, 640px); } .hero { min-height: 0; padding: 50px 0 62px; } .chapter { padding: 56px 0; } .distribution-contrast, .ignition-grid, .flywheel, .concept-grid, .layer-card, .maturity-grid, .decision-grid { grid-template-columns: 1fr; } .ignition-stage, .flywheel li { min-height: 0; } .ignition-stage:not(:last-child)::after { display: none; } .loop-panel { padding: 14px; } .loop-panel-header { display: grid; } .layer-proof { grid-column: auto; } }
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
    </section>
    <section class="chapter" aria-labelledby="loop-heading" id="agent-native-loop">
      <div class="section-heading">
        <p class="eyebrow">01 · The ignition</p>
        <h2 id="loop-heading">${escapeHtml(readerProgression.ignition.title)}</h2>
        <p>${escapeHtml(readerProgression.ignition.statement)}</p>
      </div>
      <div class="ignition-grid" aria-label="How Kungfu ignites the first Agent-native market loop">${ignitionStages}
      </div>
      <div class="distribution-contrast" aria-label="Activation and distribution boundary">
        <article class="contrast-card">
          <p class="eyebrow">Agent-assisted activation</p>
          <h3>The product has already been chosen.</h3>
          <p>${escapeHtml(readerProgression.activationBoundary.activation)}</p>
        </article>
        <article class="contrast-card distribution">
          <p class="eyebrow">Agent-mediated distribution</p>
          <h3>The Agent can help make the choice.</h3>
          <p>${escapeHtml(readerProgression.activationBoundary.distribution)}</p>
        </article>
      </div>
      <aside class="aha" aria-label="The Agent-native market insight"><p>${escapeHtml(readerProgression.ignition.aha)}</p><p class="aha-support">${escapeHtml(readerProgression.ignition.ahaSupport)}</p></aside>
      <p class="loop-boundary"><strong>Maturity and authority boundary.</strong> ${escapeHtml(readerProgression.agentNativeLoop.boundary)}</p>
    </section>
    <section class="chapter" aria-labelledby="flywheel-heading">
      <div class="section-heading">
        <p class="eyebrow">02 · The self-accelerating market</p>
        <h2 id="flywheel-heading">${escapeHtml(readerProgression.marketFlywheel.title)}</h2>
        <p>${escapeHtml(readerProgression.marketFlywheel.statement)}</p>
      </div>
      <div class="flywheel-shell">
        <aside class="ignition-source">
          <p class="eyebrow">Ignition only</p>
          <h3>Kungfu</h3>
          <p>${escapeHtml(readerProgression.marketFlywheel.ignitionRole)}</p>
        </aside>
        <div class="loop-panel">
          <div class="loop-panel-header"><strong>The loop after Kungfu</strong><span>No Kungfu dependency inside the cycle</span></div>
          <ol class="flywheel" aria-label="Self-accelerating Agent-native market flywheel">${flywheelNodes}</ol>
          <p class="loop-return">↩ ${escapeHtml(readerProgression.marketFlywheel.returnStatement)}</p>
        </div>
      </div>
      <p class="flywheel-boundary"><strong>Self-accelerating is not self-starting.</strong> ${escapeHtml(readerProgression.marketFlywheel.selfStartBoundary)}<span class="boundary-line"><strong>Enabled, not claimed.</strong> ${escapeHtml(readerProgression.flywheelBoundary)}</span></p>
    </section>
    <section class="chapter" aria-labelledby="questions-heading">
      <div class="section-heading">
        <p class="eyebrow">03 · The inevitable questions</p>
        <h2 id="questions-heading">Once you see the loop, the infrastructure stops looking abstract.</h2>
        <p>The names arrive after the need. Each part of the stack answers a question the self-accelerating market makes unavoidable.</p>
      </div>
      <div class="concept-grid">${conceptCards}
      </div>
      <p class="claim-boundary"><strong>Human authority remains explicit.</strong> ${escapeHtml(readerProgression.authorityBoundary)}</p>
    </section>
    <section class="chapter" aria-labelledby="mechanism-heading">
      <div class="section-heading">
        <p class="eyebrow">04 · The evidence behind the thesis</p>
        <h2 id="mechanism-heading">Five responsibilities. Independent owners. One inspectable path.</h2>
        <p>Now inspect what is proved, what is only enabled, and who owns each responsibility. ${escapeHtml(narrative.categoryStatement)}</p>
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
        <p><strong>Bounded evaluation:</strong> ${escapeHtml(narrative.vendorNextAction)}</p>
      </article>
      <article class="decision-card">
        <p class="eyebrow">Follow the questions</p>
        <h2>Explore the infrastructure the loop demands.</h2>
        <p>The market thesis leads naturally to a product language, an exact-release supply chain, and portable Work across independently governed Agent Hubs.</p>
        <div class="path-actions">
          <a class="action" href="${escapeAttr(narrative.layers.find((layer) => layer.id === "kfd-3").humanRoute)}">Explore KFD</a>
          <a class="action primary" href="${escapeAttr(narrative.layers.find((layer) => layer.id === "buildchain").humanRoute)}">Explore Buildchain</a>
          <a class="action" href="${escapeAttr(narrative.layers.find((layer) => layer.id === "agent-hub-portability").humanRoute)}">Explore Agent Hub</a>
        </div>
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

## The market thesis

${readerProgression.premise.title}

${readerProgression.premise.statement}

## How Kungfu ignites the first loop

${readerProgression.ignition.title}

${readerProgression.ignition.stages.map((stage, index) => `${index + 1}. ${stage.label}: ${stage.title} ${stage.statement}`).join("\n")}

Activation boundary: ${readerProgression.activationBoundary.title}

- Agent-assisted activation: ${readerProgression.activationBoundary.activation}
- Agent-mediated distribution: ${readerProgression.activationBoundary.distribution}

Aha: ${readerProgression.ignition.aha}

Continuity basis: ${readerProgression.ignition.ahaSupport}

## The self-accelerating market

${readerProgression.marketFlywheel.title}

${readerProgression.marketFlywheel.statement}

Ignition role: ${readerProgression.marketFlywheel.ignitionRole}

${readerProgression.marketFlywheel.steps.map((step, index) => `${index + 1}. ${step.label}: ${step.title} ${step.statement}`).join("\n")}

Return: ${readerProgression.marketFlywheel.returnStatement}

Self-start boundary: ${readerProgression.marketFlywheel.selfStartBoundary}

Boundary: ${readerProgression.flywheelBoundary}

## The infrastructure questions

${readerProgression.conceptQuestions.map((concept) => {
  const layer = narrative.layers.find((candidate) => candidate.id === concept.layerId);
  return `- ${concept.question} ${displayLayerName(layer.id)}: ${layer.statement} ${layer.humanRoute}`;
}).join("\n")}

Authority boundary: ${readerProgression.authorityBoundary}

## The exact Kungfu product loop

${readerProgression.agentNativeLoop.title}

${readerProgression.agentNativeLoop.statement}

${readerProgression.agentNativeLoop.stages.map((stage, index) => `${index + 1}. ${stage.label}: ${stage.title} ${stage.statement}`).join("\n")}

Boundary: ${readerProgression.agentNativeLoop.boundary}

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
