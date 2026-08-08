#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { escapeAttr, escapeHtml } from "./site-layout.mjs";

const DIGEST = /^sha256:[0-9a-f]{64}$/u;
const SHA = /^[0-9a-f]{40}$/u;
const ID = /^[1-9][0-9]*$/u;
const DEMO_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const ARTIFACT_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$/u;
const EVIDENCE_CLASS = /^[a-z0-9][a-z0-9._/-]*\/v[1-9][0-9]*$/u;
const MEDIA_PROFILE_BY_DURATION_CLASS = {
  standard: "responsive-web-delivery-v1",
  "long-form": "responsive-long-form-web-delivery-v1",
};
const MAXIMUM_DURATION_MS_BY_CLASS = {
  standard: 60_000,
  "long-form": 180_000,
};
const REQUIRED_AUTHORIZATION_SOURCES = [
  "exact-release-passport",
  "core-policy",
  "work-or-warrant",
  "explicit-capability-grant",
  "runtime-isolation",
];
const NON_AUTHORITIES = [
  "first-party-identity",
  "system-identity",
  "kfd-compliance",
  "product-system-metadata",
  "local-bundle-presence",
  "package-metadata",
  "registry-history",
  "scan-output",
  "standalone-generation",
];
const LEGACY_MEDIA_MEMBERS = [
  "checksums.sha256",
  "complete-transcript.txt",
  "demo-720p.mp4",
  "demo-720p.webm",
  "demo.gif",
  "demo.mp4",
  "demo.webm",
  "gate-receipt.json",
  "manifest.json",
  "media-inspection.json",
  "media-probe.json",
  "media-receipt.json",
  "poster.png",
  "public-projection.json",
  "renderer-checksums.sha256",
  "scene.json",
];
const DECLARATIVE_EVIDENCE_MEMBERS = [
  "capture-manifest.json",
  "demo-720p.mp4",
  "demo-720p.webm",
  "demo.gif",
  "demo.mp4",
  "demo.webm",
  "gate-receipt.json",
  "manifest.json",
  "media-inspection.json",
  "media-probe.json",
  "media-receipt.json",
  "poster.png",
  "public-evidence.json",
  "qualified-gate-receipt.json",
  "release-passport.json",
  "renderer-checksums.sha256",
  "source-coordinate.json",
];
const PUBLIC_MEDIA_MEMBERS = [
  "demo-720p.mp4",
  "demo-720p.webm",
  "demo.gif",
  "demo.mp4",
  "demo.webm",
  "gate-receipt.json",
  "manifest.json",
  "media-inspection.json",
  "media-probe.json",
  "media-receipt.json",
  "poster.png",
  "renderer-checksums.sha256",
];

function invariant(condition, message) {
  if (!condition) throw new Error(`auditable-demo import: ${message}`);
}

function sha256(bytes) {
  return `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
}

function exactTimestamp(value, label) {
  const parsed = Date.parse(value || "");
  const canonical = Number.isFinite(parsed) ? new Date(parsed).toISOString() : "";
  invariant(
    Number.isFinite(parsed)
      && (canonical === value || canonical.replace(/\.000Z$/u, "Z") === value),
    `${label} must be a canonical RFC3339 timestamp`,
  );
  return value;
}

function stableJson(value) {
  const canonical = (entry) => {
    if (Array.isArray(entry)) return entry.map(canonical);
    if (!entry || typeof entry !== "object") return entry;
    return Object.fromEntries(
      Object.keys(entry).sort().map((key) => [key, canonical(entry[key])]),
    );
  };
  return `${JSON.stringify(canonical(value), null, 2)}\n`;
}

function readRegular(filePath, label, maximumBytes = 64 * 1024 * 1024) {
  const metadata = fs.lstatSync(filePath);
  invariant(
    metadata.isFile() && !metadata.isSymbolicLink(),
    `${label} must be a regular non-symlink file`,
  );
  invariant(metadata.size <= maximumBytes, `${label} is unexpectedly large`);
  return fs.readFileSync(filePath);
}

function readJson(filePath, label) {
  return JSON.parse(readRegular(filePath, label).toString("utf8"));
}

function listRegularFiles(directory) {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .map((entry) => {
      invariant(entry.isFile() && !entry.isSymbolicLink(), `unexpected media member ${entry.name}`);
      return entry.name;
    })
    .sort();
}

function verifyLegacyPassport(passport) {
  invariant(
    [
      "kungfu.auditable-demo.release-passport/v1",
      "kungfu.auditable-demo.release-passport/v2",
    ].includes(passport?.schema)
      && passport.status === "qualified",
    "passport schema or status is invalid",
  );
  invariant(
    passport.root?.profile === "sorted-object-json-utf8-lf/v1"
      && DIGEST.test(passport.root?.value || ""),
    "passport root is invalid",
  );
  const { root, ...payload } = passport;
  invariant(sha256(Buffer.from(stableJson(payload))) === root.value, "passport root does not verify");
  invariant(
    passport.source?.repository === "kungfu-systems/kungfu"
      && SHA.test(passport.source?.sha || ""),
    "passport source coordinate is invalid",
  );
  invariant(
    passport.workflow?.repository === passport.source.repository
      && ID.test(passport.workflow?.runId || "")
      && ID.test(passport.workflow?.runAttempt || "")
      && passport.workflow?.url ===
        `https://github.com/${passport.source.repository}/actions/runs/${passport.workflow.runId}`,
    "passport workflow coordinate is invalid",
  );
  for (const [label, artifact] of [
    ["source", passport.source?.artifact],
    ["Gate", passport.gate?.artifact],
    ["media", passport.media?.artifact],
  ]) {
    invariant(
      ID.test(artifact?.id || "")
        && ARTIFACT_NAME.test(artifact?.name || "")
        && DIGEST.test(artifact?.digest || "")
        && artifact?.url === `${passport.workflow.url}/artifacts/${artifact.id}`,
      `${label} artifact coordinate is invalid`,
    );
    exactTimestamp(artifact.expiresAt, `${label} artifact expiry`);
  }
  invariant(
    passport.source.artifact.name === `kungfu-linux-x64-${passport.source.sha}`,
    "source artifact name is not bound to the source SHA",
  );
  invariant(passport.gate?.status === "passed" && DIGEST.test(passport.gate?.root || ""), "Gate is not qualified");
  invariant(
    passport.media?.status === "rendered"
      && DIGEST.test(passport.media?.root || "")
      && Object.values(MEDIA_PROFILE_BY_DURATION_CLASS).includes(
        passport.media?.profile,
      )
      && DIGEST.test(passport.media?.qualificationRoot || ""),
    "media is not rendered and responsively qualified",
  );
  invariant(
    passport.gate.artifact.name.startsWith(
      `auditable-demo-gate-${passport.source.sha.slice(0, 12)}-${passport.gate.root.slice(7, 23)}`,
    ),
    "Gate artifact name is not bound to the source SHA and Gate root",
  );
  invariant(
    passport.media.artifact.name.startsWith(
      `auditable-demo-media-${passport.source.sha.slice(0, 12)}-${passport.media.root.slice(7, 23)}`,
    ),
    "media artifact name is not bound to the source SHA and media root",
  );
  invariant(
    SHA.test(passport.toolchain?.buildchainSha || "")
      && /^ghcr\.io\/kungfu-systems\/build-images\/demo-renderer@sha256:[0-9a-f]{64}$/u
        .test(passport.toolchain?.rendererImage || ""),
    "passport toolchain coordinate is invalid",
  );
  invariant(passport.authority?.publication === "github-artifacts-only", "unexpected publication authority");
  invariant(passport.authority?.productionDeployment === false, "source run must not claim a production deployment");
  invariant(EVIDENCE_CLASS.test(passport.authority?.evidenceClass || ""), "unexpected evidence class");
  invariant(
    passport.authority?.authorization?.status === "not-granted-by-demo"
      && JSON.stringify(passport.authority.authorization.requiredSources)
        === JSON.stringify(REQUIRED_AUTHORIZATION_SOURCES)
      && JSON.stringify(passport.authority.authorization.nonAuthorities)
        === JSON.stringify(NON_AUTHORITIES),
    "identity-neutral authorization boundary is invalid",
  );
  invariant(
    Array.isArray(passport.authority.claims)
      && passport.authority.claims.length > 0
      && passport.authority.claims.every((claim) => typeof claim === "string" && claim.length > 0)
      && Array.isArray(passport.authority.nonClaims)
      && passport.authority.nonClaims.length > 0
      && passport.authority.nonClaims.every((claim) => typeof claim === "string" && claim.length > 0),
    "Passport claims and non-claims are invalid",
  );
  const demo = passport.schema.endsWith("/v2")
    ? passport.demo
    : {
      id: "agent-work-lab",
      catalogRoot: null,
      descriptorRoot: null,
      commandLabel: "kungfu agent-work-lab autoplay",
      evidenceClass: "exact-installed-artifact-agent-work-lab-autoplay/v1",
      sceneId: "kungfu-agent-work-lab-autoplay",
      publication: {
        readmeFeatured: true,
        siteSlug: "agent-work-lab",
      },
    };
  invariant(
    DEMO_ID.test(demo?.id || "")
      && (passport.schema.endsWith("/v1") || (
        DIGEST.test(demo?.catalogRoot || "")
        && DIGEST.test(demo?.descriptorRoot || "")
      ))
      && typeof demo?.commandLabel === "string"
      && demo.commandLabel.startsWith("kungfu ")
      && demo.evidenceClass === passport.authority.evidenceClass
      && DEMO_ID.test(demo?.sceneId || "")
      && typeof demo?.publication?.readmeFeatured === "boolean"
      && DEMO_ID.test(demo?.publication?.siteSlug || ""),
    "demo identity or catalog binding is invalid",
  );
  return { passport, demo };
}

