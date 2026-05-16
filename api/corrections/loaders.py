"""Loaders for correctionset manifests, correction records, and IR snapshots."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from .helpers import parse_iso8601_utc
from .models import CorrectionRecord, CorrectionSet, CorrectionSetManifest


def load_correctionset_manifest(path: Path) -> CorrectionSetManifest:
    with open(path, "r", encoding="utf-8") as f:
        raw = json.load(f)

    return CorrectionSetManifest(
        correctionset_id=str(raw.get("correctionset_id", "")),
        correctionset_version=str(raw.get("correctionset_version", "")),
        schema_id=str(raw.get("schema_id", "")),
        created_at=str(raw.get("created_at", "")),
        target_ir_version=str(raw.get("target_ir_version", "")),
        files=raw.get("files", []) if isinstance(raw.get("files", []), list) else [],
        content_sha256=str(raw.get("content_sha256", "")),
    )


def _validate_manifest_contract(manifest: CorrectionSetManifest) -> None:
    if manifest.schema_id != "correctionset_manifest_v1":
        raise ValueError("invalid correctionset manifest: schema_id must be correctionset_manifest_v1")
    if not manifest.correctionset_id:
        raise ValueError("invalid correctionset manifest: correctionset_id is required")
    if not manifest.correctionset_version:
        raise ValueError("invalid correctionset manifest: correctionset_version is required")
    if not manifest.created_at:
        raise ValueError("invalid correctionset manifest: created_at is required")
    parse_iso8601_utc(manifest.created_at)
    if not manifest.target_ir_version:
        raise ValueError("invalid correctionset manifest: target_ir_version is required")
    if not manifest.content_sha256:
        raise ValueError("invalid correctionset manifest: content_sha256 is required")
    if not manifest.files:
        raise ValueError("invalid correctionset manifest: files[] is required")

    for idx, entry in enumerate(manifest.files):
        if not isinstance(entry, dict):
            raise ValueError(f"invalid correctionset manifest: files[{idx}] must be object")
        required_keys = {"path", "sha256", "byte_length"}
        missing = required_keys - set(entry.keys())
        if missing:
            raise ValueError(
                f"invalid correctionset manifest: files[{idx}] missing keys: {', '.join(sorted(missing))}"
            )
        if not isinstance(entry["path"], str) or not entry["path"]:
            raise ValueError(f"invalid correctionset manifest: files[{idx}].path must be non-empty string")
        if not isinstance(entry["sha256"], str) or not entry["sha256"].startswith("sha256:"):
            raise ValueError(
                f"invalid correctionset manifest: files[{idx}].sha256 must be sha256:... string"
            )
        if not isinstance(entry["byte_length"], int) or entry["byte_length"] < 0:
            raise ValueError(f"invalid correctionset manifest: files[{idx}].byte_length must be >= 0 int")


def _validate_corrections_file_integrity(
    manifest: CorrectionSetManifest, corrections_path: Path
) -> None:
    matches = [
        entry for entry in manifest.files
        if Path(str(entry["path"])).name == corrections_path.name
    ]
    if not matches:
        raise ValueError(
            "invalid correctionset manifest: files[] must include corrections JSONL entry"
        )
    entry = matches[0]
    expected_size = int(entry["byte_length"])
    actual_size = corrections_path.stat().st_size
    if actual_size != expected_size:
        raise ValueError(
            "corrections.jsonl integrity mismatch: byte_length differs from manifest"
        )

    data = corrections_path.read_bytes()
    actual_sha = f"sha256:{hashlib.sha256(data).hexdigest()}"
    expected_sha = str(entry["sha256"])
    if actual_sha != expected_sha:
        raise ValueError(
            "corrections.jsonl integrity mismatch: sha256 differs from manifest"
        )


def load_corrections_jsonl(path: Path) -> list[CorrectionRecord]:
    records: list[CorrectionRecord] = []
    with open(path, "r", encoding="utf-8") as f:
        for line_number, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            raw = json.loads(line)
            if not isinstance(raw, dict):
                raise ValueError(f"corrections line {line_number} must be a JSON object")
            records.append(
                CorrectionRecord(
                    raw=raw,
                    source_line_number=line_number,
                    source_file=str(path),
                )
            )
    return records


def load_correctionset(manifest_path: Path, corrections_path: Path) -> CorrectionSet:
    manifest = load_correctionset_manifest(manifest_path)
    _validate_manifest_contract(manifest)
    _validate_corrections_file_integrity(manifest, corrections_path)
    # Deliberately deferred in v1 implementation: verification of manifest.content_sha256
    # canonicalization semantics. This remains explicitly deferred by spec.
    records = load_corrections_jsonl(corrections_path)
    return CorrectionSet(manifest=manifest, records=records)


def load_ir_jsonl(path: Path) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    with open(path, "r", encoding="utf-8") as f:
        for line_number, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            raw = json.loads(line)
            if not isinstance(raw, dict):
                raise ValueError(f"IR line {line_number} must be a JSON object")
            records.append(raw)
    return records

