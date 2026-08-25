"""CORPUS1F19 — close transition-induced G8 regressions via full virtual product."""

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
from ..paths import (
    FROZEN_F18_COMMIT,
    FROZEN_F18_TYPE_A_REGISTRY_SHA256,
    FROZEN_F18_TYPE_B_REGISTRY_SHA256,
    SourceRefreshPaths,
    default_paths,
)
from ..persist.graph import (
    build_governed_continuity_graph,
    logical_reference_survives_edition_ir_change,
)
from ..persist.validate import find_review_leaves, validate_review_file
from ..transition.frozen import verify_f16_frozen_inputs
from ..transition.id_remap import (
    IDENTITY_LAYERS,
    audit_catalog,
    logical_index_from_objects,
)
from ..transition.proposals import build_remap_proposals
from ..transition.reconstruct import reconstruct_identity_migration
from ..transition.virtual_overlay import virtual_g7_counts
from .differential import classify_suites, replay_regression_suite
from .virtual_product import VirtualProductError, assemble_virtual_search_product

CLOSURE_SCHEMA_VERSION = "malidaba_transition_regression_closure_v1"
DECISION_CLOSED = "CORPUS1F19_MALIDABA_TRANSITION_REGRESSIONS_CLOSED"
DECISION_BLOCKED = "CORPUS1F19_MALIDABA_TRANSITION_REGRESSION_BLOCKED"

# F18 aliases-only virtual replay (pre-repair), recorded for the slice report.
F18_VIRTUAL_BEFORE = {"pass": 24, "fail": 6}


def _git_head(repo_root: Path) -> str:
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=repo_root, text=True
        ).strip()
    except Exception:
        return "UNKNOWN"


def _load_f18_leaves(paths: SourceRefreshPaths) -> dict[str, Any]:
    type_a_registry = paths.f18_dir / "malidaba_continuity_reviews_v1.jsonl"
    type_b_registry = paths.f18_dir / "malidaba_missing_disposition_reviews_v1.jsonl"
    if not type_a_registry.is_file() or not type_b_registry.is_file():
        raise FileNotFoundError("f18_review_registries_missing")
    type_a_sha = sha256_file(type_a_registry)
    type_b_sha = sha256_file(type_b_registry)
    if type_a_sha != FROZEN_F18_TYPE_A_REGISTRY_SHA256:
        raise FrozenInputMismatchError(
            f"type_a_registry_sha:{type_a_sha} expected {FROZEN_F18_TYPE_A_REGISTRY_SHA256}"
        )
    if type_b_sha != FROZEN_F18_TYPE_B_REGISTRY_SHA256:
        raise FrozenInputMismatchError(
            f"type_b_registry_sha:{type_b_sha} expected {FROZEN_F18_TYPE_B_REGISTRY_SHA256}"
        )
    type_a_val = validate_review_file(type_a_registry, kind="type_a")
    type_b_val = validate_review_file(type_b_registry, kind="type_b")
    type_a_leaf_ids = set(find_review_leaves([item.row for item in type_a_val.rows]))
    type_b_leaf_ids = set(find_review_leaves([item.row for item in type_b_val.rows]))
    return {
        "type_a_registry": type_a_registry,
        "type_b_registry": type_b_registry,
        "type_a_sha256": type_a_sha,
        "type_b_sha256": type_b_sha,
        "type_a_leaves": [
            item.row for item in type_a_val.rows if item.review_id in type_a_leaf_ids
        ],
        "type_b_leaves": [
            item.row for item in type_b_val.rows if item.review_id in type_b_leaf_ids
        ],
    }


def _canonical_paths(paths: SourceRefreshPaths) -> tuple[Path, Path]:
    bundle = paths.canonical_bundle_dir
    if bundle is None:
        raise FileNotFoundError("canonical_bundle_dir_missing")
    index = bundle / "search_index.jsonl"
    records = bundle / "records.jsonl"
    if not index.is_file() or not records.is_file():
        raise FileNotFoundError("canonical_bundle_search_artifacts_missing")
    return index, records


