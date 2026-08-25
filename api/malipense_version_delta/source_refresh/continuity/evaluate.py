"""Orchestrate CORPUS1F17 Malidaba lexical continuity gate (non-mutating)."""

from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Any

from malipense_version_delta.canonical_json import sha256_file, write_json
from malipense_version_delta.frozen_inputs import FrozenInputMismatchError

from ..paths import SourceRefreshPaths, default_paths
from ..transition.cross_review import (
    annotate_ambiguous_subject,
    annotate_missing_subject,
    compute_cross_review_coupling,
)
from ..transition.missing import reconstruct_missing_subjects
from ..transition.proposals import PROPOSAL_READY, build_remap_proposals
from ..transition.reconstruct import reconstruct_identity_migration
from ..transition.worksheets import dry_run_missing_disposition_worksheet
from .build import build_virtual_continuity, load_f15_destructive_dispositions
from .frozen import verify_f17_frozen_inputs
from .g9_continuity import (
    apply_human_type_b_dispositions,
    evaluate_g9_versioned_continuity,
)
from .type_a_v2 import dry_run_continuity_worksheet, write_continuity_worksheet
from .type_b import (
    TYPE_B_REVIEW_DECISION,
    encode_type_b_retain_all,
    type_b_decision_counts,
    type_b_rights_inheritance,
    write_type_b_completed_worksheet,
)

CONTINUITY_SCHEMA_VERSION = "malidaba_lexical_continuity_gate_v1"
DECISION_READY = "CORPUS1F17_MALIDABA_LEXICAL_CONTINUITY_GATE_READY"
DECISION_BLOCKED = "CORPUS1F17_MALIDABA_LEXICAL_CONTINUITY_BLOCKED"


def _git_head(repo_root: Path) -> str:
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=repo_root, text=True
        ).strip()
    except Exception:
        return "UNKNOWN"


def _subject_preservation(
    *,
    subjects: list[dict[str, Any]],
    rows: list[dict[str, str]],
    subject_id_key: str,
    sort_key,
) -> dict[str, str]:
    before_set = {str(s[subject_id_key]) for s in subjects}
    after_set = {r[subject_id_key] for r in rows}
    expected_order = [
        str(s[subject_id_key]) for s in sorted(subjects, key=sort_key)
    ]
    actual_order = [r[subject_id_key] for r in rows]
    return {
        "same_subject_set": "YES"
        if before_set == after_set and len(before_set) == len(subjects)
        else "NO",
        "same_order": "YES" if expected_order == actual_order else "NO",
    }


