# SPDX-License-Identifier: Apache-2.0
"""Exact Alpha.2 bridge for the bundled product bootstrap verifier.

The published Alpha.2 channel added two signed ``artifact.name`` fields after
the Alpha.2 CLI archives were built, while those archives also retain their
older combined product platform labels.  The bundled verifier rejects both
representations.  This adapter keeps the original bytes as authority, permits
only those exact field projections in the one reviewed channel root, and
delegates every trust and product check to the bundled
``verify_bootstrap_candidate`` implementation.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
from pathlib import Path
from typing import Any, Mapping

from kungfu import release_channel, runtime_upgrade


ADAPTER_SCHEMA = "kungfu.site-alpha2-bootstrap-adapter/v1"
ADAPTER_RECEIPT_SCHEMA = "kungfu.site-alpha2-bootstrap-adapter-receipt/v1"
CHANNEL_PAYLOAD_ROOT = (
    "sha256:8c031dd420e15ddde5b4e751cb4dcc3c0a2d4bd67956d295918e21165de6abdd"
)
SOURCE_COMMIT = "b0cff8236b8b3746f8028b9d519ed3b0e26096c9"
VERSION = "4.0.0-alpha.2"
ALLOWED_NAMES = {
    (
        "desktop",
        "Kungfu-Episodes-4.0.0-alpha.2-macos-arm64.zip",
        "https://github.com/kungfu-systems/kungfu/releases/download/"
        "v4.0.0-alpha.2/Kungfu-Episodes-4.0.0-alpha.2-macos-arm64.zip",
    ),
    (
        "cli",
        "kungfu-episodes-cli-darwin-arm64.tar.gz",
        "https://github.com/kungfu-systems/kungfu/releases/download/"
        "v4.0.0-alpha.2/kungfu-episodes-cli-darwin-arm64.tar.gz",
    ),
}
ALLOWED_PRODUCTS = {
    ("darwin-arm64", "kungfu-episodes-cli-darwin-arm64.tar.gz"): "darwin",
    ("linux-x64", "kungfu-episodes-cli-linux-x64.tar.gz"): "linux",
    ("windows-x64", "kungfu-episodes-cli-windows-x64.zip"): "win32",
}
SIGNED_MANIFEST_ROOTS = {
    ("darwin", "arm64"): (
        "sha256:96e0a3f78bfa65a8ae06f4fd4bc035cc09211afad499ad6f905a380e1c49d2ae"
    ),
    ("linux", "x64"): (
        "sha256:a81d194ebe7ea874753a66adaa1db6d56121c87cb6e3bf0ae7f6a97045d3a280"
    ),
    ("win32", "x64"): (
        "sha256:094448e272594dce2626fb9d4fe893e2608e700c1a86a5463f2bb3f4e2875551"
    ),
}
BUNDLED_IDENTITY_PROJECTIONS = {
    (
        "darwin",
        "arm64",
        "sha256:3f37f5469e1ebc95d2bb44ba46e259a7bc98e262d7b84f1a51c7fcb9bf79d53c",
    ): SIGNED_MANIFEST_ROOTS[("darwin", "arm64")],
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
        raise AdapterError("the Alpha.2 channel is not valid JSON") from error
    if not isinstance(value, dict):
        raise AdapterError("the Alpha.2 channel must be an object")
    if value.get("payloadRoot") != CHANNEL_PAYLOAD_ROOT:
        raise AdapterError("the channel is outside the exact Alpha.2 adapter boundary")
    if value.get("sourceCommit") != SOURCE_COMMIT:
        raise AdapterError("the channel source commit differs from Alpha.2")
    return value


def project_manifest(
    manifest: Mapping[str, Any],
    original_validate: Any,
) -> dict[str, Any]:
    value = copy.deepcopy(dict(manifest))
    if value.get("productVersion") != VERSION or value.get("sourceCommit") != SOURCE_COMMIT:
        return original_validate(value)

    removed: set[tuple[str, str, str]] = set()
    artifacts = value.get("artifacts")
    if not isinstance(artifacts, list):
        return original_validate(value)
    for artifact in artifacts:
        if not isinstance(artifact, dict) or "name" not in artifact:
            continue
        coordinate = (artifact.get("kind"), artifact.get("name"), artifact.get("url"))
        if value.get("platform") != "darwin" or value.get("architecture") != "arm64":
            raise AdapterError("artifact.name appeared outside the reviewed Darwin slice")
        if coordinate not in ALLOWED_NAMES:
            raise AdapterError("artifact.name differs from the reviewed Alpha.2 projection")
        removed.add(coordinate)
        del artifact["name"]
    if removed and removed != ALLOWED_NAMES:
        raise AdapterError("the Alpha.2 artifact.name projection is incomplete")
    return original_validate(value)


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
            raise AdapterError("product.json differs from the reviewed Alpha.2 projection")
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
        raise AdapterError("the adapter only accepts the exact Alpha.2 alpha channel")
    trusted_keys: dict[str, str] = {}
    for item in args.trusted_key:
        key_id, separator, public_key = item.partition("=")
        if not separator or not key_id or not public_key or key_id in trusted_keys:
            raise AdapterError("trusted key coordinates are invalid")
        trusted_keys[key_id] = public_key

    signed_manifests: dict[tuple[str, str], dict[str, Any]] = {}
    for entry in channel.get("entries", []):
        if not isinstance(entry, dict) or not isinstance(entry.get("manifest"), dict):
            raise AdapterError("the Alpha.2 channel entries are malformed")
        coordinate = (entry.get("platform"), entry.get("architecture"))
        expected_root = SIGNED_MANIFEST_ROOTS.get(coordinate)
        if expected_root is None or entry.get("manifestRoot") != expected_root:
            raise AdapterError("the Alpha.2 signed manifest roots differ from the adapter")
        signed_manifests[coordinate] = entry["manifest"]
    if set(signed_manifests) != set(SIGNED_MANIFEST_ROOTS):
        raise AdapterError("the Alpha.2 signed target closure differs from the adapter")

    original_validate = runtime_upgrade.validate_manifest
    original_release_json = release_channel.json
    compatibility_json = CompatibilityJson(original_release_json)
    projected_bundled_identity = False

    def exact_alpha2_validate(manifest: Mapping[str, Any]) -> dict[str, Any]:
        nonlocal projected_bundled_identity
        bundled_coordinate = (
            manifest.get("platform"),
            manifest.get("architecture"),
            content_root(manifest),
        )
        signed_root = BUNDLED_IDENTITY_PROJECTIONS.get(bundled_coordinate)
        if signed_root is not None:
            coordinate = bundled_coordinate[:2]
            signed_manifest = signed_manifests[coordinate]
            if content_root(signed_manifest) != signed_root:
                raise AdapterError("the signed Alpha.2 identity projection root differs")
            projected_bundled_identity = True
            return project_manifest(signed_manifest, original_validate)
        return project_manifest(manifest, original_validate)

    runtime_upgrade.validate_manifest = exact_alpha2_validate
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
        raise AdapterError("the expected Alpha.2 product platform projection was not used")

    adapter_digest = f"sha256:{hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}"
    adapter_receipt = {
        "schema": ADAPTER_RECEIPT_SCHEMA,
        "state": "verified",
        "adapter": {"schema": ADAPTER_SCHEMA, "digest": adapter_digest},
        "compatibilityMode": "signed-alpha2-field-projection",
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
        raise SystemExit(f"alpha2-bootstrap-adapter: {error}") from error
