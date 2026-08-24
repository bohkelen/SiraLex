"""Semantic content identity vs immutable release artifact identity."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from bundle_builder.build_bundle import (
    compute_content_sha256,
    content_sha256_prefix,
    sha256_file,
    validate_bundle_id,
)

# Authorization-relevant portable distributed files (excludes manifest from
# checksums.sha256 per bundle builder convention, but included in release fingerprint).
RELEASE_DISTRIBUTED_FILES = (
    "records.jsonl",
    "search_index.jsonl",
    "bundle.manifest.json",
    "checksums.sha256",
    "ATTRIBUTION.txt",
    "DATA_LICENSES.md",
)


def deterministic_semantic_bundle_id(semantic_content_sha256: str) -> str:
    """
    Logical product-line bundle_id from semantic payload hash.

    Two byte-identical semantic payloads resolve to the same id.
    """
    prefix = content_sha256_prefix(semantic_content_sha256)
    bundle_id = f"bundle_noncommercial_{prefix}"
    return validate_bundle_id(bundle_id)


def compute_semantic_candidate_fingerprint(
    *, bundle_id: str, semantic_content_sha256: str
) -> str:
    """
    Semantic content identity fingerprint (payload files only).

    Preserved for compatibility; NOT sufficient for publication authorization.
    """
    payload = {
        "bundle_id": bundle_id,
        "semantic_content_sha256": semantic_content_sha256,
    }
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    return f"sha256:{digest}"


def collect_distributed_file_hashes(bundle_dir: Path) -> dict[str, str]:
    """SHA-256 for every authorization-relevant distributed file present."""
    hashes: dict[str, str] = {}
    for name in RELEASE_DISTRIBUTED_FILES:
        path = bundle_dir / name
        if path.is_file():
            hashes[name] = sha256_file(path)
    return hashes


def list_present_distributed_files(bundle_dir: Path) -> list[str]:
    return sorted(
        name for name in RELEASE_DISTRIBUTED_FILES if (bundle_dir / name).is_file()
    )


def compute_release_artifact_fingerprint(
    *,
    bundle_id: str,
    semantic_content_sha256: str,
    distributed_file_hashes: dict[str, str],
) -> str:
    """
    Exact portable release artifact identity.

    Binds every authorization-relevant distributed byte. Stored outside the
    artifact byte set (receipt / authorization worksheet) to avoid recursion.
    """
    distributed_files = {
        path: distributed_file_hashes[path]
        for path in sorted(distributed_file_hashes)
    }
    payload = {
        "bundle_id": bundle_id,
        "semantic_content_sha256": semantic_content_sha256,
        "distributed_files": distributed_files,
    }
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    return f"sha256:{digest}"


def release_artifact_fingerprint_prefix(release_artifact_fingerprint: str, *, length: int = 8) -> str:
    if not release_artifact_fingerprint.startswith("sha256:"):
        raise ValueError(f"invalid release fingerprint: {release_artifact_fingerprint!r}")
    hex_part = release_artifact_fingerprint.split(":", 1)[1]
    if length < 1 or length > len(hex_part):
        raise ValueError(f"invalid release fingerprint prefix length: {length}")
    return hex_part[:length]


def release_artifact_dir_name(bundle_id: str, release_artifact_fingerprint: str) -> str:
    """
    Physical immutable release directory.

    Shape: `{bundle_id}__{release_artifact_prefix8}`

    Distinct release bytes (e.g. manifest-only change) MUST NOT reuse the same
    path as a different release artifact. Semantic-only content prefix is NOT
    used here.
    """
    validated = validate_bundle_id(bundle_id)
    prefix = release_artifact_fingerprint_prefix(release_artifact_fingerprint)
    return f"{validated}__{prefix}"


def semantic_artifact_dir_name(bundle_id: str, semantic_content_sha256: str) -> str:
    """Legacy semantic content directory naming (PRODUCT1 / ML1C1A convention)."""
    validated = validate_bundle_id(bundle_id)
    prefix = content_sha256_prefix(semantic_content_sha256)
    return f"{validated}__{prefix}"


def identity_from_frozen_bundle(
    bundle_dir: Path,
    *,
    manifest_files_list: list[dict[str, Any]] | None = None,
) -> dict[str, str]:
    """Derive full identity tuple from a materialized release candidate directory."""
    if manifest_files_list is None:
        import json

        manifest_path = bundle_dir / "bundle.manifest.json"
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        manifest_files_list = manifest.get("files") or []

    semantic_content_sha256 = compute_content_sha256(manifest_files_list)
    bundle_id = deterministic_semantic_bundle_id(semantic_content_sha256)
    file_hashes = collect_distributed_file_hashes(bundle_dir)
    semantic_fp = compute_semantic_candidate_fingerprint(
        bundle_id=bundle_id,
        semantic_content_sha256=semantic_content_sha256,
    )
    release_fp = compute_release_artifact_fingerprint(
        bundle_id=bundle_id,
        semantic_content_sha256=semantic_content_sha256,
        distributed_file_hashes=file_hashes,
    )
    return {
        "semantic_bundle_id": bundle_id,
        "semantic_content_sha256": semantic_content_sha256,
        "semantic_candidate_fingerprint": semantic_fp,
        "release_artifact_fingerprint": release_fp,
        "release_artifact_dir_name": release_artifact_dir_name(bundle_id, release_fp),
        "distributed_file_hashes": file_hashes,
        # Backward-compatible aliases (semantic-only; deprecated for authorization)
        "bundle_id": bundle_id,
        "content_sha256": semantic_content_sha256,
        "candidate_fingerprint": semantic_fp,
        "artifact_dir_name": release_artifact_dir_name(bundle_id, release_fp),
    }


def identity_from_manifest_files(files: list[dict[str, Any]]) -> dict[str, str]:
    """Semantic identity from manifest files[] only (no distributed sidecars)."""
    semantic_content_sha256 = compute_content_sha256(files)
    bundle_id = deterministic_semantic_bundle_id(semantic_content_sha256)
    semantic_fp = compute_semantic_candidate_fingerprint(
        bundle_id=bundle_id,
        semantic_content_sha256=semantic_content_sha256,
    )
    return {
        "semantic_bundle_id": bundle_id,
        "semantic_content_sha256": semantic_content_sha256,
        "semantic_candidate_fingerprint": semantic_fp,
        "bundle_id": bundle_id,
        "content_sha256": semantic_content_sha256,
        "candidate_fingerprint": semantic_fp,
    }


# Backward-compatible aliases
deterministic_release_bundle_id = deterministic_semantic_bundle_id


def release_candidate_fingerprint(*, bundle_id: str, content_sha256: str) -> str:
    return compute_semantic_candidate_fingerprint(
        bundle_id=bundle_id,
        semantic_content_sha256=content_sha256,
    )


def release_candidate_storage_dir(bundle_id: str, content_sha256: str) -> str:
    """Deprecated: semantic-only directory. Prefer release_artifact_dir_name."""
    return semantic_artifact_dir_name(bundle_id, content_sha256)
