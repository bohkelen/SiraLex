"""Owner-rights leakage audit across records, search index, and projections."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from malipense_version_delta.compare import load_jsonl_records
from source_registry.load import SOURCE_OWNER, load_source_registry, source_distribution_posture

from .model import GATE_BLOCK, GATE_PASS


def audit_rights_leakage(
    *,
    repo_root: Path,
    records_path: Path,
    search_index_path: Path,
    owner_ir_path: Path | None = None,
) -> dict[str, Any]:
    registry = load_source_registry(repo_root)
    owner_posture = source_distribution_posture(registry.get(SOURCE_OWNER) or {})

    owner_record_ids: set[str] = set()
    if owner_ir_path and owner_ir_path.is_file():
        for row in load_jsonl_records(owner_ir_path):
            ir_id = str(row.get("ir_id") or "")
            if ir_id:
                owner_record_ids.add(ir_id)

    owner_lexical_rows = 0
    unknown_rights_rows = 0
    unresolved_distribution = 0

    for row in load_jsonl_records(records_path):
        source_id = str(row.get("source_id") or "")
        if source_id == SOURCE_OWNER:
            owner_lexical_rows += 1
        posture = source_distribution_posture(registry.get(source_id) or {})
        if posture.get("distribution_state") in (
            "UNKNOWN",
            "DISTRIBUTION_PERMISSION_NOT_RECORDED",
            "REQUIRES_RIGHTS_REVIEW",
        ):
            if source_id == SOURCE_OWNER:
                unresolved_distribution += 1
            elif source_id and source_id not in registry:
                unknown_rights_rows += 1

    owner_index_postings = 0
    owner_only_keys = 0
    for row in load_jsonl_records(search_index_path):
        ir_ids = [str(x) for x in (row.get("ir_ids") or [])]
        owner_hits = [i for i in ir_ids if i in owner_record_ids]
        if owner_hits:
            owner_index_postings += len(owner_hits)
        if ir_ids and all(i in owner_record_ids for i in ir_ids):
            owner_only_keys += 1

    errors: list[str] = []
    if owner_lexical_rows:
        errors.append(f"owner lexical rows in records: {owner_lexical_rows}")
    if owner_index_postings:
        errors.append(f"owner index mappings: {owner_index_postings}")
    if owner_only_keys:
        errors.append(f"owner-only search keys: {owner_only_keys}")
    if unknown_rights_rows:
        errors.append(f"unknown-rights substantive records: {unknown_rights_rows}")
    if unresolved_distribution:
        errors.append(f"unresolved distribution rights rows: {unresolved_distribution}")

    status = GATE_PASS if not errors else GATE_BLOCK
    return {
        "status": status,
        "owner_lexical_rows": owner_lexical_rows,
        "owner_index_postings": owner_index_postings,
        "owner_only_search_keys": owner_only_keys,
        "unknown_rights_substantive_records": unknown_rights_rows,
        "unresolved_distribution_rights": unresolved_distribution,
        "errors": errors,
        "owner_posture": owner_posture.get("distribution_state"),
    }


def audit_portable_bundle(bundle_dir: Path, portable_dir: Path) -> dict[str, Any]:
    """Copy bundle to isolated location and verify self-contained integrity."""
    import shutil

    if portable_dir.exists():
        shutil.rmtree(portable_dir)
    shutil.copytree(bundle_dir, portable_dir)

    manifest = json.loads((portable_dir / "bundle.manifest.json").read_text(encoding="utf-8"))
    required = [
        "bundle.manifest.json",
        "records.jsonl",
        "search_index.jsonl",
        "checksums.sha256",
        "ATTRIBUTION.txt",
        "DATA_LICENSES.md",
    ]
    missing = [name for name in required if not (portable_dir / name).is_file()]
    errors: list[str] = []
    if missing:
        errors.extend(f"portable missing: {m}" for m in missing)

    dist = manifest.get("distribution") or {}
    if not dist.get("noncommercial_distribution"):
        errors.append("portable manifest missing noncommercial_distribution flag")

    status = GATE_PASS if not errors else GATE_BLOCK
    return {"status": status, "errors": errors, "portable_dir": str(portable_dir)}
