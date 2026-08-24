"""G7 downstream reference integrity audit for Malidaba source refresh."""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path
from typing import Any

from malipense_version_delta.canonical_json import write_jsonl
from malipense_version_delta.compare import load_jsonl_records

from .model import (
    REMAP_CONFIDENCES,
    RESOLUTION_AMBIGUOUS,
    RESOLUTION_BROKEN,
    RESOLUTION_NOT_BOUND,
    RESOLUTION_REMAP,
    RESOLUTION_STILL,
    GateResult,
)
from .paths import SourceRefreshPaths


def _load_ir_index(path: Path) -> dict[str, dict[str, Any]]:
    if not path.is_file():
        return {}
    return {str(r.get("ir_id")): r for r in load_jsonl_records(path) if r.get("ir_id")}


def _build_delta_maps(
    delta_rows: list[dict[str, Any]],
) -> tuple[dict[str, dict[str, Any]], dict[str, dict[str, Any]]]:
    """Map baseline ir_id -> delta row; current ir_id -> delta row (matched only)."""
    by_baseline: dict[str, dict[str, Any]] = {}
    by_current: dict[str, dict[str, Any]] = {}
    for row in delta_rows:
        b = row.get("baseline") or {}
        c = row.get("current") or {}
        bid = b.get("ir_id")
        cid = c.get("ir_id")
        if bid:
            by_baseline[str(bid)] = row
        if cid and bid:
            by_current[str(cid)] = row
    return by_baseline, by_current


def classify_malidaba_ir_reference(
    ir_id: str,
    *,
    baseline_ids: set[str],
    current_ids: set[str],
    owner_ids: set[str],
    index_ids: set[str],
    delta_by_baseline: dict[str, dict[str, Any]],
) -> tuple[str, str | None, str | None, str | None]:
    """
    Return (resolution_status, candidate_current_ir_id, confidence, blocking_reason).
    """
    if ir_id in owner_ids:
        return RESOLUTION_NOT_BOUND, None, None, None
    if ir_id in index_ids and ir_id not in baseline_ids:
        return RESOLUTION_NOT_BOUND, None, None, "index_ir_not_lexicon_refresh_bound"

    if ir_id not in baseline_ids:
        if ir_id in current_ids:
            # Unexpected: not in frozen baseline lexicon but in candidate
            return RESOLUTION_AMBIGUOUS, ir_id, None, "ir_not_in_baseline_lexicon"
        return RESOLUTION_NOT_BOUND, None, None, "ir_not_in_malidaba_baseline_lexicon"

    delta = delta_by_baseline.get(ir_id)
    if delta is None:
        if ir_id in current_ids:
            return RESOLUTION_AMBIGUOUS, ir_id, None, "missing_delta_row_for_baseline_ir"
        return RESOLUTION_BROKEN, None, None, "baseline_ir_absent_from_delta_and_current"

    conf = str(delta.get("identity_confidence") or "")
    current = delta.get("current") or {}
    candidate = current.get("ir_id")
    candidate_s = str(candidate) if candidate else None

    if conf in REMAP_CONFIDENCES and candidate_s:
        if candidate_s == ir_id and ir_id in current_ids:
            return RESOLUTION_STILL, candidate_s, conf, None
        return RESOLUTION_REMAP, candidate_s, conf, "deterministic_remap_required_before_refresh"
    if conf == "AMBIGUOUS":
        return RESOLUTION_AMBIGUOUS, None, conf, "ambiguous_cross_version_identity"
    if conf == "UNMATCHED_BASELINE":
        return RESOLUTION_BROKEN, None, conf, "baseline_record_missing_from_current_source"
    if ir_id in current_ids:
        return RESOLUTION_AMBIGUOUS, ir_id, conf, "present_without_confident_identity_link"
    return RESOLUTION_BROKEN, None, conf, "unresolved_baseline_reference"


