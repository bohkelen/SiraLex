"""Checksum and release-artifact closure audits."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from bundle_builder.build_bundle import sha256_file

from .identity import (
    RELEASE_DISTRIBUTED_FILES,
    collect_distributed_file_hashes,
    compute_release_artifact_fingerprint,
    identity_from_frozen_bundle,
    list_present_distributed_files,
)
from .model import GATE_BLOCK, GATE_PASS

CHECKSUMS_COVERED_FILES = ("records.jsonl", "search_index.jsonl")


def audit_checksum_closure(bundle_dir: Path) -> dict[str, Any]:
    """
    Audit checksums.sha256 against repository convention.

    Payload files (records.jsonl, search_index.jsonl) must be covered.
    Sidecars and manifest are covered by release_artifact_fingerprint instead.
    """
    errors: list[str] = []
    manifest_path = bundle_dir / "bundle.manifest.json"
    checksums_path = bundle_dir / "checksums.sha256"

    if not manifest_path.is_file():
        return _result(GATE_BLOCK, errors=["bundle.manifest.json missing"])

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest_files = manifest.get("files") or []

    if not checksums_path.is_file():
        errors.append("checksums.sha256 missing")
        return _result(GATE_BLOCK, errors=errors)

    checksum_map = _parse_checksums_file(checksums_path)
    required_payload = set(CHECKSUMS_COVERED_FILES)

    for req in required_payload:
        if req not in checksum_map:
            errors.append(f"checksums.sha256 missing required entry: {req}")

    for path, declared_hex in checksum_map.items():
        file_path = bundle_dir / path
        if not file_path.is_file():
            errors.append(f"checksums entry references missing file: {path}")
            continue
        actual_hex = sha256_file(file_path).split(":", 1)[1]
        if actual_hex != declared_hex:
            errors.append(f"checksum mismatch for {path}")

    manifest_paths = {f["path"] for f in manifest_files if isinstance(f, dict)}
    for path in required_payload:
        if path not in manifest_paths:
            errors.append(f"manifest files[] missing required payload: {path}")

    for entry in manifest_files:
        if not isinstance(entry, dict):
            continue
        path = entry.get("path")
        if not isinstance(path, str):
            continue
        file_path = bundle_dir / path
        if not file_path.is_file():
            errors.append(f"manifest lists missing file: {path}")
            continue
        declared = entry.get("sha256")
        actual = sha256_file(file_path)
        if declared != actual:
            errors.append(f"manifest hash mismatch for {path}")

    for path in checksum_map:
        if path not in required_payload:
            errors.append(f"unexpected checksums.sha256 entry (repo convention): {path}")

    for sidecar in ("ATTRIBUTION.txt", "DATA_LICENSES.md"):
        if not (bundle_dir / sidecar).is_file():
            errors.append(f"missing required sidecar: {sidecar}")

    status = GATE_PASS if not errors else GATE_BLOCK
    return _result(
        status,
        errors=errors,
        checksum_entries=sorted(checksum_map.keys()),
        checksums_covered=list(CHECKSUMS_COVERED_FILES),
    )


def audit_release_artifact_closure(bundle_dir: Path) -> dict[str, Any]:
    """Verify every authorization-relevant distributed file is present and fingerprintable."""
    errors: list[str] = []
    present = list_present_distributed_files(bundle_dir)
    missing = [name for name in RELEASE_DISTRIBUTED_FILES if name not in present]
    if missing:
        errors.extend(f"missing distributed file: {name}" for name in missing)

    identity = identity_from_frozen_bundle(bundle_dir)
    file_hashes = collect_distributed_file_hashes(bundle_dir)
    recomputed = compute_release_artifact_fingerprint(
        bundle_id=identity["semantic_bundle_id"],
        semantic_content_sha256=identity["semantic_content_sha256"],
        distributed_file_hashes=file_hashes,
    )
    if recomputed != identity["release_artifact_fingerprint"]:
        errors.append("release_artifact_fingerprint mismatch on recompute")

    status = GATE_PASS if not errors else GATE_BLOCK
    return _result(
        status,
        errors=errors,
        portable_artifact_files=present,
        release_fingerprint_covered=present,
        checksums_covered=list(CHECKSUMS_COVERED_FILES),
        release_fingerprint_contract=list(RELEASE_DISTRIBUTED_FILES),
        release_artifact_fingerprint=identity["release_artifact_fingerprint"],
        distributed_file_hashes=file_hashes,
    )


def _parse_checksums_file(path: Path) -> dict[str, str]:
    result: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        parts = line.split("  ", 1)
        if len(parts) != 2:
            continue
        result[parts[1].strip()] = parts[0].strip()
    return result


def _result(status: str, *, errors: list[str], **extra: Any) -> dict[str, Any]:
    row: dict[str, Any] = {"status": status, "errors": errors}
    row.update(extra)
    return row
