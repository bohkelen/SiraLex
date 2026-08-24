"""Virtual (non-mutating) remap overlay for provisional G7/G8 effect."""

from __future__ import annotations

import json
import shutil
from dataclasses import replace
from pathlib import Path
from typing import Any

from malipense_version_delta.canonical_json import write_jsonl
from malipense_version_delta.compare import load_jsonl_records

from ..model import (
    RESOLUTION_AMBIGUOUS,
    RESOLUTION_BROKEN,
    RESOLUTION_NOT_BOUND,
    RESOLUTION_REMAP,
    RESOLUTION_STILL,
)
from ..paths import SourceRefreshPaths
from .proposals import PROPOSAL_READY


def apply_overlay_to_ir_list(ir_ids: list[str], overlay: dict[str, str]) -> list[str]:
    """Map baseline ir_ids through overlay; preserve order and unknowns."""
    return [overlay.get(i, i) for i in ir_ids]


def classify_virtual_reference(
    *,
    baseline_ir_id: str,
    f15_status: str,
    overlay: dict[str, str],
) -> str:
    if f15_status == RESOLUTION_REMAP and baseline_ir_id in overlay:
        return RESOLUTION_STILL
    if f15_status == RESOLUTION_REMAP and baseline_ir_id not in overlay:
        return RESOLUTION_REMAP
    if f15_status == RESOLUTION_AMBIGUOUS:
        return RESOLUTION_AMBIGUOUS
    if f15_status == RESOLUTION_BROKEN:
        return RESOLUTION_BROKEN
    if f15_status == RESOLUTION_NOT_BOUND:
        return RESOLUTION_NOT_BOUND
    if f15_status == RESOLUTION_STILL:
        return RESOLUTION_STILL
    return f15_status


def virtual_g7_counts(
    integrity_rows: list[dict[str, Any]],
    overlay: dict[str, str],
) -> dict[str, int]:
    counts = {
        "still_resolves": 0,
        "requires_remap": 0,
        "ambiguous": 0,
        "broken": 0,
        "not_identity_bound": 0,
        "total_references": len(integrity_rows),
    }
    for row in integrity_rows:
        status = classify_virtual_reference(
            baseline_ir_id=str(row.get("baseline_target_ir_id") or ""),
            f15_status=str(row.get("resolution_status") or ""),
            overlay=overlay,
        )
        if status == RESOLUTION_STILL:
            counts["still_resolves"] += 1
        elif status == RESOLUTION_REMAP:
            counts["requires_remap"] += 1
        elif status == RESOLUTION_AMBIGUOUS:
            counts["ambiguous"] += 1
        elif status == RESOLUTION_BROKEN:
            counts["broken"] += 1
        else:
            counts["not_identity_bound"] += 1
    return counts


def _rewrite_alias_table(
    alias_path: Path, overlay: dict[str, str], output_path: Path
) -> int:
    rows = load_jsonl_records(alias_path) if alias_path.is_file() else []
    changed = 0
    rewritten: list[dict[str, Any]] = []
    for row in rows:
        new_row = dict(row)
        for key in ("resolved_ir_ids", "evidence_ir_ids"):
            vals = row.get(key)
            if not isinstance(vals, list):
                continue
            mapped = apply_overlay_to_ir_list([str(v) for v in vals], overlay)
            if mapped != [str(v) for v in vals]:
                changed += 1
            new_row[key] = mapped
        rewritten.append(new_row)
    write_jsonl(output_path, rewritten)
    return changed


def _rewrite_supplements(
    path: Path, overlay: dict[str, str], output_path: Path
) -> int:
    rows = load_jsonl_records(path) if path.is_file() else []
    changed = 0
    rewritten: list[dict[str, Any]] = []
    for row in rows:
        new_row = dict(row)
        for key in ("target_ir_ids", "supporting_evidence_ir_ids"):
            vals = row.get(key)
            if not isinstance(vals, list):
                continue
            mapped = apply_overlay_to_ir_list([str(v) for v in vals], overlay)
            if mapped != [str(v) for v in vals]:
                changed += 1
            new_row[key] = mapped
        notes = row.get("target_notes")
        if isinstance(notes, list):
            new_notes = []
            for note in notes:
                if not isinstance(note, dict):
                    new_notes.append(note)
                    continue
                n = dict(note)
                if n.get("target_ir_id"):
                    old = str(n["target_ir_id"])
                    new = overlay.get(old, old)
                    if new != old:
                        changed += 1
                    n["target_ir_id"] = new
                new_notes.append(n)
            new_row["target_notes"] = new_notes
        rewritten.append(new_row)
    write_jsonl(output_path, rewritten)
    return changed


