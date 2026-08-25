"""Full provenance scan for distribution candidates."""

from __future__ import annotations

from typing import Any

from malipense_version_delta.compare import load_jsonl_records
from source_registry.load import SOURCE_MALIPENSE, load_source_registry

from product_boundary.paths import default_paths as product1a_paths


def _record_has_substantive_provenance(
    record: dict[str, Any], *, registry: dict[str, dict[str, Any]]
) -> tuple[bool, str | None]:
    source_id = str(record.get("source_id") or "")
    if not source_id:
        return False, "missing_source_id"
    if source_id not in registry:
        return False, "unresolvable_source_id"
    locator = record.get("record_locator")
    if isinstance(locator, dict) and locator:
        return True, None
    if source_id == SOURCE_MALIPENSE and record.get("ir_id"):
        return True, None
    return False, "missing_substantive_provenance"


def scan_record_provenance(
    records_path: Any,
    *,
    repo_root: Any,
) -> dict[str, Any]:
    registry = load_source_registry(repo_root)
    records = load_jsonl_records(records_path)
    missing: list[dict[str, str]] = []
    unresolvable: set[str] = set()
    with_prov = 0
    for record in records:
        ok, reason = _record_has_substantive_provenance(record, registry=registry)
        if ok:
            with_prov += 1
        else:
            ir_id = str(record.get("ir_id") or "")
            if reason == "unresolvable_source_id":
                unresolvable.add(str(record.get("source_id") or ""))
            missing.append({"ir_id": ir_id, "reason": reason or "unknown"})
    return {
        "records_scanned": len(records),
        "records_with_source_provenance": with_prov,
        "records_missing_source_provenance": len(missing),
        "unresolvable_source_ids": sorted(unresolvable),
        "missing_samples": missing[:20],
    }


def _derived_item_provenance(
    item: dict[str, Any],
    *,
    record_source_by_id: dict[str, str],
    registry: dict[str, dict[str, Any]],
) -> tuple[str, str | None]:
    """Return (status, detail) where status is PASS, METADATA_ONLY, or BLOCK."""
    target_ids = item.get("target_ir_ids") or item.get("ir_ids") or []
    if isinstance(target_ids, str):
        target_ids = [target_ids]
    source_terms = item.get("alias_source_term") or item.get("source_term")
    if not target_ids and not source_terms:
        return "METADATA_ONLY", "pure_structural_metadata"
    deps: set[str] = set()
    for tid in target_ids:
        if isinstance(tid, str):
            deps.add(tid)
    for record_id, source_id in record_source_by_id.items():
        if record_id in deps:
            if source_id not in registry:
                return "BLOCK", f"unresolvable_source_for_dependency:{source_id}"
    if deps:
        return "PASS", "dependency_provenance_preserved_via_record_source_id"
    return "BLOCK", "unknown_substantive_provenance"


def scan_derived_artifact_provenance(
    *,
    repo_root: Any,
    candidate_record_ids: set[str],
) -> dict[str, Any]:
    paths = product1a_paths(repo_root)
    registry = load_source_registry(repo_root)
    records = load_jsonl_records(paths.internal_records)
    record_source_by_id = {
        str(r["ir_id"]): str(r.get("source_id") or "")
        for r in records
        if r.get("ir_id")
    }

    def scan_file(path: Any, label: str) -> dict[str, Any]:
        if not path.is_file():
            return {"artifact": label, "scanned": 0, "pass": 0, "blocked": 0}
        rows = load_jsonl_records(path)
        pass_n = blocked = metadata = 0
        blocked_samples: list[dict[str, str]] = []
        for row in rows:
            # Only audit rows that touch candidate-visible records.
            targets = row.get("target_ir_ids") or row.get("ir_ids") or []
            if isinstance(targets, str):
                targets = [targets]
            touches_candidate = any(str(t) in candidate_record_ids for t in targets)
            if not touches_candidate and label != "search_index":
                continue
            status, detail = _derived_item_provenance(
                row, record_source_by_id=record_source_by_id, registry=registry
            )
            if status == "PASS":
                pass_n += 1
            elif status == "METADATA_ONLY":
                metadata += 1
            else:
                blocked += 1
                if len(blocked_samples) < 5:
                    blocked_samples.append({"detail": detail or "blocked"})
        return {
            "artifact": label,
            "scanned": pass_n + blocked + metadata,
            "pass": pass_n,
            "metadata_only": metadata,
            "blocked": blocked,
            "blocked_samples": blocked_samples,
        }

    aliases = scan_file(paths.aliases, "aliases")
    supplements = scan_file(paths.supplements, "supplements")
    variants = scan_file(paths.target_variants, "variants")

    # Search index: distributed transformed lexical text — covered by bundle manifest.
    search_stats = {"artifact": "search_index", "mechanism": "bundle_level_source_license_manifest"}
    if paths.internal_search.is_file():
        search_rows = load_jsonl_records(paths.internal_search)
        candidate_postings = 0
        for row in search_rows:
            ir_ids = [str(x) for x in (row.get("ir_ids") or [])]
            if any(i in candidate_record_ids for i in ir_ids):
                candidate_postings += 1
        search_stats["candidate_postings"] = candidate_postings
        search_stats["license_coverage"] = (
            "search_keys_derived_from_malidaba_covered_by_bundle_manifest_and_provenance_mapping"
        )

    return {
        "aliases": aliases,
        "supplements": supplements,
        "variants": variants,
        "search": search_stats,
        "derived_lexical_artifacts_with_unknown_substantive_provenance": (
            aliases.get("blocked", 0)
            + supplements.get("blocked", 0)
            + variants.get("blocked", 0)
        ),
    }
