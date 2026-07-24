#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { loadPublicationCatalog } from "./whitepaper-source.mjs";
import { escapeHtml, readLayout, renderFooter, renderHeader } from "./site-layout.mjs";

const repoRoot = process.cwd();
const catalog = loadPublicationCatalog(repoRoot);
const page = catalog.kfd.site.agentHubPage;
const projection = page?.firstPartyProductProjection;

if (
  page?.url !== "/agent-hub"
  || page?.suite?.fixedVectorCount !== 20
  || page?.normative !== false
  || page?.status !== "experimental"
  || projection?.run !== "kungfu agent hub qualify --output-dir <new-directory>"
  || projection?.verify !== "kungfu agent hub verify --qualification-dir <directory>"
  || !page?.commands?.kungfuProduct
) {
  throw new Error("KFD package does not expose the expected first-party Agent Hub qualification projection");
}

const layout = readLayout(repoRoot);
const machine = {
  schemaVersion: 1,
  contract: "kungfu-agent-hub-public-entry/v1",
  source: {
    package: catalog.kfd.packageInfo.name,
    version: catalog.kfd.packageInfo.version,
    authority: page.authorityPath,
    siteBundleRoute: page.url,
  },
  product: "Kungfu",
  status: page.status,
  normative: page.normative,
  run: projection.run,
  verify: projection.verify,
  machineRun: `${projection.run} --json`,
  suite: page.suite,
  binding: page.binding,
  ownership: projection.ownership,
  claimBoundary: page.claimBoundary,
  reportVerification: page.reportVerification,
  recovery: page.recovery,
  humanRoute: "https://kungfu.tech/agent-hub/",
  kfdRoute: "https://kfd.libkungfu.dev/agent-hub",
};

