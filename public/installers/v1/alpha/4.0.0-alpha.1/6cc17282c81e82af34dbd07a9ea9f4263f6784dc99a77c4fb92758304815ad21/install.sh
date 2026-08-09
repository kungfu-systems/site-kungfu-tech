#!/bin/sh
# Generated from one signed Kungfu release channel. Do not edit.
set -eu

channel='alpha'
channel_url='https://kungfu.tech/channels/alpha/6cc17282c81e82af34dbd07a9ea9f4263f6784dc99a77c4fb92758304815ad21/index.json'
channel_sha256='150cea40c9874fd59077cc30a6a8600d8a101f00e444107c1ddda5d33b246a15'
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
    version='4.0.0-alpha.1'
    source_commit='ad7c7db6df076f969c5939728bcbe70ccd4771b3'
    manifest_root='sha256:cb0a959822e2da8da86f36dd45da660c9bdc71d39e719eb8abbfafbdc23ce740'
    artifact_root='sha256:e418a269bd38208942fd90accd39f818c7eecb65b5bff1176a2ac2fe455c4e55'
    release_cut_root='sha256:33d4a894009a918cf7ff2d265cefb69de47f439149cbd0943628fc1893f65c08'
    platform_slice_root='sha256:ef371b2190c21abc54b3207302a2434aef91a995c1814d703f9edeeaac451aaf'
    artifact_url='https://github.com/kungfu-systems/kungfu/releases/download/v4.0.0-alpha.1/kungfu-episodes-cli-darwin-arm64.tar.gz'
    artifact_size='159116574'
    artifact_digest='360880cc7b0826924d078dc27a97f062a8731029f5a724c9cbe2bfa1d9ca0c09'
    archive_name='kungfu-episodes-cli-darwin-arm64.tar.gz'
    archive_base='kungfu-episodes-cli-darwin-arm64'
    ;;
  linux/x64)
    version='4.0.0-alpha.1'
    source_commit='ad7c7db6df076f969c5939728bcbe70ccd4771b3'
    manifest_root='sha256:5eab2c849bc05d26a887c257c861221d477f7860ceaae14c69baaeed2a924c68'
    artifact_root='sha256:097e01ee2bb647bc20c17a0f7b182787244b063f2de60d4b853a00769ff5898f'
    release_cut_root='sha256:33d4a894009a918cf7ff2d265cefb69de47f439149cbd0943628fc1893f65c08'
    platform_slice_root='sha256:33637703b08c86b288d1dfb6ecb61589eca53f642a5b03c53562b44250721953'
    artifact_url='https://github.com/kungfu-systems/kungfu/releases/download/v4.0.0-alpha.1/kungfu-episodes-cli-linux-x64.tar.gz'
    artifact_size='219557472'
    artifact_digest='cd8310b8e6a4baf346f5248adf78496bc7e87502a7f2ec8d51bcbb689fef1023'
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