def evaluate_lexical_continuity_gate(
    paths: SourceRefreshPaths | None = None,
) -> dict[str, Any]:
    """
    Encode human Type-B retain×42, emit Type-A v2 blank worksheet, build
    virtual continuity prototype. No canonical writes. No Type-A persistence.
    """
    paths = paths or default_paths()
    paths.f17_dir.mkdir(parents=True, exist_ok=True)

    try:
        frozen = verify_f17_frozen_inputs(paths)
    except FrozenInputMismatchError as exc:
        receipt = {
            "schema_version": CONTINUITY_SCHEMA_VERSION,
            "decision": DECISION_BLOCKED,
            "base_commit": _git_head(paths.repo_root),
            "frozen_inputs": "FAIL",
            "block_reason": f"frozen_hash_mismatch:{exc}",
            "canonical_writes": False,
            "product_promotion": False,
            "review_persistence": False,
            "tracked_downstream_mutation": False,
        }
        write_json(paths.f17_dir / "lexical_continuity_gate.json", receipt)
        return receipt

    migration = reconstruct_identity_migration(paths)
    proposals = build_remap_proposals(
        migration["migration_subjects"],
        current_index=migration["current_index"],
    )
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
    missing_annotated = [
        annotate_missing_subject(s, coupling) for s in missing_subjects
    ]
    ambiguous_annotated = [
        annotate_ambiguous_subject(s, coupling) for s in ambiguous_subjects
    ]

    # --- Type B: encode human retain_baseline_record × 42 ---
    type_b_rows = encode_type_b_retain_all(missing_annotated)
    type_b_f17 = paths.f17_dir / "malidaba_missing_record_disposition_review_001.csv"
    type_b_f16 = paths.f16_dir / "malidaba_missing_record_disposition_review_001.csv"
    write_type_b_completed_worksheet(type_b_f17, type_b_rows)
    # Mirror completed human encoding onto the F16 worksheet the reviewer used.
    write_type_b_completed_worksheet(type_b_f16, type_b_rows)

    # Expected context for dry-run = same rows with fill blanked for fingerprint check
    # Dry-run compares context columns against expected; fill fields are the review.
    # Reconstruct blank expected context from annotated subjects.
    from ..transition.worksheets import build_missing_worksheet_row

    type_b_expected_blank = [
        build_missing_worksheet_row(s) for s in missing_annotated
    ]
    type_b_expected_blank.sort(
        key=lambda r: (r["baseline_url"], r["headword"], r["baseline_ir_id"])
    )
    type_b_dry = dry_run_missing_disposition_worksheet(
        type_b_f17, expected_rows=type_b_expected_blank
    )
    type_b_counts = type_b_decision_counts(type_b_dry.preview_rows)

    # --- Provisional G9 under versioned continuity ---
    f15_disp = load_f15_destructive_dispositions(paths)
    retain_ids = {r["baseline_ir_id"] for r in type_b_rows}
    continuity_disp = apply_human_type_b_dispositions(
        f15_disp, retain_baseline_ir_ids=retain_ids
    )
    g9_gate, g9_counts = evaluate_g9_versioned_continuity(continuity_disp)
    write_json(
        paths.f17_dir / "g9_versioned_continuity_dispositions.json",
        {
            "model": "VERSIONED_LEXICAL_CONTINUITY",
            "dispositions": continuity_disp,
            "counts": g9_counts,
            "gate": g9_gate.to_dict(),
        },
    )

    # --- Type A v2 blank continuity worksheet ---
    type_a_csv = (
        paths.f17_dir / "malidaba_ambiguous_reference_continuity_review_001.csv"
    )
    type_a_rows = write_continuity_worksheet(type_a_csv, ambiguous_annotated)
    type_a_dry = dry_run_continuity_worksheet(
        type_a_csv, expected_rows=type_a_rows
    )
    type_a_preservation = _subject_preservation(
        subjects=ambiguous_annotated,
        rows=type_a_rows,
        subject_id_key="migration_subject_id",
        sort_key=lambda s: (
            str(s.get("baseline_url") or ""),
            str(s.get("baseline_headword") or ""),
            str(s.get("baseline_ir_id") or ""),
        ),
    )
    type_b_preservation = _subject_preservation(
        subjects=missing_annotated,
        rows=type_b_rows,
        subject_id_key="baseline_ir_id",
        sort_key=lambda s: (
            str(s.get("baseline_url") or ""),
            str(s.get("headword") or ""),
            str(s.get("baseline_ir_id") or ""),
        ),
    )

    # --- Virtual continuity build + G7/G8 ---
    virtual = build_virtual_continuity(
        paths,
        proposals=proposals,
        ambiguous_subjects=ambiguous_subjects,
        missing_subjects=missing_subjects,
        baseline_index=migration["baseline_index"],
        current_index=migration["current_index"],
    )

    ready_count = sum(
        1 for p in proposals if p.get("proposal_status") == PROPOSAL_READY
    )
    g7_after = virtual["g7_after"]
    reg_after = virtual["regression_after"]

    type_b_ok = (
        type_b_dry.summary.get("rows_read") == 42
        and type_b_dry.summary.get("rows_skipped_unreviewed") == 0
        and type_b_dry.summary.get("preview_row_count") == 42
        and type_b_dry.summary.get("error_count") == 0
        and type_b_counts.get(TYPE_B_REVIEW_DECISION) == 42
    )
    type_a_ok = (
        type_a_dry.summary.get("rows_read") == 5
        and type_a_dry.summary.get("rows_skipped_unreviewed") == 5
        and type_a_dry.summary.get("preview_row_count") == 0
        and type_a_dry.summary.get("error_count") == 0
        and type_a_preservation["same_subject_set"] == "YES"
        and type_a_preservation["same_order"] == "YES"
    )
    g9_ok = g9_gate.status == "PASS" and g9_counts.get("retain_baseline_record") == 42
    continuity_ok = (
        virtual.get("deterministic_continuity_subjects") == 10
        and virtual.get("legacy_retained_subjects") == 42
        and virtual.get("unresolved_type_a_subjects") == 5
        and virtual.get("tracked_artifact_mutation") is False
    )

    dry_ok = type_b_ok and type_a_ok and g9_ok and continuity_ok
    decision = DECISION_READY if dry_ok else DECISION_BLOCKED

    receipt = {
        "schema_version": CONTINUITY_SCHEMA_VERSION,
        "decision": decision,
        "base_commit": _git_head(paths.repo_root),
        "f16_base_commit": "604a0927fa870e93a1736da55a2de46bf2b0c76f",
        "frozen_inputs": {
            "status": "PASS",
            "baseline_ir_sha256": frozen.baseline_ir_sha256,
            "current_ir_sha256": frozen.current_ir_sha256,
            "delta_sha256": frozen.delta_sha256,
            "review_registry_sha256": frozen.review_registry_sha256,
            "acceptance_sha256": frozen.acceptance_sha256,
            "integrity_manifest_sha256": frozen.integrity_manifest_sha256,
            "destructive_manifest_sha256": frozen.destructive_manifest_sha256,
            "f16_proposals_sha256": frozen.f16_proposals_sha256,
        },
        "human_governance_decision": {
            "type_b": "retain_baseline_record × 42",
            "reviewer_id": "Reviewer_001",
            "reviewed_at": "2026-08-24T12:00:00+00:00",
            "model": "VERSIONED_LEXICAL_CONTINUITY",
        },
        "type_b": {
            "encoded_decision": TYPE_B_REVIEW_DECISION,
            "row_count": len(type_b_rows),
            "dry_run": type_b_dry.summary,
            "decision_counts": type_b_counts,
            "worksheet_sha256": sha256_file(type_b_f17),
            "subject_preservation": type_b_preservation,
        },
        "type_a_v2": {
            "worksheet_rows": len(type_a_rows),
            "dry_run": type_a_dry.summary,
            "worksheet_sha256": sha256_file(type_a_csv),
            "subject_preservation": type_a_preservation,
            "one_to_many_supported": True,
            "human_decisions_encoded": False,
        },
        "provisional_g9": {
            "status": g9_gate.status,
            "counts": g9_counts,
            "destructive_unresolved": g9_counts.get("destructive_unresolved"),
            "legacy_retained": g9_counts.get("retain_baseline_record"),
            "model": "VERSIONED_LEXICAL_CONTINUITY",
        },
        "deterministic_continuity_subjects": ready_count,
        "unresolved_type_a_continuity_subjects": len(ambiguous_subjects),
        "legacy_retained_subjects": len(missing_subjects),
        "stable_logical_lexical_reference_prototype": "READY"
        if continuity_ok
        else "BLOCKED",
        "virtual_continuity": virtual,
        "virtual_g7": g7_after,
        "virtual_g8": {
            "pass": reg_after.get("pass"),
            "fail": reg_after.get("fail"),
            "status": reg_after.get("status"),
        },
        "rights": type_b_rights_inheritance(),
        "canonical_writes": False,
        "product_promotion": False,
        "review_persistence": False,
        "type_a_persistence": False,
        "tracked_downstream_mutation": False,
        "publication_authorized": False,
        "product_candidates_authorized": False,
        "local_artifacts": {
            "type_b_worksheet": str(type_b_f17),
            "type_a_v2_worksheet": str(type_a_csv),
            "continuity_objects": virtual.get("continuity_path"),
            "receipt": str(paths.f17_dir / "lexical_continuity_gate.json"),
        },
    }
    write_json(paths.f17_dir / "lexical_continuity_gate.json", receipt)
    return receipt


def run_lexical_continuity_gate(
    *, repo_root: Path | None = None
) -> dict[str, Any]:
    return evaluate_lexical_continuity_gate(default_paths(repo_root))
