// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import test from "node:test";
import { loadPresentationContract } from "./import-auditable-demo.mjs";
import {
  adjacentScene,
  CONTINUITY_PRELUDE_DELAY_MS,
  PROBLEM_AUTOMATION_DELAY_MS,
  PROOF_PRELUDE_DELAY_MS,
  PROOF_SCENE_TRANSITION_DURATION_MS,
  mediaPolicy,
  passiveTransition,
  transitionReel,
} from "../public/assets/proof-reel-state.js";

const html = () => fs.readFileSync("public/index.html", "utf8");
const collection = () => JSON.parse(fs.readFileSync("public/auditable-demos.json", "utf8"));

test("importer accepts only the exact rooted presentation bytes", () => {
  const source = JSON.parse(fs.readFileSync("site/auditable-demo-source.json", "utf8"));
  const presentation = loadPresentationContract(process.cwd(), source, source.demos);
  assert.equal(presentation.proofs.length, 3);
  const drifted = structuredClone(source);
  drifted.presentation.contractSha256 = "0".repeat(64);
  assert.throws(
    () => loadPresentationContract(process.cwd(), drifted, drifted.demos),
    /presentation contract digest does not verify/u,
  );
});

test("homepage renders four semantic chapters from the rooted three-proof contract", () => {
  const page = html();
  const projection = collection();
  const contractBytes = fs.readFileSync(projection.presentation.source.contractPath);
  assert.equal(
    crypto.createHash("sha256").update(contractBytes).digest("hex"),
    projection.presentation.source.contractSha256,
  );
  assert.equal((page.match(/<article\b[^>]*data-demo-slide/gu) || []).length, 4);
  assert.equal((page.match(/data-proof-chapter=/g) || []).length, 3);
  assert.equal((page.match(/<section\b[^>]*data-proof-prelude/gu) || []).length, 3);
  assert.equal((page.match(/<figure\b[^>]*data-proof-media/gu) || []).length, 3);
  for (const proof of projection.presentation.proofs) {
    assert.match(page, new RegExp(proof.question.replace(/[?]/gu, "\\?"), "u"));
    assert.match(page, new RegExp(`data-proof-demo-id="${proof.demoId}"`, "u"));
    const demoProjection = JSON.parse(
      fs.readFileSync(`public${proof.projectionPath}`, "utf8"),
    );
    assert.equal(demoProjection.passportRoot, proof.passportRoot);
    assert.equal(demoProjection.mediaRoot, proof.mediaRoot);
    assert.match(page, new RegExp(`${demoProjection.publicEvidencePath}/passport\\.json`, "u"));
  }
});

test("homepage leads with dogfood proof beside the canonical acquisition path", () => {
  const page = html();
  const heroIndex = page.indexOf('class="hero"');
  const detailsIndex = page.indexOf('class="hero-details"');
  const acquisitionIndex = page.indexOf('class="hero-acquisition-row"');
  const dogfoodIndex = page.indexOf('class="hero-dogfood-proof"');
  const installIndex = page.indexOf('class="hero-install-strip"');
  const reelIndex = page.indexOf('class="demo-showcase"');
  const nextSectionIndex = page.indexOf('class="builder-entry"');
  assert.ok(acquisitionIndex > heroIndex);
  assert.ok(dogfoodIndex > acquisitionIndex);
  assert.ok(installIndex > dogfoodIndex);
  assert.ok(reelIndex > installIndex);
  assert.ok(detailsIndex > reelIndex);
  assert.ok(nextSectionIndex > detailsIndex);
  assert.match(page, /class="hero-dogfood-proof" href="https:\/\/libkungfu\.dev\/dogfood\/"/u);
  assert.match(page, /Built in public by one human working through agents\./u);
  assert.match(page, /3,467 merged public PRs across 16 repositories in 30 days\./u);
  assert.match(page, /Inspect the evidence/u);
  assert.match(page, /class="hero-install-strip" href="\/install\/"/u);
  assert.match(page, /<strong>Download Kungfu<\/strong>/u);
  assert.match(page, /Public Alpha · Desktop \+ standalone CLI/u);
  for (const platform of ["macOS", "Linux", "Windows"]) {
    assert.match(page, new RegExp(`<span>${platform}</span>`, "u"));
  }
});

