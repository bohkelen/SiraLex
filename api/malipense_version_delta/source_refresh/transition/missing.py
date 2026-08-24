"""Reconstruct Type-B missing baseline disposition subjects from F15 evidence."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from malipense_version_delta.compare import load_jsonl_records
from malipense_version_delta.review_descriptors import reviewability_descriptors

from ..paths import SourceRefreshPaths
from ..reference_integrity import collect_downstream_references
from .lexical import (
    current_records_same_page_headword,
    lexical_locator,
    semantic_summary,
)


def _search_index_ids(path: Path | None) -> set[str]:
    if path is None or not path.is_file():
        return set()
    ids: set[str] = set()
    with path.open(encoding="utf-8") as handle:
        for line in handle:
            if not line.strip():
                continue
            row = json.loads(line)
            for ir in row.get("ir_ids") or []:
                ids.add(str(ir))
    return ids


def reconstruct_missing_subjects(
    paths: SourceRefreshPaths,
    *,
    baseline_index: dict[str, dict[str, Any]],
    current_index: dict[str, dict[str, Any]],
    current_records: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """One subject per missing baseline record (no headword dedupe)."""
    dest_rows = load_jsonl_records(paths.destructive_manifest)
    downstream = collect_downstream_references(paths)
    refs_by_ir: dict[str, list[dict[str, Any]]] = {}
    for ref in downstream:
        refs_by_ir.setdefault(ref["baseline_target_ir_id"], []).append(
            {
                "artifact_type": ref["artifact_type"],
                "artifact_id": ref["artifact_id"],
                "field": ref["field"],
            }
        )

    search_ids = set()
    if paths.canonical_bundle_dir:
        search_ids |= _search_index_ids(
            paths.canonical_bundle_dir / "search_index.jsonl"
        )
    if paths.canonical_search_index:
        search_ids |= _search_index_ids(paths.canonical_search_index)

    enriched_ids: set[str] = set()
    if paths.canonical_enriched and paths.canonical_enriched.is_file():
        for row in load_jsonl_records(paths.canonical_enriched):
            if row.get("ir_id"):
                enriched_ids.add(str(row["ir_id"]))

    subjects: list[dict[str, Any]] = []
    for dest in dest_rows:
        bid = str(dest.get("baseline_ir_id") or "")
        baseline = baseline_index.get(bid)
        loc = lexical_locator(baseline)
        desc = reviewability_descriptors(baseline) if baseline else {}

        same_hw = current_records_same_page_headword(
            url_canonical=loc.get("url_canonical"),
            headword_latin=loc.get("headword_latin"),
            current_records=current_records,
        )
        # Exact same-page/headword only — never fuzzy. Real F15 missing set has 0.
        possible = [
            {
                "ir_id": lexical_locator(r).get("ir_id"),
                "source_record_id": lexical_locator(r).get("source_record_id"),
                "headword_latin": lexical_locator(r).get("headword_latin"),
                "headword_nko": lexical_locator(r).get("headword_nko"),
                "semantic_summary": semantic_summary(r),
            }
            for r in same_hw
        ]

        reused = None
        if bid in current_index:
            crec = current_index[bid]
            cloc = lexical_locator(crec)
            reused = {
                "same_ir_id_in_current": True,
                "current_headword_latin": cloc.get("headword_latin"),
                "current_source_record_id": cloc.get("source_record_id"),
                "note": (
                    "baseline ir_id reappears in current IR for a different headword "
                    "at the recycled source_record_id anchor — not an equivalent"
                ),
            }

        visibility = {
            "in_canonical_enriched": bid in enriched_ids,
            "in_canonical_search_index": bid in search_ids,
            "downstream_reference_count": len(refs_by_ir.get(bid, [])),
            "f15_disposition": dest.get("disposition"),
            "f15_reason": dest.get("reason"),
        }

        subjects.append(
            {
                "baseline_ir_id": bid,
                "baseline_source_record_id": dest.get("source_record_id")
                or loc.get("source_record_id"),
                "baseline_url": dest.get("url_canonical") or loc.get("url_canonical"),
                "headword": dest.get("headword_latin") or loc.get("headword_latin"),
                "headword_nko": loc.get("headword_nko"),
                "baseline_semantic_summary": semantic_summary(baseline),
                "example_count": desc.get("example_count"),
                "idiom_or_subentry_count": desc.get("idiom_or_subentry_count"),
                "sense_count": desc.get("sense_count"),
                "product_visibility_summary": json.dumps(
                    visibility, ensure_ascii=False, sort_keys=True, separators=(",", ":")
                ),
                "downstream_reference_summary": refs_by_ir.get(bid, []),
                "possible_current_candidates": possible,
                "anchor_reuse_observation": reused,
                "f15_disposition": dest.get("disposition"),
                "f15_reason": dest.get("reason"),
                "identity_confidence": dest.get("identity_confidence"),
                "no_safe_equivalent_reason": dest.get("reason"),
            }
        )

    subjects.sort(
        key=lambda s: (
            str(s.get("baseline_url") or ""),
            str(s.get("headword") or ""),
            str(s.get("baseline_ir_id") or ""),
        )
    )
    return subjects