def _rewrite_target_variants(
    path: Path, overlay: dict[str, str], output_path: Path
) -> int:
    rows = load_jsonl_records(path) if path.is_file() else []
    changed = 0
    rewritten: list[dict[str, Any]] = []
    for row in rows:
        new_row = dict(row)
        old = str(row.get("canonical_ir_id") or "")
        if old in overlay:
            new_row["canonical_ir_id"] = overlay[old]
            changed += 1
        rewritten.append(new_row)
    write_jsonl(output_path, rewritten)
    return changed


def _classify_regression_failure(
    case_id: str,
    expected_ir_ids: list[str],
    *,
    ambiguous_baseline_ids: set[str],
    missing_baseline_ids: set[str],
    overlay: dict[str, str],
) -> str:
    # expected_ir_ids here are already overlay-mapped for comparison bookkeeping;
    # classify using original expected ids passed separately when needed.
    _ = case_id
    _ = overlay
    # Prefer missing then ambiguous then other using original baseline ids if present
    # in the pre-overlay expected set (caller passes original).
    originals = expected_ir_ids
    if any(i in missing_baseline_ids for i in originals):
        return "MISSING_BASELINE_RECORD"
    if any(i in ambiguous_baseline_ids for i in originals):
        return "AMBIGUOUS_REFERENCE"
    return "OTHER"


def replay_regression_with_overlay(
    *,
    search_index_path: Path,
    records_path: Path,
    regression_dir: Path,
    overlay: dict[str, str],
    ambiguous_baseline_ids: set[str],
    missing_baseline_ids: set[str],
) -> dict[str, Any]:
    from query_evidence.replay import load_search_index
    from search_regression.replay import replay_case
    from search_regression.schema import load_matrix_jsonl

    search_index = load_search_index(search_index_path)
    records_by_id = {
        str(r["ir_id"]): r for r in load_jsonl_records(records_path) if r.get("ir_id")
    }

    passed = 0
    failed = 0
    failures: list[dict[str, Any]] = []
    for matrix in sorted(regression_dir.glob("search_regression_matrix*.jsonl")):
        cases = load_matrix_jsonl(matrix)
        for case in cases:
            original_expected = list(case.expected_ir_ids)
            mapped_expected = apply_overlay_to_ir_list(original_expected, overlay)
            virtual_case = replace(case, expected_ir_ids=mapped_expected)
            result = replay_case(
                search_index,
                virtual_case,
                records_by_id=records_by_id,
            )
            if result.expected_match:
                passed += 1
            else:
                failed += 1
                failures.append(
                    {
                        "case_id": case.case_id,
                        "class": _classify_regression_failure(
                            case.case_id,
                            original_expected,
                            ambiguous_baseline_ids=ambiguous_baseline_ids,
                            missing_baseline_ids=missing_baseline_ids,
                            overlay=overlay,
                        ),
                        "mismatches": list(result.mismatches),
                        "original_expected_ir_ids": original_expected,
                        "mapped_expected_ir_ids": mapped_expected,
                        "actual_ir_ids": list(result.actual_ir_ids),
                    }
                )

    return {
        "status": "RAN",
        "pass": passed,
        "fail": failed,
        "failures": failures,
    }


