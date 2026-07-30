import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const scriptPath = fileURLToPath(new URL("./check-copyable-code.mjs", import.meta.url));

function runGate(html) {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "kungfu-copyable-code-"));
  try {
    fs.writeFileSync(path.join(fixtureRoot, "index.html"), html);
    return spawnSync(process.execPath, [scriptPath, "--root", fixtureRoot], { encoding: "utf8" });
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

const sharedScript = '<script src="/assets/command-copy.js" defer></script>';

test("accepts one fully wired actionable code surface", () => {
  const result = runGate(`
    <div class="command-block">
      <pre><code>kungfu verify</code></pre>
      <button class="copy-button" data-copy-command aria-label="Copy command" aria-live="polite">Copy</button>
    </div>
    ${sharedScript}
  `);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /verified 1 copyable code surface/);
});

test("rejects an actionable surface outside a command-block", () => {
  const result = runGate(`<pre><code>kungfu verify</code></pre>${sharedScript}`);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /must belong to exactly one command-block/);
});

test("rejects a command-block without an accessible copy control", () => {
  const result = runGate(`
    <div class="command-block">
      <code class="command">kungfu verify</code>
      <button data-copy-command>Copy</button>
    </div>
    ${sharedScript}
  `);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /missing the copy-button class/);
  assert.match(result.stderr, /requires a non-empty aria-label/);
  assert.match(result.stderr, /requires aria-live="polite"/);
});

test("rejects a copyable surface without the shared behavior", () => {
  const result = runGate(`
    <div class="command-block">
      <pre><code>kungfu verify</code></pre>
      <button class="copy-button" data-copy-command aria-label="Copy command" aria-live="polite">Copy</button>
    </div>
  `);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /missing the deferred shared command-copy script/);
});
