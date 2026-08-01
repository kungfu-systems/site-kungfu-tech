import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { consumePaperPropagation } from "./paper-propagation.mjs";

function sortJson(value) {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([, entry]) => entry !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => [key, sortJson(entry)]));
}

function digest(value) {
  return crypto.createHash("sha256").update(`${JSON.stringify(sortJson(value), null, 2)}\n`).digest("hex");
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "site-kungfu-paper-propagation-"));
  fs.mkdirSync(path.join(root, "scripts"));
  fs.mkdirSync(path.join(root, "buildchain.upstreams"));
  fs.writeFileSync(path.join(root, "package.json"), `${JSON.stringify({
    dependencies: { "@kungfu-tech/paper-observer-declared-timelines": "0.1.0-alpha.9" },
  }, null, 2)}\n`);
  fs.writeFileSync(path.join(root, "README.md"), "- `@kungfu-tech/paper-observer-declared-timelines@0.1.0-alpha.9`\n");
  fs.writeFileSync(path.join(root, "scripts", "whitepaper-source.mjs"), [
    "export const PAPER_RELEASES = [",
    "  {",
    "    package: \"@kungfu-tech/paper-observer-declared-timelines\",",
    "    version: \"0.1.0-alpha.9\",",
    "  },",
    "];",
    "",
  ].join("\n"));
  const lock = {
    schemaVersion: 1,
    contract: "kungfu-buildchain-release-propagation-lock",
    upstream: {
      repository: "kungfu-systems/paper-observer-declared-timelines",
      channel: "alpha",
      package: {
        name: "@kungfu-tech/paper-observer-declared-timelines",
        version: "0.1.0-alpha.10",
        integrity: "sha512-dGVzdA==",
      },
      publicationArtifact: { version: "0.1.0-alpha.10" },
    },
    downstream: { repository: "kungfu-systems/site-kungfu-tech" },
    propagation: { exact: true, floatingTags: false },
  };
  lock.propagation.propagationKey = digest({
    release: {
      repository: lock.upstream.repository,
      version: lock.upstream.package.version,
      channel: lock.upstream.channel,
    },
    downstreamRepository: lock.downstream.repository,
  });
  lock.lockSha256 = digest({ ...lock, lockSha256: undefined });
  const lockPath = path.join(root, "buildchain.upstreams", "observer.release.json");
  fs.writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
  return { root, lock, lockPath };
}

test("consumes one exact paper release lock across all site-owned pins", () => {
  const { root, lockPath } = fixture();
  const result = consumePaperPropagation({ repoRoot: root, lockPath });
  assert.equal(result.version, "0.1.0-alpha.10");
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).dependencies[
      "@kungfu-tech/paper-observer-declared-timelines"
    ],
    "0.1.0-alpha.10",
  );
  assert.match(fs.readFileSync(path.join(root, "README.md"), "utf8"), /alpha\.10/u);
  assert.match(fs.readFileSync(path.join(root, "scripts", "whitepaper-source.mjs"), "utf8"), /alpha\.10/u);
});

test("rejects a lock whose exact content root was changed", () => {
  const { root, lock, lockPath } = fixture();
  lock.upstream.package.version = "0.1.0-alpha.11";
  fs.writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
  assert.throws(
    () => consumePaperPropagation({ repoRoot: root, lockPath }),
    /publication|root mismatch/u,
  );
});
