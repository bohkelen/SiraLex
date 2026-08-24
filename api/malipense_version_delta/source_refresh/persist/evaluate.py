"""Orchestrate CORPUS1F18 persistence + virtual source-refresh re-evaluation."""

from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Any

from malipense_version_delta.canonical_json import sha256_file, write_json, write_jsonl
from malipense_version_delta.compare import load_jsonl_records
from malipense_version_delta.frozen_inputs import FrozenInputMismatchError

from ..continuity.build import load_f15_destructive_dispositions
from ..continuity.g9_continuity import (
    apply_human_type_b_dispositions,
    evaluate_g9_versioned_continuity,
)
from ..continuity.type_a_v2 import build_continuity_worksheet_row
from ..continuity.type_b import TYPE_B_REVIEW_DECISION
from ..evidence_gates import (
    count_nested_lxp2_pages,
    evaluate_g1_source_capture,
    evaluate_g2_parser_compatibility,
    evaluate_g3_baseline_regression,
    evaluate_g4_structural_coverage,
    evaluate_g5_delta_deterministic,
    evaluate_g6_review_evidence,
    evaluate_g10_rights,
)
from ..model import (
    OVERALL_ENGINEERING_READY,
    GateResult,
    RightsPosture,
    derive_overall_decision,
)
from ..paths import FROZEN_F17_COMMIT, SourceRefreshPaths, default_paths
from ..transition.cross_review import (
    annotate_ambiguous_subject,
    annotate_missing_subject,
    compute_cross_review_coupling,
)
from ..transition.frozen import verify_f16_frozen_inputs
from ..transition.missing import reconstruct_missing_subjects
from ..transition.proposals import PROPOSAL_READY, build_remap_proposals
from ..transition.reconstruct import reconstruct_identity_migration
from ..transition.virtual_overlay import run_virtual_overlay
from ..transition.worksheets import build_missing_worksheet_row
from .candidates import (
    type_a_candidates_from_worksheet,
    type_b_candidates_from_worksheet,
)
from .graph import (
    build_governed_continuity_graph,
    logical_reference_survives_edition_ir_change,
)
from .human import FrozenHumanWorksheetError, verify_frozen_human_worksheets
from .identity import TYPE_A_SCHEMA, TYPE_B_SCHEMA
from .validate import find_review_leaves, validate_review_file
from .writer import apply_review_write, plan_review_write

PERSIST_SCHEMA_VERSION = "malidaba_transition_review_persist_v1"
DECISION_READY = "CORPUS1F18_MALIDABA_TRANSITION_REVIEWS_PERSISTED"
DECISION_BLOCKED = "CORPUS1F18_MALIDABA_TRANSITION_REVIEW_BLOCKED"


def _git_head(repo_root: Path) -> str:
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=repo_root, text=True
        ).strip()
    except Exception:
        return "UNKNOWN"


def _blank_type_a_rows(subjects: list[dict[str, Any]]) -> list[dict[str, str]]:
    rows = [build_continuity_worksheet_row(s) for s in subjects]
    rows.sort(
        key=lambda r: (r["baseline_url"], r["baseline_headword"], r["baseline_ir_id"])
    )
    return rows


def _blank_type_b_rows(subjects: list[dict[str, Any]]) -> list[dict[str, str]]:
    rows = [build_missing_worksheet_row(s) for s in subjects]
    rows.sort(key=lambda r: (r["baseline_url"], r["headword"], r["baseline_ir_id"]))
    return rows


