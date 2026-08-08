// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import test from "node:test";
import { loadPresentationContract } from "./import-auditable-demo.mjs";
import {
  CONTINUITY_PRELUDE_DELAY_MS,
  PROBLEM_AUTOMATION_DELAY_MS,
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

test("passive progression is bounded to Problem and the compact Continuity prelude", () => {
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
    assert.equal(passiveTransition({ activeChapter, proofState: "prelude", automationEnabled: true, reducedMotion: false, visible: true }), null);
  }
  assert.equal(passiveTransition({ activeChapter: 0, proofState: "chapter", automationEnabled: true, reducedMotion: true, visible: true }), null);
});

test("navigation and media interaction cancel automation and keep chapter progress stable", () => {
  const initial = { activeChapter: 0, proofState: "chapter", automationEnabled: true };
  const continuity = transitionReel(initial, { type: "select-chapter", chapter: 1, userInitiated: true });
  assert.deepEqual(continuity, { activeChapter: 1, proofState: "prelude", automationEnabled: false });
  const media = transitionReel(continuity, { type: "enter-proof", play: true, userInitiated: true });
  assert.deepEqual(media, { activeChapter: 1, proofState: "media", automationEnabled: false });
  assert.equal(media.activeChapter, continuity.activeChapter);
  assert.equal(transitionReel(media, { type: "pause", userInitiated: true }).automationEnabled, false);
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
