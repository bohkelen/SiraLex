"""Orchestrate CORPUS1F16 transition review gate (non-mutating)."""

from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Any

from malipense_version_delta.canonical_json import sha256_file, write_json, write_jsonl
from malipense_version_delta.frozen_inputs import FrozenInputMismatchError

from ..paths import SourceRefreshPaths, default_paths
from .cross_review import (
    CONSISTENCY_READY,
    annotate_ambiguous_subject,
    annotate_missing_subject,
    compute_cross_review_coupling,
)
from .frozen import verify_f16_frozen_inputs
from .missing import reconstruct_missing_subjects
from .proposals import PROPOSAL_READY, build_remap_proposals, ready_overlay_map
from .reconstruct import reconstruct_identity_migration
from .virtual_overlay import run_virtual_overlay
from .worksheets import (
    dry_run_ambiguous_remap_worksheet,
    dry_run_missing_disposition_worksheet,
    write_ambiguous_remap_worksheet,
    write_missing_disposition_worksheet,
)

TRANSITION_SCHEMA_VERSION = "malidaba_transition_review_gate_v1"
DECISION_READY = "CORPUS1F16_MALIDABA_TRANSITION_REVIEW_GATE_READY"
DECISION_HUMAN_READY = "CORPUS1F16_HUMAN_TRANSITION_REVIEW_READY"
DECISION_BLOCKED = "CORPUS1F16_MALIDABA_TRANSITION_REVIEW_GATE_BLOCKED"


def _worksheet_preservation(
    *,
    subjects: list[dict[str, Any]],
    rows: list[dict[str, str]],
    subject_id_key: str,
    sort_key,
) -> dict[str, bool]:
    before_set = {str(s[subject_id_key]) for s in subjects}
    after_set = {r[subject_id_key] for r in rows}
    expected_order = [
        str(s[subject_id_key]) for s in sorted(subjects, key=sort_key)
    ]
    actual_order = [r[subject_id_key] for r in rows]
    return {
        "same_subject_set": before_set == after_set and len(before_set) == len(subjects),
        "same_order": expected_order == actual_order,
    }


def _all_human_review_fields_blank(rows: list[dict[str, str]]) -> bool:
    fill_cols = (
        "review_decision",
        "selected_current_ir_id",
        "reviewer_id",
        "reviewed_at",
        "review_method",
        "issue_codes",
        "review_notes",
    )
    for row in rows:
        for col in fill_cols:
            if str(row.get(col) or "").strip():
                return False
    return True


def _git_head(repo_root: Path) -> str:
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=repo_root, text=True
        ).strip()
    except Exception:
        return "UNKNOWN"