def _persist_kind(
    *,
    kind: str,
    schema_version: str,
    worksheet_path: Path,
    output_path: Path,
    candidates: list[dict[str, Any]],
    receipt_path: Path,
) -> dict[str, Any]:
    first = plan_review_write(
        kind=kind,
        schema_version=schema_version,
        worksheet_path=worksheet_path,
        output_path=output_path,
        candidate_rows=candidates,
    )
    apply_review_write(
        first, output_path=output_path, kind=kind, receipt_path=receipt_path
    )
    second = plan_review_write(
        kind=kind,
        schema_version=schema_version,
        worksheet_path=worksheet_path,
        output_path=output_path,
        candidate_rows=candidates,
    )
    apply_review_write(second, output_path=output_path, kind=kind, receipt_path=None)
    sha_first = first.receipt.get("registry_sha256_after")
    sha_second = sha256_file(output_path)
    return {
        "first": {
            "rows_before": first.receipt["rows_before"],
            "candidate": first.receipt["candidate_rows"],
            "new": first.receipt["new_rows_written"],
            "already_present_identical": first.receipt["already_present_identical"],
            "rows_after": first.receipt["rows_after"],
        },
        "second": {
            "rows_before": second.receipt["rows_before"],
            "candidate": second.receipt["candidate_rows"],
            "new": second.receipt["new_rows_written"],
            "already_present_identical": second.receipt["already_present_identical"],
            "rows_after": second.receipt["rows_after"],
        },
        "registry_sha256": sha_second,
        "idempotent_sha_unchanged": sha_first == sha_second,
        "decision_counts": first.receipt.get("decision_counts"),
    }


def _apply_ok(apply_receipt: dict[str, Any], *, expected_new: int) -> bool:
    first = apply_receipt["first"]
    second = apply_receipt["second"]
    if not apply_receipt.get("idempotent_sha_unchanged"):
        return False
    initial = (
        first["rows_before"] == 0
        and first["new"] == expected_new
        and first["rows_after"] == expected_new
        and second["new"] == 0
        and second["already_present_identical"] == expected_new
        and second["rows_after"] == expected_new
    )
    rerun = (
        first["new"] == 0
        and first["already_present_identical"] == expected_new
        and first["rows_after"] == expected_new
        and second["new"] == 0
        and second["already_present_identical"] == expected_new
    )
    return initial or rerun


def _classify_g8_failures(
    failures: list[dict[str, Any]],
    *,
    overlay: dict[str, str],
    alias_apply_note: str,
) -> list[dict[str, Any]]:
    overlay_ids = set(overlay)
    classified = []
    for fail in failures:
        originals = [str(x) for x in (fail.get("original_expected_ir_ids") or [])]
        mapped = [str(x) for x in (fail.get("mapped_expected_ir_ids") or [])]
        transition = any(i in overlay_ids for i in originals)
        alias_blocked = str(alias_apply_note).startswith("alias_apply_failed")
        if transition or (
            alias_blocked and any(i in overlay_ids for i in originals + mapped)
        ):
            cause = "TRANSITION_MAPPING"
        else:
            cause = "PREEXISTING_UNRELATED"
        item = dict(fail)
        item["root_cause"] = cause
        classified.append(item)
    return classified


