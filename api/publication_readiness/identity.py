"""Deterministic release-candidate identity from immutable bundle content."""

from __future__ import annotations

import hashlib
import json
from typing import Any

from bundle_builder.build_bundle import (
    artifact_dir_name,
    compute_content_sha256,
    content_sha256_prefix,
    validate_bundle_id,
)


def deterministic_release_bundle_id(content_sha256: str) -> str:
    """
    Content-addressed logical bundle_id.

    Two byte-identical candidates resolve to the same id; differing bytes get
    a different id prefix. Does not use wall-clock time or random UUIDs.
    """
    prefix = content_sha256_prefix(content_sha256)
    bundle_id = f"bundle_noncommercial_{prefix}"
    return validate_bundle_id(bundle_id)


def release_candidate_storage_dir(bundle_id: str, content_sha256: str) -> str:
    """Physical artifact directory per offline-bundle-versioning.md."""
    return artifact_dir_name(bundle_id, content_sha256)


def release_candidate_fingerprint(*, bundle_id: str, content_sha256: str) -> str:
    """
    Deterministic fingerprint binding human authorization to exact candidate bytes.

    Authorization of bundle A must not authorize bundle B.
    """
    payload = {
        "bundle_id": bundle_id,
        "content_sha256": content_sha256,
    }
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    return f"sha256:{digest}"


def identity_from_manifest_files(files_list: list[dict[str, Any]]) -> dict[str, str]:
    """Derive content identity from manifest files[] payload list."""
    content_sha256 = compute_content_sha256(files_list)
    bundle_id = deterministic_release_bundle_id(content_sha256)
    return {
        "bundle_id": bundle_id,
        "content_sha256": content_sha256,
        "artifact_dir_name": release_candidate_storage_dir(bundle_id, content_sha256),
        "candidate_fingerprint": release_candidate_fingerprint(
            bundle_id=bundle_id,
            content_sha256=content_sha256,
        ),
    }