def evaluate_transition_review_gate(
    paths: SourceRefreshPaths | None = None,
) -> dict[str, Any]:
    """
    Produce deterministic remap proposals + blank human worksheets.

    Does not persist human decisions. Does not mutate tracked artifacts.
    """
    paths = paths or default_paths()
    paths.f16_dir.mkdir(parents=True, exist_ok=True)

    try:
        frozen = verify_f16_frozen_inputs(paths)
    except FrozenInputMismatchError as exc:
        receipt = {
            "schema_version": TRANSITION_SCHEMA_VERSION,
            "decision": DECISION_BLOCKED,
            "base_commit": _git_head(paths.repo_root),
            "frozen_inputs": "FAIL",
            "block_reason": f"frozen_hash_mismatch:{exc}",
            "publication_authorized": False,
            "product_candidates_authorized": False,
            "tracked_downstream_mutation": False,
            "review_persistence": False,
            "canonical_writes": False,
        }
        write_json(paths.f16_dir / "transition_review_gate.json", receipt)
        return receipt

    migration = reconstruct_identity_migration(paths)
    proposals = build_remap_proposals(
        migration["migration_subjects"],
        current_index=migration["current_index"],
    )
    overlay = ready_overlay_map(proposals)

    proposals_path = paths.f16_dir / "downstream_ir_id_remap_proposals.jsonl"
    # Strip raw_references from proposal-adjacent subject dumps for manifest
    proposal_rows = []
    for row in proposals:
        proposal_rows.append(
            {
                "migration_subject_id": row["migration_subject_id"],
                "baseline_ir_id": row["baseline_ir_id"],
                "candidate_current_ir_id": row["candidate_current_ir_id"],
                "identity_confidence": row["identity_confidence"],
                "evidence_basis": row["evidence_basis"],
                "affected_reference_count": row["affected_reference_count"],
                "affected_references": row["affected_references"],
                "proposal_status": row["proposal_status"],
                "block_reason": row["block_reason"],
                "f15_resolution_status": row["f15_resolution_status"],
            }
        )
    write_jsonl(proposals_path, proposal_rows)

    ambiguous_subjects = migration["ambiguous_migration_subjects"]
    missing_subjects = reconstruct_missing_subjects(
        paths,
        baseline_index=migration["baseline_index"],
        current_index=migration["current_index"],
        current_records=migration["current_records"],
    )

    coupling = compute_cross_review_coupling(
        ambiguous_subjects=ambiguous_subjects,
        deterministic_remap_subjects=migration["deterministic_remap_subjects"],
        missing_subjects=missing_subjects,
    )
    ambiguous_annotated = [
        annotate_ambiguous_subject(s, coupling) for s in ambiguous_subjects
    ]
    missing_annotated = [
        annotate_missing_subject(s, coupling) for s in missing_subjects
    ]

    remap_csv = paths.f16_dir / "malidaba_ambiguous_reference_remap_review_001.csv"
    remap_expected = write_ambiguous_remap_worksheet(remap_csv, ambiguous_annotated)
    remap_dry = dry_run_ambiguous_remap_worksheet(
        remap_csv, expected_rows=remap_expected
    )

    missing_csv = paths.f16_dir / "malidaba_missing_record_disposition_review_001.csv"
    missing_expected = write_missing_disposition_worksheet(
        missing_csv, missing_annotated
    )
    missing_dry = dry_run_missing_disposition_worksheet(
        missing_csv, expected_rows=missing_expected
    )

    type_a_preservation = _worksheet_preservation(
        subjects=ambiguous_annotated,
        rows=remap_expected,
        subject_id_key="migration_subject_id",
        sort_key=lambda s: (
            str(s.get("baseline_url") or ""),
            str(s.get("baseline_headword") or ""),
            str(s.get("baseline_ir_id") or ""),
        ),
    )
    type_b_preservation = _worksheet_preservation(
        subjects=missing_annotated,
        rows=missing_expected,
        subject_id_key="baseline_ir_id",
        sort_key=lambda s: (
            str(s.get("baseline_url") or ""),
            str(s.get("headword") or ""),
            str(s.get("baseline_ir_id") or ""),
        ),
    )

    ambiguous_ids = {str(s["baseline_ir_id"]) for s in ambiguous_subjects}
    missing_ids = {str(s["baseline_ir_id"]) for s in missing_subjects}

    virtual = run_virtual_overlay(
        paths,
        overlay=overlay,
        proposals=proposals,
        ambiguous_baseline_ids=ambiguous_ids,
        missing_baseline_ids=missing_ids,
    )

    # Preserve F15 documented regression baseline in the receipt; also retain
    # the fresh no-overlay measurement under virtual for auditability.
    regression_before = {"pass": 16, "fail": 14, "status": "F15_DOCUMENTED"}
    measured_before = virtual["regression_before"]
    reg_after = virtual["regression_after"]
    remaining_failures = reg_after.get("failures") or []

    # Version-coupled debt assessment (repository-structure based)
    version_coupled_debt = True
    would_repeat_g7 = True
    identity_strategy = "STABLE_LOGICAL_LEXICAL_REFERENCE_LAYER"
    debt_notes = [
        "Downstream artifacts (aliases, supplements, target variants, search "
        "regression) bind Malidaba via edition-specific ir_id values.",
        "ir_id is derived from (source_id|url_canonical|source_record_id|parser_version); "
        "source_record_id renumbers across Malidaba editions (F11).",
        "A one-time migration map can clear the current 23 REQUIRES_REMAP refs, "
        "but the next edition renumbering would recreate the same G7 class of "
        "failure for any still-bound ir_id references.",
        "Therefore the debt is systemic (B), not only one-time edition migration (A).",
    ]

    missing_destructive = sum(
        1
        for s in missing_subjects
        if s.get("f15_disposition") == "DESTRUCTIVE_CHANGE_REQUIRES_REVIEW"
    )
    missing_ambiguous = sum(
        1 for s in missing_subjects if s.get("f15_disposition") == "AMBIGUOUS"
    )

    g7_after = virtual["g7_after"]

    # Gate READY means worksheets + proposals are correctly emitted for human review.
    # Source refresh itself remains blocked (G9 + remaining ambiguous remaps).
    dry_ok = (
        remap_dry.summary.get("error_count", 1) == 0
        and missing_dry.summary.get("error_count", 1) == 0
        and remap_dry.summary.get("preview_row_count", 1) == 0
        and missing_dry.summary.get("preview_row_count", 1) == 0
        and migration["raw_problem_reference_count"] == 37
        and len(missing_subjects) == 42
        and type_a_preservation["same_subject_set"]
        and type_a_preservation["same_order"]
        and type_b_preservation["same_subject_set"]
        and type_b_preservation["same_order"]
        and _all_human_review_fields_blank(remap_expected)
        and _all_human_review_fields_blank(missing_expected)
    )
    decision = DECISION_HUMAN_READY if dry_ok else DECISION_BLOCKED

    remap_worksheet_sha256 = sha256_file(remap_csv)
    missing_worksheet_sha256 = sha256_file(missing_csv)

    receipt = {
        "schema_version": TRANSITION_SCHEMA_VERSION,
        "decision": decision,
        "base_commit": _git_head(paths.repo_root),
        "frozen_inputs": {
            "status": "PASS",
            "baseline_ir_sha256": frozen.baseline_ir_sha256,
            "current_ir_sha256": frozen.current_ir_sha256,
            "delta_sha256": frozen.delta_sha256,
            "review_registry_sha256": frozen.review_registry_sha256,
            "acceptance_sha256": frozen.acceptance_sha256,
            "integrity_manifest_sha256": frozen.integrity_manifest_sha256,
            "destructive_manifest_sha256": frozen.destructive_manifest_sha256,
        },
        "raw_identity_bound_problem_references": migration[
            "raw_problem_reference_count"
        ],
        "unique_migration_subjects": migration["unique_migration_subject_count"],
        "deterministic_remap_raw_references": migration[
            "deterministic_remap_raw_references"
        ],
        "deterministic_remap_subjects": len(migration["deterministic_remap_subjects"]),
        "proposal_ready_count": sum(
            1 for p in proposals if p.get("proposal_status") == PROPOSAL_READY
        ),
        "remaining_ambiguous_raw_references": migration["ambiguous_raw_references"],
        "remaining_ambiguous_migration_subjects": len(ambiguous_subjects),
        "virtual_g7_before": virtual["g7_before"],
        "virtual_g7_after": g7_after,
        "regression_before": regression_before,
        "regression_measured_without_overlay": measured_before,
        "regression_after_safe_virtual_remaps": {
            "pass": reg_after.get("pass"),
            "fail": reg_after.get("fail"),
            "status": reg_after.get("status"),
        },
        "remaining_regression_failures": remaining_failures,
        "ambiguous_remap_worksheet_rows": len(remap_expected),
        "ambiguous_worksheet_dry_run": remap_dry.summary,
        "missing_baseline_records": len(missing_subjects),
        "missing_destructive": missing_destructive,
        "missing_ambiguous": missing_ambiguous,
        "missing_disposition_worksheet_rows": len(missing_expected),
        "missing_worksheet_dry_run": missing_dry.summary,
        "g9": "BLOCK — HUMAN DISPOSITION REQUIRED",
        "version_coupled_reference_debt": "YES" if version_coupled_debt else "NO",
        "would_next_malidaba_renumbering_repeat_g7": "YES" if would_repeat_g7 else "NO",
        "recommended_identity_strategy": identity_strategy,
        "debt_notes": debt_notes,
        "local_artifacts": {
            "proposals": str(proposals_path),
            "ambiguous_remap_worksheet": str(remap_csv),
            "missing_disposition_worksheet": str(missing_csv),
            "virtual_dir": str(paths.f16_dir / "virtual"),
        },
        "proposals_sha256": sha256_file(proposals_path),
        "virtual": {
            "overlay_size": virtual["overlay_size"],
            "tracked_artifact_mutation": virtual["tracked_artifact_mutation"],
            "virtual_rewrites": virtual["virtual_rewrites"],
            "supplement_targets_in_current_ir": virtual[
                "supplement_targets_in_current_ir"
            ],
            "target_variants_in_current_ir": virtual["target_variants_in_current_ir"],
        },
        "publication_authorized": False,
        "product_candidates_authorized": False,
        "tracked_downstream_mutation": False,
        "review_persistence": False,
        "canonical_writes": False,
        "g7_vs_g9_ontology": {
            "type_a": "DOWNSTREAM_IDENTITY_MIGRATION",
            "type_b": "DESTRUCTIVE_SOURCE_CHANGE",
            "separate_worksheets": True,
        },
        "cross_ontology_coupling": {
            "type_a_ambiguous_subjects": coupling.type_a_ambiguous_count,
            "type_b_missing_subjects": coupling.type_b_missing_count,
            "ambiguous_type_b_overlap_count": coupling.ambiguous_missing_overlap_count,
            "ambiguous_type_b_overlap_baseline_ir_ids": (
                coupling.ambiguous_missing_overlap_baseline_ir_ids
            ),
            "deterministic_remap_type_b_overlap_count": (
                coupling.deterministic_remap_missing_overlap_count
            ),
            "deterministic_remap_type_b_overlap_baseline_ir_ids": (
                coupling.deterministic_remap_missing_overlap_baseline_ir_ids
            ),
            "cross_review_group_count": coupling.cross_review_group_count,
            "overlap_note": (
                "Separate ontologies may still share exact baseline_ir_id; "
                "coupling fields expose paired decisions without merging subjects."
            ),
        },
        "cross_review_consistency_validation": CONSISTENCY_READY,
        "worksheet_sha256": {
            "ambiguous_remap_worksheet": remap_worksheet_sha256,
            "missing_disposition_worksheet": missing_worksheet_sha256,
        },
        "subject_preservation": {
            "type_a_same_subject_set": "YES"
            if type_a_preservation["same_subject_set"]
            else "NO",
            "type_a_same_order": "YES" if type_a_preservation["same_order"] else "NO",
            "type_b_same_subject_set": "YES"
            if type_b_preservation["same_subject_set"]
            else "NO",
            "type_b_same_order": "YES" if type_b_preservation["same_order"] else "NO",
        },
        "human_review_fields_blank": {
            "type_a": "PASS" if _all_human_review_fields_blank(remap_expected) else "FAIL",
            "type_b": "PASS" if _all_human_review_fields_blank(missing_expected) else "FAIL",
        },
        "gate_ready_decision": DECISION_READY,
    }
    write_json(paths.f16_dir / "transition_review_gate.json", receipt)
    return receipt


def run_transition_review_gate(
    *, repo_root: Path | None = None
) -> dict[str, Any]:
    return evaluate_transition_review_gate(default_paths(repo_root))