function verifyDeclarativePassport(rawPassport, sourceEntry, featuredDemoId) {
  invariant(
    rawPassport?.schema === "buildchain.declarative-demo-release-passport/v1"
      && rawPassport.status === "qualified",
    "declarative Passport schema or status is invalid",
  );
  const { passportRoot, ...body } = rawPassport;
  invariant(
    DIGEST.test(passportRoot || "")
      && passportRoot === sha256(Buffer.from(stableJson(body))),
    "declarative Passport root does not verify",
  );
  invariant(
    rawPassport.product?.id === "kungfu"
      && rawPassport.product?.binaryName === "kungfu"
      && rawPassport.demo?.id === sourceEntry.id
      && typeof rawPassport.demo?.title === "string"
      && rawPassport.demo.title.length > 0
      && typeof rawPassport.demo?.claimBoundary === "string"
      && rawPassport.demo.claimBoundary.length > 0,
    "declarative Passport product or demo identity is invalid",
  );
  const source = rawPassport.source;
  invariant(
    source?.schema === "buildchain.github-artifact-coordinate/v1"
      && source.repository === "kungfu-systems/kungfu"
      && SHA.test(source.sourceSha || "")
      && ID.test(source.runId || "")
      && ID.test(source.runAttempt || "")
      && ID.test(source.id || "")
      && ARTIFACT_NAME.test(source.name || "")
      && source.name === `kungfu-linux-x64-${source.sourceSha}`
      && DIGEST.test(source.digest || ""),
    "declarative Passport source coordinate is invalid",
  );
  exactTimestamp(source.expiresAt, "source artifact expiry");
  invariant(
    DIGEST.test(rawPassport.evidenceRoot || "")
      && DIGEST.test(rawPassport.scenarioRoot || "")
      && DIGEST.test(rawPassport.capture?.root || "")
      && rawPassport.capture?.binary?.platformId === "linux-x64"
      && Array.isArray(rawPassport.capture.binary.runtimeDependencies)
      && rawPassport.capture.binary.runtimeDependencies.length === 0
      && typeof rawPassport.capture?.networkIsolation === "string"
      && rawPassport.capture.networkIsolation.length > 0
      && DIGEST.test(rawPassport.gate?.root || "")
      && DIGEST.test(rawPassport.media?.root || "")
      && [
        "responsive-web-delivery-v1",
        "responsive-long-form-web-delivery-v1",
      ].includes(rawPassport.media?.profile)
      && DIGEST.test(rawPassport.media?.qualificationRoot || ""),
    "declarative Passport evidence chain is invalid",
  );
  invariant(
    SHA.test(rawPassport.toolchain?.buildchainSha || "")
      && /^ghcr\.io\/kungfu-systems\/build-images\/demo-renderer@sha256:[0-9a-f]{64}$/u
        .test(rawPassport.toolchain?.rendererImage || ""),
    "declarative Passport toolchain coordinate is invalid",
  );
  invariant(
    JSON.stringify(rawPassport.authority?.grants) === "[]"
      && JSON.stringify(rawPassport.authority?.authorizationSources)
        === JSON.stringify(REQUIRED_AUTHORIZATION_SOURCES)
      && JSON.stringify(rawPassport.authority?.nonAuthorities)
        === JSON.stringify(NON_AUTHORITIES.filter((value) => value !== "local-bundle-presence"))
      && rawPassport.authority?.productSystemRole
        === "assembly-and-distribution-metadata-only",
    "declarative Passport identity-neutral authority boundary is invalid",
  );
  invariant(
    typeof sourceEntry.commandLabel === "string"
      && sourceEntry.commandLabel.startsWith("kungfu ")
      && DEMO_ID.test(sourceEntry.siteSlug || ""),
    "declarative demo presentation coordinate is invalid",
  );
  const workflowUrl = `https://github.com/${source.repository}/actions/runs/${source.runId}`;
  const passport = {
    ...rawPassport,
    source: {
      ...source,
      sha: source.sourceSha,
      artifact: {
        ...source,
        url: `${workflowUrl}/artifacts/${source.id}`,
      },
    },
    workflow: {
      repository: source.repository,
      runId: source.runId,
      runAttempt: source.runAttempt,
      url: workflowUrl,
    },
    root: {
      algorithm: "sha256",
      profile: "sorted-object-json-utf8-lf/v1",
      value: passportRoot,
    },
    authority: {
      ...rawPassport.authority,
      evidenceClass: "exact-standalone-binary-declarative-demo/v1",
      claims: [
        "The exact retained standalone Kungfu Linux artifact completed the declared bounded demo.",
        "The Gate and responsive media qualification bind two independently captured native PTY renditions.",
      ],
      nonClaims: [rawPassport.demo.claimBoundary],
    },
  };
  const demo = {
    id: rawPassport.demo.id,
    title: rawPassport.demo.title,
    catalogRoot: rawPassport.scenarioRoot,
    descriptorRoot: rawPassport.capture.root,
    commandLabel: sourceEntry.commandLabel,
    evidenceClass: passport.authority.evidenceClass,
    sceneId: rawPassport.demo.id,
    publication: {
      readmeFeatured: rawPassport.demo.id === featuredDemoId,
      siteSlug: sourceEntry.siteSlug,
    },
  };
  return { passport, demo, declarative: true, rawPassport };
}

function verifyPassport(passport, sourceEntry, featuredDemoId) {
  if (passport?.schema === "buildchain.declarative-demo-release-passport/v1") {
    return verifyDeclarativePassport(passport, sourceEntry, featuredDemoId);
  }
  return { ...verifyLegacyPassport(passport), declarative: false, rawPassport: passport };
}

