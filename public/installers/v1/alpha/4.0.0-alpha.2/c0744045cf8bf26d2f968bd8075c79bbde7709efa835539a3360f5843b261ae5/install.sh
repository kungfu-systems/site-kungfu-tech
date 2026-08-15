#!/bin/sh
# Generated from one signed Kungfu release channel. Do not edit.
set -eu

channel='alpha'
channel_url='https://kungfu.tech/channels/alpha/c0744045cf8bf26d2f968bd8075c79bbde7709efa835539a3360f5843b261ae5/index.json'
channel_sha256='d528052164e1713198007a67c53974cff905cc34867a6aecbfd9119bbb844bbc'
trusted_key='ed25519-3c473c24ca261745=bNB6syHpgY0RKMHPKUhekyQupwgvtwqQ6qqrUV2ecfQ='
install_root=${XDG_DATA_HOME:-"$HOME/.local/share"}/kungfu/product
bin_dir="$HOME/.local/bin"
dry_run=0
verbose=0
requested_channel="$channel"
requested_version=

usage() {
  printf '%s\n' "usage: install.sh [--channel alpha] [--version VERSION] [--install-dir DIR] [--bin-dir DIR] [--no-path] [--dry-run] [--yes] [--ci] [--verbose]"
}
log() { printf '%s\n' "kungfu-install: $*" >&2; }
debug() { [ "$verbose" -eq 0 ] || log "$@"; }
fail() { log "error[$1]: $2"; exit 1; }

while [ "$#" -gt 0 ]; do
  case "$1" in
    --channel) [ "$#" -ge 2 ] || fail option-missing "--channel needs a value"; requested_channel=$2; shift 2 ;;
    --version) [ "$#" -ge 2 ] || fail option-missing "--version needs a value"; requested_version=$2; shift 2 ;;
    --install-dir) [ "$#" -ge 2 ] || fail option-missing "--install-dir needs a value"; install_root=$2; shift 2 ;;
    --bin-dir) [ "$#" -ge 2 ] || fail option-missing "--bin-dir needs a value"; bin_dir=$2; shift 2 ;;
    --no-path|--yes|--ci|--non-interactive) shift ;;
    --dry-run) dry_run=1; shift ;;
    --verbose) verbose=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) fail option-unknown "unknown option: $1" ;;
  esac
done
[ "$requested_channel" = "$channel" ] || fail channel-unavailable "this installer is pinned to $channel"

os=$(uname -s 2>/dev/null || true)
case "$os" in Darwin) platform=darwin ;; Linux) platform=linux ;; *) fail unsupported-platform "supported systems are macOS and Linux" ;; esac
machine=$(uname -m 2>/dev/null || true)
case "$machine" in arm64|aarch64) architecture=arm64 ;; x86_64|amd64) architecture=x64 ;; *) fail unsupported-architecture "unsupported architecture: $machine" ;; esac
[ "$platform/$architecture" != darwin/x64 ] || fail unsupported-host 'unsupported-host: Intel macOS (Darwin x86_64) is not supported by Kungfu'
if [ "$platform" = linux ]; then
  libc=$(getconf GNU_LIBC_VERSION 2>/dev/null || ldd --version 2>&1 | head -1 || true)
  case "$libc" in *glibc*|*"GNU libc"*|*GLIBC*) ;; *) fail unsupported-libc "the advertised Linux archive requires glibc" ;; esac
fi