def run_virtual_overlay(
    paths: SourceRefreshPaths,
    *,
    overlay: dict[str, str],
    proposals: list[dict[str, Any]],
    ambiguous_baseline_ids: set[str],
    missing_baseline_ids: set[str],
    virtual_dir: Path | None = None,
) -> dict[str, Any]:
    """
    Apply deterministic proposals virtually under a local virtual/ directory.

    Never mutates tracked shared tables or canonical build outputs.
    """
    virtual_dir = virtual_dir or (paths.f16_dir / "virtual")
    virtual_dir.mkdir(parents=True, exist_ok=True)

    integrity_rows = load_jsonl_records(paths.integrity_manifest)
    g7_before = {
        "still_resolves": sum(
            1 for r in integrity_rows if r.get("resolution_status") == RESOLUTION_STILL
        ),
        "requires_remap": sum(
            1 for r in integrity_rows if r.get("resolution_status") == RESOLUTION_REMAP
        ),
        "ambiguous": sum(
            1
            for r in integrity_rows
            if r.get("resolution_status") == RESOLUTION_AMBIGUOUS
        ),
        "broken": sum(
            1 for r in integrity_rows if r.get("resolution_status") == RESOLUTION_BROKEN
        ),
        "not_identity_bound": sum(
            1
            for r in integrity_rows
            if r.get("resolution_status") == RESOLUTION_NOT_BOUND
        ),
    }
    g7_after = virtual_g7_counts(integrity_rows, overlay)

    alias_out = virtual_dir / "source_aliases_virtual.jsonl"
    supp_out = virtual_dir / "source_index_supplements_virtual.jsonl"
    tvar_out = virtual_dir / "reviewed_target_variants_virtual.jsonl"
    alias_changes = _rewrite_alias_table(paths.aliases, overlay, alias_out)
    supp_changes = _rewrite_supplements(paths.supplements, overlay, supp_out)
    tvar_changes = _rewrite_target_variants(paths.target_variants, overlay, tvar_out)

    # Prefer isolated candidate build artifacts when present.
    build_dir = paths.build_dir
    candidate_index = build_dir / "candidate_search_index.jsonl"
    candidate_records = build_dir / "candidate_enriched.jsonl"
    if not candidate_records.is_file():
        candidate_records = build_dir / "candidate_normalized.jsonl"

    regression_before = {"pass": 16, "fail": 14, "status": "F15_BASELINE"}
    regression_after: dict[str, Any] = {
        "status": "SKIPPED",
        "pass": None,
        "fail": None,
        "reason": "isolated_candidate_build_artifacts_missing",
    }
    alias_apply_note = "skipped_no_candidate_index"

    if candidate_index.is_file() and candidate_records.is_file():
        virtual_index = virtual_dir / "candidate_search_index_with_virtual_aliases.jsonl"
        try:
            from source_aliases.apply_aliases_to_search_index import (
                apply_approved_aliases,
            )

            apply_approved_aliases(
                alias_table_path=alias_out,
                records_path=candidate_records,
                input_search_index_path=candidate_index,
                output_search_index_path=virtual_index,
                output_report_path=virtual_dir / "alias_apply_report.json",
            )
            alias_apply_note = "applied_virtual_aliases"
            index_for_replay = virtual_index
        except Exception as exc:
            shutil.copyfile(candidate_index, virtual_index)
            alias_apply_note = f"alias_apply_failed_fallback_raw_index:{exc}"
            index_for_replay = virtual_index

        # Baseline (no expected remap) replay for before/after within this run
        regression_before = replay_regression_with_overlay(
            search_index_path=candidate_index,
            records_path=candidate_records,
            regression_dir=paths.search_regression_dir,
            overlay={},  # no expected remap
            ambiguous_baseline_ids=ambiguous_baseline_ids,
            missing_baseline_ids=missing_baseline_ids,
        )
        regression_after = replay_regression_with_overlay(
            search_index_path=index_for_replay,
            records_path=candidate_records,
            regression_dir=paths.search_regression_dir,
            overlay=overlay,
            ambiguous_baseline_ids=ambiguous_baseline_ids,
            missing_baseline_ids=missing_baseline_ids,
        )

    # Supplement / variant resolution checks (existence only)
    current_ids = {
        str(r.get("ir_id"))
        for r in load_jsonl_records(paths.current_ir)
        if r.get("ir_id")
    }
    supp_rows = load_jsonl_records(supp_out) if supp_out.is_file() else []
    supp_targets = []
    for row in supp_rows:
        for ir in row.get("target_ir_ids") or []:
            supp_targets.append(str(ir))
    supp_resolved = sum(1 for i in supp_targets if i in current_ids)
    tvar_rows = load_jsonl_records(tvar_out) if tvar_out.is_file() else []
    tvar_resolved = sum(
        1 for r in tvar_rows if str(r.get("canonical_ir_id") or "") in current_ids
    )

    return {
        "overlay_size": len(overlay),
        "proposal_ready_count": sum(
            1 for p in proposals if p.get("proposal_status") == PROPOSAL_READY
        ),
        "g7_before": g7_before,
        "g7_after": g7_after,
        "regression_before": {
            "pass": regression_before.get("pass"),
            "fail": regression_before.get("fail"),
            "status": regression_before.get("status"),
        },
        "regression_after": {
            "pass": regression_after.get("pass"),
            "fail": regression_after.get("fail"),
            "status": regression_after.get("status"),
            "failures": regression_after.get("failures") or [],
        },
        "virtual_rewrites": {
            "alias_field_updates": alias_changes,
            "supplement_field_updates": supp_changes,
            "target_variant_updates": tvar_changes,
            "alias_apply_note": alias_apply_note,
            "virtual_dir": str(virtual_dir),
        },
        "supplement_targets_in_current_ir": {
            "total": len(supp_targets),
            "resolved": supp_resolved,
        },
        "target_variants_in_current_ir": {
            "total": len(tvar_rows),
            "resolved": tvar_resolved,
        },
        "tracked_artifact_mutation": False,
    }