function verifyLegacyMedia(mediaDirectory, passport) {
  invariant(
    JSON.stringify(listRegularFiles(mediaDirectory)) === JSON.stringify(LEGACY_MEDIA_MEMBERS),
    "media bundle member set is not exact",
  );
  const checksumBytes = readRegular(path.join(mediaDirectory, "checksums.sha256"), "media checksums");
  invariant(sha256(checksumBytes) === passport.media.root, "media root does not match the passport");
  const rows = checksumBytes.toString("utf8").trimEnd().split("\n");
  const declared = [];
  for (const row of rows) {
    const match = /^([0-9a-f]{64})  ([A-Za-z0-9._-]+)$/u.exec(row);
    invariant(match, `invalid checksum row ${row}`);
    const member = match[2];
    invariant(member !== "checksums.sha256", "checksums cannot cover themselves");
    invariant(!declared.includes(member), `duplicate checksum member ${member}`);
    declared.push(member);
    invariant(
      sha256(readRegular(path.join(mediaDirectory, member), member)).slice(7) === match[1],
      `checksum mismatch for ${member}`,
    );
  }
  invariant(
    JSON.stringify(declared.sort()) === JSON.stringify(LEGACY_MEDIA_MEMBERS.filter((name) => name !== "checksums.sha256")),
    "checksums do not cover every media member exactly once",
  );
  const receipt = readJson(path.join(mediaDirectory, "media-receipt.json"), "media receipt");
  invariant(
    receipt.schema === "buildchain.auditable-demo-media/v2"
      && receipt.status === "passed"
      && receipt.sourceSha === passport.source.sha
      && receipt.qualifiedGateRoot === passport.gate.root
      && receipt.rendererImage === passport.toolchain.rendererImage
      && receipt.qualification?.profile?.id === passport.media.profile
      && receipt.qualificationRoot === passport.media.qualificationRoot
      && receipt.qualification?.qualificationRoot === receipt.qualificationRoot,
    "media receipt does not bind the passport",
  );
  const { qualificationRoot, ...qualificationBody } = receipt.qualification;
  invariant(
    qualificationRoot === sha256(Buffer.from(stableJson(qualificationBody))),
    "media qualification root does not verify",
  );
  invariant(
    Array.isArray(receipt.qualification.renditions),
    "media qualification renditions are missing",
  );
  const roles = new Map();
  for (const rendition of receipt.qualification.renditions) {
    invariant(
      rendition
        && typeof rendition.role === "string"
        && typeof rendition.path === "string"
        && LEGACY_MEDIA_MEMBERS.includes(rendition.path)
        && rendition.path !== "checksums.sha256"
        && !roles.has(rendition.role)
        && DIGEST.test(rendition.root || ""),
      "media qualification role mapping is invalid",
    );
    const bytes = readRegular(path.join(mediaDirectory, rendition.path), rendition.role);
    invariant(
      rendition.root === sha256(bytes) && rendition.bytes === bytes.length,
      `media qualification drifted for role ${rendition.role}`,
    );
    roles.set(rendition.role, rendition);
  }
  const expectedRoles = {
    "primary-video": ["video/mp4", 1920, 1080, "scene-exact"],
    "alternate-video": ["video/webm", 1920, 1080, "scene-exact"],
    "responsive-primary-video": [
      "video/mp4",
      1280,
      720,
      "exact-downscale-same-aspect",
    ],
    "responsive-alternate-video": [
      "video/webm",
      1280,
      720,
      "exact-downscale-same-aspect",
    ],
    "readme-compatibility": [
      "image/gif",
      1280,
      720,
      "exact-downscale-same-aspect",
    ],
    "evidence-poster": ["image/png", 1920, 1080, "scene-exact"],
  };
  for (const [role, [mimeType, width, height, dimensionPolicy]] of Object.entries(
    expectedRoles,
  )) {
    const rendition = roles.get(role);
    invariant(
      rendition
        && rendition.mimeType === mimeType
        && rendition.width === width
        && rendition.height === height
        && rendition.dimensionPolicy === dimensionPolicy,
      `qualified media role ${role} is missing or invalid`,
    );
  }
  const scene = readJson(path.join(mediaDirectory, "scene.json"), "scene");
  const durationClass = scene.durationClass ?? "standard";
  const maximumDurationMs = MAXIMUM_DURATION_MS_BY_CLASS[durationClass];
  invariant(
    scene.schema === "build-images.demo-scene/v1"
      && scene.width === 1920
      && scene.height === 1080
      && Number.isInteger(maximumDurationMs)
      && Number.isInteger(scene.durationMs)
      && scene.durationMs >= 500
      && scene.durationMs <= maximumDurationMs,
    "scene duration is invalid",
  );
  invariant(
    passport.media.profile ===
      MEDIA_PROFILE_BY_DURATION_CLASS[durationClass],
    "scene duration class and media profile do not match",
  );
  const manifest = readJson(path.join(mediaDirectory, "manifest.json"), "renderer manifest");
  invariant(
    manifest.schema === "build-images.auditable-demo-render/v1"
      && manifest.renderer?.image === passport.toolchain.rendererImage
      && manifest.policy?.evidenceClass === passport.authority.evidenceClass
      && manifest.policy?.visualClassification === "bounded-pty-replay"
      && manifest.policy?.runtimeTextAuthority === "terminal-capture.json"
      && DIGEST.test(manifest.inputs?.terminalCapture?.root || "")
      && manifest.derivation?.policy ===
        "single-frame-set-deterministic-renditions/v1",
    "renderer manifest does not prove the qualified PTY replay",
  );
  for (const rendition of roles.values()) {
    const derivation = manifest.derivation?.renditions?.[rendition.path];
    invariant(
      derivation
        && derivation.width === rendition.width
        && derivation.height === rendition.height,
      `renderer derivation is missing for role ${rendition.role}`,
    );
  }
  return {
    scene,
    roles,
    members: LEGACY_MEDIA_MEMBERS,
    transcript: null,
    nativeCaptures: [],
  };
}