case "$platform/$architecture" in
  darwin/arm64)
    version='4.0.0-alpha.2'
    source_commit='b0cff8236b8b3746f8028b9d519ed3b0e26096c9'
    manifest_root='sha256:341a32eab972c918fa1f60f30f90af8fc5f4abf92a8d26e2204660787dd63331'
    artifact_root='sha256:7c632909750854ff4b35733855dc08f657e443e89cfb44a321449e40a7fbac6f'
    release_cut_root='sha256:2b6113f6684c3a012ad44376bd4d9ba10f8ee06e1f7bb7fd30a7ea7838b97acf'
    platform_slice_root='sha256:9bfdecb1de3a5ab6ab91dd62e109e1de18ad73326f0371944a0ca3bb2ed8dc6c'
    artifact_url='https://github.com/kungfu-systems/kungfu/releases/download/v4.0.0-alpha.2/kungfu-episodes-cli-darwin-arm64.tar.gz'
    artifact_size='148303069'
    artifact_digest='d1ebce0c094889080ae89a7396f1f994642afaaeca582903e3ac13e49290e779'
    archive_name='kungfu-episodes-cli-darwin-arm64.tar.gz'
    archive_base='kungfu-episodes-cli-darwin-arm64'
    ;;
  linux/x64)
    version='4.0.0-alpha.2'
    source_commit='b0cff8236b8b3746f8028b9d519ed3b0e26096c9'
    manifest_root='sha256:a431772ba2e0a96b6029b24675d723640f205a74dc9d19404aa9a3692b31d3fb'
    artifact_root='sha256:d2236808005a72ada0c97f70849aa350217f711a9d7babc7cbfd14871fff5396'
    release_cut_root='sha256:2b6113f6684c3a012ad44376bd4d9ba10f8ee06e1f7bb7fd30a7ea7838b97acf'
    platform_slice_root='sha256:bad8402cf07c188e6ab1b1cee981b6e28e43c09f63910ac64c8511300ac6aee4'
    artifact_url='https://github.com/kungfu-systems/kungfu/releases/download/v4.0.0-alpha.2/kungfu-episodes-cli-linux-x64.tar.gz'
    artifact_size='205955896'
    artifact_digest='78c8773ae5a33ae21d150b97af9ccbb3a11f8bfd4c740b83f99c04be519daeaa'
    archive_name='kungfu-episodes-cli-linux-x64.tar.gz'
    archive_base='kungfu-episodes-cli-linux-x64'
    ;;
  *) fail unsupported-target "no qualified $channel archive exists for $platform/$architecture" ;;
esac
[ -z "$requested_version" ] || [ "$requested_version" = "$version" ] || fail version-unavailable "this immutable installer selects $version"

launcher="$bin_dir/kungfu"
version_key=$(printf '%s' "$manifest_root" | cut -c8-23)
version_root="$install_root/versions/$version-$version_key"
log "plan: $channel $version ($source_commit) $platform/$architecture Cut $release_cut_root slice $platform_slice_root -> $version_root"
if [ "$dry_run" -eq 1 ]; then exit 0; fi

command -v curl >/dev/null 2>&1 || fail prerequisite-missing "curl is required"
command -v tar >/dev/null 2>&1 || fail prerequisite-missing "tar is required"
if command -v shasum >/dev/null 2>&1; then
  sha256_file() { shasum -a 256 "$1" | awk '{print $1}'; }
elif command -v sha256sum >/dev/null 2>&1; then
  sha256_file() { sha256sum "$1" | awk '{print $1}'; }
else
  fail prerequisite-missing "shasum or sha256sum is required"
fi
existing=$(command -v kungfu 2>/dev/null || true)
if [ -n "$existing" ] && [ "$existing" != "$launcher" ]; then
  fail ownership-conflict "existing Kungfu is owned outside $launcher: $existing"
fi
if [ -e "$launcher" ] && [ ! -L "$launcher" ]; then
  fail ownership-conflict "$launcher is not owned by the Kungfu archive installer"
fi
mkdir -p "$install_root/versions" "$bin_dir"
lock="$install_root/.bootstrap-install.lock"
mkdir "$lock" 2>/dev/null || fail concurrent-install "another Kungfu installer owns $lock"
stage="$install_root/.bootstrap-stage.$$"
published_temporary=
cleanup() {
  if [ -n "$published_temporary" ]; then rm -f "$published_temporary"; fi
  rm -rf "$stage"
  rmdir "$lock" 2>/dev/null || true
}
trap cleanup EXIT HUP INT TERM
[ ! -e "$stage" ] || fail staging-conflict "staging path already exists: $stage"
umask 077
mkdir "$stage" "$stage/download" "$stage/extract"