def evaluate_transition_review_persist(
    paths: SourceRefreshPaths | None = None,
) -> dict[str, Any]:
    paths = paths or default_paths()
    paths.f18_dir.mkdir(parents=True, exist_ok=True)

    def _blocked(reason: str, extra: dict[str, Any] | None = None) -> dict[str, Any]:
        receipt = {
            "schema_version": PERSIST_SCHEMA_VERSION,
            "decision": DECISION_BLOCKED,
            "base_commit": FROZEN_F17_COMMIT,
            "block_reason": reason,
            "canonical_writes": False,
            "product_promotion": False,
            **(extra or {}),
        }
        write_json(paths.f18_dir / "transition_review_persist.json", receipt)
        return receipt

    try:
        frozen = verify_f16_frozen_inputs(paths)
        human_ws = verify_frozen_human_worksheets(paths)
    except FrozenInputMismatchError as exc:
        return _blocked(f"frozen_hash_mismatch:{exc}")
    except FrozenHumanWorksheetError as exc:
        return _blocked(f"human_worksheet_mismatch:{exc}")

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
    ambiguous_annotated = [
        annotate_ambiguous_subject(s, coupling) for s in ambiguous_subjects
    ]
    missing_annotated = [
        annotate_missing_subject(s, coupling) for s in missing_subjects
    ]

    type_a_path = Path(human_ws["type_a_path"])
    type_b_path = Path(human_ws["type_b_path"])
    try:
        type_a_candidates, type_a_dry = type_a_candidates_from_worksheet(
            type_a_path, expected_blank_rows=_blank_type_a_rows(ambiguous_annotated)
        )
        type_b_candidates, type_b_dry = type_b_candidates_from_worksheet(
            type_b_path, expected_blank_rows=_blank_type_b_rows(missing_annotated)
        )
    except FrozenHumanWorksheetError as exc:
        return _blocked(f"human_worksheet_mismatch:{exc}")

    type_a_registry = paths.f18_dir / "malidaba_continuity_reviews_v1.jsonl"
    type_b_registry = paths.f18_dir / "malidaba_missing_disposition_reviews_v1.jsonl"

    type_a_apply = _persist_kind(
        kind="type_a",
        schema_version=TYPE_A_SCHEMA,
        worksheet_path=type_a_path,
        output_path=type_a_registry,
        candidates=type_a_candidates,
        receipt_path=paths.f18_dir / "type_a_persist_receipt.json",
    )
    type_b_apply = _persist_kind(
        kind="type_b",
        schema_version=TYPE_B_SCHEMA,
        worksheet_path=type_b_path,
        output_path=type_b_registry,
        candidates=type_b_candidates,
        receipt_path=paths.f18_dir / "type_b_persist_receipt.json",
    )

    type_a_val = validate_review_file(type_a_registry, kind="type_a")
    type_b_val = validate_review_file(type_b_registry, kind="type_b")
    type_a_leaf_ids = set(find_review_leaves([item.row for item in type_a_val.rows]))
    type_b_leaf_ids = set(find_review_leaves([item.row for item in type_b_val.rows]))
    type_a_leaves = [
        item.row for item in type_a_val.rows if item.review_id in type_a_leaf_ids
    ]
    type_b_leaves = [
        item.row for item in type_b_val.rows if item.review_id in type_b_leaf_ids
    ]

    graph = build_governed_continuity_graph(
        proposals=proposals,
        type_a_leaves=type_a_leaves,
        type_b_leaves=type_b_leaves,
        baseline_index=migration["baseline_index"],
        current_index=migration["current_index"],
    )
    write_jsonl(
        paths.f18_dir / "virtual" / "logical_lexical_continuity.jsonl",
        graph["objects"],
    )
    overlay = graph["overlay"]
    write_json(paths.f18_dir / "virtual" / "identity_overlay.json", overlay)

    virtual = run_virtual_overlay(
        paths,
        overlay=overlay,
        proposals=proposals,
        ambiguous_baseline_ids=set(),
        missing_baseline_ids={str(s["baseline_ir_id"]) for s in missing_subjects},
        virtual_dir=paths.f18_dir / "virtual",
    )

    g7_after = virtual["g7_after"]
    g7_ok = (
        g7_after.get("requires_remap") == 0
        and g7_after.get("ambiguous") == 0
        and g7_after.get("broken") == 0
        and g7_after.get("still_resolves") == 37
    )
    g7_gate = GateResult(
        "G7_DOWNSTREAM_REFERENCE_INTEGRITY_PASS",
        "PASS" if g7_ok else "BLOCK",
        {"virtual": g7_after, "overlay_size": len(overlay)},
        None
        if g7_ok
        else (
            f"unresolved_identity_refs:remap={g7_after.get('requires_remap')}"
            f";ambiguous={g7_after.get('ambiguous')};broken={g7_after.get('broken')}"
        ),
    )

    classified_failures = _classify_g8_failures(
        list((virtual.get("regression_after") or {}).get("failures") or []),
        overlay=overlay,
        alias_apply_note=str(
            (virtual.get("virtual_rewrites") or {}).get("alias_apply_note") or ""
        ),
    )
    transition_fails = [f for f in classified_failures if f.get("root_cause") == "TRANSITION_MAPPING"]
    preexisting_fails = [
        f for f in classified_failures if f.get("root_cause") == "PREEXISTING_UNRELATED"
    ]
    g8_ok = len(transition_fails) == 0
    g8_gate = GateResult(
        "G8_ISOLATED_BUILD_REGRESSION_PASS",
        "PASS" if g8_ok else "BLOCK",
        {
            "pass": (virtual.get("regression_after") or {}).get("pass"),
            "fail": (virtual.get("regression_after") or {}).get("fail"),
            "transition_mapping_failures": len(transition_fails),
            "preexisting_unrelated_failures": len(preexisting_fails),
            "alias_apply_note": (virtual.get("virtual_rewrites") or {}).get(
                "alias_apply_note"
            ),
        },
        None
        if g8_ok
        else f"transition_mapping_regression_failures:{len(transition_fails)}",
    )

    f15_disp = load_f15_destructive_dispositions(paths)
    retain_ids = {
        str(r["baseline_ir_id"])
        for r in type_b_leaves
        if r.get("review_decision") == TYPE_B_REVIEW_DECISION
    }
    continuity_disp = apply_human_type_b_dispositions(
        f15_disp, retain_baseline_ir_ids=retain_ids
    )
    g9_gate, g9_counts = evaluate_g9_versioned_continuity(continuity_disp)

    # G1–G6 / G10 reuse F15 evaluators; do not rewrite F15 acceptance/manifests.
    baseline_records = load_jsonl_records(paths.baseline_ir)
    current_records = load_jsonl_records(paths.current_ir)
    nested, checked = count_nested_lxp2_pages(paths.crawl_dir)
    reparse_cache = (
        paths.repo_root
        / "data"
        / "malidaba_delta"
        / "current"
        / "f11_gates"
        / "baseline_reparse.jsonl"
    )
    gates = {
        "G1_SOURCE_CAPTURE_VALID": evaluate_g1_source_capture(paths),
        "G2_PARSER_COMPATIBILITY_PASS": evaluate_g2_parser_compatibility(
            baseline_records,
            current_records,
            nested_lxp2_pages=nested,
            pages_checked=checked,
        ),
        "G3_BASELINE_REGRESSION_PASS": evaluate_g3_baseline_regression(
            baseline_records,
            baseline_crawl_dir=paths.baseline_crawl_dir,
            reparse_cache=reparse_cache if reparse_cache.is_file() else None,
        ),
        "G4_CURRENT_STRUCTURAL_COVERAGE_PASS": evaluate_g4_structural_coverage(
            current_records
        ),
        "G5_DELTA_DETERMINISTIC": evaluate_g5_delta_deterministic(
            baseline_records,
            current_records,
            frozen_delta_path=paths.delta,
        ),
        "G6_DELTA_REVIEW_EVIDENCE_SUFFICIENT": evaluate_g6_review_evidence(paths),
        "G7_DOWNSTREAM_REFERENCE_INTEGRITY_PASS": g7_gate,
        "G8_ISOLATED_BUILD_REGRESSION_PASS": g8_gate,
        "G9_NO_UNREVIEWED_DESTRUCTIVE_CHANGE": g9_gate,
        "G10_RIGHTS_POSTURE_RECORDED": evaluate_g10_rights(paths),
    }
    overall, reasons = derive_overall_decision(gates)
    g10 = gates["G10_RIGHTS_POSTURE_RECORDED"]
    rights = RightsPosture(
        claimed_license=str(g10.evidence.get("claimed_license") or "CC BY-NC-SA 4.0"),
        internal_source_maintenance=str(
            g10.evidence.get("internal_source_maintenance") or "allowed"
        ),
        noncommercial_distribution=str(
            g10.evidence.get("noncommercial_distribution") or "requires_rights_review"
        ),
        commercial_distribution=str(
            g10.evidence.get("commercial_distribution") or "blocked"
        ),
        notes=list(g10.evidence.get("notes") or []),
    )

    # Virtual proof that logical IDs survive edition-specific ir_id change.
    sample_old = next(iter(overlay.values()), "")
    future_ok = False
    if sample_old:
        future_ok = logical_reference_survives_edition_ir_change(
            overlay=overlay,
            objects=graph["objects"],
            old_current_ir_id=sample_old,
            new_current_ir_id="future_edition_ir_placeholder",
        )

    persist_ok = (
        type_a_dry.get("rows_read") == 5
        and type_a_dry.get("rows_skipped_unreviewed") == 0
        and type_a_dry.get("preview_row_count") == 5
        and type_a_dry.get("error_count") == 0
        and type_b_dry.get("rows_read") == 42
        and type_b_dry.get("rows_skipped_unreviewed") == 0
        and type_b_dry.get("preview_row_count") == 42
        and type_b_dry.get("error_count") == 0
        and _apply_ok(type_a_apply, expected_new=5)
        and _apply_ok(type_b_apply, expected_new=42)
        and graph["counts"]["deterministic"] == 10
        and graph["counts"]["human_confirmed"] == 5
        and graph["counts"]["legacy_retained"] == 42
        and graph["counts"]["unresolved"] == 0
        and graph["validation"]["ok"]
    )
    decision = DECISION_READY if persist_ok else DECISION_BLOCKED

    receipt = {
        "schema_version": PERSIST_SCHEMA_VERSION,
        "decision": decision,
        "base_commit": FROZEN_F17_COMMIT,
        "git_head": _git_head(paths.repo_root),
        "frozen_inputs": {
            "status": "PASS",
            "baseline_ir_sha256": frozen.baseline_ir_sha256,
            "current_ir_sha256": frozen.current_ir_sha256,
            "delta_sha256": frozen.delta_sha256,
            "acceptance_sha256": frozen.acceptance_sha256,
        },
        "human_worksheets": human_ws,
        "type_a": {
            "dry_run": type_a_dry,
            "apply": type_a_apply,
            "human_reviews": 5,
            "decision": "confirmed_continuity",
        },
        "type_b": {
            "dry_run": type_b_dry,
            "apply": type_b_apply,
            "human_reviews": 42,
            "decision": TYPE_B_REVIEW_DECISION,
        },
        "logical_continuity": graph["counts"],
        "logical_graph_validation": graph["validation"],
        "overlay_size": len(overlay),
        "virtual_g7": g7_after,
        "virtual_g8": {
            "pass": (virtual.get("regression_after") or {}).get("pass"),
            "fail": (virtual.get("regression_after") or {}).get("fail"),
            "transition_mapping_failures": [
                {"case_id": f.get("case_id"), "mismatches": f.get("mismatches")}
                for f in transition_fails
            ],
            "preexisting_unrelated_failures": [
                {"case_id": f.get("case_id"), "class": f.get("class")}
                for f in preexisting_fails
            ],
            "alias_apply_note": (virtual.get("virtual_rewrites") or {}).get(
                "alias_apply_note"
            ),
        },
        "provisional_g9": {"status": g9_gate.status, "counts": g9_counts},
        "source_refresh_gates": {k: v.to_dict() for k, v in gates.items()},
        "overall": overall,
        "blocking_reasons": reasons,
        "engineering_ready": overall == OVERALL_ENGINEERING_READY,
        "future_renumbering_protected_by_logical_layer": "YES" if future_ok else "NO",
        "rights": rights.to_dict(),
        "canonical_writes": False,
        "product_promotion": False,
        "publication_authorized": False,
        "product_candidates_authorized": False,
        "tracked_downstream_mutation": False,
        "local_artifacts": {
            "type_a_registry": str(type_a_registry),
            "type_b_registry": str(type_b_registry),
            "receipt": str(paths.f18_dir / "transition_review_persist.json"),
        },
    }
    write_json(paths.f18_dir / "transition_review_persist.json", receipt)
    write_json(
        paths.f18_dir / "source_refresh_acceptance_f18.json",
        {
            "overall_decision": overall,
            "gates": {k: v.to_dict() for k, v in gates.items()},
            "rights_posture": rights.to_dict(),
            "engineering_ready": overall == OVERALL_ENGINEERING_READY,
            "publication_authorized": False,
            "product_candidates_authorized": False,
        },
    )
    return receipt