const command = projection.run.replace("<new-directory>", "./kungfu-agent-hub-check");
const verify = projection.verify.replace("<directory>", "./kungfu-agent-hub-check");
const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Verify Kungfu's KFD Agent Hub | Kungfu</title>
  <meta name="description" content="Ask the installed Kungfu product to run the fixed KFD Agent Hub 20 suite, explain what passed, retain rooted evidence, and state what the result does not prove.">
  <meta property="og:title" content="Verify Kungfu's KFD Agent Hub | Kungfu">
  <meta property="og:description" content="One installed-product command. Twenty fixed local Hub scenarios. Human explanation and machine JSON from the same evidence.">
  <meta property="og:url" content="https://kungfu.tech/agent-hub/">
  <link rel="canonical" href="https://kungfu.tech/agent-hub/">
  <link rel="alternate" type="application/json" title="Agent Hub machine entry" href="/agent-hub.json">
  <link rel="alternate" type="text/plain" title="Kungfu agent entrypoint" href="/llms.txt">
  <link rel="stylesheet" href="/assets/site.css">
  <style>
    main { width: min(1080px, calc(100% - 40px)); margin: 0 auto; padding: 34px 0 64px; }
    .hero { display: grid; gap: 20px; min-height: 500px; align-content: center; padding: 64px 0; }
    .eyebrow { margin: 0; color: var(--accent); font-size: 13px; font-weight: 750; text-transform: uppercase; }
    h1 { max-width: 920px; margin: 0; font-size: clamp(46px, 8vw, 86px); line-height: .96; }
    .lead { max-width: 820px; margin: 0; color: var(--muted); font-size: 20px; }
    .command { overflow-x: auto; margin: 8px 0 0; padding: 20px; border: 1px solid var(--line); border-left: 5px solid var(--accent); background: var(--panel); color: var(--fg); font: 700 15px/1.6 "SFMono-Regular", Consolas, monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
    .actions { display: flex; flex-wrap: wrap; gap: 12px; }
    .actions a { padding: 10px 14px; border: 1px solid var(--line); font-weight: 700; text-decoration: none; }
    .actions a:first-child { border-color: var(--accent); background: var(--accent); color: white; }
    .section { padding: 58px 0; border-top: 1px solid var(--line); }
    .section h2 { margin: 0 0 18px; font-size: clamp(30px, 5vw, 48px); }
    .question-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
    .card { padding: 22px; border: 1px solid var(--line); background: var(--panel); }
    .card h3 { margin: 0 0 10px; font-size: 20px; }
    .card p { margin: 0; color: var(--muted); }
    .boundary { padding: 24px; border-left: 5px solid var(--warn); background: var(--panel-soft); }
    .boundary p { margin: 0; }
    .boundary p + p { margin-top: 12px; }
    @media (max-width: 820px) { .question-grid { grid-template-columns: 1fr 1fr; } }
    @media (max-width: 560px) { main { width: min(100% - 28px, 560px); } .hero { min-height: 0; } .question-grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <main>
    <!-- shared-header:start -->
${renderHeader(layout)}
    <!-- shared-header:end -->
    <section class="hero">
      <p class="eyebrow">Executable first-party proof · ${escapeHtml(page.status)}</p>
      <h1>Ask Kungfu to prove its Agent Hub capability.</h1>
      <p class="lead">The installed product runs the fixed KFD Hub ${page.suite.fixedVectorCount} suite against two isolated local authority domains, then explains the exact result to a human. Add <code>--json</code> for an Agent.</p>
      <pre class="command"><code>${escapeHtml(command)}</code></pre>
      <div class="actions">
        <a href="https://kfd.libkungfu.dev/agent-hub">Read the KFD-owned profile</a>
        <a href="/agent-hub.json">Open the machine entry</a>
      </div>
    </section>
    <section class="section" aria-labelledby="answers-heading">
      <p class="eyebrow">One result · four immediate answers</p>
      <h2 id="answers-heading">You should not need to decode a report root first.</h2>
      <div class="question-grid">
        <article class="card"><h3>What ran?</h3><p>Twenty fixed scenarios across negotiation, delivery, authority, conflict, knowledge, completion, recovery, and portability.</p></article>
        <article class="card"><h3>Did it pass?</h3><p>The result gives pass or fail, exact coverage, offline verification state, product identity, and platform.</p></article>
        <article class="card"><h3>What does it mean?</h3><p>It states whether this exact Kungfu artifact can perform the tested local KFD Agent Hub exchange.</p></article>
        <article class="card"><h3>What does it not mean?</h3><p>Certification, security, production fitness, remote networking, external adoption, and unobserved platforms stay outside the claim.</p></article>
      </div>
    </section>
    <section class="section" aria-labelledby="verify-heading">
      <p class="eyebrow">Retained evidence</p>
      <h2 id="verify-heading">Verify again without rerunning the suite.</h2>
      <pre class="command"><code>${escapeHtml(verify)}</code></pre>
      <p>The verifier rechecks the KFD report, adapter bytes, current product artifact, isolation statement, and bounded meaning. The qualification also records whether real <code>~/.kungfu</code> metadata stayed unchanged.</p>
    </section>
    <section class="section" aria-labelledby="ownership-heading">
      <p class="eyebrow">Authority boundary</p>
      <h2 id="ownership-heading">One reader path. Independent owners.</h2>
      <div class="boundary">
        <p><strong>KFD owns</strong> the fixed suite and offline report verifier. <strong>Kungfu owns</strong> its product semantics, installed-artifact binding, isolated execution, and human or Agent explanation.</p>
        <p>${escapeHtml(page.claimBoundary)}</p>
      </div>
    </section>
    <!-- shared-footer:start -->
${renderFooter(layout)}
    <!-- shared-footer:end -->
  </main>
</body>
</html>
`;

const outputDir = path.join(repoRoot, "dist", "agent-hub");
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, "index.html"), html);
fs.writeFileSync(path.join(repoRoot, "dist", "agent-hub.json"), `${JSON.stringify(machine, null, 2)}\n`);
fs.appendFileSync(
  path.join(repoRoot, "dist", "llms.txt"),
  `\n## Verify the installed Kungfu Agent Hub\n\nRun: ${command} --json\nVerify: ${verify} --json\nHuman route: https://kungfu.tech/agent-hub/\nMachine route: https://kungfu.tech/agent-hub.json\nKFD authority: https://kfd.libkungfu.dev/agent-hub\nMeaning and non-claims are emitted by the command; do not widen them.\n`,
);
console.log("rendered Agent Hub human and machine entrypoints");
