"""Checksum closure audit for release-candidate bundles."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from bundle_builder.build_bundle import sha256_file

from .freeze import DISTRIBUTED_FILES
from .model import GATE_BLOCK, GATE_PASS


def audit_checksum_closure(bundle_dir: Path) -> dict[str, Any]:
    """
    Audit checksums.sha256 against repository convention.

    Payload files (records.jsonl, search_index.jsonl) must be covered.
    Detects missing, extra, mismatch, and manifest disagreement.
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
    required_payload = {"records.jsonl", "search_index.jsonl"}

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

    # Unexpected checksum entries for non-existent convention files.
    for path in checksum_map:
        if path not in required_payload:
            errors.append(f"unexpected checksums.sha256 entry (repo convention): {path}")

    # Sidecars should exist for publication candidate but are not in checksums.sha256
    # per current bundle builder convention — verify presence only.
    for sidecar in ("ATTRIBUTION.txt", "DATA_LICENSES.md"):
        if not (bundle_dir / sidecar).is_file():
            errors.append(f"missing required sidecar: {sidecar}")

    status = GATE_PASS if not errors else GATE_BLOCK
    return _result(status, errors=errors, checksum_entries=sorted(checksum_map.keys()))


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