function verifyDeclarativeEvidence(evidenceDirectory, passport, rawPassport, demo) {
  invariant(
    JSON.stringify(listRegularFiles(evidenceDirectory))
      === JSON.stringify(DECLARATIVE_EVIDENCE_MEMBERS),
    "declarative evidence member set is not exact",
  );
  const sourceCoordinate = readJson(
    path.join(evidenceDirectory, "source-coordinate.json"),
    "source coordinate",
  );
  invariant(
    stableJson(sourceCoordinate) === stableJson(rawPassport.source),
    "source coordinate does not match the declarative Passport",
  );
  const capture = readJson(
    path.join(evidenceDirectory, "capture-manifest.json"),
    "capture manifest",
  );
  const { root: captureRoot, ...captureBody } = capture;
  invariant(
    capture.schema === "buildchain.declarative-demo-capture/v1"
      && capture.status === "qualified"
      && capture.demo?.id === demo.id
      && capture.scenarioRoot === rawPassport.scenarioRoot
      && captureRoot === rawPassport.capture.root
      && captureRoot === sha256(Buffer.from(stableJson(captureBody)))
      && JSON.stringify(capture.authority?.grants) === "[]"
      && JSON.stringify(capture.authority?.nonAuthorities)
        === JSON.stringify(rawPassport.authority.nonAuthorities),
    "capture manifest does not bind the declarative Passport",
  );
  const publicEvidence = readJson(
    path.join(evidenceDirectory, "public-evidence.json"),
    "public evidence",
  );
  const evidencePreimage = {
    schema: "buildchain.declarative-demo-evidence-root/v1",
    scenarioRoot: rawPassport.scenarioRoot,
    captureRoot: rawPassport.capture.root,
    gateRoot: rawPassport.gate.root,
    mediaRoot: rawPassport.media.root,
    demoId: demo.id,
  };
  invariant(
    publicEvidence.schema === evidencePreimage.schema
      && publicEvidence.evidenceRoot === sha256(Buffer.from(stableJson(evidencePreimage)))
      && publicEvidence.evidenceRoot === rawPassport.evidenceRoot
      && publicEvidence.passportRoot === rawPassport.passportRoot
      && stableJson(publicEvidence.source) === stableJson(rawPassport.source)
      && Array.isArray(publicEvidence.files),
    "public evidence does not bind the declarative Passport",
  );
  const declaredFiles = [...publicEvidence.files]
    .sort((left, right) => left.path.localeCompare(right.path));
  invariant(
    JSON.stringify(declaredFiles.map(({ path: member }) => member))
      === JSON.stringify(PUBLIC_MEDIA_MEMBERS),
    "public evidence file set is not exact",
  );
  for (const file of declaredFiles) {
    const bytes = readRegular(path.join(evidenceDirectory, file.path), file.path);
    invariant(
      file.root === sha256(bytes) && file.bytes === bytes.length,
      `public evidence member ${file.path} drifted`,
    );
  }
  const receipt = readJson(
    path.join(evidenceDirectory, "media-receipt.json"),
    "media receipt",
  );
  invariant(
    receipt.schema === "buildchain.auditable-demo-media/v2"
      && receipt.status === "passed"
      && receipt.sourceSha === rawPassport.source.sourceSha
      && receipt.qualifiedGateRoot === rawPassport.gate.root
      && receipt.rendererImage === rawPassport.toolchain.rendererImage
      && receipt.qualification?.profile?.id === rawPassport.media.profile
      && receipt.qualificationRoot === rawPassport.media.qualificationRoot
      && receipt.qualification?.qualificationRoot === receipt.qualificationRoot,
    "media receipt does not bind the declarative Passport",
  );
  const { qualificationRoot, ...qualificationBody } = receipt.qualification;
  invariant(
    qualificationRoot === sha256(Buffer.from(stableJson(qualificationBody))),
    "declarative media qualification root does not verify",
  );
  const roles = new Map();
  for (const rendition of receipt.qualification.renditions || []) {
    invariant(
      rendition
        && typeof rendition.role === "string"
        && PUBLIC_MEDIA_MEMBERS.includes(rendition.path)
        && !roles.has(rendition.role)
        && DIGEST.test(rendition.root || ""),
      "declarative media role mapping is invalid",
    );
    const bytes = readRegular(path.join(evidenceDirectory, rendition.path), rendition.role);
    invariant(
      rendition.root === sha256(bytes) && rendition.bytes === bytes.length,
      `declarative media role ${rendition.role} drifted`,
    );
    roles.set(rendition.role, rendition);
  }
  const expectedRoles = {
    "primary-video": ["video/mp4", 1920, 1080],
    "alternate-video": ["video/webm", 1920, 1080],
    "responsive-primary-video": ["video/mp4", 1280, 720],
    "responsive-alternate-video": ["video/webm", 1280, 720],
    "readme-compatibility": ["image/gif", 1280, 720],
    "evidence-poster": ["image/png", 1920, 1080],
  };
  for (const [role, [mimeType, width, height]] of Object.entries(expectedRoles)) {
    const rendition = roles.get(role);
    invariant(
      rendition?.mimeType === mimeType
        && rendition.width === width
        && rendition.height === height,
      `declarative media role ${role} is missing or invalid`,
    );
  }
  const manifest = readJson(
    path.join(evidenceDirectory, "manifest.json"),
    "renderer manifest",
  );
  const sourceFrameSets = manifest.derivation?.sourceFrameSets;
  const inputRenditions = manifest.inputs?.renditions;
  invariant(
    manifest.schema === "build-images.auditable-demo-render/v1"
      && manifest.renderer?.image === rawPassport.toolchain.rendererImage
      && manifest.policy?.evidenceClass === passport.authority.evidenceClass
      && manifest.policy?.visualClassification === "bounded-pty-replay"
      && manifest.policy?.runtimeTextAuthority === "rendition-set.json"
      && manifest.derivation?.policy === "independent-native-frame-sets/v1"
      && Array.isArray(sourceFrameSets)
      && sourceFrameSets.length === 2
      && Array.isArray(inputRenditions)
      && inputRenditions.length === 2,
    "renderer manifest does not prove independent native PTY replay",
  );
  const expectedNative = [
    ["1080p", "primary", 1920, 1080],
    ["720p", "responsive", 1280, 720],
  ];
  for (const [id, role, width, height] of expectedNative) {
    const frameSet = sourceFrameSets.find((entry) => entry.id === id);
    const input = inputRenditions.find((entry) => entry.id === id);
    invariant(
      frameSet?.role === role
        && frameSet.width === width
        && frameSet.height === height
        && DIGEST.test(frameSet.captureRoot || "")
        && input?.role === role
        && input.scene?.path?.schema === "build-images.demo-scene/v1"
        && input.scene.path.width === width
        && input.scene.path.height === height
        && input.terminalCapture?.root === frameSet.captureRoot
        && input.terminalCapture?.dimensions?.columns
          === (id === "1080p" ? 150 : 100)
        && input.terminalCapture?.dimensions?.rows
          === (id === "1080p" ? 36 : 28)
        && typeof input.transcript?.path === "string"
        && input.transcript.path.length > 0
        && input.transcript.root === sha256(Buffer.from(input.transcript.path)),
      `renderer native input ${id} is invalid`,
    );
  }
  invariant(
    sourceFrameSets[0].captureRoot !== sourceFrameSets[1].captureRoot,
    "720p and 1080p must come from distinct native capture roots",
  );
  for (const rendition of roles.values()) {
    const derivation = manifest.derivation.renditions?.[rendition.path];
    invariant(
      derivation?.operation === "native-frame-set-encode"
        && derivation.width === rendition.width
        && derivation.height === rendition.height,
      `native renderer derivation is missing for ${rendition.role}`,
    );
  }
  const primary = inputRenditions.find((entry) => entry.id === "1080p");
  const responsive = inputRenditions.find((entry) => entry.id === "720p");
  const scene = primary.scene.path;
  const maximumDuration = scene.durationClass === "long-form" ? 180000 : 60000;
  invariant(
    Number.isInteger(scene.durationMs)
      && scene.durationMs >= 500
      && scene.durationMs <= maximumDuration
      && Math.abs(scene.durationMs - responsive.scene.path.durationMs) <= 1000,
    "declarative scene duration is invalid",
  );
  invariant(
    primary.transcript.path.includes(`$ ${demo.commandLabel}`),
    "declared command label is absent from the retained transcript",
  );
  return {
    scene,
    roles,
    members: DECLARATIVE_EVIDENCE_MEMBERS,
    transcript: Buffer.from(primary.transcript.path),
    nativeCaptures: sourceFrameSets.map(({ id, role, width, height, captureRoot }) => ({
      id,
      role,
      width,
      height,
      captureRoot,
    })),
  };
}

function verifyMedia(mediaDirectory, passport, rawPassport, demo, declarative) {
  return declarative
    ? verifyDeclarativeEvidence(mediaDirectory, passport, rawPassport, demo)
    : verifyLegacyMedia(mediaDirectory, passport);
}

function formatDuration(durationMs) {
  const seconds = durationMs / 1000;
  return Number.isInteger(seconds) ? `${seconds}` : seconds.toFixed(1);
}

function renderVideoSources(publicPath, roles) {
  const constrainedMp4 = roles.get("responsive-primary-video");
  const constrainedWebm = roles.get("responsive-alternate-video");
  const desktopMp4 = roles.get("primary-video");
  const desktopWebm = roles.get("alternate-video");
  return [
    [constrainedMp4, "(max-width: 767px)"],
    [constrainedWebm, "(max-width: 767px)"],
    [desktopMp4, "(min-width: 768px)"],
    [desktopWebm, "(min-width: 768px)"],
  ]
    .map(
      ([rendition, media]) =>
        `<source media="${media}" src="${escapeAttr(publicPath)}/${escapeAttr(rendition.path)}" type="${escapeAttr(rendition.mimeType)}">`,
    )
    .join("\n          ");
}