test("passive progression advances every text scene without overriding user or motion preferences", () => {
  assert.equal(PROBLEM_AUTOMATION_DELAY_MS, 7000);
  assert.equal(PROOF_PRELUDE_DELAY_MS, 5000);
  assert.deepEqual(
    passiveTransition({
      activeChapter: 0,
      proofState: "chapter",
      automationEnabled: true,
      reducedMotion: false,
      visible: true,
    }),
    { delayMs: PROBLEM_AUTOMATION_DELAY_MS, action: { type: "select-chapter", chapter: 1 } },
  );
  assert.deepEqual(
    passiveTransition({
      activeChapter: 1,
      proofState: "prelude",
      automationEnabled: true,
      reducedMotion: false,
      visible: true,
    }),
    { delayMs: CONTINUITY_PRELUDE_DELAY_MS, action: { type: "enter-proof", play: true } },
  );
  for (const activeChapter of [2, 3]) {
    assert.deepEqual(
      passiveTransition({ activeChapter, proofState: "prelude", automationEnabled: true, reducedMotion: false, visible: true }),
      { delayMs: CONTINUITY_PRELUDE_DELAY_MS, action: { type: "enter-proof", play: true } },
    );
  }
  assert.equal(passiveTransition({ activeChapter: 0, proofState: "chapter", automationEnabled: true, reducedMotion: true, visible: true }), null);
  assert.equal(passiveTransition({ activeChapter: 2, proofState: "media", automationEnabled: true, reducedMotion: false, visible: true }), null);
});

test("scene navigation walks text and video scenes in both directions and wraps", () => {
  const forward = [
    { activeChapter: 0, proofState: "chapter" },
    { activeChapter: 1, proofState: "prelude" },
    { activeChapter: 1, proofState: "media" },
    { activeChapter: 2, proofState: "prelude" },
    { activeChapter: 2, proofState: "media" },
    { activeChapter: 3, proofState: "prelude" },
    { activeChapter: 3, proofState: "media" },
    { activeChapter: 0, proofState: "chapter" },
  ];
  for (let index = 0; index < forward.length - 1; index += 1) {
    assert.deepEqual(adjacentScene(forward[index], 1), forward[index + 1]);
    assert.deepEqual(adjacentScene(forward[index + 1], -1), forward[index]);
  }
});

test("browser controls and video completion delegate to scene navigation", () => {
  const page = html();
  assert.match(page, /demoPrevious\.addEventListener\("click", \(\) => stepScene\(-1\)\)/u);
  assert.match(page, /demoPlayback\.addEventListener\("click", \(\) => setPlayback\(!autoAdvanceEnabled\)\)/u);
  assert.match(page, /demoNext\.addEventListener\("click", \(\) => stepScene\(1\)\)/u);
  assert.match(page, /video\.addEventListener\("ended", \(\) => \{[\s\S]*?autoAdvanceEnabled\) stepScene\(1\)/u);
  assert.match(page, /aria-label="Previous scene" data-carousel-previous/u);
  assert.match(page, /aria-label="Pause scene playback" aria-pressed="true" data-carousel-playback/u);
  assert.match(page, /aria-label="Next scene" data-carousel-next/u);
});

test("proof text crossfades into media with a short motion-safe transition", () => {
  const page = html();
  assert.equal(PROOF_SCENE_TRANSITION_DURATION_MS, 480);
  assert.match(page, /!reducedMotion\.matches[\s\S]*?typeof prelude\?\.animate === "function"/u);
  assert.match(page, /prelude\.animate\(\[[\s\S]*?scale\(0\.985\)/u);
  assert.match(page, /media\.animate\(\[[\s\S]*?scale\(1\.015\)[\s\S]*?scale\(1\)/u);
  assert.match(page, /setSceneAnimationsPlaying\(enabled\)/u);
  assert.match(page, /data-proof-transitioning/u);
  assert.match(page, /const previousVideo = activeProofVideo\(\);\s*activeDemoIndex = boundedIndex;\s*if \(previousVideo\)/u);
});

test("navigation preserves explicit playback while play and pause own automation", () => {
  const initial = { activeChapter: 0, proofState: "chapter", automationEnabled: true };
  const continuity = transitionReel(initial, { type: "select-chapter", chapter: 1, userInitiated: true });
  assert.deepEqual(continuity, { activeChapter: 1, proofState: "prelude", automationEnabled: true });
  const media = transitionReel(continuity, { type: "enter-proof", play: true, userInitiated: true });
  assert.deepEqual(media, { activeChapter: 1, proofState: "media", automationEnabled: true });
  assert.equal(media.activeChapter, continuity.activeChapter);
  const paused = transitionReel(media, { type: "pause" });
  assert.equal(paused.automationEnabled, false);
  assert.equal(transitionReel(paused, { type: "play" }).automationEnabled, true);
});

test("inactive media never plays, resets, and remains non-eager", () => {
  assert.deepEqual(mediaPolicy({ active: false, proofState: "media", visible: true }), {
    preload: "none",
    pause: true,
    reset: true,
  });
  assert.deepEqual(mediaPolicy({ active: true, proofState: "media", visible: true }), {
    preload: "metadata",
    pause: false,
    reset: false,
  });
  const page = html();
  const videoTags = [...page.matchAll(/<video\b[^>]*data-proof-video[^>]*>/gu)].map(([tag]) => tag);
  assert.equal(videoTags.length, 3);
  for (const tag of videoTags) {
    assert.match(tag, /preload="none"/u);
    assert.doesNotMatch(tag, /\bloop\b/u);
  }
});
