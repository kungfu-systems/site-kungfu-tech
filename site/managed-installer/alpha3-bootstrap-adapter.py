# SPDX-License-Identifier: Apache-2.0
"""Exact Alpha.3 identity bridge for the bundled product bootstrap verifier.

The published Alpha.3 CLI archives retain combined product platform labels
(``darwin-arm64``, ``linux-x64``, and ``windows-x64``), while the signed
channel identifies the same targets by platform and architecture.  The
bundled verifier compares those representations directly and rejects the
otherwise authentic archive.  The bundled release manifests also retain
reviewed pre-channel roots. This adapter keeps the original bytes as authority,
projects only those exact product and release-identity values in the signed
channel closure, and delegates every trust and product check to the bundled
``verify_bootstrap_candidate`` implementation.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
from pathlib import Path
from typing import Any

from kungfu import release_channel, runtime_upgrade


ADAPTER_SCHEMA = "kungfu.site-alpha3-bootstrap-adapter/v1"
ADAPTER_RECEIPT_SCHEMA = "kungfu.site-alpha3-bootstrap-adapter-receipt/v1"
CHANNEL_PAYLOAD_ROOT = (
    "sha256:af360a051e2201d006e2c8f75627fc575f981e00c4f4cc998c90e130d9a40b5b"
)
SOURCE_COMMIT = "6d99af738b78eccb48885a5fd59b88a0e5e4900a"
VERSION = "4.0.0-alpha.3"
ALLOWED_PRODUCTS = {
    ("darwin-arm64", "kungfu-episodes-cli-darwin-arm64.tar.gz"): "darwin",
    ("linux-x64", "kungfu-episodes-cli-linux-x64.tar.gz"): "linux",
    ("windows-x64", "kungfu-episodes-cli-windows-x64.zip"): "win32",
}
SIGNED_MANIFEST_ROOTS = {
    ("darwin", "arm64"): (
        "sha256:485e5421107a8611b743c2aa325d021a63d410baef408997a61e4488e5f6e8bf"
    ),
    ("linux", "arm64"): (
        "sha256:3fedc3677729e056dafdffe4292c85f7b04069be5fd98d56220eb9a090fcc3c7"
    ),
    ("linux", "x64"): (
        "sha256:6d8d25473e4be07fea4373703dfb6db8d1c4d0406e6955282d0a101d8ec430e8"
    ),
    ("win32", "x64"): (
        "sha256:0f83d080f2480d9dc4b0888c9c9818bb61c0736f7b3c15b00f7a8f7603ab5dc7"
    ),
}
BUNDLED_IDENTITY_PROJECTIONS = {
    (
        "darwin",
        "arm64",
        "sha256:e53f57f6118b2e3d12350e81a827c616ce40fe7aaaca87ede1d0ad1243019e21",
    ): SIGNED_MANIFEST_ROOTS[("darwin", "arm64")],
    (
        "linux",
        "x64",
        "sha256:c7e2faa5d7912c744949e38efa75d8bccb76ab5ecddfc54cd7249d856717b451",
    ): SIGNED_MANIFEST_ROOTS[("linux", "x64")],
    (
        "win32",
        "x64",
        "sha256:478f7daf9e741d25996c6c7bee8fb341aece27989f60929bcf2dad21e463e1b4",
    ): SIGNED_MANIFEST_ROOTS[("win32", "x64")],
}


class AdapterError(ValueError):
    pass


def canonical_json(value: Any) -> bytes:
    return json.dumps(
        value,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=True,
    ).encode("utf-8")


def content_root(value: Any) -> str:
    return f"sha256:{hashlib.sha256(canonical_json(value)).hexdigest()}"


def read_channel(path: Path) -> dict[str, Any]:
    payload = path.read_bytes()
    try:
        value = json.loads(payload.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise AdapterError("the Alpha.3 channel is not valid JSON") from error
    if not isinstance(value, dict):
        raise AdapterError("the Alpha.3 channel must be an object")
    if value.get("payloadRoot") != CHANNEL_PAYLOAD_ROOT:
        raise AdapterError("the channel is outside the exact Alpha.3 adapter boundary")
    if value.get("sourceCommit") != SOURCE_COMMIT:
        raise AdapterError("the channel source commit differs from Alpha.3")
    return value


class CompatibilityJson:
    def __init__(self, delegate: Any) -> None:
        self.delegate = delegate
        self.projected_product = False

    def __getattr__(self, name: str) -> Any:
        return getattr(self.delegate, name)

    def loads(self, payload: Any, *args: Any, **kwargs: Any) -> Any:
        value = self.delegate.loads(payload, *args, **kwargs)
        if not isinstance(value, dict) or value.get("schema") != "kungfu.product.cli/v1":
            return value
        coordinate = (value.get("platform"), value.get("archive"))
        projected_platform = ALLOWED_PRODUCTS.get(coordinate)
        if (
            value.get("product") != "cli"
            or value.get("install", {}).get("source") != "archive"
            or projected_platform is None
        ):
            raise AdapterError("product.json differs from the reviewed Alpha.3 projection")
        projected = copy.deepcopy(value)
        projected["platform"] = projected_platform
        self.projected_product = True
        return projected


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("channel_index", type=Path)
    parser.add_argument("candidate_archive", type=Path)
    parser.add_argument("candidate_root", type=Path)
    parser.add_argument("--channel", required=True)
    parser.add_argument("--platform", required=True, dest="platform_name")
    parser.add_argument("--architecture", required=True)
    parser.add_argument("--version", required=True)
    parser.add_argument("--manifest-root", required=True)
    parser.add_argument("--artifact-root", required=True)
    parser.add_argument("--platform-trust", required=True)
    parser.add_argument("--trusted-key", required=True, action="append")
    parser.add_argument("--adapter-receipt", required=True, type=Path)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    channel = read_channel(args.channel_index)
    if args.version != VERSION or args.channel != "alpha":
        raise AdapterError("the adapter only accepts the exact Alpha.3 alpha channel")
    trusted_keys: dict[str, str] = {}
    for item in args.trusted_key:
        key_id, separator, public_key = item.partition("=")
        if not separator or not key_id or not public_key or key_id in trusted_keys:
            raise AdapterError("trusted key coordinates are invalid")
        trusted_keys[key_id] = public_key

    signed_manifests: dict[tuple[str, str], dict[str, Any]] = {}
    for entry in channel.get("entries", []):
        if not isinstance(entry, dict) or not isinstance(entry.get("manifest"), dict):
            raise AdapterError("the Alpha.3 channel entries are malformed")
        coordinate = (entry.get("platform"), entry.get("architecture"))
        expected_root = SIGNED_MANIFEST_ROOTS.get(coordinate)
        if expected_root is None or entry.get("manifestRoot") != expected_root:
            raise AdapterError("the Alpha.3 signed manifest roots differ from the adapter")
        signed_manifests[coordinate] = entry["manifest"]
    if set(signed_manifests) != set(SIGNED_MANIFEST_ROOTS):
        raise AdapterError("the Alpha.3 signed target closure differs from the adapter")

    original_validate = runtime_upgrade.validate_manifest
    original_release_json = release_channel.json
    compatibility_json = CompatibilityJson(original_release_json)
    projected_bundled_identity = False

    def exact_alpha3_validate(manifest: dict[str, Any]) -> dict[str, Any]:
        nonlocal projected_bundled_identity
        bundled_coordinate = (
            manifest.get("platform"),
            manifest.get("architecture"),
            content_root(manifest),
        )
        signed_root = BUNDLED_IDENTITY_PROJECTIONS.get(bundled_coordinate)
        if signed_root is None:
            return original_validate(manifest)
        coordinate = bundled_coordinate[:2]
        signed_manifest = signed_manifests[coordinate]
        if content_root(signed_manifest) != signed_root:
            raise AdapterError("the signed Alpha.3 identity projection root differs")
        projected_bundled_identity = True
        return original_validate(signed_manifest)

    runtime_upgrade.validate_manifest = exact_alpha3_validate
    release_channel.json = compatibility_json
    try:
        receipt = release_channel.verify_bootstrap_candidate(
            channel_index=args.channel_index,
            trusted_keys=trusted_keys,
            candidate_archive=args.candidate_archive,
            candidate_root=args.candidate_root,
            channel=args.channel,
            platform_name=args.platform_name,
            architecture=args.architecture,
            version=args.version,
            manifest_root=args.manifest_root,
            artifact_root=args.artifact_root,
            platform_trust=args.platform_trust,
        )
    finally:
        runtime_upgrade.validate_manifest = original_validate
        release_channel.json = original_release_json
    if not compatibility_json.projected_product:
        raise AdapterError("the expected Alpha.3 product platform projection was not used")

    adapter_digest = f"sha256:{hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}"
    adapter_receipt = {
        "schema": ADAPTER_RECEIPT_SCHEMA,
        "state": "verified",
        "adapter": {"schema": ADAPTER_SCHEMA, "digest": adapter_digest},
        "compatibilityMode": "signed-alpha3-identity-projection",
        "bundledIdentityProjection": projected_bundled_identity,
        "channelPayloadRoot": channel["payloadRoot"],
        "manifestRoot": args.manifest_root,
        "nativeReceiptRoot": receipt["receiptRoot"],
        "platform": args.platform_name,
        "architecture": args.architecture,
        "productVersion": args.version,
    }
    adapter_receipt["receiptRoot"] = content_root(adapter_receipt)
    args.adapter_receipt.write_text(
        json.dumps(adapter_receipt, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(receipt, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (AdapterError, OSError, release_channel.ReleaseChannelError) as error:
        raise SystemExit(f"alpha3-bootstrap-adapter: {error}") from error