def evaluate_transition_regression_closure(
    paths: SourceRefreshPaths | None = None,
) -> dict[str, Any]:
    paths = paths or default_paths()
    paths.f19_dir.mkdir(parents=True, exist_ok=True)

    def _blocked(reason: str, extra: dict[str, Any] | None = None) -> dict[str, Any]:
        receipt = {
            "schema_version": CLOSURE_SCHEMA_VERSION,
            "decision": DECISION_BLOCKED,
            "base_commit": FROZEN_F18_COMMIT,
            "block_reason": reason,
            "canonical_writes": False,
            "product_promotion": False,
            **(extra or {}),
        }
        write_json(paths.f19_dir / "transition_regression_closure.json", receipt)
        return receipt

    try:
        frozen = verify_f16_frozen_inputs(paths)
        f18 = _load_f18_leaves(paths)
    except FrozenInputMismatchError as exc:
        return _blocked(f"frozen_hash_mismatch:{exc}")
    except FileNotFoundError as exc:
        return _blocked(str(exc))

    migration = reconstruct_identity_migration(paths)
    proposals = build_remap_proposals(
        migration["migration_subjects"],
        current_index=migration["current_index"],
    )
    graph = build_governed_continuity_graph(
        proposals=proposals,
        type_a_leaves=f18["type_a_leaves"],
        type_b_leaves=f18["type_b_leaves"],
        baseline_index=migration["baseline_index"],
        current_index=migration["current_index"],
    )
    overlay = graph["overlay"]
    virtual_dir = paths.f19_dir / "virtual"
    write_json(virtual_dir / "identity_overlay.json", overlay)
    write_jsonl(virtual_dir / "logical_lexical_continuity.jsonl", graph["objects"])

    integrity_rows = load_jsonl_records(paths.integrity_manifest)
    g7_after = virtual_g7_counts(integrity_rows, overlay)
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

    product_error: str | None = None
    try:
        product = assemble_virtual_search_product(
            paths,
            overlay=overlay,
            work_dir=virtual_dir / "product",
            objects=graph["objects"],
        )
    except VirtualProductError as exc:
        product = {"error": str(exc)}
        product_error = str(exc)

    canonical_results: list = []
    refresh_results: list = []
    differential: dict[str, Any] = {
        "g8_pass": False,
        "canonical_pass": 0,
        "canonical_fail": 0,
        "refresh_pass": 0,
        "refresh_fail": 0,
        "transition_introduced_failures": 0,
        "transition_worsened_failures": 0,
        "unchanged_preexisting_failures": 0,
        "fixed_failures": 0,
        "cases": [],
        "status": "SKIPPED",
    }
    if product_error is None:
        try:
            canon_index, canon_records = _canonical_paths(paths)
            canonical_results = replay_regression_suite(
                search_index_path=canon_index,
                records_path=canon_records,
                regression_dir=paths.search_regression_dir,
                overlay={},
            )
            refresh_overlay = dict(overlay)
            refresh_overlay.update(product.get("generated_mapping_overlay") or {})
            refresh_results = replay_regression_suite(
                search_index_path=Path(product["search_index_path"]),
                records_path=Path(product["records_path"]),
                regression_dir=paths.search_regression_dir,
                overlay=refresh_overlay,
            )
            differential = classify_suites(
                canonical_results, refresh_results, refresh_overlay
            )
            differential["status"] = "RAN"
            differential["f18_virtual_before"] = dict(F18_VIRTUAL_BEFORE)
        except Exception as exc:
            product_error = f"regression_replay_failed:{exc}"
            differential["status"] = f"ERROR:{exc}"

    g8_ok = (
        product_error is None
        and differential.get("status") == "RAN"
        and bool(differential.get("g8_pass"))
    )
    g8_gate = GateResult(
        "G8_ISOLATED_BUILD_REGRESSION_PASS",
        "PASS" if g8_ok else "BLOCK",
        {
            "doctrine": "differential_canonical_vs_virtual_refresh",
            "canonical_pass": differential.get("canonical_pass"),
            "canonical_fail": differential.get("canonical_fail"),
            "refresh_pass": differential.get("refresh_pass"),
            "refresh_fail": differential.get("refresh_fail"),
            "transition_introduced_failures": differential.get(
                "transition_introduced_failures"
            ),
            "transition_worsened_failures": differential.get(
                "transition_worsened_failures"
            ),
            "unchanged_preexisting_failures": differential.get(
                "unchanged_preexisting_failures"
            ),
            "fixed_failures": differential.get("fixed_failures"),
            "introduced_case_ids": differential.get("introduced_case_ids"),
            "worsened_case_ids": differential.get("worsened_case_ids"),
            "product_error": product_error,
            "alias_apply_note": (product or {}).get("alias_apply_note"),
            "supplement_merge_note": (product or {}).get("supplement_merge_note"),
        },
        None
        if g8_ok
        else (
            product_error
            or (
                "transition_regression_delta:"
                f"introduced={differential.get('transition_introduced_failures')}"
                f";worsened={differential.get('transition_worsened_failures')}"
            )
        ),
    )

    f15_disp = load_f15_destructive_dispositions(paths)
    retain_ids = {
        str(r["baseline_ir_id"])
        for r in f18["type_b_leaves"]
        if r.get("review_decision") == TYPE_B_REVIEW_DECISION
    }
    continuity_disp = apply_human_type_b_dispositions(
        f15_disp, retain_baseline_ir_ids=retain_ids
    )
    g9_gate, g9_counts = evaluate_g9_versioned_continuity(continuity_disp)

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

    decision = (
        DECISION_CLOSED
        if overall == OVERALL_ENGINEERING_READY and g8_ok and g7_ok
        else DECISION_BLOCKED
    )

    sample_new = next(iter(overlay.values()), "")
    future_ok = False
    if sample_new:
        future_ok = logical_reference_survives_edition_ir_change(
            overlay=overlay,
            objects=graph["objects"],
            old_current_ir_id=sample_new,
            new_current_ir_id="future_edition_ir_placeholder",
        )

    blocking_cases = [
        c for c in differential.get("cases") or [] if c.get("blocks_transition")
    ]

    receipt = {
        "schema_version": CLOSURE_SCHEMA_VERSION,
        "decision": decision,
        "base_commit": FROZEN_F18_COMMIT,
        "git_head": _git_head(paths.repo_root),
        "frozen_inputs": {
            "status": "PASS",
            "baseline_ir_sha256": frozen.baseline_ir_sha256,
            "current_ir_sha256": frozen.current_ir_sha256,
            "delta_sha256": frozen.delta_sha256,
            "acceptance_sha256": frozen.acceptance_sha256,
            "type_a_registry_sha256": f18["type_a_sha256"],
            "type_b_registry_sha256": f18["type_b_sha256"],
        },
        "overlay_size": len(overlay),
        "logical_continuity": graph["counts"],
        "identity_layers": IDENTITY_LAYERS,
        "id_bearing_field_audit": audit_catalog(),
        "virtual_product": {
            k: product.get(k)
            for k in (
                "work_dir",
                "records_path",
                "search_index_path",
                "anchor_rewrites",
                "enrichment",
                "alias_apply_note",
                "supplement_merge_note",
                "field_updates",
                "generated_mapping_overlay",
                "normalize_stats",
                "candidate_records_sha256",
                "candidate_search_index_sha256",
                "error",
            )
            if k in product
        },
        "virtual_g7": g7_after,
        "canonical_regression": {
            "pass": differential.get("canonical_pass"),
            "fail": differential.get("canonical_fail"),
        },
        "virtual_regression_before_f19": dict(F18_VIRTUAL_BEFORE),
        "virtual_regression_after": {
            "pass": differential.get("refresh_pass"),
            "fail": differential.get("refresh_fail"),
        },
        "differential": {
            "status": differential.get("status"),
            "transition_introduced_failures": differential.get(
                "transition_introduced_failures"
            ),
            "transition_worsened_failures": differential.get(
                "transition_worsened_failures"
            ),
            "unchanged_preexisting_failures": differential.get(
                "unchanged_preexisting_failures"
            ),
            "fixed_failures": differential.get("fixed_failures"),
            "introduced_case_ids": differential.get("introduced_case_ids"),
            "worsened_case_ids": differential.get("worsened_case_ids"),
            "unchanged_preexisting_case_ids": differential.get(
                "unchanged_preexisting_case_ids"
            ),
            "blocking_cases": blocking_cases,
        },
        "provisional_g9": {"status": g9_gate.status, "counts": g9_counts},
        "source_refresh_gates": {k: v.to_dict() for k, v in gates.items()},
        "overall": overall,
        "blocking_reasons": reasons,
        "engineering_ready": overall == OVERALL_ENGINEERING_READY,
        "future_renumbering_protected_by_logical_layer": "YES" if future_ok else "NO",
        "logical_index_size": len(logical_index_from_objects(graph["objects"])),
        "rights": rights.to_dict(),
        "canonical_writes": False,
        "product_promotion": False,
        "publication_authorized": False,
        "product_candidates_authorized": False,
        "tracked_downstream_mutation": False,
        "local_artifacts": {
            "receipt": str(paths.f19_dir / "transition_regression_closure.json"),
            "virtual_dir": str(virtual_dir),
        },
    }
    write_json(paths.f19_dir / "transition_regression_closure.json", receipt)
    write_json(
        paths.f19_dir / "source_refresh_acceptance_f19.json",
        {
            "overall_decision": overall,
            "gates": {k: v.to_dict() for k, v in gates.items()},
            "rights_posture": rights.to_dict(),
            "engineering_ready": overall == OVERALL_ENGINEERING_READY,
            "publication_authorized": False,
            "product_candidates_authorized": False,
            "differential_g8": {
                "pass": differential.get("g8_pass"),
                "introduced": differential.get("transition_introduced_failures"),
                "worsened": differential.get("transition_worsened_failures"),
            },
        },
    )
    return receipt


def run_transition_regression_closure(
    paths: SourceRefreshPaths | None = None,
) -> dict[str, Any]:
    return evaluate_transition_regression_closure(paths)
