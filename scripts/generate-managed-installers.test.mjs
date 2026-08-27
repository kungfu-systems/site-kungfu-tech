// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert/strict";
import { spawn, execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { generateManagedInstallers } from "./generate-managed-installers.mjs";

function inputs() {
  const policy = JSON.parse(
    fs.readFileSync("site/managed-installer-alpha3.json", "utf8"),
  );
  return {
    policy,
    publication: JSON.parse(
      fs.readFileSync("public/installer-publication.json", "utf8"),
    ),
    channel: JSON.parse(
      fs.readFileSync("public/.well-known/kungfu/alpha.json", "utf8"),
    ),
    trustedKeys: {
      [policy.trustedKey.keyId]: policy.trustedKey.publicKey,
    },
    source: JSON.parse(
      fs.readFileSync("site/installer-publication-source.json", "utf8"),
    ),
    templateRoot: path.resolve("site/managed-installer"),
  };
}

function generate(root) {
  return generateManagedInstallers({
    ...inputs(),
    outputRoot: root,
  });
}

function executable(filePath, body) {
  fs.writeFileSync(filePath, body, { mode: 0o755 });
}

function fakeHost(root, { system, machine, glibc, curlMarker }) {
  const bin = path.join(root, "bin");
  fs.mkdirSync(bin, { recursive: true });
  executable(
    path.join(bin, "uname"),
    `#!/bin/sh\ncase "$1" in -s) printf '%s\\n' '${system}' ;; -m) printf '%s\\n' '${machine}' ;; *) printf '%s\\n' '${system}' ;; esac\n`,
  );
  executable(
    path.join(bin, "getconf"),
    `#!/bin/sh\nprintf '%s\\n' 'glibc ${glibc}'\n`,
  );
  executable(
    path.join(bin, "curl"),
    `#!/bin/sh\nprintf touched > '${curlMarker}'\nexit 70\n`,
  );
  return bin;
}

function linuxArchiveFixture(root, configure) {
  const fixture = inputs();
  fixture.publication = structuredClone(fixture.publication);
  fixture.policy = structuredClone(fixture.policy);
  const target = fixture.publication.entries.find(
    (entry) => entry.platform === "linux" && entry.architecture === "x64",
  );
  const payload = path.join(root, "payload");
  const candidate = path.join(payload, target.archiveBase);
  fs.mkdirSync(candidate, { recursive: true });
  configure(candidate);
  const archive = path.join(root, target.archiveName);
  execFileSync("tar", ["-czf", archive, "-C", payload, target.archiveBase]);
  const bytes = fs.readFileSync(archive);
  target.artifactUrl = `https://fixture.invalid/${target.archiveName}`;
  target.artifactSize = bytes.length;
  target.artifactDigest = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  const listing = execFileSync("tar", ["-tzf", archive], { encoding: "utf8" })
    .trimEnd()
    .split("\n");
  const verbose = execFileSync("tar", ["-tvzf", archive], { encoding: "utf8" })
    .trimEnd()
    .split("\n");
  fixture.policy.targets["linux/x64"].archiveEntries = listing.length;
  fixture.policy.targets["linux/x64"].archiveLinks = verbose.filter(
    (line) => line.startsWith("l"),
  ).length;
  const output = path.join(root, "output");
  generateManagedInstallers({ ...fixture, outputRoot: output });
  const cache = path.join(root, "cache");
  const cached = path.join(
    cache,
    "sha256",
    target.artifactDigest.slice(7),
    target.archiveName,
  );
  fs.mkdirSync(path.dirname(cached), { recursive: true });
  fs.copyFileSync(archive, cached);
  return { output, cache, target };
}

function channelCurl(root) {
  const filePath = path.join(root, "host-bin", "curl");
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  executable(
    filePath,
    `#!${process.execPath}\n` +
      `const fs = require('node:fs');\n` +
      `const args = process.argv.slice(2);\n` +
      `const index = args.indexOf('--output');\n` +
      `if (index < 0 || !args[index + 1]) process.exit(64);\n` +
      `fs.copyFileSync(${JSON.stringify(path.resolve("public/.well-known/kungfu/alpha.json"))}, args[index + 1]);\n`,
  );
  return path.dirname(filePath);
}

function fakeLinuxPath(root) {
  const bin = channelCurl(root);
  executable(
    path.join(bin, "uname"),
    "#!/bin/sh\ncase \"$1\" in -s) printf '%s\\n' Linux ;; -m) printf '%s\\n' x86_64 ;; esac\n",
  );
  executable(path.join(bin, "getconf"), "#!/bin/sh\nprintf '%s\\n' 'glibc 2.39'\n");
  if (process.platform === "darwin") {
    executable(
      path.join(bin, "mv"),
      "#!/bin/sh\nif [ \"$1\" = -fT ]; then shift; exec /bin/mv -fh \"$@\"; fi\nexec /bin/mv \"$@\"\n",
    );
  }
  return `${bin}:/usr/bin:/bin`;
}

test("generates deterministic site-owned Alpha.3 installers and rooted catalog", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "kungfu-managed-generate-"));
  try {
    const left = path.join(root, "left");
    const right = path.join(root, "right");
    const first = generate(left);
    const second = generate(right);
    assert.equal(first.catalogRoot, second.catalogRoot);
    assert.deepEqual(first.scriptDigests, second.scriptDigests);
    assert.match(first.catalogRoot, /^sha256:[a-f0-9]{64}$/u);
    for (const file of ["install.sh", "install.ps1"]) {
      assert.deepEqual(
        fs.readFileSync(path.join(left, file)),
        fs.readFileSync(path.join(right, file)),
      );
      assert.equal(
        fs.readFileSync(path.join(left, file), "utf8").includes("@@"),
        false,
      );
      assert.deepEqual(
        fs.readFileSync(path.join(left, file)),
        fs.readFileSync(path.join(left, first.immutablePath, file)),
      );
    }
    const catalog = JSON.parse(
      fs.readFileSync(
        path.join(left, ".well-known/kungfu/managed-installer.json"),
        "utf8",
      ),
    );
    assert.equal(catalog.catalogRoot, first.catalogRoot);
    assert.equal(catalog.release.version, "4.0.0-alpha.3");
    assert.deepEqual(
      catalog.entries.map((entry) => `${entry.platform}/${entry.architecture}`),
      ["darwin/arm64", "linux/x64", "win32/x64"],
    );
    assert.equal(
      catalog.entries.find((entry) => entry.platform === "linux")
        .compatibility.minimumGlibc,
      "2.39",
    );
    assert.equal(catalog.transaction.resume, "http-range");
    assert.equal(catalog.transaction.activation, "atomic-current-previous");
    assert.equal(
      catalog.implementation.schema,
      "kungfu.site-managed-installer-implementation/v1",
    );
    assert.match(catalog.implementation.generator, /^sha256:[a-f0-9]{64}$/u);
    assert.match(
      catalog.implementation.templates["install.sh"],
      /^sha256:[a-f0-9]{64}$/u,
    );
    assert.equal(
      catalog.trust.compatibilityAdapter.mode,
      "signed-alpha3-identity-projection",
    );
    assert.match(
      catalog.trust.compatibilityAdapter.digest,
      /^sha256:[a-f0-9]{64}$/u,
    );
    assert.deepEqual(
      fs.readFileSync(
        path.join(left, first.immutablePath, "alpha3-bootstrap-adapter.py"),
      ),
      fs.readFileSync("site/managed-installer/alpha3-bootstrap-adapter.py"),
    );
    const publication = JSON.parse(
      fs.readFileSync(path.join(left, "installer-publication.json"), "utf8"),
    );
    assert.equal(publication.immutablePath, first.immutablePath);
    for (const asset of publication.assets) {
      const bytes = fs.readFileSync(path.join(left, asset.name));
      assert.equal(asset.size, bytes.length);
      assert.equal(asset.digest, `sha256:${createHash("sha256").update(bytes).digest("hex")}`);
      assert.equal(
        new URL(asset.immutableUrl).pathname,
        `/${first.immutablePath}/${asset.name}`,
      );
    }
    assert.deepEqual(
      JSON.parse(
        fs.readFileSync(
          path.join(left, first.immutablePath, "upstream-installer-publication.json"),
          "utf8",
        ),
      ),
      inputs().publication,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("rejects authority, trust, and target-closure drift", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "kungfu-managed-reject-"));
  try {
    const authority = inputs();
    authority.policy = structuredClone(authority.policy);
    authority.policy.channelPayloadRoot = `sha256:${"0".repeat(64)}`;
    assert.throws(
      () =>
        generateManagedInstallers({
          ...authority,
          outputRoot: path.join(root, "authority"),
        }),
      /differs from verified release authority/u,
    );
    const abi = inputs();
    abi.policy = structuredClone(abi.policy);
    abi.policy.targets["linux/x64"].minimumGlibc = "2.38";
    assert.throws(
      () =>
        generateManagedInstallers({
          ...abi,
          outputRoot: path.join(root, "abi"),
        }),
      /must remain exact glibc 2\.39/u,
    );
    const closure = inputs();
    closure.publication = structuredClone(closure.publication);
    closure.publication.entries.pop();
    assert.throws(
      () =>
        generateManagedInstallers({
          ...closure,
          outputRoot: path.join(root, "closure"),
        }),
      /target closure differs/u,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("POSIX dry-run performs no download or filesystem mutation", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "kungfu-managed-dry-"));
  try {
    const output = path.join(root, "output");
    generate(output);
    const home = path.join(root, "home");
    const install = path.join(root, "install root");
    const cache = path.join(root, "cache root");
    const bin = path.join(root, "bin root");
    fs.mkdirSync(home);
    const result = spawnSync(
      "/bin/sh",
      [
        path.join(output, "install.sh"),
        "--install-dir",
        install,
        "--cache-dir",
        cache,
        "--bin-dir",
        bin,
        "--dry-run",
      ],
      { encoding: "utf8", env: { ...process.env, HOME: home } },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stderr, /phase\[plan\]/u);
    assert.equal(fs.existsSync(install), false);
    assert.equal(fs.existsSync(cache), false);
    assert.equal(fs.existsSync(bin), false);
    assert.deepEqual(fs.readdirSync(home), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

for (const host of [
  {
    name: "unsupported Linux architecture",
    system: "Linux",
    machine: "aarch64",
    glibc: "2.39",
    error: /unsupported-architecture/u,
  },
  {
    name: "incompatible Linux ABI",
    system: "Linux",
    machine: "x86_64",
    glibc: "2.38",
    error: /unsupported-libc.*requires glibc 2\.39/u,
  },
]) {
  test(`${host.name} fails before network and install-root mutation`, () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "kungfu-managed-host-"));
    try {
      const output = path.join(root, "output");
      generate(output);
      const curlMarker = path.join(root, "curl-called");
      const fakeBin = fakeHost(root, { ...host, curlMarker });
      const install = path.join(root, "install");
      const result = spawnSync(
        "/bin/sh",
        [path.join(output, "install.sh"), "--install-dir", install],
        {
          encoding: "utf8",
          env: { ...process.env, PATH: `${fakeBin}:/usr/bin:/bin` },
        },
      );
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, host.error);
      assert.equal(fs.existsSync(curlMarker), false);
      assert.equal(fs.existsSync(install), false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
}

test("templates retain resumable cache, product verification, activation, and rollback gates", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "kungfu-managed-contract-"));
  try {
    generate(root);
    const shell = fs.readFileSync(path.join(root, "install.sh"), "utf8");
    const powershell = fs.readFileSync(path.join(root, "install.ps1"), "utf8");
    for (const [label, text] of [
      ["POSIX", shell],
      ["PowerShell", powershell],
    ]) {
      for (const token of [
        "verify_bootstrap_candidate",
        "alpha3-bootstrap-adapter-receipt.json",
        "artifact-digest-mismatch",
        "archive-unsafe",
        "product-verification-failed",
        "activation-failed",
        "rollback-failed",
        "previous",
      ]) {
        assert.equal(text.includes(token), true, `${label} missing ${token}`);
      }
    }
    assert.match(shell, /--continue-at -/u);
    assert.match(shell, /\.part/u);
    assert.match(shell, /replace_pointer "\$current_tmp" "\$current_link"/u);
    assert.match(shell, /ensure_default_path/u);
    assert.match(shell, /kungfu-site-managed PATH/u);
    assert.match(powershell, /RangeHeaderValue/u);
    assert.match(powershell, /ResponseHeadersRead/u);
    assert.match(powershell, /Set-AtomicText \$CurrentPointer/u);
    assert.match(powershell, /Ensure-DefaultPath/u);
    assert.match(powershell, /SetEnvironmentVariable\('Path',/u);
    assert.doesNotMatch(powershell, /\bexit\b/u);
    assert.doesNotMatch(powershell, /RuntimeInformation/u);
    execFileSync("/bin/sh", ["-n", path.join(root, "install.sh")]);
    const pwsh = spawnSync("/usr/bin/env", ["sh", "-c", "command -v pwsh"], {
      encoding: "utf8",
    }).stdout.trim();
    if (pwsh) {
      execFileSync(pwsh, [
        "-NoProfile",
        "-Command",
        `[scriptblock]::Create([IO.File]::ReadAllText('${path.join(root, "install.ps1").replaceAll("'", "''")}')) | Out-Null`,
      ]);
      const powershellDryRun = path.join(root, "powershell-dry-run.ps1");
      fs.writeFileSync(
        powershellDryRun,
        `$env:LOCALAPPDATA = ${JSON.stringify(root)}\n` +
          `$env:PROCESSOR_ARCHITECTURE = 'AMD64'\n` +
          `& ([scriptblock]::Create([IO.File]::ReadAllText('${path.join(root, "install.ps1").replaceAll("'", "''")}'))) -DryRun\n` +
          `Write-Output 'host-still-alive'\n`,
      );
      assert.match(
        execFileSync(pwsh, ["-NoProfile", "-File", powershellDryRun], { encoding: "utf8" }),
        /host-still-alive/u,
      );
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("PowerShell takes over its launcher path without historical ownership checks", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "kungfu-managed-powershell-owner-"));
  try {
    generate(root);
    const powershell = fs.readFileSync(path.join(root, "install.ps1"), "utf8");
    assert.doesNotMatch(powershell, /ownership-conflict/u);
    assert.doesNotMatch(powershell, /Test-LegacyProductLauncher/u);
    assert.match(powershell, /Set-AtomicLauncher \$Launcher \$VersionRoot/u);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("POSIX starts installation when its launcher path already exists", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "kungfu-managed-owner-"));
  try {
    const output = path.join(root, "output");
    generate(output);
    const hostBin = fakeHost(root, {
      system: "Linux",
      machine: "x86_64",
      glibc: "2.39",
      curlMarker: path.join(root, "curl-called"),
    });
    const managedBin = path.join(root, "managed-bin");
    fs.mkdirSync(managedBin);
    executable(path.join(managedBin, "kungfu"), "#!/bin/sh\nexit 0\n");
    const install = path.join(root, "install");
    const result = spawnSync(
      "/bin/sh",
      [
        path.join(output, "install.sh"),
        "--install-dir",
        install,
        "--bin-dir",
        managedBin,
      ],
      {
        encoding: "utf8",
        env: { ...process.env, PATH: `${managedBin}:${hostBin}:/usr/bin:/bin` },
      },
    );
    assert.notEqual(result.status, 0);
    assert.doesNotMatch(result.stderr, /ownership-conflict/u);
    assert.equal(fs.existsSync(path.join(root, "curl-called")), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("POSIX migrates the exact legacy product launcher", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "kungfu-managed-legacy-owner-"));
  try {
    const output = path.join(root, "output");
    generate(output);
    const curlMarker = path.join(root, "curl-called");
    const hostBin = fakeHost(root, {
      system: "Linux",
      machine: "x86_64",
      glibc: "2.39",
      curlMarker,
    });
    const managedBin = path.join(root, "managed-bin");
    fs.mkdirSync(managedBin);
    fs.writeFileSync(
      path.join(managedBin, "kungfu"),
      [
        "#!/bin/sh",
        "set -e",
        "target=$0",
        'while [ -L "$target" ]; do',
        '  link=$(readlink "$target")',
        "  case $link in",
        "    /*) target=$link ;;",
        '    *) target=$(dirname "$target")/$link ;;',
        "  esac",
        "done",
        'here=$(cd "$(dirname "$target")" && pwd)',
        "export KUNGFU_INSTALL_SOURCE=archive",
        'export KUNGFU_DIR="$here/runtime"',
        'export KUNGFU_PRODUCT_MANIFEST="$here/product.json"',
        'export KUNGFU_UPGRADE_MANIFEST="$here/upgrade/kungfu-release-manifest.json"',
        'export KF_BUNDLED_EXTENSION_ROOT="$here/extensions"',
        'export KUNGFU_CLI_BIN="$here/kungfu"',
        'export KUNGFU_AGENT_SESSION_EXECUTABLE="$here/runtime/kungfu"',
        'export KUNGFU_CONTROLLER_ENTRYPOINT="$here/runtime/kungfu"',
        'exec "$here/runtime/kungfu" "$@"',
        "",
      ].join("\\n"),
      { mode: 0o755 },
    );
    const result = spawnSync(
      "/bin/sh",
      [
        path.join(output, "install.sh"),
        "--install-dir",
        path.join(root, "install"),
        "--bin-dir",
        managedBin,
      ],
      {
        encoding: "utf8",
        env: { ...process.env, PATH: `${managedBin}:${hostBin}:/usr/bin:/bin` },
      },
    );
    assert.notEqual(result.status, 0);
    assert.doesNotMatch(result.stderr, /ownership-conflict/u);
    assert.equal(fs.existsSync(curlMarker), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("POSIX migrates the exact legacy archive launcher", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "kungfu-managed-legacy-archive-owner-"));
  try {
    const output = path.join(root, "output");
    generate(output);
    const curlMarker = path.join(root, "curl-called");
    const hostBin = fakeHost(root, {
      system: "Linux",
      machine: "x86_64",
      glibc: "2.39",
      curlMarker,
    });
    const managedBin = path.join(root, "managed-bin");
    fs.mkdirSync(managedBin);
    fs.writeFileSync(
      path.join(managedBin, "kungfu"),
      [
        "#!/bin/sh",
        "set -e",
        "target=$0",
        'while [ -L "$target" ]; do',
        '  link=$(readlink "$target")',
        "  case $link in",
        "    /*) target=$link ;;",
        '    *) target=$(dirname "$target")/$link ;;',
        "  esac",
        "done",
        'version_root=$(CDPATH= cd -- "$(dirname "$target")/.." && pwd)',
        "export KUNGFU_INSTALL_SOURCE=archive",
        'export KUNGFU_DIR="$version_root/runtime"',
        'exec "$version_root/kungfu" "$@"',
        "",
      ].join("\\n"),
      { mode: 0o755 },
    );
    const result = spawnSync(
      "/bin/sh",
      [
        path.join(output, "install.sh"),
        "--install-dir",
        path.join(root, "install"),
        "--bin-dir",
        managedBin,
      ],
      {
        encoding: "utf8",
        env: { ...process.env, PATH: `${managedBin}:${hostBin}:/usr/bin:/bin` },
      },
    );
    assert.notEqual(result.status, 0);
    assert.doesNotMatch(result.stderr, /ownership-conflict/u);
    assert.equal(fs.existsSync(curlMarker), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("POSIX rejects a digest mismatch without activation", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "kungfu-managed-digest-"));
  try {
    const fixture = inputs();
    fixture.publication = structuredClone(fixture.publication);
    const target = fixture.publication.entries.find(
      (entry) => entry.platform === "linux" && entry.architecture === "x64",
    );
    const expected = Buffer.from("expected archive bytes");
    const received = Buffer.from("received archive bytes");
    assert.equal(expected.length, received.length);
    target.artifactUrl = "https://fixture.invalid/digest.tar.gz";
    target.archiveName = "digest.tar.gz";
    target.artifactSize = expected.length;
    target.artifactDigest = `sha256:${createHash("sha256").update(expected).digest("hex")}`;
    const output = path.join(root, "output");
    generateManagedInstallers({ ...fixture, outputRoot: output });
    const hostPath = fakeLinuxPath(root);
    const curlPath = path.join(root, "host-bin", "curl");
    executable(
      curlPath,
      `#!${process.execPath}\n` +
        `const fs = require('node:fs'); const args = process.argv.slice(2);\n` +
        `const output = args[args.indexOf('--output') + 1];\n` +
        `if (args.at(-1).includes('/channels/alpha/')) fs.copyFileSync(${JSON.stringify(path.resolve("public/.well-known/kungfu/alpha.json"))}, output);\n` +
        `else fs.writeFileSync(output, Buffer.from(${JSON.stringify(received.toString())}));\n`,
    );
    const install = path.join(root, "install");
    const result = spawnSync(
      "/bin/sh",
      [
        path.join(output, "install.sh"),
        "--install-dir",
        install,
        "--cache-dir",
        path.join(root, "cache"),
        "--bin-dir",
        path.join(root, "managed-bin"),
        "--ci",
      ],
      { encoding: "utf8", env: { ...process.env, PATH: hostPath } },
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /artifact-digest-mismatch/u);
    assert.equal(fs.existsSync(path.join(install, "current")), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("POSIX rejects a symlink that resolves outside the archive root", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "kungfu-managed-link-"));
  try {
    const fixture = linuxArchiveFixture(root, (candidate) => {
      fs.mkdirSync(path.join(candidate, "runtime"));
      fs.symlinkSync("../../../outside", path.join(candidate, "runtime", "escape"));
    });
    const install = path.join(root, "install");
    const result = spawnSync(
      "/bin/sh",
      [
        path.join(fixture.output, "install.sh"),
        "--install-dir",
        install,
        "--cache-dir",
        fixture.cache,
        "--bin-dir",
        path.join(root, "managed-bin"),
        "--ci",
      ],
      { encoding: "utf8", env: { ...process.env, PATH: fakeLinuxPath(root) } },
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /archive-unsafe.*link target escapes/u);
    assert.equal(fs.existsSync(path.join(install, "current")), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("POSIX product-hook failure cannot activate staged content", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "kungfu-managed-hook-"));
  try {
    const fixture = linuxArchiveFixture(root, (candidate) => {
      fs.mkdirSync(path.join(candidate, "runtime", "python", "bin"), { recursive: true });
      executable(path.join(candidate, "runtime", "kungfu"), "#!/bin/sh\nexit 0\n");
      executable(path.join(candidate, "runtime", "python", "bin", "python3"), "#!/bin/sh\nexit 42\n");
      executable(path.join(candidate, "kungfu"), "#!/bin/sh\nprintf '%s\\n' 4.0.0-alpha.3\n");
      fs.writeFileSync(path.join(candidate, "product.json"), "{}\n");
    });
    const install = path.join(root, "install");
    const result = spawnSync(
      "/bin/sh",
      [
        path.join(fixture.output, "install.sh"),
        "--install-dir",
        install,
        "--cache-dir",
        fixture.cache,
        "--bin-dir",
        path.join(root, "managed-bin"),
        "--ci",
      ],
      { encoding: "utf8", env: { ...process.env, PATH: fakeLinuxPath(root) } },
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /product-verification-failed/u);
    assert.equal(fs.existsSync(path.join(install, "current")), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("POSIX download resumes an interrupted faithful HTTP transfer with Range", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "kungfu-managed-range-"));
  const server = http.createServer();
  try {
    const fixture = inputs();
    fixture.publication = structuredClone(fixture.publication);
    const artifact = Buffer.alloc(2 * 1024 * 1024 + 137, 0x5a);
    const artifactDigest = createHash("sha256").update(artifact).digest("hex");
    const target = fixture.publication.entries.find(
      (entry) => entry.platform === "darwin" && entry.architecture === "arm64",
    );
    target.artifactUrl = "https://fixture.invalid/kungfu-episodes-cli-darwin-arm64.tar.gz";
    target.artifactSize = artifact.length;
    target.artifactDigest = `sha256:${artifactDigest}`;
    fixture.policy = structuredClone(fixture.policy);
    fixture.policy.targets["darwin/arm64"].archiveEntries = 1;
    fixture.policy.targets["darwin/arm64"].archiveLinks = 0;

    const channel = fs.readFileSync("public/.well-known/kungfu/alpha.json");
    const split = 1024 * 1024 + 73;
    let interrupted = false;
    const ranges = [];
    server.on("request", (request, response) => {
      if (request.url === "/channel") {
        response.writeHead(200, { "Content-Length": channel.length });
        response.end(channel);
        return;
      }
      if (request.url !== "/artifact") {
        response.writeHead(404).end();
        return;
      }
      const range = request.headers.range || "";
      ranges.push(range);
      if (!interrupted && !range) {
        interrupted = true;
        response.writeHead(200, { "Content-Length": artifact.length });
        response.write(artifact.subarray(0, split), () => response.destroy());
        return;
      }
      const match = /^bytes=(\d+)-$/u.exec(range);
      assert.ok(match, `expected a Range retry, received ${range}`);
      const offset = Number(match[1]);
      response.writeHead(206, {
        "Content-Length": artifact.length - offset,
        "Content-Range": `bytes ${offset}-${artifact.length - 1}/${artifact.length}`,
      });
      response.end(artifact.subarray(offset));
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    const output = path.join(root, "output");
    generateManagedInstallers({ ...fixture, outputRoot: output });

    const bin = fakeHost(root, {
      system: "Darwin",
      machine: "arm64",
      glibc: "2.39",
      curlMarker: path.join(root, "unused-curl-marker"),
    });
    executable(
      path.join(bin, "curl"),
      `#!${process.execPath}\n` +
        `const { spawnSync } = require('node:child_process');\n` +
        `const source = process.argv.slice(2); const args = [];\n` +
        `for (let i = 0; i < source.length; i += 1) {\n` +
        `  if (source[i] === '--proto') { i += 1; continue; }\n` +
        `  if (source[i] === '--tlsv1.2') continue;\n` +
        `  if (source[i].includes('/channels/alpha/')) args.push('http://127.0.0.1:${address.port}/channel');\n` +
        `  else if (source[i].startsWith('https://fixture.invalid/')) args.push('http://127.0.0.1:${address.port}/artifact');\n` +
        `  else args.push(source[i]);\n` +
        `}\n` +
        `const result = spawnSync('/usr/bin/curl', args, { stdio: 'inherit' });\n` +
        `process.exit(result.status ?? 70);\n`,
    );
    const install = path.join(root, "install");
    const cache = path.join(root, "cache");
    const result = await new Promise((resolve) => {
      const child = spawn(
        "/bin/sh",
        [
          path.join(output, "install.sh"),
          "--install-dir",
          install,
          "--cache-dir",
          cache,
          "--bin-dir",
          path.join(root, "managed-bin"),
          "--ci",
        ],
        {
          env: { ...process.env, PATH: `${bin}:/usr/bin:/bin` },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk) => (stdout += chunk));
      child.stderr.on("data", (chunk) => (stderr += chunk));
      child.on("close", (status) => resolve({ status, stdout, stderr }));
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /phase\[retry\]/u);
    assert.match(result.stderr, /resume-byte [1-9][0-9]*/u);
    assert.match(result.stderr, /phase\[extract\]/u);
    assert.equal(ranges.length, 2);
    assert.equal(ranges[0], "");
    assert.match(ranges[1], /^bytes=[1-9][0-9]*-$/u);
    const cacheFile = path.join(
      cache,
      "sha256",
      artifactDigest,
      "kungfu-episodes-cli-darwin-arm64.tar.gz",
    );
    assert.deepEqual(fs.readFileSync(cacheFile), artifact);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("POSIX activation verification failure restores the prior command", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "kungfu-managed-activate-"));
  try {
    const counter = path.join(root, "candidate-invocations");
    const fixture = linuxArchiveFixture(root, (candidate) => {
      fs.mkdirSync(path.join(candidate, "runtime", "python", "bin"), { recursive: true });
      executable(path.join(candidate, "runtime", "kungfu"), "#!/bin/sh\nexit 0\n");
      executable(
        path.join(candidate, "runtime", "python", "bin", "python3"),
        "#!/bin/sh\nprintf '%s\\n' '{\"schema\":\"fixture\",\"state\":\"verified\"}'\n",
      );
      executable(
        path.join(candidate, "kungfu"),
        `#!/bin/sh\ncount=0\n[ ! -f '${counter}' ] || count=$(cat '${counter}')\ncount=$((count + 1))\nprintf '%s\\n' "$count" > '${counter}'\nif [ "$count" -eq 1 ]; then printf '%s\\n' 4.0.0-alpha.3; else printf '%s\\n' broken; fi\n`,
      );
      fs.writeFileSync(path.join(candidate, "product.json"), "{}\n");
    });
    const install = path.join(root, "install");
    const managedBin = path.join(root, "managed-bin");
    const old = path.join(install, "versions", "old");
    fs.mkdirSync(path.join(old, "install"), { recursive: true });
    executable(path.join(old, "kungfu"), "#!/bin/sh\nprintf '%s\\n' 0.0.1\n");
    executable(
      path.join(old, "install", "kungfu-site-launcher"),
      `#!/bin/sh\nexec '${path.join(old, "kungfu")}' "$@"\n`,
    );
    fs.mkdirSync(managedBin);
    fs.symlinkSync(old, path.join(install, "current"));
    fs.symlinkSync(
      path.join(install, "current", "install", "kungfu-site-launcher"),
      path.join(managedBin, "kungfu"),
    );
    const result = spawnSync(
      "/bin/sh",
      [
        path.join(fixture.output, "install.sh"),
        "--install-dir",
        install,
        "--cache-dir",
        fixture.cache,
        "--bin-dir",
        managedBin,
        "--ci",
      ],
      {
        encoding: "utf8",
        env: { ...process.env, PATH: `${managedBin}:${fakeLinuxPath(root)}` },
      },
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /activation-verification-failed.*prior current was restored/u);
    assert.equal(fs.readlinkSync(path.join(install, "current")), old);
    assert.equal(
      execFileSync(path.join(managedBin, "kungfu"), ["--version"], { encoding: "utf8" }).trim(),
      "0.0.1",
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("POSIX rollback swaps only to a previously verified managed version", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "kungfu-managed-rollback-"));
  try {
    const output = path.join(root, "output");
    generate(output);
    const install = path.join(root, "install");
    const bin = path.join(root, "bin");
    const current = path.join(install, "versions", "current-version");
    const previous = path.join(install, "versions", "previous-version");
    const receipt =
      `catalog=sha256:${"1".repeat(64)} version=0.0.1 source=${"2".repeat(40)} ` +
      `manifest=sha256:${"3".repeat(64)} artifact=sha256:${"4".repeat(64)} ` +
      `passport=sha256:${"5".repeat(64)}\n`;
    for (const [versionRoot, version] of [
      [current, "0.0.2"],
      [previous, "0.0.1"],
    ]) {
      fs.mkdirSync(path.join(versionRoot, "install"), { recursive: true });
      executable(
        path.join(versionRoot, "kungfu"),
        `#!/bin/sh\nprintf '%s\\n' '${version}'\n`,
      );
      executable(
        path.join(versionRoot, "install", "kungfu-site-launcher"),
        `#!/bin/sh\nexec '${path.join(versionRoot, "kungfu")}' "$@"\n`,
      );
      fs.writeFileSync(path.join(versionRoot, "install", "site-managed-receipt"), receipt);
      fs.writeFileSync(
        path.join(versionRoot, "install", "bootstrap-receipt.json"),
        '{"schema":"kungfu.bootstrap-verification-receipt/v1","state":"verified"}\n',
      );
    }
    fs.mkdirSync(bin, { recursive: true });
    fs.symlinkSync(current, path.join(install, "current"));
    fs.symlinkSync(previous, path.join(install, "previous"));
    fs.symlinkSync(
      path.join(install, "current", "install", "kungfu-site-launcher"),
      path.join(bin, "kungfu"),
    );
    const result = spawnSync(
      "/bin/sh",
      [
        path.join(output, "install.sh"),
        "--install-dir",
        install,
        "--bin-dir",
        bin,
        "--rollback",
      ],
      { encoding: "utf8", env: { ...process.env, PATH: "/usr/bin:/bin" } },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.readlinkSync(path.join(install, "current")), previous);
    assert.equal(fs.readlinkSync(path.join(install, "previous")), current);
    assert.equal(execFileSync(path.join(bin, "kungfu"), ["--version"], { encoding: "utf8" }).trim(), "0.0.1");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("POSIX rollback verification failure restores both pointers and launcher", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "kungfu-managed-rollback-fail-"));
  try {
    const output = path.join(root, "output");
    generate(output);
    const install = path.join(root, "install");
    const bin = path.join(root, "bin");
    const current = path.join(install, "versions", "current-version");
    const previous = path.join(install, "versions", "previous-version");
    const counter = path.join(root, "previous-invocations");
    const receipt =
      `catalog=sha256:${"1".repeat(64)} version=0.0.1 source=${"2".repeat(40)} ` +
      `manifest=sha256:${"3".repeat(64)} artifact=sha256:${"4".repeat(64)} ` +
      `passport=sha256:${"5".repeat(64)}\n`;
    for (const versionRoot of [current, previous]) {
      fs.mkdirSync(path.join(versionRoot, "install"), { recursive: true });
      fs.writeFileSync(path.join(versionRoot, "install", "site-managed-receipt"), receipt);
      fs.writeFileSync(
        path.join(versionRoot, "install", "bootstrap-receipt.json"),
        '{"schema":"kungfu.bootstrap-verification-receipt/v1","state":"verified"}\n',
      );
    }
    executable(path.join(current, "kungfu"), "#!/bin/sh\nprintf '%s\\n' 0.0.2\n");
    executable(
      path.join(previous, "kungfu"),
      `#!/bin/sh\ncount=0\n[ ! -f '${counter}' ] || count=$(cat '${counter}')\ncount=$((count + 1))\nprintf '%s\\n' "$count" > '${counter}'\nif [ "$count" -eq 1 ]; then printf '%s\\n' 0.0.1; else printf '%s\\n' broken; fi\n`,
    );
    for (const versionRoot of [current, previous]) {
      executable(
        path.join(versionRoot, "install", "kungfu-site-launcher"),
        `#!/bin/sh\nexec '${path.join(versionRoot, "kungfu")}' "$@"\n`,
      );
    }
    fs.mkdirSync(bin, { recursive: true });
    fs.symlinkSync(current, path.join(install, "current"));
    fs.symlinkSync(previous, path.join(install, "previous"));
    fs.symlinkSync(
      path.join(install, "current", "install", "kungfu-site-launcher"),
      path.join(bin, "kungfu"),
    );
    const result = spawnSync(
      "/bin/sh",
      [
        path.join(output, "install.sh"),
        "--install-dir",
        install,
        "--bin-dir",
        bin,
        "--rollback",
      ],
      { encoding: "utf8", env: { ...process.env, PATH: "/usr/bin:/bin" } },
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /rollback-failed.*prior state was restored/u);
    assert.equal(fs.readlinkSync(path.join(install, "current")), current);
    assert.equal(fs.readlinkSync(path.join(install, "previous")), previous);
    assert.equal(
      execFileSync(path.join(bin, "kungfu"), ["--version"], { encoding: "utf8" }).trim(),
      "0.0.2",
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