def collect_downstream_references(paths: SourceRefreshPaths) -> list[dict[str, Any]]:
    """Collect identity-bound references from tracked runtime artifacts."""
    refs: list[dict[str, Any]] = []

    def add(
        *,
        artifact_type: str,
        artifact_id: str,
        artifact_path: str,
        field: str,
        ir_id: str,
    ) -> None:
        refs.append(
            {
                "artifact_type": artifact_type,
                "artifact_id": artifact_id,
                "artifact_path": artifact_path,
                "field": field,
                "baseline_target_ir_id": ir_id,
            }
        )

    if paths.aliases.is_file():
        with paths.aliases.open(encoding="utf-8") as handle:
            for line in handle:
                if not line.strip():
                    continue
                row = json.loads(line)
                aid = str(row.get("alias_id") or "")
                for ir in row.get("resolved_ir_ids") or []:
                    add(
                        artifact_type="source_alias",
                        artifact_id=aid,
                        artifact_path=str(paths.aliases),
                        field="resolved_ir_ids",
                        ir_id=str(ir),
                    )
                for ir in row.get("evidence_ir_ids") or []:
                    add(
                        artifact_type="source_alias",
                        artifact_id=aid,
                        artifact_path=str(paths.aliases),
                        field="evidence_ir_ids",
                        ir_id=str(ir),
                    )

    if paths.supplements.is_file():
        with paths.supplements.open(encoding="utf-8") as handle:
            for line in handle:
                if not line.strip():
                    continue
                row = json.loads(line)
                sid = str(row.get("supplement_id") or "")
                for ir in row.get("target_ir_ids") or []:
                    add(
                        artifact_type="source_index_supplement",
                        artifact_id=sid,
                        artifact_path=str(paths.supplements),
                        field="target_ir_ids",
                        ir_id=str(ir),
                    )
                for ir in row.get("supporting_evidence_ir_ids") or []:
                    add(
                        artifact_type="source_index_supplement",
                        artifact_id=sid,
                        artifact_path=str(paths.supplements),
                        field="supporting_evidence_ir_ids",
                        ir_id=str(ir),
                    )
                for note in row.get("target_notes") or []:
                    if note.get("target_ir_id"):
                        add(
                            artifact_type="source_index_supplement",
                            artifact_id=sid,
                            artifact_path=str(paths.supplements),
                            field="target_notes.target_ir_id",
                            ir_id=str(note["target_ir_id"]),
                        )

    if paths.target_variants.is_file():
        with paths.target_variants.open(encoding="utf-8") as handle:
            for line in handle:
                if not line.strip():
                    continue
                row = json.loads(line)
                add(
                    artifact_type="reviewed_target_variant",
                    artifact_id=str(row.get("variant_id") or ""),
                    artifact_path=str(paths.target_variants),
                    field="canonical_ir_id",
                    ir_id=str(row.get("canonical_ir_id") or ""),
                )

    if paths.phrase_review.is_file():
        with paths.phrase_review.open(encoding="utf-8") as handle:
            for line in handle:
                if not line.strip():
                    continue
                row = json.loads(line)
                pid = str(row.get("phrase_id") or row.get("review_id") or row.get("case_id") or "")
                for term in row.get("related_single_terms") or []:
                    for ir in term.get("resolved_ir_ids") or []:
                        add(
                            artifact_type="phrase_review",
                            artifact_id=pid,
                            artifact_path=str(paths.phrase_review),
                            field="related_single_terms.resolved_ir_ids",
                            ir_id=str(ir),
                        )
                for ir in row.get("candidate_resolved_ir_ids") or []:
                    add(
                        artifact_type="phrase_review",
                        artifact_id=pid,
                        artifact_path=str(paths.phrase_review),
                        field="candidate_resolved_ir_ids",
                        ir_id=str(ir),
                    )

    if paths.search_regression_dir.is_dir():
        for matrix in sorted(paths.search_regression_dir.glob("search_regression_matrix*.jsonl")):
            with matrix.open(encoding="utf-8") as handle:
                for line in handle:
                    if not line.strip():
                        continue
                    row = json.loads(line)
                    cid = str(row.get("case_id") or "")
                    for ir in row.get("expected_ir_ids") or []:
                        add(
                            artifact_type="search_regression",
                            artifact_id=cid,
                            artifact_path=str(matrix),
                            field="expected_ir_ids",
                            ir_id=str(ir),
                        )

    return refs