function renderEvidence(passport, demo, publicPath, scene, roles) {
  const declarative = passport.schema === "buildchain.declarative-demo-release-passport/v1";
  const runUrl = passport.workflow.url;
  const sourceUrl = `https://github.com/${passport.source.repository}/commit/${passport.source.sha}`;
  const artifactLinks = [
    ["Exact source artifact", passport.source.artifact.url],
    ...(passport.gate.artifact ? [["Passing Gate artifact", passport.gate.artifact.url]] : []),
    ...(passport.media.artifact ? [["Rendered media artifact", passport.media.artifact.url]] : []),
    ["GitHub Actions run", runUrl],
    ["Exact source commit", sourceUrl],
  ];
  const claims = passport.authority.claims
    .map((claim) => `<li>${escapeHtml(claim)}</li>`)
    .join("");
  const nonClaims = passport.authority.nonClaims
    .map((claim) => `<li>${escapeHtml(claim)}</li>`)
    .join("");
  const artifactExpiryRows = [
    passport.gate.artifact
      ? `<div><dt>Gate expires</dt><dd><time datetime="${escapeAttr(passport.gate.artifact.expiresAt)}">${escapeHtml(passport.gate.artifact.expiresAt)}</time></dd></div>`
      : "",
    passport.media.artifact
      ? `<div><dt>Media expires</dt><dd><time datetime="${escapeAttr(passport.media.artifact.expiresAt)}">${escapeHtml(passport.media.artifact.expiresAt)}</time></dd></div>`
      : "",
  ].filter(Boolean).join("\n          ");
  return `      <!-- auditable-demo-evidence:start -->
      <section class="demo-player" aria-labelledby="demo-heading">
        <div>
          <p class="eyebrow">Exact installed artifact · bounded Linux proof</p>
          <h1 id="demo-heading">Watch the artifact explain itself.</h1>
          <p class="lead">No account, hosted session, or hand-authored transcript is required. This ${formatDuration(scene.durationMs)}-second animation replays the bounded PTY output of the installed <code>${declarative ? escapeHtml(demo.commandLabel) : "kungfu agent-work-lab autoplay"}</code> command after the reusable Buildchain Gate passed.</p>
        </div>
        <video controls playsinline preload="metadata" aria-label="${declarative ? `${escapeAttr(demo.title)} exact installed-artifact demonstration` : "Exact installed Kungfu Agent Work Lab autoplay demonstration"}" poster="${escapeAttr(publicPath)}/${escapeAttr(roles.get("evidence-poster").path)}">
          ${renderVideoSources(publicPath, roles)}
          <p><a href="${escapeAttr(publicPath)}/${escapeAttr(roles.get("responsive-primary-video").path)}">Download the 720p MP4 recording.</a></p>
        </video>
        <p class="fallback">Static fallback: <a href="${escapeAttr(publicPath)}/${escapeAttr(roles.get("evidence-poster").path)}">open the exact poster</a>. Text alternative: <a href="${escapeAttr(publicPath)}/complete-transcript.txt">read the complete transcript</a>. The page never autoplays media.</p>
      </section>

      <section class="proof-grid" aria-label="Auditable demo proof">
        <article><h2>What ran</h2><p>${declarative ? `The installed Linux artifact executed its own <code>${escapeHtml(demo.commandLabel)}</code> launcher in disposable bounded PTYs.` : "The installed Linux artifact executed its own <code>kungfu agent-work-lab autoplay</code> launcher in a disposable bounded PTY."}</p></article>
        <article><h2>What passed</h2><p>${declarative ? "Two independent native terminal captures, their retained transcript, and responsive media passed the Buildchain Gate and renderer qualification." : "The exact terminal capture, transcript, public projection, and scene passed an isolated renderer smoke before full media was allowed."}</p></article>
        <article><h2>What is retained</h2><p>Source, Gate, media, toolchain, expiry, run, and canonical Passport roots remain machine-readable.</p></article>
        <article><h2>Authority boundary</h2><p>The capture grants no authority. Authorization still requires the exact Passport, Core policy, Work or Warrant, an explicit capability grant, and runtime isolation.</p></article>
      </section>

      <section class="coordinates">
        <h2>Claims from the exact Passport</h2>
        <ul>${claims}</ul>
        <h2>Explicit non-claims</h2>
        <ul>${nonClaims}</ul>
      </section>

      <section class="coordinates">
        <h2>Release Passport</h2>
        <dl>
          <div><dt>Source SHA</dt><dd><code>${escapeHtml(passport.source.sha)}</code></dd></div>
          <div><dt>Gate root</dt><dd><code>${escapeHtml(passport.gate.root)}</code></dd></div>
          <div><dt>Media root</dt><dd><code>${escapeHtml(passport.media.root)}</code></dd></div>
          <div><dt>Passport root</dt><dd><code>${escapeHtml(passport.root.value)}</code></dd></div>
          <div><dt>Buildchain</dt><dd><code>${escapeHtml(passport.toolchain.buildchainSha)}</code></dd></div>
          <div><dt>Renderer</dt><dd><code>${escapeHtml(passport.toolchain.rendererImage)}</code></dd></div>
          <div><dt>Source expires</dt><dd><time datetime="${escapeAttr(passport.source.artifact.expiresAt)}">${escapeHtml(passport.source.artifact.expiresAt)}</time></dd></div>${artifactExpiryRows ? `\n          ${artifactExpiryRows}` : ""}
        </dl>
        <nav class="evidence-links" aria-label="Exact evidence links">
          ${artifactLinks.map(([label, href]) => `<a href="${escapeAttr(href)}">${escapeHtml(label)}</a>`).join("\n          ")}
          <a href="${escapeAttr(publicPath)}/passport.json">Machine-readable Passport</a>
          <a href="/auditable-demo.json">Public site projection</a>
        </nav>
        <p class="retention-note">The original GitHub Artifacts are explicitly retained for 14 days. This site projection copies the verified public media and Passport; it does not rewrite their roots or claim that the originating workflow deployed production.</p>
      </section>
      <!-- auditable-demo-evidence:end -->`;
}

function homepagePresentation(demo) {
  if (demo.id === "project-work-recovery") {
    return {
      articleLabel: "Project Work recovery demonstration",
      title: "The Work survives",
      status: "Qualified project recovery",
      videoLabel: "Exact installed Kungfu Project Work recovery demonstration",
      headline: "One Work survives failed attempts and a fresh Agent.",
      note: "A bounded Mock Agent replay—not hosted-provider or cross-machine proof.",
      evidenceHref: "/how-tested/auditable-demo/#demo-project-work-recovery-heading",
    };
  }
  if (demo.id === "project-tour-08x") {
    return {
      articleLabel: "Kungfu Project Tour at 0.8x demonstration",
      title: "Project Tour",
      status: "Qualified 0.8x tour",
      videoLabel: "Exact standalone Kungfu Project Tour at 0.8x demonstration",
      headline: "Take the guided tour at a readable pace.",
      note: "Two native PTY captures—not a scaled replay or an authorization grant.",
      evidenceHref: "/how-tested/auditable-demo/#demo-project-tour-08x-heading",
    };
  }
  return {
    articleLabel: "Agent Work Lab demonstration",
    title: "Agent Work Lab",
    status: "Qualified replay",
    videoLabel: "Exact installed Kungfu Agent Work Lab autoplay demonstration",
    headline: "One Work. Two fresh Agent processes.",
    note: "A bounded offline replay—not provider or durability proof.",
    evidenceHref: "/how-tested/auditable-demo/",
  };
}

