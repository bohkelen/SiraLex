"""Reconstruct identity-bound migration subjects from frozen F15 evidence."""

from __future__ import annotations

import hashlib
from collections import defaultdict
from typing import Any

from malipense_version_delta.canonical_json import canonical_dumps
from malipense_version_delta.compare import load_jsonl_records

from ..model import RESOLUTION_AMBIGUOUS, RESOLUTION_REMAP
from ..paths import FROZEN_ACCEPTANCE_SHA256, SourceRefreshPaths
from .lexical import (
    current_records_same_page_headword,
    lexical_locator,
    semantic_summary,
)

PROBLEM_STATUSES = frozenset({RESOLUTION_REMAP, RESOLUTION_AMBIGUOUS})


def _load_jsonl(path) -> list[dict[str, Any]]:
    return load_jsonl_records(path)


def _delta_by_baseline(delta_rows: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for row in delta_rows:
        baseline = row.get("baseline") or {}
        bid = baseline.get("ir_id")
        if bid:
            out[str(bid)] = row
    return out


def _reference_summary(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "artifact_type": row.get("artifact_type"),
        "artifact_id": row.get("artifact_id"),
        "artifact_path": row.get("artifact_path"),
        "field": row.get("field"),
        "f15_resolution_status": row.get("resolution_status"),
        "f15_candidate_current_ir_id": row.get("candidate_current_ir_id"),
        "f15_identity_confidence": row.get("identity_confidence"),
        "f15_blocking_reason": row.get("blocking_reason"),
    }


def enrich_problem_reference(
    integrity_row: dict[str, Any],
    *,
    baseline_index: dict[str, dict[str, Any]],
    current_index: dict[str, dict[str, Any]],
    delta_by_baseline: dict[str, dict[str, Any]],
    current_records: list[dict[str, Any]],
) -> dict[str, Any]:
    """Expand one F15 integrity row into a full Type-A migration reference record."""
    baseline_ir_id = str(integrity_row.get("baseline_target_ir_id") or "")
    baseline_rec = baseline_index.get(baseline_ir_id)
    baseline_loc = lexical_locator(baseline_rec)
    delta = delta_by_baseline.get(baseline_ir_id) or {}
    status = str(integrity_row.get("resolution_status") or "")
    conf = str(
        integrity_row.get("identity_confidence")
        or delta.get("identity_confidence")
        or ""
    )
    match_method = str(delta.get("match_method") or "")

    candidate_ids: list[str] = []
    if status == RESOLUTION_REMAP:
        cand = integrity_row.get("candidate_current_ir_id") or (
            (delta.get("current") or {}).get("ir_id")
        )
        if cand:
            candidate_ids = [str(cand)]
    elif status == RESOLUTION_AMBIGUOUS:
        candidates = current_records_same_page_headword(
            url_canonical=baseline_loc.get("url_canonical"),
            headword_latin=baseline_loc.get("headword_latin"),
            current_records=current_records,
        )
        candidate_ids = [str(c.get("ir_id")) for c in candidates if c.get("ir_id")]

    candidate_records = [current_index[i] for i in candidate_ids if i in current_index]

    return {
        "artifact_type": integrity_row.get("artifact_type"),
        "artifact_path": integrity_row.get("artifact_path"),
        "artifact_id": integrity_row.get("artifact_id"),
        "reference_field": integrity_row.get("field"),
        "baseline_ir_id": baseline_ir_id,
        "baseline_source_record_id": baseline_loc.get("source_record_id"),
        "baseline_url": baseline_loc.get("url_canonical"),
        "baseline_headword": baseline_loc.get("headword_latin"),
        "baseline_nko": baseline_loc.get("headword_nko"),
        "baseline_semantic_summary": semantic_summary(baseline_rec),
        "candidate_current_ir_ids": candidate_ids,
        "candidate_source_record_ids": [
            lexical_locator(r).get("source_record_id") for r in candidate_records
        ],
        "candidate_headwords": [
            lexical_locator(r).get("headword_latin") for r in candidate_records
        ],
        "candidate_nko": [
            lexical_locator(r).get("headword_nko") for r in candidate_records
        ],
        "candidate_semantic_summaries": [
            semantic_summary(r) for r in candidate_records
        ],
        "identity_confidence": conf,
        "f11_match_method": match_method,
        "f11_evidence_basis": {
            "identity_rule_id": delta.get("identity_rule_id"),
            "identity_confidence": conf,
            "match_method": match_method,
            "delta_classification": delta.get("classification"),
        },
        "f15_resolution_status": status,
        "f15_blocking_reason": integrity_row.get("blocking_reason"),
        "reference_summary": _reference_summary(integrity_row),
    }


def migration_subject_id(
    *,
    baseline_ir_id: str,
    candidate_current_ir_ids: list[str],
    f15_resolution_status: str,
) -> str:
    payload = {
        "baseline_ir_id": baseline_ir_id,
        "candidate_current_ir_ids": list(candidate_current_ir_ids),
        "f15_resolution_status": f15_resolution_status,
        "frozen_acceptance_sha256": FROZEN_ACCEPTANCE_SHA256,
    }
    digest = hashlib.sha256(canonical_dumps(payload).encode("utf-8")).hexdigest()[:16]
    return f"mig_{digest}"


def group_migration_subjects(
    enriched_refs: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Group raw references by baseline ir_id + candidate-current target set."""
    buckets: dict[tuple[Any, ...], list[dict[str, Any]]] = defaultdict(list)
    for ref in enriched_refs:
        key = (
            ref["baseline_ir_id"],
            tuple(ref.get("candidate_current_ir_ids") or []),
            ref.get("f15_resolution_status"),
        )
        buckets[key].append(ref)

    subjects: list[dict[str, Any]] = []
    for (baseline_ir_id, cand_tuple, status), refs in sorted(
        buckets.items(), key=lambda item: (item[0][2] or "", item[0][0], item[0][1])
    ):
        sample = refs[0]
        subject_id = migration_subject_id(
            baseline_ir_id=str(baseline_ir_id),
            candidate_current_ir_ids=list(cand_tuple),
            f15_resolution_status=str(status),
        )
        affected = [r["reference_summary"] for r in refs]
        affected.sort(
            key=lambda a: (
                str(a.get("artifact_type") or ""),
                str(a.get("artifact_path") or ""),
                str(a.get("artifact_id") or ""),
                str(a.get("field") or ""),
            )
        )
        subjects.append(
            {
                "migration_subject_id": subject_id,
                "baseline_ir_id": baseline_ir_id,
                "baseline_source_record_id": sample.get("baseline_source_record_id"),
                "baseline_url": sample.get("baseline_url"),
                "baseline_headword": sample.get("baseline_headword"),
                "baseline_nko": sample.get("baseline_nko"),
                "baseline_semantic_summary": sample.get("baseline_semantic_summary"),
                "candidate_current_ir_ids": list(cand_tuple),
                "candidate_source_record_ids": sample.get("candidate_source_record_ids"),
                "candidate_headwords": sample.get("candidate_headwords"),
                "candidate_nko": sample.get("candidate_nko"),
                "candidate_semantic_summaries": sample.get(
                    "candidate_semantic_summaries"
                ),
                "identity_confidence": sample.get("identity_confidence"),
                "f11_evidence_basis": sample.get("f11_evidence_basis"),
                "f15_resolution_status": status,
                "affected_reference_count": len(refs),
                "affected_references": affected,
                "raw_references": refs,
            }
        )
    return subjects


def reconstruct_identity_migration(
    paths: SourceRefreshPaths,
) -> dict[str, Any]:
    """Load and enrich the 37 identity-bound problem references from F15."""
    integrity_rows = _load_jsonl(paths.integrity_manifest)
    problem_rows = [
        r for r in integrity_rows if r.get("resolution_status") in PROBLEM_STATUSES
    ]
    problem_rows.sort(
        key=lambda r: (
            str(r.get("resolution_status") or ""),
            str(r.get("artifact_type") or ""),
            str(r.get("artifact_path") or ""),
            str(r.get("artifact_id") or ""),
            str(r.get("field") or ""),
            str(r.get("baseline_target_ir_id") or ""),
        )
    )

    baseline_records = _load_jsonl(paths.baseline_ir)
    current_records = _load_jsonl(paths.current_ir)
    delta_rows = _load_jsonl(paths.delta)
    baseline_index = {str(r.get("ir_id")): r for r in baseline_records if r.get("ir_id")}
    current_index = {str(r.get("ir_id")): r for r in current_records if r.get("ir_id")}
    delta_by_b = _delta_by_baseline(delta_rows)

    enriched = [
        enrich_problem_reference(
            row,
            baseline_index=baseline_index,
            current_index=current_index,
            delta_by_baseline=delta_by_b,
            current_records=current_records,
        )
        for row in problem_rows
    ]
    subjects = group_migration_subjects(enriched)
    remap_subjects = [
        s for s in subjects if s.get("f15_resolution_status") == RESOLUTION_REMAP
    ]
    ambiguous_subjects = [
        s for s in subjects if s.get("f15_resolution_status") == RESOLUTION_AMBIGUOUS
    ]
    return {
        "raw_problem_references": enriched,
        "raw_problem_reference_count": len(enriched),
        "migration_subjects": subjects,
        "unique_migration_subject_count": len(subjects),
        "deterministic_remap_raw_references": sum(
            1 for r in enriched if r.get("f15_resolution_status") == RESOLUTION_REMAP
        ),
        "deterministic_remap_subjects": remap_subjects,
        "ambiguous_raw_references": sum(
            1 for r in enriched if r.get("f15_resolution_status") == RESOLUTION_AMBIGUOUS
        ),
        "ambiguous_migration_subjects": ambiguous_subjects,
        "baseline_index": baseline_index,
        "current_index": current_index,
        "current_records": current_records,
        "delta_by_baseline": delta_by_b,
    }