def evaluate_g7_reference_integrity(
    paths: SourceRefreshPaths,
    *,
    delta_rows: list[dict[str, Any]],
) -> tuple[GateResult, list[dict[str, Any]], dict[str, int]]:
    baseline_index = _load_ir_index(paths.baseline_ir)
    current_index = _load_ir_index(paths.current_ir)
    owner_index = _load_ir_index(paths.owner_ir)
    index_index = _load_ir_index(paths.index_ir)
    delta_by_baseline, _ = _build_delta_maps(delta_rows)

    baseline_ids = set(baseline_index)
    current_ids = set(current_index)
    owner_ids = set(owner_index)
    index_ids = set(index_index)

    refs = collect_downstream_references(paths)
    manifest_rows: list[dict[str, Any]] = []
    counts: Counter[str] = Counter()

    for ref in refs:
        ir_id = ref["baseline_target_ir_id"]
        status, candidate, confidence, reason = classify_malidaba_ir_reference(
            ir_id,
            baseline_ids=baseline_ids,
            current_ids=current_ids,
            owner_ids=owner_ids,
            index_ids=index_ids,
            delta_by_baseline=delta_by_baseline,
        )
        counts[status] += 1
        manifest_rows.append(
            {
                "artifact_type": ref["artifact_type"],
                "artifact_id": ref["artifact_id"],
                "artifact_path": ref["artifact_path"],
                "field": ref["field"],
                "baseline_target_ir_id": ir_id,
                "candidate_current_ir_id": candidate,
                "resolution_status": status,
                "identity_confidence": confidence,
                "blocking_reason": reason,
            }
        )

    # Sort for determinism
    manifest_rows.sort(
        key=lambda r: (
            r["artifact_type"],
            r["artifact_path"],
            r["artifact_id"],
            r["field"],
            r["baseline_target_ir_id"],
        )
    )
    write_jsonl(paths.integrity_manifest, manifest_rows)

    count_dict = {
        "still_resolves": counts.get(RESOLUTION_STILL, 0),
        "requires_remap": counts.get(RESOLUTION_REMAP, 0),
        "ambiguous": counts.get(RESOLUTION_AMBIGUOUS, 0),
        "broken": counts.get(RESOLUTION_BROKEN, 0),
        "not_identity_bound": counts.get(RESOLUTION_NOT_BOUND, 0),
        "total_references": len(manifest_rows),
    }

    blockers = counts.get(RESOLUTION_REMAP, 0) + counts.get(
        RESOLUTION_AMBIGUOUS, 0
    ) + counts.get(RESOLUTION_BROKEN, 0)

    evidence = {
        "counts": count_dict,
        "integrity_manifest_path": str(paths.integrity_manifest),
        "rule": (
            "G7 PASS only when every identity-bound reference STILL_RESOLVES "
            "or is NOT_IDENTITY_BOUND; REQUIRES_REMAP/AMBIGUOUS/BROKEN block "
            "canonical refresh (no auto-remap in this slice)."
        ),
        "generic_delta_ambiguous_rows_do_not_auto_block": 4234,
    }

    if blockers > 0:
        return (
            GateResult(
                "G7_DOWNSTREAM_REFERENCE_INTEGRITY_PASS",
                "BLOCK",
                evidence,
                (
                    "downstream_identity_references_unresolved:"
                    f"requires_remap={count_dict['requires_remap']}"
                    f";ambiguous={count_dict['ambiguous']}"
                    f";broken={count_dict['broken']}"
                ),
            ),
            manifest_rows,
            count_dict,
        )

    return (
        GateResult("G7_DOWNSTREAM_REFERENCE_INTEGRITY_PASS", "PASS", evidence, None),
        manifest_rows,
        count_dict,
    )