export function loadPresentationContract(repoRoot, source, demos) {
  if (!source.presentation) return null;
  const descriptor = source.presentation;
  invariant(
    descriptor
      && Object.keys(descriptor).sort().join(",")
        === "contractPath,contractSha256,repository,sourcePath,sourceSha"
      && descriptor.repository === "kungfu-systems/kungfu"
      && SHA.test(descriptor.sourceSha || "")
      && descriptor.sourcePath === ".buildchain/auditable-demo.json"
      && /^[0-9a-f]{64}$/u.test(descriptor.contractSha256 || "")
      && typeof descriptor.contractPath === "string"
      && descriptor.contractPath.length > 0,
    "presentation source coordinate is invalid",
  );
  const contractPath = path.resolve(repoRoot, descriptor.contractPath);
  invariant(contractPath.startsWith(`${repoRoot}${path.sep}`), "presentation contract path escapes repository");
  const contractBytes = readRegular(contractPath, "presentation contract", 1024 * 1024);
  invariant(
    sha256(contractBytes) === `sha256:${descriptor.contractSha256}`,
    "presentation contract digest does not verify",
  );
  const contract = JSON.parse(contractBytes.toString("utf8"));
  invariant(
    contract.schema === "buildchain.declarative-binary-demo/v1"
      && contract.product?.id === "kungfu"
      && contract.presentation?.schema === "buildchain.declarative-demo-presentation/v1"
      && Array.isArray(contract.presentation.proofs)
      && contract.presentation.proofs.length === 3,
    "presentation contract schema or proof count is invalid",
  );
  const demoIds = demos.map(({ id }) => id);
  const proofIds = contract.presentation.proofs.map((proof, index) => {
    invariant(
      proof
        && Object.keys(proof).sort().join(",")
          === (index < 2
            ? "demoId,label,question,summary,transitionAfter"
            : "demoId,label,question,summary")
        && DEMO_ID.test(proof.demoId || "")
        && [proof.label, proof.question, proof.summary].every(
          (value) => typeof value === "string" && value.length > 0,
        )
        && (index === 2 || (typeof proof.transitionAfter === "string" && proof.transitionAfter.length > 0)),
      `presentation proof ${index} is invalid`,
    );
    const declaredDemo = contract.demos?.find(({ id }) => id === proof.demoId);
    invariant(
      declaredDemo?.title === proof.question,
      `presentation proof ${proof.demoId} question drifts from its demo title`,
    );
    return proof.demoId;
  });
  invariant(
    new Set(proofIds).size === proofIds.length
      && proofIds.every((id) => demoIds.includes(id)),
    "presentation proof order does not bind the imported demos",
  );
  return {
    source: descriptor,
    schema: contract.presentation.schema,
    proofs: contract.presentation.proofs,
  };
}

function renderProofChapter(proof, importedDemo, proofIndex) {
  const { demo, rawPassport, publicPath, scene, roles } = importedDemo;
  const duration = formatDuration(scene.durationMs);
  const titleId = `proof-${proofIndex + 1}-title`;
  const noteId = `proof-${proofIndex + 1}-note`;
  return `      <article id="reel-proof-${proofIndex + 1}" class="demo-carousel-slide proof-chapter" role="tabpanel" aria-label="${escapeAttr(proof.question)}" data-demo-slide data-demo-title="${escapeAttr(proof.label)}" data-proof-chapter="${proofIndex + 1}" data-proof-demo-id="${escapeAttr(demo.id)}">
        <section class="proof-panel" data-proof-prelude>
          <div class="hero-demo-bar">
            <span class="hero-demo-status">Proof ${proofIndex + 1} of 3 · ${escapeHtml(proof.label)}</span>
            <span>Prelude · exact contract</span>
          </div>
          <div class="proof-prelude-canvas">
            <p class="claim-demo-kicker">${escapeHtml(proof.label)}</p>
            <h2 id="${titleId}" class="proof-question">${escapeHtml(proof.question)}</h2>
            <p class="proof-summary">${escapeHtml(proof.summary)}</p>
          </div>
          <div class="hero-demo-caption">
            <span class="hero-demo-copy"><strong>${escapeHtml(proof.transitionAfter || "The governed completion boundary is now visible.")}</strong><span>Exact media and its retained evidence remain independently inspectable.</span></span>
            <span class="hero-demo-links"><button class="hero-demo-proof-link" type="button" data-proof-start>${proofIndex === 0 ? "Watch proof" : `Start Project Tour episode ${proofIndex}`} →</button></span>
          </div>
        </section>
        <figure class="hero-demo proof-media" data-proof-media hidden>
          <div class="hero-demo-bar">
            <span class="hero-demo-status">Proof ${proofIndex + 1} of 3 · ${escapeHtml(proof.label)}</span>
            <span>Exact installed artifact · ${escapeHtml(duration)} seconds</span>
          </div>
          <video data-proof-video${proofIndex === 0 ? " data-passive-proof" : ""} controls muted playsinline preload="none" aria-label="${escapeAttr(proof.question)} exact installed-artifact demonstration" aria-describedby="${noteId}" poster="${escapeAttr(publicPath)}/${escapeAttr(roles.get("evidence-poster").path)}">
            ${renderVideoSources(publicPath, roles)}
            <p><a href="${escapeAttr(publicPath)}/${escapeAttr(roles.get("responsive-primary-video").path)}">Download the 720p MP4 replay.</a></p>
          </video>
          <figcaption>
            <span class="hero-demo-copy"><strong>${escapeHtml(proof.question)}</strong><span id="${noteId}">${escapeHtml(rawPassport.demo.claimBoundary)}</span></span>
            <span class="hero-demo-links"><a href="/how-tested/auditable-demo/#demo-${escapeAttr(demo.id)}-heading">Evidence</a><a href="${escapeAttr(publicPath)}/complete-transcript.txt">Transcript</a><a href="${escapeAttr(publicPath)}/passport.json">Passport</a></span>
          </figcaption>
        </figure>
      </article>`;
}

function renderHomepageProofReel(presentation, imports) {
  const byId = new Map(imports.map((entry) => [entry.demo.id, entry]));
  return `      <!-- auditable-demo-home:start -->
${presentation.proofs.map((proof, index) => {
    const importedDemo = byId.get(proof.demoId);
    invariant(importedDemo, `presentation proof ${proof.demoId} did not import`);
    return renderProofChapter(proof, importedDemo, index);
  }).join("\n")}
      <!-- auditable-demo-home:end -->`;
}

function renderHomepageDemo(demo, publicPath, scene, roles) {
  const duration = formatDuration(scene.durationMs);
  const presentation = homepagePresentation(demo);
  return `      <!-- auditable-demo-home:start -->
      <article class="demo-carousel-slide" aria-label="${escapeAttr(presentation.articleLabel)}" data-demo-slide data-demo-title="${escapeAttr(presentation.title)}">
        <figure class="hero-demo" aria-labelledby="hero-demo-title">
          <div class="hero-demo-bar">
            <span class="hero-demo-status">${escapeHtml(presentation.status)}</span>
            <span>Exact installed artifact · ${escapeHtml(duration)} seconds</span>
          </div>
          <video data-autoplay-demo controls muted loop playsinline preload="metadata" aria-label="${escapeAttr(presentation.videoLabel)}" aria-describedby="hero-demo-note" poster="${escapeAttr(publicPath)}/${escapeAttr(roles.get("evidence-poster").path)}">
            ${renderVideoSources(publicPath, roles)}
            <p><a href="${escapeAttr(publicPath)}/${escapeAttr(roles.get("responsive-primary-video").path)}">Download the 720p MP4 replay.</a></p>
          </video>
          <figcaption>
            <span class="hero-demo-copy"><strong id="hero-demo-title">${escapeHtml(presentation.headline)}</strong><span id="hero-demo-note">${escapeHtml(presentation.note)}</span></span>
            <span class="hero-demo-links"><a href="${escapeAttr(presentation.evidenceHref)}">How this was tested</a><a href="${escapeAttr(publicPath)}/complete-transcript.txt">Transcript</a></span>
          </figcaption>
        </figure>
      </article>
      <!-- auditable-demo-home:end -->`;
}

