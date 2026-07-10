#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  readLayout,
  renderFooter,
  renderHeader,
  replaceSharedBlock,
} from "./site-layout.mjs";

const repoRoot = process.cwd();
const checkOnly = process.argv.includes("--check");
const config = readLayout(repoRoot);
const blocks = {
  header: renderHeader(config),
  footer: renderFooter(config),
};

let drift = false;
for (const page of config.pages) {
  const pagePath = path.join(repoRoot, page);
  const before = fs.readFileSync(pagePath, "utf8");
  let after = replaceSharedBlock(before, "header", blocks.header);
  after = replaceSharedBlock(after, "footer", blocks.footer);

  if (after !== before) {
    drift = true;
    if (checkOnly) {
      console.error(`error: ${page} shared layout is stale; run bash scripts/build-site.sh`);
    } else {
      fs.writeFileSync(pagePath, after);
      console.log(`rendered shared layout: ${page}`);
    }
  }
}

if (checkOnly && drift) process.exit(1);
if (!drift) console.log("shared layout is current");
