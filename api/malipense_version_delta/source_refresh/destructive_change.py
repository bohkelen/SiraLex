"""G9 destructive-change disposition for missing baseline records."""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path
from typing import Any

from malipense_version_delta.canonical_json import write_jsonl
from malipense_version_delta.compare import CLASS_MISSING, load_jsonl_records

from .model import (
    DESTRUCTIVE_AMBIGUOUS,
    DESTRUCTIVE_EQUIVALENT,
    DESTRUCTIVE_NOT_VISIBLE,
    DESTRUCTIVE_REQUIRES_REVIEW,
    REMAP_CONFIDENCES,
    GateResult,
)
from .paths import SourceRefreshPaths
from .reference_integrity import collect_downstream_references


def _product_visible_ir_ids(paths: SourceRefreshPaths) -> set[str]:
    """IRs present in current product surfaces (enriched / bundle / shared refs)."""
    visible: set[str] = set()
    for ref in collect_downstream_references(paths):
        visible.add(ref["baseline_target_ir_id"])

    for candidate in (
        paths.canonical_enriched,
        paths.canonical_bundle_dir / "records.jsonl"
        if paths.canonical_bundle_dir
        else None,
    ):
        if candidate is None or not candidate.is_file():
            continue
        with candidate.open(encoding="utf-8") as handle:
            for line in handle:
                if not line.strip():
                    continue
                row = json.loads(line)
                if row.get("ir_id"):
                    visible.add(str(row["ir_id"]))
                for key in ("ir_ids", "target_ir_ids", "resolved_ir_ids"):
                    vals = row.get(key)
                    if isinstance(vals, list):
                        visible.update(str(v) for v in vals)
    return visible


def classify_missing_baseline_record(
    delta_row: dict[str, Any],
    *,
    product_visible: set[str],
    current_ids: set[str],
) -> tuple[str, str | None]:
    """Return (disposition, reason)."""
    baseline = delta_row.get("baseline") or {}
    ir_id = str(baseline.get("ir_id") or "")
    conf = str(delta_row.get("identity_confidence") or "")
    current = delta_row.get("current") or {}

    # Should not happen for MISSING class, but keep fail-closed
    if conf in REMAP_CONFIDENCES and current.get("ir_id"):
        return DESTRUCTIVE_EQUIVALENT, "confident_current_equivalent"

    if conf == "AMBIGUOUS":
        return DESTRUCTIVE_AMBIGUOUS, "ambiguous_identity_for_missing_baseline"

    if not ir_id:
        return DESTRUCTIVE_AMBIGUOUS, "missing_baseline_ir_id"

    if ir_id in current_ids:
        # Same ir_id reappeared without UNMATCHED classification consistency
        return DESTRUCTIVE_AMBIGUOUS, "ir_id_present_in_current_despite_missing_class"

    if ir_id in product_visible:
        return (
            DESTRUCTIVE_REQUIRES_REVIEW,
            "refresh_would_remove_product_visible_baseline_knowledge",
        )

    return DESTRUCTIVE_NOT_VISIBLE, "baseline_ir_not_observed_on_product_surface"


def evaluate_g9_destructive_change(
    paths: SourceRefreshPaths,
    *,
    delta_rows: list[dict[str, Any]],
) -> tuple[GateResult, list[dict[str, Any]], dict[str, int]]:
    current_ids = {
        str(r.get("ir_id"))
        for r in load_jsonl_records(paths.current_ir)
        if r.get("ir_id")
    }
    product_visible = _product_visible_ir_ids(paths)

    missing_rows = [
        r
        for r in delta_rows
        if r.get("classification") == CLASS_MISSING
        or r.get("identity_confidence") == "UNMATCHED_BASELINE"
    ]

    dispositions: list[dict[str, Any]] = []
    counts: Counter[str] = Counter()
    for row in missing_rows:
        baseline = row.get("baseline") or {}
        disposition, reason = classify_missing_baseline_record(
            row, product_visible=product_visible, current_ids=current_ids
        )
        counts[disposition] += 1
        dispositions.append(
            {
                "baseline_ir_id": baseline.get("ir_id"),
                "headword_latin": baseline.get("headword_latin"),
                "url_canonical": baseline.get("url_canonical"),
                "source_record_id": baseline.get("source_record_id"),
                "identity_confidence": row.get("identity_confidence"),
                "disposition": disposition,
                "reason": reason,
            }
        )

    dispositions.sort(
        key=lambda r: (
            str(r.get("url_canonical") or ""),
            str(r.get("source_record_id") or ""),
            str(r.get("baseline_ir_id") or ""),
        )
    )
    write_jsonl(paths.destructive_manifest, dispositions)

    count_dict = {
        "missing_evidence_total": len(missing_rows),
        "current_equivalent_resolved": counts.get(DESTRUCTIVE_EQUIVALENT, 0),
        "not_product_visible": counts.get(DESTRUCTIVE_NOT_VISIBLE, 0),
        "destructive_requires_review": counts.get(DESTRUCTIVE_REQUIRES_REVIEW, 0),
        "ambiguous": counts.get(DESTRUCTIVE_AMBIGUOUS, 0),
    }

    evidence = {
        "counts": count_dict,
        "destructive_manifest_path": str(paths.destructive_manifest),
        "rule": (
            "G9 PASS only if every missing baseline record is "
            "CURRENT_EQUIVALENT_RESOLVED or NOT_PRODUCT_VISIBLE. "
            "Generic IDENTITY_AMBIGUOUS delta rows (4234) do not alone block "
            "SOURCE_REFRESH_ACCEPTANCE."
        ),
    }

    if count_dict["destructive_requires_review"] or count_dict["ambiguous"]:
        return (
            GateResult(
                "G9_NO_UNREVIEWED_DESTRUCTIVE_CHANGE",
                "BLOCK",
                evidence,
                (
                    "unreviewed_destructive_or_ambiguous_missing:"
                    f"requires_review={count_dict['destructive_requires_review']}"
                    f";ambiguous={count_dict['ambiguous']}"
                ),
            ),
            dispositions,
            count_dict,
        )

    return (
        GateResult("G9_NO_UNREVIEWED_DESTRUCTIVE_CHANGE", "PASS", evidence, None),
        dispositions,
        count_dict,
    )
