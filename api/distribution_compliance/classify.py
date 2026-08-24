"""Noncommercial distribution eligibility classification."""

from __future__ import annotations

from typing import Any

from source_registry.load import (
    SOURCE_MALIPENSE,
    SOURCE_OWNER,
    load_source_registry,
    resolve_source_entry,
    source_distribution_posture,
)

from .model import ExclusionReason


def classify_record_for_noncommercial(
    record: dict[str, Any],
    *,
    registry: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    source_id = str(record.get("source_id") or "")
    entry = registry.get(source_id)
    if not entry:
        return {
            "eligible": False,
            "source_id": source_id,
            "distribution_state": "UNKNOWN",
            "exclusion_reason": "UNKNOWN",
        }

    posture = source_distribution_posture(entry)
    state = posture["distribution_state"]

    if source_id == SOURCE_OWNER:
        return {
            "eligible": False,
            "source_id": source_id,
            "distribution_state": "DISTRIBUTION_PERMISSION_NOT_RECORDED",
            "exclusion_reason": "DISTRIBUTION_PERMISSION_NOT_RECORDED",
            "reason": posture.get("reason")
            or "project-internal-review does not record external distribution permission",
        }

    if source_id == SOURCE_MALIPENSE and posture.get("noncommercial_distribution"):
        resolved = resolve_source_entry(registry, source_id) or {}
        missing: list[str] = []
        if not resolved.get("claimed_license"):
            missing.append("claimed_license")
        if not resolved.get("attribution"):
            missing.append("attribution")
        if not resolved.get("source_url"):
            missing.append("source_url")
        if missing:
            return {
                "eligible": False,
                "source_id": source_id,
                "distribution_state": state,
                "exclusion_reason": "OTHER_RIGHTS_BLOCK",
                "missing_metadata": missing,
            }
        return {
            "eligible": True,
            "source_id": source_id,
            "distribution_state": state,
            "sharealike_required": posture.get("sharealike_required", False),
            "attribution_required": posture.get("attribution_required", False),
        }

    if state in {"REQUIRES_RIGHTS_REVIEW", "UNKNOWN", "BLOCKED_DISTRIBUTION"}:
        return {
            "eligible": False,
            "source_id": source_id,
            "distribution_state": state,
            "exclusion_reason": "OTHER_RIGHTS_BLOCK",
        }

    return {
        "eligible": False,
        "source_id": source_id,
        "distribution_state": state,
        "exclusion_reason": "OTHER_RIGHTS_BLOCK",
    }


def owner_distribution_audit(
    repo_root: Any,
    *,
    owner_ir_path: Any,
    internal_records: list[dict[str, Any]],
) -> dict[str, Any]:
    registry = load_source_registry(repo_root)
    owner_entry = registry.get(SOURCE_OWNER) or {}
    posture = source_distribution_posture(owner_entry)

    owner_rows = [r for r in internal_records if r.get("source_id") == SOURCE_OWNER]
    owner_lexicon = [r for r in owner_rows if r.get("ir_kind") == "lexicon_entry"]
    owner_mappings = [r for r in owner_rows if r.get("ir_kind") == "index_mapping"]

    independently_evidenced = 0
    for row in owner_lexicon:
        prov = row.get("provenance") or row.get("evidence") or {}
        review_ref = prov.get("review_reference") if isinstance(prov, dict) else None
        if review_ref or row.get("record_locator"):
            independently_evidenced += 1

    permission_recorded = posture.get("noncommercial_distribution") is True
    distributable = 0 if not permission_recorded else len(owner_rows)

    return {
        "owner_source_id": SOURCE_OWNER,
        "claimed_license": str(owner_entry.get("claimed_license") or ""),
        "distribution_state": posture["distribution_state"],
        "project_internal_review_semantics": (
            "A: internal review state only; external distribution permission is not recorded"
        ),
        "independently_evidenced_lexicon_rows": independently_evidenced,
        "generated_index_mappings": len(owner_mappings),
        "total_owner_product_rows": len(owner_rows),
        "noncommercial_distribution_permission_recorded": permission_recorded,
        "owner_rows_distributable": distributable,
        "owner_rows_excluded": len(owner_rows) - distributable,
        "exclusion_reason": (
            "DISTRIBUTION_PERMISSION_NOT_RECORDED"
            if not permission_recorded
            else None
        ),
        "owner_row_details": [
            {
                "ir_id": str(r.get("ir_id") or ""),
                "ir_kind": str(r.get("ir_kind") or ""),
                "source_id": SOURCE_OWNER,
                "current_source_rights_state": posture["distribution_state"],
                "noncommercial_distribution_permission": permission_recorded,
                "distribution_eligibility": "excluded"
                if not permission_recorded
                else "eligible",
            }
            for r in owner_rows
        ],
    }


def summarize_exclusions(
    classifications: dict[str, dict[str, Any]],
) -> dict[str, int]:
    counts: dict[str, int] = {
        "INTERNAL_ONLY": 0,
        "DISTRIBUTION_PERMISSION_NOT_RECORDED": 0,
        "UNKNOWN": 0,
        "OTHER_RIGHTS_BLOCK": 0,
    }
    for item in classifications.values():
        if item.get("eligible"):
            continue
        reason = str(item.get("exclusion_reason") or "UNKNOWN")
        counts[reason] = counts.get(reason, 0) + 1
    return counts