function renderAdditionalEvidence(passport, demo, publicPath, scene, roles) {
  const claims = passport.authority.claims
    .map((claim) => `<li>${escapeHtml(claim)}</li>`)
    .join("");
  const nonClaims = passport.authority.nonClaims
    .map((claim) => `<li>${escapeHtml(claim)}</li>`)
    .join("");
  return `
      <section class="demo-player" aria-labelledby="demo-${escapeAttr(demo.id)}-heading">
        <div>
          <p class="eyebrow">Additional exact installed-artifact demo · ${escapeHtml(demo.id)}</p>
          <h2 id="demo-${escapeAttr(demo.id)}-heading">${escapeHtml(demo.commandLabel)}</h2>
          <p class="lead">This ${formatDuration(scene.durationMs)}-second animation is selected by the exact demo id <code>${escapeHtml(demo.id)}</code>. It passed its own Gate and Passport; catalog membership alone grants no authority.</p>
        </div>
        <video controls playsinline preload="metadata" aria-label="${escapeAttr(demo.commandLabel)} exact installed-artifact demonstration" poster="${escapeAttr(publicPath)}/${escapeAttr(roles.get("evidence-poster").path)}">
          ${renderVideoSources(publicPath, roles)}
          <p><a href="${escapeAttr(publicPath)}/${escapeAttr(roles.get("responsive-primary-video").path)}">Download the 720p MP4 recording.</a></p>
        </video>
        <p class="fallback">Static fallback: <a href="${escapeAttr(publicPath)}/${escapeAttr(roles.get("evidence-poster").path)}">open the exact poster</a>. Text alternative: <a href="${escapeAttr(publicPath)}/complete-transcript.txt">read the complete transcript</a>.</p>
      </section>

      <section class="coordinates">
        <h2>${escapeHtml(demo.id)} claims</h2>
        <ul>${claims}</ul>
        <h3>Explicit non-claims</h3>
        <ul>${nonClaims}</ul>
        <dl>
          <div><dt>Demo descriptor</dt><dd><code>${escapeHtml(demo.descriptorRoot)}</code></dd></div>
          <div><dt>Gate root</dt><dd><code>${escapeHtml(passport.gate.root)}</code></dd></div>
          <div><dt>Media root</dt><dd><code>${escapeHtml(passport.media.root)}</code></dd></div>
          <div><dt>Passport root</dt><dd><code>${escapeHtml(passport.root.value)}</code></dd></div>
        </dl>
        <nav class="evidence-links" aria-label="${escapeAttr(demo.id)} exact evidence links">
          <a href="${escapeAttr(publicPath)}/passport.json">Machine-readable Passport</a>
          <a href="/auditable-demos/${escapeAttr(demo.id)}.json">Public site projection</a>
        </nav>
      </section>`;
}

function replaceEvidence(page, rendered) {
  const pattern = /      <!-- auditable-demo-evidence:start -->[\s\S]*?      <!-- auditable-demo-evidence:end -->/mu;
  invariant(pattern.test(page), "page is missing auditable-demo evidence markers");
  return page.replace(pattern, rendered);
}

function replaceHomepageDemo(page, rendered) {
  const pattern = /      <!-- auditable-demo-home:start -->[\s\S]*?      <!-- auditable-demo-home:end -->/mu;
  invariant(pattern.test(page), "homepage is missing auditable-demo markers");
  return page.replace(pattern, rendered);
}

function normalizeSources(source) {
  if (source.schema === "kungfu.site.auditable-demo-source/v1") {
    return {
      featuredDemoId: "agent-work-lab",
      homepageDemoId: "agent-work-lab",
      demos: [{
        id: "agent-work-lab",
        passport: source.passport,
        mediaDirectory: source.mediaDirectory,
      }],
      collection: false,
    };
  }
  if (source.schema === "kungfu.site.auditable-demo-source/v3") {
    invariant(
      DEMO_ID.test(source.featuredDemoId || "")
        && Array.isArray(source.demos)
        && source.demos.length >= 1
        && source.demos.length <= 8,
      "declarative source descriptor is invalid",
    );
    const demos = source.demos.map((entry, index) => {
      invariant(
        entry
          && Object.keys(entry).sort().join(",")
            === "commandLabel,evidenceDirectory,id,siteSlug"
          && DEMO_ID.test(entry.id || "")
          && typeof entry.commandLabel === "string"
          && entry.commandLabel.startsWith("kungfu ")
          && typeof entry.evidenceDirectory === "string"
          && entry.evidenceDirectory.length > 0
          && DEMO_ID.test(entry.siteSlug || ""),
        `declarative source demo ${index} is invalid`,
      );
      return {
        ...entry,
        passport: `${entry.evidenceDirectory}/release-passport.json`,
        mediaDirectory: entry.evidenceDirectory,
      };
    });
    const ids = demos.map(({ id }) => id);
    invariant(new Set(ids).size === ids.length, "declarative source demo ids must be unique");
    invariant(ids.includes(source.featuredDemoId), "declarative featured demo is absent");
    const homepageDemoId = source.homepageDemoId || source.featuredDemoId;
    invariant(ids.includes(homepageDemoId), "declarative homepage demo is absent");
    return {
      featuredDemoId: source.featuredDemoId,
      homepageDemoId,
      demos,
      collection: true,
      declarative: true,
    };
  }
  invariant(
    source.schema === "kungfu.site.auditable-demo-source/v2"
      && DEMO_ID.test(source.featuredDemoId || "")
      && Array.isArray(source.demos)
      && source.demos.length >= 1
      && source.demos.length <= 8,
    "source descriptor schema or demo collection is invalid",
  );
  const demos = source.demos.map((entry, index) => {
    invariant(
      entry && Object.keys(entry).sort().join(",") === "id,mediaDirectory,passport"
        && DEMO_ID.test(entry.id || "")
        && typeof entry.passport === "string"
        && entry.passport.length > 0
        && typeof entry.mediaDirectory === "string"
        && entry.mediaDirectory.length > 0,
      `source descriptor demo ${index} is invalid`,
    );
    return entry;
  });
  const ids = demos.map(({ id }) => id);
  invariant(new Set(ids).size === ids.length, "source descriptor demo ids must be unique");
  invariant(ids.includes(source.featuredDemoId), "featured demo id is not declared");
  const homepageDemoId = source.homepageDemoId || source.featuredDemoId;
  invariant(
    DEMO_ID.test(homepageDemoId) && ids.includes(homepageDemoId),
    "homepage demo id is not declared",
  );
  return {
    featuredDemoId: source.featuredDemoId,
    homepageDemoId,
    demos,
    collection: true,
    declarative: false,
  };
}

function siteProjection(passport, demo, publicPath, roles, nativeCaptures, scene) {
  return {
    schema: "kungfu.site.auditable-demo/v2",
    status: "qualified",
    demo,
    sourceSha: passport.source.sha,
    evidenceClass: passport.authority.evidenceClass,
    gateRoot: passport.gate.root,
    mediaRoot: passport.media.root,
    passportRoot: passport.root.value,
    buildchainSha: passport.toolchain.buildchainSha,
    rendererImage: passport.toolchain.rendererImage,
    workflowUrl: passport.workflow.url,
    publicEvidencePath: publicPath,
    mediaProfile: passport.media.profile,
    mediaQualificationRoot: passport.media.qualificationRoot,
    ...(nativeCaptures.length > 0 ? {
      durationClass: scene.durationClass || "standard",
      nativeCaptures,
    } : {}),
    renditions: Object.fromEntries(
      [...roles.entries()].map(([role, rendition]) => [
        role,
        {
          path: rendition.path,
          mimeType: rendition.mimeType,
          width: rendition.width,
          height: rendition.height,
          root: rendition.root,
        },
      ]),
    ),
    claims: passport.authority.claims,
    nonClaims: passport.authority.nonClaims,
  };
}

