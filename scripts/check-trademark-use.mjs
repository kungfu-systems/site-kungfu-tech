#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EXACT_MARK = "Kungfu UNGFU™";
const OWNER_NOTICE = `${EXACT_MARK} is a trademark of Kungfu Origin Technology Limited.`;
const PRINCIPLE = "Never Guess. Facts Unfold.";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function footerBlock(source) {
  return source.match(/<!-- shared-footer:start -->[\s\S]*?<!-- shared-footer:end -->/)?.[0] || "";
}

export function validateTrademarkUse({ layout, pages }) {
  const issues = [];
  const home = pages["public/index.html"] || "";
  const homePrinciple = home.match(/<div class="brand-principle"[\s\S]*?<\/div>/)?.[0] || "";
  const why = pages["public/why-kungfu/index.html"] || "";
  const legal = pages["public/legal/index.html"] || "";
  const trademarkItem = layout.footer?.find((item) => item.role === "trademark");

  if (layout.brand?.label !== "Kungfu") issues.push("primary product name must remain Kungfu");
  if (trademarkItem?.text !== OWNER_NOTICE) issues.push("shared trademark attribution is not exact");
  if (!homePrinciple.includes(EXACT_MARK) || !homePrinciple.includes(PRINCIPLE)) {
    issues.push("homepage must pair the exact mark with the brand principle");
  }
  if (!why.includes(EXACT_MARK) || !why.includes("UNGFU is not a second product or runtime")) {
    issues.push("Why Kungfu must explain the exact mark and product boundary");
  }
  if (!legal.includes(OWNER_NOTICE) || !legal.includes("makes no claim about registration status")) {
    issues.push("legal page must state ownership without claiming registration");
  }

  for (const pagePath of layout.pages || []) {
    if (!footerBlock(pages[pagePath] || "").includes(OWNER_NOTICE)) {
      issues.push(`${pagePath} is missing the shared trademark notice`);
    }
  }

  for (const [pagePath, source] of Object.entries(pages)) {
    if (source.includes("®")) issues.push(`${pagePath} uses the registered symbol`);
    if (/\b(?:is|are) (?:an? )?registered trademark\b/iu.test(source)) {
      issues.push(`${pagePath} makes an unsupported registration claim`);
    }
  }
  return issues;
}

function liveInput() {
  const layout = JSON.parse(fs.readFileSync(path.join(ROOT, "site/shared-layout.json"), "utf8"));
  const pages = Object.fromEntries(
    layout.pages.map((pagePath) => [pagePath, fs.readFileSync(path.join(ROOT, pagePath), "utf8")]),
  );
  return { layout, pages };
}

function selfTest() {
  const base = liveInput();
  assert.deepEqual(validateTrademarkUse(base), []);

  const registeredSymbol = structuredClone(base);
  registeredSymbol.pages["public/index.html"] = registeredSymbol.pages["public/index.html"].replace("™", "®");
  assert.ok(validateTrademarkUse(registeredSymbol).some((issue) => issue.includes("registered symbol")));

  const renamed = structuredClone(base);
  renamed.layout.brand.label = "UNGFU";
  assert.ok(validateTrademarkUse(renamed).includes("primary product name must remain Kungfu"));

  const missingSurface = structuredClone(base);
  missingSurface.pages["public/index.html"] = missingSurface.pages["public/index.html"].replace(
    `<span class="brand-signature">${EXACT_MARK}</span>`,
    '<span class="brand-signature">Kungfu</span>',
  );
  assert.ok(validateTrademarkUse(missingSurface).some((issue) => issue.includes("homepage")));

  const registrationClaim = structuredClone(base);
  registrationClaim.pages["public/legal/index.html"] += " Kungfu UNGFU is a registered trademark.";
  assert.ok(validateTrademarkUse(registrationClaim).some((issue) => issue.includes("unsupported registration")));
}

const selfTestMode = process.argv.includes("--self-test");
if (selfTestMode) {
  selfTest();
  console.log("trademark-use negative fixtures passed");
} else {
  const issues = validateTrademarkUse(liveInput());
  if (issues.length) {
    for (const issue of issues) console.error(`error: ${issue}`);
    process.exit(1);
  }
  console.log("trademark-use surfaces passed");
}
