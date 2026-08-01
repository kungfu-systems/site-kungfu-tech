#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LOCK_CONTRACT = "kungfu-buildchain-release-propagation-lock";
const SITE_REPOSITORY = "kungfu-systems/site-kungfu-tech";
const PAPER_PREFIX = "@kungfu-tech/paper-";

const PAPER_SOURCE_BINDINGS = {
  "@kungfu-tech/paper-kungfu-product-white-paper": {
    pattern: /export const WHITEPAPER_VERSION = "([^"]+)";/u,
    render: (version) => `export const WHITEPAPER_VERSION = "${version}";`,
  },
  "@kungfu-tech/paper-kfd-machine-life-roadmap": {
    pattern: /export const MACHINE_LIFE_VERSION = "([^"]+)";/u,
    render: (version) => `export const MACHINE_LIFE_VERSION = "${version}";`,
  },
  "@kungfu-tech/paper-kfd-foundation-real-world-agent-work": {
    pattern: /(package: "@kungfu-tech\/paper-kfd-foundation-real-world-agent-work",\n\s+version: )"([^"]+)"/u,
    render: (version, prefix) => `${prefix}"${version}"`,
    versionGroup: 2,
  },
  "@kungfu-tech/paper-observer-declared-timelines": {
    pattern: /(package: "@kungfu-tech\/paper-observer-declared-timelines",\n\s+version: )"([^"]+)"/u,
    render: (version, prefix) => `${prefix}"${version}"`,
    versionGroup: 2,
  },
  "@kungfu-tech/paper-episodes-to-primitives": {
    pattern: /(package: "@kungfu-tech\/paper-episodes-to-primitives",\n\s+version: )"([^"]+)"/u,
    render: (version, prefix) => `${prefix}"${version}"`,
    versionGroup: 2,
  },
};

function sortJson(value) {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, sortJson(entry)]),
  );
}

function stableJson(value) {
  return `${JSON.stringify(sortJson(value), null, 2)}\n`;
}

function sha256Json(value) {
  return crypto.createHash("sha256").update(stableJson(value)).digest("hex");
}

function normalizeDigest(value, label) {
  const digest = String(value || "").trim().toLowerCase().replace(/^sha256:/u, "");
  if (!/^[a-f0-9]{64}$/u.test(digest)) throw new Error(`${label} must be an exact SHA-256 digest`);
  return digest;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function replaceExactlyOnce(text, binding, oldVersion, newVersion, label) {
  const matches = [...text.matchAll(new RegExp(binding.pattern.source, `${binding.pattern.flags}g`))];
  if (matches.length !== 1) throw new Error(`${label} must contain exactly one managed paper version binding`);
  const match = matches[0];
  const version = match[binding.versionGroup || 1];
  if (version !== oldVersion) throw new Error(`${label} version does not match package.json`);
  const replacement = binding.render(newVersion, match[1]);
  return `${text.slice(0, match.index)}${replacement}${text.slice(match.index + match[0].length)}`;
}

function assertLock(lock) {
  if (lock?.schemaVersion !== 1 || lock.contract !== LOCK_CONTRACT) {
    throw new Error("paper propagation lock contract mismatch");
  }
  if (
    lock.downstream?.repository !== SITE_REPOSITORY
    || lock.propagation?.exact !== true
    || lock.propagation?.floatingTags !== false
  ) {
    throw new Error("paper propagation lock must target exact site-kungfu-tech state");
  }
  const packageFact = lock.upstream?.package;
  const publication = lock.upstream?.publicationArtifact;
  if (
    !packageFact?.name?.startsWith(PAPER_PREFIX)
    || !packageFact.version
    || packageFact.version !== publication?.version
    || !/^sha512-[A-Za-z0-9+/=_-]+$/u.test(packageFact.integrity || "")
  ) {
    throw new Error("paper propagation lock must bind one exact npm publication");
  }
  const expectedLock = sha256Json({ ...lock, lockSha256: undefined });
  if (normalizeDigest(lock.lockSha256, "paper propagation lock root") !== expectedLock) {
    throw new Error("paper propagation lock root mismatch");
  }
  const expectedKey = sha256Json({
    release: {
      repository: lock.upstream.repository,
      version: packageFact.version,
      channel: lock.upstream.channel,
    },
    downstreamRepository: SITE_REPOSITORY,
  });
  if (normalizeDigest(lock.propagation.propagationKey, "paper propagation key") !== expectedKey) {
    throw new Error("paper propagation key mismatch");
  }
  return packageFact;
}

export function consumePaperPropagation({ repoRoot = process.cwd(), lockPath } = {}) {
  if (!lockPath) throw new Error("--lock is required");
  const lock = readJson(path.resolve(repoRoot, lockPath));
  const packageFact = assertLock(lock);
  const binding = PAPER_SOURCE_BINDINGS[packageFact.name];
  if (!binding) throw new Error(`unsupported paper package: ${packageFact.name}`);

  const packagePath = path.join(repoRoot, "package.json");
  const sourcePath = path.join(repoRoot, "scripts", "whitepaper-source.mjs");
  const readmePath = path.join(repoRoot, "README.md");
  const packageJson = readJson(packagePath);
  const oldVersion = packageJson.dependencies?.[packageFact.name];
  if (!oldVersion) throw new Error(`package.json does not declare ${packageFact.name}`);

  const nextSource = replaceExactlyOnce(
    fs.readFileSync(sourcePath, "utf8"),
    binding,
    oldVersion,
    packageFact.version,
    "scripts/whitepaper-source.mjs",
  );
  const escapedPackage = packageFact.name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const readmePattern = new RegExp("- `" + escapedPackage + "@([^`]+)`", "gu");
  const readme = fs.readFileSync(readmePath, "utf8");
  const readmeMatches = [...readme.matchAll(readmePattern)];
  if (readmeMatches.length !== 1 || readmeMatches[0][1] !== oldVersion) {
    throw new Error("README.md paper version does not match package.json");
  }
  const nextReadme = readme.replace(readmePattern, `- \`${packageFact.name}@${packageFact.version}\``);

  packageJson.dependencies[packageFact.name] = packageFact.version;
  fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
  fs.writeFileSync(sourcePath, nextSource);
  fs.writeFileSync(readmePath, nextReadme);

  return {
    schemaVersion: 1,
    contract: "kungfu-tech-paper-propagation-consume-result",
    package: packageFact.name,
    previousVersion: oldVersion,
    version: packageFact.version,
    lockPath,
    lockSha256: `sha256:${normalizeDigest(lock.lockSha256, "paper propagation lock root")}`,
  };
}

function cliArguments(argv) {
  const index = argv.indexOf("--lock");
  return { lockPath: index >= 0 ? argv[index + 1] : "" };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.stdout.write(`${JSON.stringify(consumePaperPropagation(cliArguments(process.argv.slice(2))), null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`paper propagation: ${error.message}\n`);
    process.exitCode = 1;
  }
}
