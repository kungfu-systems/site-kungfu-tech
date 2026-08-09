# Generated from one signed Kungfu release channel. Do not edit.
[CmdletBinding()]
param(
  [ValidateSet('alpha','stable')][string]$Channel = 'alpha',
  [string]$Version,
  [string]$InstallDir = (Join-Path $env:LOCALAPPDATA 'Kungfu\product'),
  [string]$BinDir = (Join-Path $env:LOCALAPPDATA 'Kungfu\bin'),
  [switch]$NoPath,
  [switch]$DryRun,
  [switch]$Yes,
  [switch]$CI
)
$ErrorActionPreference = 'Stop'
$RequestedVersion = $Version
if ($Channel -ne 'alpha') { throw 'error[channel-unavailable]: this installer is pinned to alpha' }
if (-not [Environment]::Is64BitOperatingSystem) { throw 'error[unsupported-platform]: 64-bit Windows is required' }
switch ([Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString()) {
  'x64' {
    $Architecture = 'x64'
    $Version = '4.0.0-alpha.1'
    $SourceCommit = 'ad7c7db6df076f969c5939728bcbe70ccd4771b3'
    $ManifestRoot = 'sha256:19b75bf6f91654a13b4f79ffcad6b0775c6ff273b3c64f5790da7100fc512399'
    $ArtifactRoot = 'sha256:f445caa50c2f5443bcda8d6b0d1a006636056fd243d5bfc097fed31f27f28966'
    $ReleaseCutRoot = 'sha256:33d4a894009a918cf7ff2d265cefb69de47f439149cbd0943628fc1893f65c08'
    $PlatformSliceRoot = 'sha256:1ab6e42b0bed229c5a0176c2b49931e82d3c36479bc1259cb780c32d9756aa67'
    $ArtifactUrl = 'https://github.com/kungfu-systems/kungfu/releases/download/v4.0.0-alpha.1/kungfu-episodes-cli-windows-x64.zip'
    $ArtifactSize = [int64]1214020883
    $ArtifactDigest = 'bdae85d3aa517668ef48ba5a24a1bcbddb65eafb8f19887b13743fcb4027557a'
    $ArchiveName = 'kungfu-episodes-cli-windows-x64.zip'
    $ArchiveBase = 'kungfu-episodes-cli-windows-x64'
  }
  default { throw "error[unsupported-architecture]: no qualified archive exists for $_" }
}
if ($RequestedVersion -and $RequestedVersion -ne $Version) { throw "error[version-unavailable]: this immutable installer selects $Version" }
$ChannelUrl = 'https://kungfu.tech/channels/alpha/6cc17282c81e82af34dbd07a9ea9f4263f6784dc99a77c4fb92758304815ad21/index.json'
$ChannelSha256 = '150cea40c9874fd59077cc30a6a8600d8a101f00e444107c1ddda5d33b246a15'
$TrustedKey = 'ed25519-3c473c24ca261745=bNB6syHpgY0RKMHPKUhekyQupwgvtwqQ6qqrUV2ecfQ='
$VersionKey = $ManifestRoot.Substring(7, 16)
$VersionRoot = Join-Path $InstallDir "versions\$Version-$VersionKey"
$Launcher = Join-Path $BinDir 'kungfu.cmd'
Write-Host "kungfu-install: plan: $Channel $Version win32/$Architecture Cut $ReleaseCutRoot slice $PlatformSliceRoot -> $VersionRoot"
if ($DryRun) { exit 0 }

New-Item -ItemType Directory -Force -Path (Join-Path $InstallDir 'versions'), $BinDir | Out-Null
$Existing = Get-Command kungfu -ErrorAction SilentlyContinue
if ($Existing -and $Existing.Source -ne $Launcher) {
  throw "error[ownership-conflict]: existing Kungfu is owned outside $Launcher: $($Existing.Source)"
}
if (Test-Path $Launcher) {
  $firstLine = Get-Content -LiteralPath $Launcher -TotalCount 1
  if ($firstLine -ne '@rem kungfu-archive-bootstrap/v1') { throw "error[ownership-conflict]: $Launcher is not owned by the Kungfu archive installer" }
}
$Lock = Join-Path $InstallDir '.bootstrap-install.lock'
try { New-Item -ItemType Directory -Path $Lock -ErrorAction Stop | Out-Null }
catch { throw "error[concurrent-install]: another Kungfu installer owns $Lock" }
$Stage = Join-Path $InstallDir ".bootstrap-stage.$([Guid]::NewGuid().ToString('N'))"
try {
  New-Item -ItemType Directory -Path $Stage | Out-Null
  New-Item -ItemType Directory -Path (Join-Path $Stage 'download'), (Join-Path $Stage 'extract') | Out-Null
  $ChannelFile = Join-Path $Stage 'download\channel.json'
  $ArchiveFile = Join-Path $Stage "download\$ArchiveName"
  Invoke-WebRequest -UseBasicParsing -Uri $ChannelUrl -OutFile $ChannelFile
  if ((Get-FileHash -Algorithm SHA256 -LiteralPath $ChannelFile).Hash.ToLowerInvariant() -ne $ChannelSha256) {
    throw 'error[channel-byte-mismatch]: channel bytes differ from the reviewed installer'
  }
  Invoke-WebRequest -UseBasicParsing -Uri $ArtifactUrl -OutFile $ArchiveFile
  $Archive = Get-Item -LiteralPath $ArchiveFile
  if ($Archive.Length -ne $ArtifactSize) { throw 'error[artifact-size-mismatch]: CLI archive size differs from signed evidence' }
  if ((Get-FileHash -Algorithm SHA256 -LiteralPath $ArchiveFile).Hash.ToLowerInvariant() -ne $ArtifactDigest) {
    throw 'error[artifact-digest-mismatch]: CLI archive digest differs from signed evidence'
  }
  Expand-Archive -LiteralPath $ArchiveFile -DestinationPath (Join-Path $Stage 'extract')
  $Candidate = Join-Path $Stage "extract\$ArchiveBase"
  $Runtime = Join-Path $Candidate 'runtime\kungfu.exe'
  # Alpha intentionally ships unsigned Windows bytes. Trust comes from the
  # signed channel, exact archive digest, manifest root, and artifact root.
  $PlatformTrust = 'signed-channel-digest'
  New-Item -ItemType Directory -Force -Path (Join-Path $Candidate 'install') | Out-Null
  $Receipt = Join-Path $Candidate 'install\bootstrap-receipt.json'
  $ReceiptJson = & (Join-Path $Candidate 'kungfu.cmd') update bootstrap-verify $ChannelFile $ArchiveFile $Candidate `
    --channel $Channel --platform win32 --architecture $Architecture --version $Version `
    --manifest-root $ManifestRoot --artifact-root $ArtifactRoot --platform-trust $PlatformTrust `
    --trusted-key $TrustedKey
  if ($LASTEXITCODE -ne 0) { throw 'error[signed-authority-mismatch]: staged CLI did not verify release authority' }
  [IO.File]::WriteAllText(
    $Receipt,
    (($ReceiptJson -join [Environment]::NewLine) + [Environment]::NewLine),
    (New-Object Text.UTF8Encoding($false))
  )
  if (-not (Test-Path $VersionRoot)) { Move-Item -LiteralPath $Candidate -Destination $VersionRoot }
  $Temporary = "$Launcher.$PID.tmp"
  "@rem kungfu-archive-bootstrap/v1`r`n@setlocal`r`n@set `"KUNGFU_INSTALL_SOURCE=archive`"`r`n@set `"KUNGFU_DIR=$VersionRoot\runtime`"`r`n@call `"$VersionRoot\kungfu.cmd`" %*`r`n" | Set-Content -LiteralPath $Temporary -Encoding Ascii
  Move-Item -Force -LiteralPath $Temporary -Destination $Launcher
  Write-Host "kungfu-install: installed: $Launcher"
  Write-Host "kungfu-install: PATH, profiles, registry, services, and scheduled tasks were not modified"
}
finally {
  Remove-Item -Recurse -Force -ErrorAction SilentlyContinue -LiteralPath $Stage
  Remove-Item -Force -ErrorAction SilentlyContinue -LiteralPath $Lock
}