channel_file="$stage/download/channel.json"
archive_file="$stage/download/$archive_name"
curl --fail --silent --show-error --location --proto '=https' --tlsv1.2 --output "$channel_file" "$channel_url" ||
  fail channel-download-failed "could not download signed channel"
observed_channel=$(sha256_file "$channel_file")
[ "$observed_channel" = "$channel_sha256" ] || fail channel-byte-mismatch "channel bytes differ from the reviewed installer"

curl --fail --silent --show-error --location --proto '=https' --tlsv1.2 --output "$archive_file" "$artifact_url" ||
  fail artifact-download-failed "could not download CLI archive"
observed_size=$(wc -c < "$archive_file" | tr -d ' ')
[ "$observed_size" = "$artifact_size" ] || fail artifact-size-mismatch "CLI archive size differs from signed evidence"
observed_digest=$(sha256_file "$archive_file")
[ "$observed_digest" = "$artifact_digest" ] || fail artifact-digest-mismatch "CLI archive digest differs from signed evidence"

tar -tzf "$archive_file" | awk '
  /^\// || /(^|\/)\.\.(\/|$)/ { exit 1 }
  { count += 1 }
  END { if (count == 0) exit 1 }
' || fail archive-unsafe "CLI archive contains an unsafe or empty path set"
tar -xzf "$archive_file" -C "$stage/extract" || fail archive-invalid "CLI archive could not be extracted"
candidate="$stage/extract/$archive_base"
[ -f "$candidate/product.json" ] || fail product-manifest-missing "CLI product manifest is missing"
[ -x "$candidate/runtime/kungfu" ] || fail runtime-missing "CLI runtime is missing"
platform_trust=signed-channel-digest
if [ "$platform" = darwin ]; then
  codesign --verify --deep --strict "$candidate/runtime/kungfu" >/dev/null 2>&1 ||
    fail platform-trust-failed "macOS code signature did not verify"
  platform_trust=codesign-valid
fi

mkdir -p "$candidate/install"
"$candidate/kungfu" update bootstrap-verify "$channel_file" "$archive_file" "$candidate" \
  --channel "$channel" --platform "$platform" --architecture "$architecture" \
  --version "$version" --manifest-root "$manifest_root" --artifact-root "$artifact_root" \
  --platform-trust "$platform_trust" --trusted-key "$trusted_key" \
  > "$candidate/install/bootstrap-receipt.json" ||
  fail signed-authority-mismatch "staged CLI did not verify the signed channel and release identity"

cat > "$candidate/install/kungfu-archive-launcher" <<'KUNGFU_ARCHIVE_LAUNCHER'
#!/bin/sh
set -e
target=$0
while [ -L "$target" ]; do
  link=$(readlink "$target")
  case $link in
    /*) target=$link ;;
    *) target=$(dirname "$target")/$link ;;
  esac
done
version_root=$(CDPATH= cd -- "$(dirname "$target")/.." && pwd)
export KUNGFU_INSTALL_SOURCE=archive
export KUNGFU_DIR="$version_root/runtime"
exec "$version_root/kungfu" "$@"
KUNGFU_ARCHIVE_LAUNCHER
chmod 755 "$candidate/install/kungfu-archive-launcher"

if [ -d "$version_root" ]; then
  debug "verified version already installed"
  published_temporary="$version_root/install/.kungfu-archive-launcher.$$"
  cp "$candidate/install/kungfu-archive-launcher" "$published_temporary"
  chmod 755 "$published_temporary"
  mv -f "$published_temporary" "$version_root/install/kungfu-archive-launcher"
  published_temporary=
else
  mv "$candidate" "$version_root" || fail activation-failed "could not publish the verified version"
fi
temporary_link="$bin_dir/.kungfu.bootstrap.$$"
ln -s "$version_root/install/kungfu-archive-launcher" "$temporary_link"
mv -f "$temporary_link" "$launcher"
trap - EXIT HUP INT TERM
cleanup
log "installed: $launcher"
log "PATH was not modified; add $bin_dir explicitly if it is not already present"
