// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { importAuditableDemo } from "./import-auditable-demo.mjs";

function sha256(bytes) {
  return `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
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

function assertMp4BeforeWebm(html) {
  const videos = [...html.matchAll(/<video\b[\s\S]*?<\/video>/giu)]
    .map(([video]) => video)
    .filter((video) => video.includes('type="video/mp4"') && video.includes('type="video/webm"'));
  assert.ok(videos.length > 0, "expected at least one MP4 and WebM video source pair");
  for (const video of videos) {
    assert.ok(
      video.indexOf('type="video/mp4"') < video.indexOf('type="video/webm"'),
      "MP4 must precede WebM in each video source list",
    );
  }
}

function fixture() {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "auditable-demo-site-"));
  const mediaDirectory = path.join(repoRoot, "site/auditable-demo/media");
  const outputRoot = path.join(repoRoot, "public");
  fs.mkdirSync(mediaDirectory, { recursive: true });
  fs.mkdirSync(path.join(outputRoot, "how-tested/auditable-demo"), { recursive: true });
  const sourceSha = "1".repeat(40);
  const gateRoot = `sha256:${"2".repeat(64)}`;
  const rendererImage =
    `ghcr.io/kungfu-systems/build-images/demo-renderer@sha256:${"3".repeat(64)}`;
  const members = {
    "complete-transcript.txt": Buffer.from("kungfu agent-work-lab autoplay\nqualified\n"),
    "demo.gif": Buffer.from("gif"),
    "demo-720p.mp4": Buffer.from("720p mp4"),
    "demo-720p.webm": Buffer.from("720p webm"),
    "demo.mp4": Buffer.from("mp4"),
    "demo.webm": Buffer.from("webm"),
    "gate-receipt.json": Buffer.from("{}\n"),
    "manifest.json": Buffer.from(stableJson({
      schema: "build-images.auditable-demo-render/v1",
      renderer: { image: rendererImage },
      policy: {
        evidenceClass: "exact-installed-artifact-agent-work-lab-autoplay/v1",
        visualClassification: "bounded-pty-replay",
        runtimeTextAuthority: "terminal-capture.json",
      },
      inputs: {
        terminalCapture: { root: `sha256:${"9".repeat(64)}` },
      },
      derivation: {
        policy: "single-frame-set-deterministic-renditions/v1",
        renditions: {
          "demo.mp4": { width: 1920, height: 1080 },
          "demo.webm": { width: 1920, height: 1080 },
          "demo-720p.mp4": { width: 1280, height: 720 },
          "demo-720p.webm": { width: 1280, height: 720 },
          "demo.gif": { width: 1280, height: 720 },
          "poster.png": { width: 1920, height: 1080 },
        },
      },
    })),
    "media-inspection.json": Buffer.from('{"passed":true}\n'),
    "media-probe.json": Buffer.from('{"passed":true}\n'),
    "poster.png": Buffer.from("png"),
    "public-projection.json": Buffer.from("{}\n"),
    "renderer-checksums.sha256": Buffer.from("renderer\n"),
    "scene.json": Buffer.from(stableJson({
      schema: "build-images.demo-scene/v1",
      width: 1920,
      height: 1080,
      durationMs: 18500,
    })),
  };
  const renditionSpecs = [
    ["primary-video", "demo.mp4", "video/mp4", 1920, 1080, "scene-exact"],
    [
      "alternate-video",
      "demo.webm",
      "video/webm",
      1920,
      1080,
      "scene-exact",
    ],
    [
      "responsive-primary-video",
      "demo-720p.mp4",
      "video/mp4",
      1280,
      720,
      "exact-downscale-same-aspect",
    ],
    [
      "responsive-alternate-video",
      "demo-720p.webm",
      "video/webm",
      1280,
      720,
      "exact-downscale-same-aspect",
    ],
    [
      "readme-compatibility",
      "demo.gif",
      "image/gif",
      1280,
      720,
      "exact-downscale-same-aspect",
    ],
    [
      "evidence-poster",
      "poster.png",
      "image/png",
      1920,
      1080,
      "scene-exact",
    ],
  ];
  const qualificationBody = {
    schema: "buildchain.auditable-demo-media-qualification/v1",
    profile: { id: "responsive-web-delivery-v1" },
    inspectionRoot: `sha256:${"4".repeat(64)}`,
    renditions: renditionSpecs.map(
      ([role, file, mimeType, width, height, dimensionPolicy]) => ({
        role,
        path: file,
        mimeType,
        width,
        height,
        dimensionPolicy,
        root: sha256(members[file]),
        bytes: members[file].length,
      }),
    ),
    nonClaims: [],
  };
  const qualification = {
    ...qualificationBody,
    qualificationRoot: sha256(Buffer.from(stableJson(qualificationBody))),
  };
  members["media-receipt.json"] = Buffer.from(stableJson({
    schema: "buildchain.auditable-demo-media/v2",
    status: "passed",
    sourceSha,
    qualifiedGateRoot: gateRoot,
    rendererImage,
    rendererManifestRoot: `sha256:${"4".repeat(64)}`,
    qualification,
    qualificationRoot: qualification.qualificationRoot,
  }));
  for (const [name, bytes] of Object.entries(members)) {
    fs.writeFileSync(path.join(mediaDirectory, name), bytes);
  }
  const checksums = `${Object.keys(members).sort().map((name) => `${sha256(members[name]).slice(7)}  ${name}`).join("\n")}\n`;
  fs.writeFileSync(path.join(mediaDirectory, "checksums.sha256"), checksums);
  const payload = {
    schema: "kungfu.auditable-demo.release-passport/v1",
    status: "qualified",
    source: {
      repository: "kungfu-systems/kungfu",
      sha: sourceSha,
      artifact: {
        id: "101",
        name: `kungfu-linux-x64-${sourceSha}`,
        digest: `sha256:${"5".repeat(64)}`,
        url: "https://github.com/kungfu-systems/kungfu/actions/runs/99/artifacts/101",
        expiresAt: "2026-08-08T00:00:00.000Z",
      },
    },
    gate: {
      status: "passed",
      root: gateRoot,
      artifact: {
        id: "102",
        name: `auditable-demo-gate-${sourceSha.slice(0, 12)}-${gateRoot.slice(7, 23)}`,
        digest: `sha256:${"6".repeat(64)}`,
        url: "https://github.com/kungfu-systems/kungfu/actions/runs/99/artifacts/102",
        expiresAt: "2026-08-08T00:00:00.000Z",
      },
    },
    media: {
      status: "rendered",
      root: sha256(Buffer.from(checksums)),
      profile: "responsive-web-delivery-v1",
      qualificationRoot: qualification.qualificationRoot,
      artifact: {
        id: "103",
        name: `auditable-demo-media-${sourceSha.slice(0, 12)}-${sha256(Buffer.from(checksums)).slice(7, 23)}`,
        digest: `sha256:${"7".repeat(64)}`,
        url: "https://github.com/kungfu-systems/kungfu/actions/runs/99/artifacts/103",
        expiresAt: "2026-08-08T00:00:00.000Z",
      },
    },
    workflow: {
      repository: "kungfu-systems/kungfu",
      runId: "99",
      runAttempt: "1",
      url: "https://github.com/kungfu-systems/kungfu/actions/runs/99",
    },
    toolchain: {
      buildchainSha: "8".repeat(40),
      rendererImage,
    },
    authority: {
      evidenceClass: "exact-installed-artifact-agent-work-lab-autoplay/v1",
      publication: "github-artifacts-only",
      productionDeployment: false,
      authorization: {
        status: "not-granted-by-demo",
        requiredSources: [
          "exact-release-passport",
          "core-policy",
          "work-or-warrant",
          "explicit-capability-grant",
          "runtime-isolation",
        ],
        nonAuthorities: [
          "first-party-identity",
          "system-identity",
          "kfd-compliance",
          "product-system-metadata",
          "local-bundle-presence",
          "package-metadata",
          "registry-history",
          "scan-output",
          "standalone-generation",
        ],
      },
      claims: ["exact autoplay artifact ran", "bounded PTY Gate passed"],
      nonClaims: ["durability", "performance", "implicit identity authority"],
    },
  };
  const passport = {
    ...payload,
    root: {
      algorithm: "sha256",
      profile: "sorted-object-json-utf8-lf/v1",
      value: sha256(Buffer.from(stableJson(payload))),
    },
  };
  const passportPath = path.join(repoRoot, "site/auditable-demo/passport.json");
  fs.writeFileSync(passportPath, stableJson(passport));
  const sourcePath = path.join(repoRoot, "site/auditable-demo-source.json");
  fs.writeFileSync(sourcePath, stableJson({
    schema: "kungfu.site.auditable-demo-source/v1",
    passport: "site/auditable-demo/passport.json",
    mediaDirectory: "site/auditable-demo/media",
  }));
  fs.writeFileSync(
    path.join(outputRoot, "how-tested/auditable-demo/index.html"),
    "<main>\n      <!-- auditable-demo-evidence:start -->\n      fixture\n      <!-- auditable-demo-evidence:end -->\n</main>\n",
  );
  fs.writeFileSync(
    path.join(outputRoot, "index.html"),
    "<main>\n<div data-demo-carousel><div data-carousel-track>\n<article data-demo-slide data-demo-title=\"The pain\" data-active>pain</article>\n      <!-- auditable-demo-home:start -->\n      fixture\n      <!-- auditable-demo-home:end -->\n</div></div>\n</main>\n",
  );
  return { repoRoot, sourcePath, outputRoot, passport };
}

function rebindMedia(repoRoot) {
  const mediaDirectory = path.join(repoRoot, "site/auditable-demo/media");
  const members = fs.readdirSync(mediaDirectory).filter((name) => name !== "checksums.sha256").sort();
  const checksums = `${members.map((name) => `${sha256(fs.readFileSync(path.join(mediaDirectory, name))).slice(7)}  ${name}`).join("\n")}\n`;
  fs.writeFileSync(path.join(mediaDirectory, "checksums.sha256"), checksums);
  const passportPath = path.join(repoRoot, "site/auditable-demo/passport.json");
  const passport = JSON.parse(fs.readFileSync(passportPath, "utf8"));
  passport.media.root = sha256(Buffer.from(checksums));
  passport.media.artifact.name =
    `auditable-demo-media-${passport.source.sha.slice(0, 12)}-${passport.media.root.slice(7, 23)}`;
  const { root: ignoredRoot, ...payload } = passport;
  passport.root.value = sha256(Buffer.from(stableJson(payload)));
  fs.writeFileSync(passportPath, stableJson(passport));
}

function setDurationPolicy(input, {
  durationMs,
  durationClass,
  profile,
}) {
  const mediaDirectory = path.join(input.repoRoot, "site/auditable-demo/media");
  const scenePath = path.join(mediaDirectory, "scene.json");
  const scene = JSON.parse(fs.readFileSync(scenePath, "utf8"));
  scene.durationMs = durationMs;
  if (durationClass === undefined) delete scene.durationClass;
  else scene.durationClass = durationClass;
  fs.writeFileSync(scenePath, stableJson(scene));

  const receiptPath = path.join(mediaDirectory, "media-receipt.json");
  const receipt = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
  receipt.qualification.profile.id = profile;
  const { qualificationRoot: ignoredQualificationRoot, ...qualificationBody } =
    receipt.qualification;
  receipt.qualification.qualificationRoot = sha256(
    Buffer.from(stableJson(qualificationBody)),
  );
  receipt.qualificationRoot = receipt.qualification.qualificationRoot;
  fs.writeFileSync(receiptPath, stableJson(receipt));

  const passportPath = path.join(input.repoRoot, "site/auditable-demo/passport.json");
  const passport = JSON.parse(fs.readFileSync(passportPath, "utf8"));
  passport.media.profile = profile;
  passport.media.qualificationRoot = receipt.qualificationRoot;
  fs.writeFileSync(passportPath, stableJson(passport));
  rebindMedia(input.repoRoot);
}

function addSecondaryDemo(input, {
  id = "status-snapshot",
  commandLabel = "kungfu status --snapshot --no-interaction",
  evidenceClass = "exact-installed-artifact-status-snapshot/v1",
  homepage = false,
} = {}) {
  const secondaryRoot = path.join(input.repoRoot, "site/auditable-demo-secondary");
  const secondaryMedia = path.join(secondaryRoot, "media");
  fs.mkdirSync(secondaryRoot, { recursive: true });
  fs.cpSync(
    path.join(input.repoRoot, "site/auditable-demo/media"),
    secondaryMedia,
    { recursive: true },
  );
  const manifestPath = path.join(secondaryMedia, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.policy.evidenceClass = evidenceClass;
  fs.writeFileSync(manifestPath, stableJson(manifest));
  fs.writeFileSync(
    path.join(secondaryMedia, "complete-transcript.txt"),
    `${commandLabel}\nqualified\n`,
  );
  const members = fs
    .readdirSync(secondaryMedia)
    .filter((name) => name !== "checksums.sha256")
    .sort();
  const checksums =
    `${members
      .map(
        (name) =>
          `${sha256(fs.readFileSync(path.join(secondaryMedia, name))).slice(7)}  ${name}`,
      )
      .join("\n")}\n`;
  fs.writeFileSync(path.join(secondaryMedia, "checksums.sha256"), checksums);
  const payload = structuredClone(input.passport);
  delete payload.root;
  payload.schema = "kungfu.auditable-demo.release-passport/v2";
  payload.demo = {
    id,
    catalogRoot: `sha256:${"a".repeat(64)}`,
    descriptorRoot: `sha256:${"b".repeat(64)}`,
    commandLabel,
    evidenceClass,
    sceneId: `kungfu-${id}`,
    publication: {
      readmeFeatured: false,
      siteSlug: id,
    },
  };
  payload.authority.evidenceClass = evidenceClass;
  payload.authority.claims = [`exact ${id} artifact ran`];
  payload.authority.nonClaims = ["general production behavior"];
  payload.gate.artifact.id = "202";
  payload.gate.artifact.url =
    `${payload.workflow.url}/artifacts/${payload.gate.artifact.id}`;
  payload.media.root = sha256(Buffer.from(checksums));
  payload.media.artifact.id = "203";
  payload.media.artifact.url =
    `${payload.workflow.url}/artifacts/${payload.media.artifact.id}`;
  payload.media.artifact.name =
    `auditable-demo-media-${payload.source.sha.slice(0, 12)}-` +
    `${payload.media.root.slice(7, 23)}`;
  const passport = {
    ...payload,
    root: {
      algorithm: "sha256",
      profile: "sorted-object-json-utf8-lf/v1",
      value: sha256(Buffer.from(stableJson(payload))),
    },
  };
  fs.writeFileSync(
    path.join(secondaryRoot, "passport.json"),
    stableJson(passport),
  );
  fs.writeFileSync(input.sourcePath, stableJson({
    schema: "kungfu.site.auditable-demo-source/v2",
    featuredDemoId: "agent-work-lab",
    ...(homepage ? { homepageDemoId: id } : {}),
    demos: [
      {
        id: "agent-work-lab",
        passport: "site/auditable-demo/passport.json",
        mediaDirectory: "site/auditable-demo/media",
      },
      {
        id,
        passport: "site/auditable-demo-secondary/passport.json",
        mediaDirectory: "site/auditable-demo-secondary/media",
      },
    ],
  }));
  return passport;
}

function declarativeFixture() {
  const input = fixture();
  const evidenceDirectory = path.join(input.repoRoot, "site/auditable-demo/media");
  const commandLabel = "kungfu agent-work-lab autoplay";
  for (const member of [
    "checksums.sha256",
    "complete-transcript.txt",
    "public-projection.json",
    "scene.json",
  ]) {
    fs.rmSync(path.join(evidenceDirectory, member));
  }
  const transcript = `$ ${commandLabel}\nKUNGFU_TUI_DEMO_COMPLETE\n`;
  const primaryRoot = `sha256:${"a".repeat(64)}`;
  const responsiveRoot = `sha256:${"b".repeat(64)}`;
  const scene = (id, width, height) => ({
    schema: "build-images.demo-scene/v1",
    id: `agent-work-lab-autoplay-${id}`,
    title: "Kungfu Agent Work Lab autoplay",
    commandLabel,
    width,
    height,
    fps: 10,
    durationMs: 3800,
    durationClass: "long-form",
    accent: "#67e8a5",
    background: "#0b1020",
  });
  const renditionRows = [
    ["demo.mp4", 1920, 1080],
    ["demo.webm", 1920, 1080],
    ["demo-720p.mp4", 1280, 720],
    ["demo-720p.webm", 1280, 720],
    ["demo.gif", 1280, 720],
    ["poster.png", 1920, 1080],
  ];
  const manifest = {
    schema: "build-images.auditable-demo-render/v1",
    renderer: {
      image: `ghcr.io/kungfu-systems/build-images/demo-renderer@sha256:${"3".repeat(64)}`,
    },
    policy: {
      evidenceClass: "exact-standalone-binary-declarative-demo/v1",
      visualClassification: "bounded-pty-replay",
      runtimeTextAuthority: "rendition-set.json",
    },
    inputs: {
      renditions: [
        {
          id: "1080p",
          role: "primary",
          scene: { path: scene("1080p", 1920, 1080) },
          terminalCapture: {
            root: primaryRoot,
            dimensions: { columns: 150, rows: 36 },
          },
          transcript: { path: transcript, root: sha256(Buffer.from(transcript)) },
        },
        {
          id: "720p",
          role: "responsive",
          scene: { path: scene("720p", 1280, 720) },
          terminalCapture: {
            root: responsiveRoot,
            dimensions: { columns: 150, rows: 28 },
          },
          transcript: { path: transcript, root: sha256(Buffer.from(transcript)) },
        },
      ],
    },
    derivation: {
      policy: "independent-native-frame-sets/v1",
      sourceFrameSets: [
        { id: "1080p", role: "primary", width: 1920, height: 1080, captureRoot: primaryRoot },
        { id: "720p", role: "responsive", width: 1280, height: 720, captureRoot: responsiveRoot },
      ],
      renditions: Object.fromEntries(
        renditionRows.map(([member, width, height]) => [member, {
          operation: "native-frame-set-encode",
          width,
          height,
        }]),
      ),
    },
  };
  fs.writeFileSync(path.join(evidenceDirectory, "manifest.json"), stableJson(manifest));
  const mediaReceiptPath = path.join(evidenceDirectory, "media-receipt.json");
  const mediaReceipt = JSON.parse(fs.readFileSync(mediaReceiptPath, "utf8"));
  mediaReceipt.qualification.profile.id = "responsive-long-form-web-delivery-v1";
  const { qualificationRoot: ignoredQualificationRoot, ...qualificationBody } =
    mediaReceipt.qualification;
  mediaReceipt.qualification.qualificationRoot = sha256(
    Buffer.from(stableJson(qualificationBody)),
  );
  mediaReceipt.qualificationRoot = mediaReceipt.qualification.qualificationRoot;
  fs.writeFileSync(mediaReceiptPath, stableJson(mediaReceipt));
  const source = {
    schema: "buildchain.github-artifact-coordinate/v1",
    repository: "kungfu-systems/kungfu",
    sourceSha: "1".repeat(40),
    runId: "99",
    runAttempt: "1",
    id: "101",
    nodeId: "fixture",
    name: `kungfu-linux-x64-${"1".repeat(40)}`,
    digest: `sha256:${"5".repeat(64)}`,
    sizeInBytes: 1024,
    createdAt: "2026-08-01T00:00:00.000Z",
    expiresAt: "2026-08-15T00:00:00.000Z",
  };
  fs.writeFileSync(
    path.join(evidenceDirectory, "source-coordinate.json"),
    stableJson(source),
  );
  const nonAuthorities = [
    "first-party-identity",
    "system-identity",
    "kfd-compliance",
    "product-system-metadata",
    "package-metadata",
    "registry-history",
    "scan-output",
    "standalone-generation",
  ];
  const captureBody = {
    schema: "buildchain.declarative-demo-capture/v1",
    status: "qualified",
    demo: {
      id: "agent-work-lab-autoplay",
      title: "Kungfu Agent Work Lab autoplay",
      claimBoundary: "This bounded demo grants no product or runtime authority.",
    },
    scenarioRoot: `sha256:${"6".repeat(64)}`,
    artifact: {
      platformId: "linux-x64",
      binaryRoot: `sha256:${"7".repeat(64)}`,
      metadataRoot: `sha256:${"8".repeat(64)}`,
      metadataContract: "kungfu.declarative-demo-binary/v1",
      runtimeDependencies: [],
    },
    networkIsolation: "job-container-none",
    sourceCoordinateRoot: sha256(Buffer.from(stableJson(source))),
    renditions: [],
    authority: {
      classification: "capture-source-evidence",
      grants: [],
      nonAuthorities,
    },
  };
  const capture = {
    ...captureBody,
    root: sha256(Buffer.from(stableJson(captureBody))),
  };
  fs.writeFileSync(
    path.join(evidenceDirectory, "capture-manifest.json"),
    stableJson(capture),
  );
  fs.writeFileSync(
    path.join(evidenceDirectory, "qualified-gate-receipt.json"),
    stableJson({ schema: "buildchain.auditable-demo-gate/v1", status: "passed" }),
  );
  const passportBody = {
    schema: "buildchain.declarative-demo-release-passport/v1",
    status: "qualified",
    product: { id: "kungfu", displayName: "Kungfu", binaryName: "kungfu" },
    demo: capture.demo,
    evidenceRoot: "",
    scenarioRoot: capture.scenarioRoot,
    capture: {
      root: capture.root,
      binary: capture.artifact,
      networkIsolation: capture.networkIsolation,
    },
    source,
    gate: { root: mediaReceipt.qualifiedGateRoot },
    media: {
      root: `sha256:${"9".repeat(64)}`,
      profile: "responsive-long-form-web-delivery-v1",
      qualificationRoot: mediaReceipt.qualificationRoot,
    },
    toolchain: {
      buildchainSha: "2".repeat(40),
      rendererImage: manifest.renderer.image,
    },
    authority: {
      grants: [],
      nonAuthorities,
      authorizationSources: [
        "exact-release-passport",
        "core-policy",
        "work-or-warrant",
        "explicit-capability-grant",
        "runtime-isolation",
      ],
      productSystemRole: "assembly-and-distribution-metadata-only",
    },
  };
  const evidencePreimage = {
    schema: "buildchain.declarative-demo-evidence-root/v1",
    scenarioRoot: passportBody.scenarioRoot,
    captureRoot: passportBody.capture.root,
    gateRoot: passportBody.gate.root,
    mediaRoot: passportBody.media.root,
    demoId: passportBody.demo.id,
  };
  passportBody.evidenceRoot = sha256(Buffer.from(stableJson(evidencePreimage)));
  const passport = {
    ...passportBody,
    passportRoot: sha256(Buffer.from(stableJson(passportBody))),
  };
  fs.writeFileSync(
    path.join(evidenceDirectory, "release-passport.json"),
    stableJson(passport),
  );
  const publicMembers = renditionRows.map(([member]) => member).sort().concat([
    "gate-receipt.json",
    "manifest.json",
    "media-inspection.json",
    "media-probe.json",
    "media-receipt.json",
    "renderer-checksums.sha256",
  ]).sort();
  fs.writeFileSync(
    path.join(evidenceDirectory, "public-evidence.json"),
    stableJson({
      ...evidencePreimage,
      evidenceRoot: passport.evidenceRoot,
      passportRoot: passport.passportRoot,
      source,
      files: publicMembers.map((member) => {
        const bytes = fs.readFileSync(path.join(evidenceDirectory, member));
        return { path: member, root: sha256(bytes), bytes: bytes.length };
      }),
    }),
  );
  fs.writeFileSync(input.sourcePath, stableJson({
    schema: "kungfu.site.auditable-demo-source/v3",
    featuredDemoId: "agent-work-lab-autoplay",
    homepageDemoId: "agent-work-lab-autoplay",
    demos: [{
      id: "agent-work-lab-autoplay",
      commandLabel,
      siteSlug: "agent-work-lab",
      evidenceDirectory: "site/auditable-demo/media",
    }],
  }));
  return { ...input, passport, evidenceDirectory };
}

test("imports exact media and a source-bound public projection", () => {
  const input = fixture();
  try {
    const result = importAuditableDemo(input);
    assert.equal(result.changed, true);
    assert.equal(result.passport.root.value, input.passport.root.value);
    const projection = JSON.parse(fs.readFileSync(path.join(input.outputRoot, "auditable-demo.json"), "utf8"));
    assert.equal(projection.passportRoot, input.passport.root.value);
    assert.equal(projection.sourceSha, input.passport.source.sha);
    assert.deepEqual(projection.claims, input.passport.authority.claims);
    assert.deepEqual(projection.nonClaims, input.passport.authority.nonClaims);
    assert.equal(projection.mediaProfile, "responsive-web-delivery-v1");
    assert.equal(
      projection.mediaQualificationRoot,
      input.passport.media.qualificationRoot,
    );
    assert.deepEqual(
      [
        projection.renditions["responsive-primary-video"].width,
        projection.renditions["responsive-primary-video"].height,
      ],
      [1280, 720],
    );
    assert.deepEqual(
      [
        projection.renditions["primary-video"].width,
        projection.renditions["primary-video"].height,
      ],
      [1920, 1080],
    );
    const evidencePage = fs.readFileSync(
      path.join(input.outputRoot, "how-tested/auditable-demo/index.html"),
      "utf8",
    );
    assert.match(evidencePage, /Watch the artifact explain itself\./u);
    assertMp4BeforeWebm(evidencePage);
    assert.match(
      fs.readFileSync(path.join(input.outputRoot, "how-tested/auditable-demo/index.html"), "utf8"),
      /18\.5-second animation/u,
    );
    assert.match(
      fs.readFileSync(path.join(input.outputRoot, "how-tested/auditable-demo/index.html"), "utf8"),
      /read the complete transcript/u,
    );
    assert.match(
      fs.readFileSync(path.join(input.outputRoot, "how-tested/auditable-demo/index.html"), "utf8"),
      /kungfu agent-work-lab autoplay/u,
    );
    assert.match(
      evidencePage,
      /media="\(max-width: 767px\)" src="[^"]+\/demo-720p\.mp4"/u,
    );
    assert.match(
      evidencePage,
      /media="\(min-width: 768px\)" src="[^"]+\/demo\.mp4"/u,
    );
    const homepage = fs.readFileSync(path.join(input.outputRoot, "index.html"), "utf8");
    assert.match(homepage, /data-demo-carousel/u);
    assert.match(homepage, /data-carousel-track/u);
    assert.match(homepage, /data-demo-title="The pain" data-active/u);
    assert.match(homepage, /data-demo-slide data-demo-title="Agent Work Lab"/u);
    assert.ok(homepage.indexOf('data-demo-title="The pain"') < homepage.indexOf('data-demo-title="Agent Work Lab"'));
    assert.match(homepage, /data-autoplay-demo controls muted loop playsinline/u);
    assert.match(homepage, /Exact installed artifact · 18\.5 seconds/u);
    assert.match(
      homepage,
      /media="\(max-width: 767px\)" src="[^"]+\/demo-720p\.webm"/u,
    );
    assert.match(
      homepage,
      /media="\(min-width: 768px\)" src="[^"]+\/demo\.webm"/u,
    );
    assert.match(homepage, new RegExp(`${result.publicPath}/demo\\.webm`, "u"));
    assert.match(homepage, new RegExp(`${result.publicPath}/complete-transcript\\.txt`, "u"));
    assertMp4BeforeWebm(homepage);
    assert.equal(importAuditableDemo({ ...input, checkOnly: true }).changed, false);
  } finally {
    fs.rmSync(input.repoRoot, { recursive: true, force: true });
  }
});

test("imports a demo-id collection while preserving the Agent Work Lab route", () => {
  const input = fixture();
  try {
    const secondary = addSecondaryDemo(input);
    const result = importAuditableDemo(input);
    assert.equal(result.demos.length, 2);
    const collection = JSON.parse(
      fs.readFileSync(
        path.join(input.outputRoot, "auditable-demos.json"),
        "utf8",
      ),
    );
    assert.equal(collection.featuredDemoId, "agent-work-lab");
    assert.equal(collection.homepageDemoId, "agent-work-lab");
    assert.deepEqual(
      collection.demos.map(({ id }) => id),
      ["agent-work-lab", "status-snapshot"],
    );
    const secondaryProjection = JSON.parse(
      fs.readFileSync(
        path.join(input.outputRoot, "auditable-demos/status-snapshot.json"),
        "utf8",
      ),
    );
    assert.equal(secondaryProjection.demo.id, "status-snapshot");
    assert.equal(secondaryProjection.passportRoot, secondary.root.value);
    assert.match(
      secondaryProjection.publicEvidencePath,
      /^\/evidence\/auditable-demo\/status-snapshot\/[0-9a-f]{64}$/u,
    );
    const page = fs.readFileSync(
      path.join(input.outputRoot, "how-tested/auditable-demo/index.html"),
      "utf8",
    );
    assert.match(page, /Watch the artifact explain itself\./u);
    assert.match(page, /kungfu status --snapshot --no-interaction/u);
    assertMp4BeforeWebm(page);
    assert.equal(importAuditableDemo({ ...input, checkOnly: true }).changed, false);
  } finally {
    fs.rmSync(input.repoRoot, { recursive: true, force: true });
  }
});

test("can feature Project Work recovery on the homepage without replacing the canonical demo route", () => {
  const input = fixture();
  try {
    const recovery = addSecondaryDemo(input, {
      id: "project-work-recovery",
      commandLabel: "kungfu agent-work-lab project-tour",
      evidenceClass: "exact-installed-artifact-project-work-recovery/v1",
      homepage: true,
    });
    const result = importAuditableDemo(input);
    assert.equal(result.passport.root.value, input.passport.root.value);
    const collection = JSON.parse(
      fs.readFileSync(
        path.join(input.outputRoot, "auditable-demos.json"),
        "utf8",
      ),
    );
    assert.equal(collection.featuredDemoId, "agent-work-lab");
    assert.equal(collection.homepageDemoId, "project-work-recovery");
    const homepage = fs.readFileSync(
      path.join(input.outputRoot, "index.html"),
      "utf8",
    );
    assert.match(homepage, /data-demo-title="The Work survives"/u);
    assert.match(homepage, /Qualified project recovery/u);
    assert.match(
      homepage,
      /One Work survives failed attempts and a fresh Agent\./u,
    );
    assert.match(homepage, /not hosted-provider or cross-machine proof/u);
    assert.match(
      homepage,
      new RegExp(
        `/evidence/auditable-demo/project-work-recovery/${recovery.root.value.slice(7)}/demo\\.mp4`,
        "u",
      ),
    );
    const canonical = JSON.parse(
      fs.readFileSync(
        path.join(input.outputRoot, "auditable-demo.json"),
        "utf8",
      ),
    );
    assert.equal(canonical.demo.id, "agent-work-lab");
    assert.equal(importAuditableDemo({ ...input, checkOnly: true }).changed, false);
  } finally {
    fs.rmSync(input.repoRoot, { recursive: true, force: true });
  }
});

test("rejects incomplete identity-neutral authority even under a re-rooted Passport", () => {
  const input = fixture();
  try {
    const passportPath = path.join(input.repoRoot, "site/auditable-demo/passport.json");
    const passport = JSON.parse(fs.readFileSync(passportPath, "utf8"));
    passport.authority.authorization.nonAuthorities.pop();
    const { root: ignoredRoot, ...payload } = passport;
    passport.root.value = sha256(Buffer.from(stableJson(payload)));
    fs.writeFileSync(passportPath, stableJson(passport));
    assert.throws(
      () => importAuditableDemo(input),
      /identity-neutral authorization boundary is invalid/u,
    );
  } finally {
    fs.rmSync(input.repoRoot, { recursive: true, force: true });
  }
});

test("rejects media drift before publication", () => {
  const input = fixture();
  try {
    fs.appendFileSync(path.join(input.repoRoot, "site/auditable-demo/media/demo.mp4"), "tampered");
    assert.throws(() => importAuditableDemo(input), /checksum mismatch for demo\.mp4/u);
  } finally {
    fs.rmSync(input.repoRoot, { recursive: true, force: true });
  }
});

test("rejects a cross-run artifact URL even when the Passport root is valid", () => {
  const input = fixture();
  try {
    const passportPath = path.join(input.repoRoot, "site/auditable-demo/passport.json");
    const passport = JSON.parse(fs.readFileSync(passportPath, "utf8"));
    passport.media.artifact.url =
      "https://github.com/kungfu-systems/kungfu/actions/runs/100/artifacts/103";
    const { root: ignoredRoot, ...payload } = passport;
    passport.root.value = sha256(Buffer.from(stableJson(payload)));
    fs.writeFileSync(passportPath, stableJson(passport));
    assert.throws(() => importAuditableDemo(input), /media artifact coordinate is invalid/u);
  } finally {
    fs.rmSync(input.repoRoot, { recursive: true, force: true });
  }
});

test("rejects a missing Gate expiry even when the Passport root is valid", () => {
  const input = fixture();
  try {
    const passportPath = path.join(input.repoRoot, "site/auditable-demo/passport.json");
    const passport = JSON.parse(fs.readFileSync(passportPath, "utf8"));
    passport.gate.artifact.expiresAt = "";
    const { root: ignoredRoot, ...payload } = passport;
    passport.root.value = sha256(Buffer.from(stableJson(payload)));
    fs.writeFileSync(passportPath, stableJson(passport));
    assert.throws(() => importAuditableDemo(input), /Gate artifact expiry/u);
  } finally {
    fs.rmSync(input.repoRoot, { recursive: true, force: true });
  }
});

test("rejects a scene without a bounded exact duration", () => {
  const input = fixture();
  try {
    const scenePath = path.join(input.repoRoot, "site/auditable-demo/media/scene.json");
    fs.writeFileSync(scenePath, stableJson({
      schema: "build-images.demo-scene/v1",
      durationMs: 0,
    }));
    rebindMedia(input.repoRoot);
    assert.throws(
      () => importAuditableDemo(input),
      /scene duration is invalid/u,
    );
  } finally {
    fs.rmSync(input.repoRoot, { recursive: true, force: true });
  }
});

test("imports a declarative long-form demo from two native capture roots", () => {
  const input = declarativeFixture();
  try {
    const result = importAuditableDemo(input);
    assert.equal(result.changed, true);
    assert.equal(result.passport.root.value, input.passport.passportRoot);
    const projection = JSON.parse(
      fs.readFileSync(path.join(input.outputRoot, "auditable-demo.json"), "utf8"),
    );
    assert.equal(projection.demo.id, "agent-work-lab-autoplay");
    assert.equal(projection.durationClass, "long-form");
    assert.deepEqual(
      projection.nativeCaptures.map(({ width, height }) => [width, height]),
      [[1920, 1080], [1280, 720]],
    );
    assert.notEqual(
      projection.nativeCaptures[0].captureRoot,
      projection.nativeCaptures[1].captureRoot,
    );
    const transcript = fs.readFileSync(
      path.join(input.outputRoot, result.publicPath, "complete-transcript.txt"),
      "utf8",
    );
    assert.match(transcript, /\$ kungfu agent-work-lab autoplay/u);
    const page = fs.readFileSync(
      path.join(input.outputRoot, "how-tested/auditable-demo/index.html"),
      "utf8",
    );
    assert.match(page, /Two independent native terminal captures/u);
    assertMp4BeforeWebm(page);
    assert.equal(importAuditableDemo({ ...input, checkOnly: true }).changed, false);
  } finally {
    fs.rmSync(input.repoRoot, { recursive: true, force: true });
  }
});

test("accepts an explicitly bounded long-form scene and media profile", () => {
  const input = fixture();
  try {
    setDurationPolicy(input, {
      durationMs: 90_500,
      durationClass: "long-form",
      profile: "responsive-long-form-web-delivery-v1",
    });
    const result = importAuditableDemo(input);
    const projection = JSON.parse(
      fs.readFileSync(
        path.join(input.outputRoot, "auditable-demo.json"),
        "utf8",
      ),
    );
    assert.equal(
      projection.mediaProfile,
      "responsive-long-form-web-delivery-v1",
    );
    assert.match(
      fs.readFileSync(
        path.join(input.outputRoot, "how-tested/auditable-demo/index.html"),
        "utf8",
      ),
      /90\.5-second animation/u,
    );
    assert.equal(result.changed, true);
  } finally {
    fs.rmSync(input.repoRoot, { recursive: true, force: true });
  }
});

test("rejects declarative evidence that collapses both native renditions", () => {
  const input = declarativeFixture();
  try {
    const manifestPath = path.join(input.evidenceDirectory, "manifest.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    manifest.derivation.sourceFrameSets[1].captureRoot =
      manifest.derivation.sourceFrameSets[0].captureRoot;
    manifest.inputs.renditions[1].terminalCapture.root =
      manifest.inputs.renditions[0].terminalCapture.root;
    fs.writeFileSync(manifestPath, stableJson(manifest));
    const publicEvidencePath = path.join(input.evidenceDirectory, "public-evidence.json");
    const publicEvidence = JSON.parse(fs.readFileSync(publicEvidencePath, "utf8"));
    const manifestBytes = fs.readFileSync(manifestPath);
    const manifestEntry = publicEvidence.files.find(({ path: member }) => member === "manifest.json");
    manifestEntry.root = sha256(manifestBytes);
    manifestEntry.bytes = manifestBytes.length;
    fs.writeFileSync(publicEvidencePath, stableJson(publicEvidence));
    assert.throws(
      () => importAuditableDemo(input),
      /distinct native capture roots/u,
    );
  } finally {
    fs.rmSync(input.repoRoot, { recursive: true, force: true });
  }
});

test("rejects the legacy narrow 100-column 720p capture", () => {
  const input = declarativeFixture();
  try {
    const manifestPath = path.join(input.evidenceDirectory, "manifest.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    manifest.inputs.renditions[1].terminalCapture.dimensions.columns = 100;
    fs.writeFileSync(manifestPath, stableJson(manifest));
    const publicEvidencePath = path.join(input.evidenceDirectory, "public-evidence.json");
    const publicEvidence = JSON.parse(fs.readFileSync(publicEvidencePath, "utf8"));
    const manifestBytes = fs.readFileSync(manifestPath);
    const manifestEntry = publicEvidence.files.find(({ path: member }) => member === "manifest.json");
    manifestEntry.root = sha256(manifestBytes);
    manifestEntry.bytes = manifestBytes.length;
    fs.writeFileSync(publicEvidencePath, stableJson(publicEvidence));
    assert.throws(
      () => importAuditableDemo(input),
      /renderer native input 720p is invalid/u,
    );
  } finally {
    fs.rmSync(input.repoRoot, { recursive: true, force: true });
  }
});

test("rejects long-form duration under the standard media profile", () => {
  const input = fixture();
  try {
    setDurationPolicy(input, {
      durationMs: 90_500,
      durationClass: "long-form",
      profile: "responsive-web-delivery-v1",
    });
    assert.throws(
      () => importAuditableDemo(input),
      /scene duration class and media profile do not match/u,
    );
  } finally {
    fs.rmSync(input.repoRoot, { recursive: true, force: true });
  }
});

test("rejects a long-form scene above the 180-second ceiling", () => {
  const input = fixture();
  try {
    setDurationPolicy(input, {
      durationMs: 180_001,
      durationClass: "long-form",
      profile: "responsive-long-form-web-delivery-v1",
    });
    assert.throws(
      () => importAuditableDemo(input),
      /scene duration is invalid/u,
    );
  } finally {
    fs.rmSync(input.repoRoot, { recursive: true, force: true });
  }
});
