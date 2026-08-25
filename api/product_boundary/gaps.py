"""Commercial coverage gap queue (research queue, not lexical content)."""

from __future__ import annotations

from typing import Any

from malipense_version_delta.canonical_json import write_jsonl
from malipense_version_delta.compare import load_jsonl_records

from .paths import Product1APaths


def build_coverage_gaps(
    paths: Product1APaths,
    *,
    classification: dict[str, Any],
    internal_records_path,
) -> list[dict[str, Any]]:
    """
    Gap records for excluded high-value concepts.

    Avoid copying restricted gloss text beyond minimal locators.
    """
    logical_by_current: dict[str, str] = {}
    for row in load_jsonl_records(paths.logical_continuity):
        lid = str(row.get("logical_lexical_id") or "")
        for cid in row.get("current_ir_ids") or []:
            logical_by_current[str(cid)] = lid
        for bid in row.get("baseline_ir_ids") or []:
            logical_by_current.setdefault(str(bid), lid)

    owner_independent = {
        ir_id
        for ir_id, item in classification["record_classes"].items()
        if item.get("source_id") == "src_siralex_lexical_review"
        and item.get("owner_independence") == "independently_evidenced"
    }

    gaps: list[dict[str, Any]] = []
    for row in load_jsonl_records(internal_records_path):
        if row.get("ir_kind") != "lexicon_entry":
            continue
        ir_id = str(row.get("ir_id") or "")
        item = classification["record_classes"].get(ir_id)
        if item is None:
            continue
        if item.get("commercial_eligible") is True:
            continue
        headword = item.get("preferred_form") or ""
        # High-value heuristic: has FR or EN gloss display, or is owner/health domain.
        display = row.get("display") if isinstance(row.get("display"), dict) else {}
        senses = display.get("senses") if isinstance(display, dict) else None
        has_gloss = bool(senses)
        high_value = bool(has_gloss) or item.get("source_id") == "src_siralex_lexical_review"
        if not high_value:
            # Still record a compact gap for Malidaba lexicon entries with headwords.
            if not headword:
                continue
        gaps.append(
            {
                "schema_version": "siralex_commercial_coverage_gap_v1",
                "gap_id": f"gap_{ir_id}",
                "logical_lexical_id": logical_by_current.get(ir_id),
                "edition_ir_id": ir_id,
                "headword_locator": headword,
                "missing_capability": "commercial_safe_lexical_lookup",
                "exclusion_classification": item.get("classification"),
                "reason_codes": item.get("reason_codes"),
                "restricted_source_id": item.get("source_id"),
                "independent_evidence_already_available": ir_id in owner_independent,
                "recommended_evidence_acquisition_route": (
                    "independent_speaker_owner_research_with_separate_provenance"
                    if ir_id not in owner_independent
                    else "record_commercial_permission_in_source_registry"
                ),
                "high_value": high_value,
            }
        )

    gaps.sort(key=lambda g: (not g.get("high_value"), str(g.get("headword_locator") or ""), g["gap_id"]))
    write_jsonl(paths.gaps_path, gaps)
    return gaps