export function importAuditableDemo({
  repoRoot,
  sourcePath,
  outputRoot,
  checkOnly = false,
}) {
  const source = readJson(sourcePath, "source descriptor");
  const normalizedSource = normalizeSources(source);
  const presentation = loadPresentationContract(
    repoRoot,
    source,
    normalizedSource.demos,
  );
  const pagePath = path.join(outputRoot, "how-tested/auditable-demo/index.html");
  const homepagePath = path.join(outputRoot, "index.html");
  const projectionPath = path.join(outputRoot, "auditable-demo.json");
  const expected = new Map();
  const imports = [];
  for (const entry of normalizedSource.demos) {
    const passportPath = path.resolve(repoRoot, entry.passport);
    const mediaDirectory = path.resolve(repoRoot, entry.mediaDirectory);
    invariant(passportPath.startsWith(`${repoRoot}${path.sep}`), "passport path escapes repository");
    invariant(mediaDirectory.startsWith(`${repoRoot}${path.sep}`), "media path escapes repository");
    const verified = verifyPassport(
      readJson(passportPath, "passport"),
      entry,
      normalizedSource.featuredDemoId,
    );
    const { passport, demo, rawPassport, declarative } = verified;
    invariant(entry.id === demo.id, `source demo id ${entry.id} does not match its Passport`);
    invariant(
      demo.publication.readmeFeatured === (entry.id === normalizedSource.featuredDemoId),
      `demo ${entry.id} README feature status drifts from the source descriptor`,
    );
    const { scene, roles, members, transcript, nativeCaptures } = verifyMedia(
      mediaDirectory,
      passport,
      rawPassport,
      demo,
      declarative,
    );
    const rootName = passport.root.value.slice(7);
    const publicPath = declarative
      ? `/evidence/auditable-demo/${rootName}/${demo.id}`
      : demo.id === "agent-work-lab" && demo.publication.readmeFeatured
        ? `/evidence/auditable-demo/${rootName}`
        : `/evidence/auditable-demo/${demo.publication.siteSlug}/${rootName}`;
    const evidenceDirectory = path.join(outputRoot, publicPath);
    for (const member of members) {
      expected.set(
        path.join(evidenceDirectory, member),
        readRegular(path.join(mediaDirectory, member), member),
      );
    }
    if (transcript) {
      expected.set(path.join(evidenceDirectory, "complete-transcript.txt"), transcript);
    }
    expected.set(
      path.join(evidenceDirectory, "passport.json"),
      Buffer.from(stableJson(rawPassport)),
    );
    const projection = siteProjection(
      passport,
      demo,
      publicPath,
      roles,
      nativeCaptures,
      scene,
    );
    imports.push({ passport, rawPassport, demo, scene, roles, publicPath, projection });
    if (normalizedSource.collection) {
      expected.set(
        path.join(outputRoot, "auditable-demos", `${demo.id}.json`),
        Buffer.from(stableJson(projection)),
      );
    }
  }
  const featured = imports.find(({ demo }) => demo.id === normalizedSource.featuredDemoId);
  invariant(featured, "featured demo did not import");
  expected.set(
    projectionPath,
    Buffer.from(
      stableJson(
        normalizedSource.collection
          ? featured.projection
          : {
            ...featured.projection,
            schema: "kungfu.site.auditable-demo/v1",
            demo: undefined,
          },
      ),
    ),
  );
  if (normalizedSource.collection) {
    expected.set(
      path.join(outputRoot, "auditable-demos.json"),
      Buffer.from(stableJson({
        schema: "kungfu.site.auditable-demo-collection/v1",
        status: "qualified",
        featuredDemoId: featured.demo.id,
        homepageDemoId: normalizedSource.homepageDemoId,
        ...(presentation ? {
          presentation: {
            schema: presentation.schema,
            source: presentation.source,
            proofs: presentation.proofs.map((proof) => {
              const imported = imports.find(({ demo }) => demo.id === proof.demoId);
              invariant(imported, `presentation projection ${proof.demoId} did not import`);
              return {
                ...proof,
                projectionPath: `/auditable-demos/${proof.demoId}.json`,
                passportRoot: imported.projection.passportRoot,
                mediaRoot: imported.projection.mediaRoot,
              };
            }),
          },
        } : {}),
        demos: imports
          .map(({ projection }) => ({
            id: projection.demo.id,
            siteSlug: projection.demo.publication.siteSlug,
            projectionPath: `/auditable-demos/${projection.demo.id}.json`,
            passportRoot: projection.passportRoot,
            mediaRoot: projection.mediaRoot,
          }))
          .sort((left, right) => left.id.localeCompare(right.id)),
      })),
    );
  }
  const pageBefore = readRegular(pagePath, "auditable demo page").toString("utf8");
  let rendered = renderEvidence(
    featured.passport,
    featured.demo,
    featured.publicPath,
    featured.scene,
    featured.roles,
  );
  const additional = imports
    .filter(({ demo }) => demo.id !== featured.demo.id)
    .sort((left, right) => left.demo.id.localeCompare(right.demo.id))
    .map(({ passport, demo, publicPath, scene, roles }) =>
      renderAdditionalEvidence(passport, demo, publicPath, scene, roles),
    )
    .join("");
  if (additional) {
    rendered = rendered.replace(
      "      <!-- auditable-demo-evidence:end -->",
      `${additional}\n      <!-- auditable-demo-evidence:end -->`,
    );
  }
  expected.set(
    pagePath,
    Buffer.from(replaceEvidence(pageBefore, rendered)),
  );
  const homepageBefore = readRegular(homepagePath, "homepage").toString("utf8");
  const homepageDemo = imports.find(
    ({ demo }) => demo.id === normalizedSource.homepageDemoId,
  );
  invariant(homepageDemo, "homepage demo did not import");
  expected.set(
    homepagePath,
    Buffer.from(
      replaceHomepageDemo(
        homepageBefore,
        presentation
          ? renderHomepageProofReel(presentation, imports)
          : renderHomepageDemo(
            homepageDemo.demo,
            homepageDemo.publicPath,
            homepageDemo.scene,
            homepageDemo.roles,
          ),
      ),
    ),
  );

  const drift = [];
  for (const [target, bytes] of expected) {
    if (!fs.existsSync(target) || !readRegular(target, path.relative(repoRoot, target)).equals(bytes)) {
      drift.push(target);
      if (!checkOnly) {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, bytes);
      }
    }
  }
  if (checkOnly) {
    invariant(drift.length === 0, `generated publication drift: ${drift.map((item) => path.relative(repoRoot, item)).join(", ")}`);
  }
  return {
    passport: featured.passport,
    publicPath: featured.publicPath,
    demos: imports,
    changed: drift.length > 0,
  };
}

function parseArguments(argv) {
  const checkOnly = argv.includes("--check");
  const values = argv.filter((entry) => entry !== "--check");
  invariant(values.length === 0 || (values.length === 2 && values[0] === "--source"), "usage: import-auditable-demo.mjs [--source PATH] [--check]");
  return { checkOnly, source: values[1] || "site/auditable-demo-source.json" };
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  try {
    const args = parseArguments(process.argv.slice(2));
    const repoRoot = process.cwd();
    const result = importAuditableDemo({
      repoRoot,
      sourcePath: path.resolve(repoRoot, args.source),
      outputRoot: path.join(repoRoot, "public"),
      checkOnly: args.checkOnly,
    });
    console.log(`${result.changed ? "imported" : "verified"} auditable demo ${result.passport.root.value}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
