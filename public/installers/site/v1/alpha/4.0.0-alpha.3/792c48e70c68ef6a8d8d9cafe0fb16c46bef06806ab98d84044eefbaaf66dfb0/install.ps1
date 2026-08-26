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
    $Version = '4.0.0-alpha.3'
    $SourceCommit = '6d99af738b78eccb48885a5fd59b88a0e5e4900a'
    $ManifestRoot = 'sha256:0f83d080f2480d9dc4b0888c9c9818bb61c0736f7b3c15b00f7a8f7603ab5dc7'
    $ArtifactRoot = 'sha256:13977f02cb95a5a6e6aeafcaf107e016943214defc0c3940dcdee07a5f53384d'
    $ReleaseCutRoot = 'sha256:80640129776ab0a5b11c4e0d66d6158fd6e05613c67ad790a00b29fe65ffca38'
    $PlatformSliceRoot = 'sha256:fa0d4a39c5db798263ca24a63d78c522cb9d2d35c46535d65fa18ed06dfdfb61'
    $ArtifactUrl = 'https://github.com/kungfu-systems/kungfu/releases/download/v4.0.0-alpha.3/kungfu-episodes-cli-windows-x64.zip'
    $ArtifactSize = [int64]313815840
    $ArtifactDigest = 'ca467459a9b1e6b89b3cd1fd6c460807cba983e2368c85001537c51529de703b'
    $ArchiveName = 'kungfu-episodes-cli-windows-x64.zip'
    $ArchiveBase = 'kungfu-episodes-cli-windows-x64'
  }
  default { throw "error[unsupported-architecture]: no qualified archive exists for $_" }
}
if ($RequestedVersion -and $RequestedVersion -ne $Version) { throw "error[version-unavailable]: this immutable installer selects $Version" }
$ChannelUrl = 'https://kungfu.tech/channels/alpha/af360a051e2201d006e2c8f75627fc575f981e00c4f4cc998c90e130d9a40b5b/index.json'
$ChannelSha256 = '2234799d7cc054f0c2a7009a4278cf45e2938761a3b66b9d850520ec155cabb3'
$TrustedKey = 'ed25519-3c473c24ca261745=bNB6syHpgY0RKMHPKUhekyQupwgvtwqQ6qqrUV2ecfQ='
$VersionKey = $ManifestRoot.Substring(7, 16)
$VersionRoot = Join-Path $InstallDir "versions\$Version-$VersionKey"
$Launcher = Join-Path $BinDir 'kungfu.cmd'
Write-Host "kungfu-install: plan: $Channel $Version win32/$Architecture Cut $ReleaseCutRoot slice $PlatformSliceRoot -> $VersionRoot"
if ($DryRun) { exit 0 }

New-Item -ItemType Directory -Force -Path (Join-Path $InstallDir 'versions'), $BinDir | Out-Null
$Existing = Get-Command kungfu -ErrorAction SilentlyContinue
if ($Existing -and $Existing.Source -ne $Launcher) {
  throw "error[ownership-conflict]: existing Kungfu is owned outside ${Launcher}: $($Existing.Source)"
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
