"""CORPUS1F20 — guarded canonical Malidaba source-refresh transaction dry-run."""

from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path
from typing import Any

from malipense_version_delta.canonical_json import sha256_file, write_json
from malipense_version_delta.compare import load_jsonl_records

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
    FROZEN_F18_TYPE_A_REGISTRY_SHA256,
    FROZEN_F18_TYPE_B_REGISTRY_SHA256,
    FROZEN_F19_COMMIT,
    FROZEN_F19_LOGICAL_CONTINUITY_SHA256,
    SourceRefreshPaths,
    default_paths,
)
from ..persist.validate import find_review_leaves, validate_review_file
from ..transition.id_remap import generated_mapping_overlay
from ..transition.virtual_overlay import virtual_g7_counts
from .apply_sim import run_rollback_drills
from .build import run_staged_product_build
from .closure_refs import evaluate_reference_closure
from .freeze import FrozenTransactionInputError, freeze_transaction_inputs
from .future_edition import simulate_future_edition_renumber
from .layers import build_canonical_layers, validate_layer_provenance
from .manifest import (
    build_rollback_manifest,
    build_transaction_manifest,
    compute_transaction_id,
    manifest_sha256,
)
from .model import (
    DECISION_BLOCKED,
    DECISION_READY,
    KIND_DERIVED,
    KIND_GOVERNED,
    PROJECTION_POLICY,
)
from .preconditions import check_preconditions
from .stage import materialize_candidate_bytes, retain_before_bytes, write_staging_tree
from .surface import discover_mutation_surface


def _git_head(repo_root: Path) -> str:
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=repo_root, text=True
        ).strip()
    except Exception:
        return "UNKNOWN"


def _git_diff_check(repo_root: Path) -> str:
    try:
        subprocess.check_call(
            ["git", "diff", "--check"],
            cwd=repo_root,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return "PASS"
    except Exception:
        return "FAIL"


def _canonical_snapshot(paths: SourceRefreshPaths) -> dict[str, str | None]:
    targets = [
        paths.baseline_ir,
        paths.aliases,
        paths.supplements,
        paths.target_variants,
        paths.index_ir,
        paths.owner_ir,
        paths.f18_dir / "malidaba_continuity_reviews_v1.jsonl",
        paths.f18_dir / "malidaba_missing_disposition_reviews_v1.jsonl",
    ]
    out: dict[str, str | None] = {}
    for path in targets:
        out[str(path)] = sha256_file(path) if path.is_file() else None
    return out


def _load_overlay(paths: SourceRefreshPaths) -> dict[str, str]:
    raw = json.loads(
        (paths.f19_dir / "virtual" / "identity_overlay.json").read_text(encoding="utf-8")
    )
    return {str(k): str(v) for k, v in raw.items()}


def _blocked_stub(
    paths: SourceRefreshPaths,
    blocking: list[str],
    *,
    frozen_status: str,
    frozen: dict[str, Any],
    base_commit: str,
) -> dict[str, Any]:
    return {
        "decision": DECISION_BLOCKED,
        "f19_commit": FROZEN_F19_COMMIT,
        "base_commit": base_commit,
        "frozen_inputs": frozen_status,
        "blocking_reasons": blocking,
        "frozen": frozen,
        "real_canonical_writes": "NONE",
        "publication_writes": "NONE",
        "product_promotion": "NONE",
        "commit": "NOT_CREATED",
        "git_head": _git_head(paths.repo_root),
    }


def evaluate_canonical_refresh_transaction(
    paths: SourceRefreshPaths | None = None,
    *,
    workspace: Path | None = None,
    expected_base_commit: str | None = None,
) -> dict[str, Any]:
    """
    Complete guarded transaction dry-run: freeze → stage → build → validate.

    Transaction identity is commit-anchored: base_git_commit defaults to HEAD.
    Never mutates real canonical paths. Never applies.
    """
    paths = paths or default_paths()
    workspace = workspace or paths.f20_dir
    workspace.mkdir(parents=True, exist_ok=True)
    base_commit = expected_base_commit or _git_head(paths.repo_root)
    blocking: list[str] = []
    before_snap = _canonical_snapshot(paths)

    try:
        frozen = freeze_transaction_inputs(paths)
        frozen_status = "PASS"
    except FrozenTransactionInputError as exc:
        frozen = {"status": "FAIL", "error": str(exc), "inputs": [], "hashes": {}}
        frozen_status = "FAIL"
        blocking.append(f"frozen_inputs:{exc}")
        receipt = _blocked_stub(
            paths,
            blocking,
            frozen_status=frozen_status,
            frozen=frozen,
            base_commit=base_commit,
        )
        write_json(workspace / "transaction_dry_run.json", receipt)
        return receipt

    layers = build_canonical_layers(paths)
    provenance = validate_layer_provenance(layers)
    if not provenance["ok"]:
        blocking.append(f"provenance:{provenance['errors'][:5]}")

    candidate_bytes = materialize_candidate_bytes(paths, layers)
    candidate_hashes = {
        rel: hashlib.sha256(payload).hexdigest()
        for rel, payload in sorted(candidate_bytes.items())
    }

    surface = discover_mutation_surface(paths, candidate_bytes=candidate_bytes)
    staging = write_staging_tree(paths, candidate_bytes, workspace=workspace)
    before_store = retain_before_bytes(
        paths, surface["mutations"], workspace=workspace
    )

    overlay = _load_overlay(paths)
    original_supplements = load_jsonl_records(paths.supplements)
    remapped_supplements = load_jsonl_records(
        paths.f19_dir / "virtual" / "product" / "source_index_supplements_virtual.jsonl"
    )
    mapping_overlay = generated_mapping_overlay(
        original_supplements, remapped_supplements
    )

    try:
        staged_build = run_staged_product_build(
            paths,
            staging_root=Path(staging["staging_root"]),
            overlay=overlay,
            generated_mapping_overlay=mapping_overlay,
            workspace=workspace,
        )
    except Exception as exc:
        staged_build = {
            "matches_f19_behavior": False,
            "error": str(exc),
            "canonical_pass": None,
            "canonical_fail": None,
            "staged_pass": None,
            "staged_fail": None,
            "differential": {"g8_pass": False},
        }
        blocking.append(f"staged_build:{exc}")

    ref_closure = evaluate_reference_closure(
        paths,
        staging_root=Path(staging["staging_root"]),
        overlay={**overlay, **mapping_overlay},
    )
    if not ref_closure["ok"]:
        blocking.append(
            f"reference_closure:ambiguous={ref_closure['ambiguous']}:"
            f"broken={ref_closure['broken']}"
        )

    integrity_rows = load_jsonl_records(paths.integrity_manifest)
    g7_counts = virtual_g7_counts(integrity_rows, overlay)
    g7_pass = (
        g7_counts.get("ambiguous", 1) == 0
        and g7_counts.get("broken", 1) == 0
        and g7_counts.get("requires_remap", 1) == 0
    )

    type_b_val = validate_review_file(
        paths.f18_dir / "malidaba_missing_disposition_reviews_v1.jsonl", kind="type_b"
    )
    type_b_leaf_ids = set(find_review_leaves([item.row for item in type_b_val.rows]))
    type_b_leaves = [
        item.row for item in type_b_val.rows if item.review_id in type_b_leaf_ids
    ]
    retain_ids = {
        str(r["baseline_ir_id"])
        for r in type_b_leaves
        if r.get("review_decision") == TYPE_B_REVIEW_DECISION
    }
    dispositions = apply_human_type_b_dispositions(
        load_f15_destructive_dispositions(paths),
        retain_baseline_ir_ids=retain_ids,
    )
    g9, _g9_counts = evaluate_g9_versioned_continuity(dispositions)

    future = simulate_future_edition_renumber(
        logical_rows=layers["logical_rows"],
        overlay=overlay,
        sample_current_ir_id=next(iter(overlay.values()), ""),
    )
    if not future.get("ok"):
        blocking.append(f"future_edition:{future}")

    ordered_paths = [m["path"] for m in surface["mutations"]]
    drills = run_rollback_drills(
        work_root=workspace / "rollback_drills",
        candidate_bytes=candidate_bytes,
        before_store=before_store,
        ordered_paths=ordered_paths,
    )
    if not drills.get("all_pass"):
        blocking.append("rollback_drill_failed")

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
    gates: dict[str, GateResult] = {
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
        "G7_DOWNSTREAM_REFERENCE_INTEGRITY_PASS": GateResult(
            "G7_DOWNSTREAM_REFERENCE_INTEGRITY_PASS",
            "PASS" if g7_pass else "BLOCK",
            g7_counts,
            None if g7_pass else "g7_ambiguous_or_broken_or_requires_remap",
        ),
        "G8_ISOLATED_BUILD_REGRESSION_PASS": GateResult(
            "G8_ISOLATED_BUILD_REGRESSION_PASS",
            "PASS"
            if staged_build.get("differential", {}).get("g8_pass")
            else "BLOCK",
            {
                "canonical_pass": staged_build.get("canonical_pass"),
                "canonical_fail": staged_build.get("canonical_fail"),
                "staged_pass": staged_build.get("staged_pass"),
                "staged_fail": staged_build.get("staged_fail"),
                "differential": staged_build.get("differential"),
            },
            None
            if staged_build.get("differential", {}).get("g8_pass")
            else "staged_g8_fail",
        ),
        "G9_NO_UNREVIEWED_DESTRUCTIVE_CHANGE": g9,
        "G10_RIGHTS_POSTURE_RECORDED": evaluate_g10_rights(paths),
    }
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
    rights_summary = {
        "internal": rights.internal_source_maintenance,
        "noncommercial": rights.noncommercial_distribution,
        "commercial": rights.commercial_distribution,
    }

    g_status = {gid: gates[gid].status for gid in gates}
    overall, overall_reasons = derive_overall_decision(gates)
    engineering_ready = overall == OVERALL_ENGINEERING_READY
    if overall_reasons and not engineering_ready:
        blocking.extend(f"overall_reason:{r}" for r in overall_reasons)

    preconditions = check_preconditions(
        paths,
        expected_base_commit=base_commit,
        frozen_hashes=frozen["hashes"],
        mutations=surface["mutations"],
        publication_in_plan=surface["publication_paths_in_transaction"],
        g_results=g_status,
        staged_regression={
            "canonical_pass": staged_build.get("canonical_pass"),
            "canonical_fail": staged_build.get("canonical_fail"),
            "staged_pass": staged_build.get("staged_pass"),
            "staged_fail": staged_build.get("staged_fail"),
        },
        rights=rights_summary,
        allow_dirty_for_dry_run=True,
    )
    apply_preconditions = check_preconditions(
        paths,
        expected_base_commit=base_commit,
        frozen_hashes=frozen["hashes"],
        mutations=surface["mutations"],
        publication_in_plan=surface["publication_paths_in_transaction"],
        g_results=g_status,
        staged_regression={
            "canonical_pass": staged_build.get("canonical_pass"),
            "canonical_fail": staged_build.get("canonical_fail"),
            "staged_pass": staged_build.get("staged_pass"),
            "staged_fail": staged_build.get("staged_fail"),
        },
        rights=rights_summary,
        allow_dirty_for_dry_run=False,
    )

    transaction_id = compute_transaction_id(
        base_git_commit=base_commit,
        frozen_input_hashes=frozen["hashes"],
        mutation_paths=ordered_paths,
    )
    rollback_manifest = build_rollback_manifest(
        transaction_id=transaction_id,
        before_store=before_store,
        mutations=surface["mutations"],
    )
    rollback_sha = manifest_sha256(rollback_manifest)
    postconditions = {
        "destination_after_hashes_exact": True,
        "legacy_retained_count": layers["counts"]["legacy_retained_assertions"],
        "logical_continuity_count": layers["counts"]["logical_continuity_objects"],
        "unresolved_continuity": layers["counts"]["unresolved_continuity"],
        "g7_pass": g7_pass,
        "g8_pass": bool(staged_build.get("differential", {}).get("g8_pass")),
        "g9_pass": g9.status == "PASS",
        "rights_unchanged": True,
        "publication_untouched": len(surface["publication_paths_in_transaction"]) == 0,
    }
    tx_manifest = build_transaction_manifest(
        transaction_id=transaction_id,
        base_git_commit=base_commit,
        frozen_input_hashes=frozen["hashes"],
        mutations=surface["mutations"],
        counts=layers["counts"],
        review_registry_hashes={
            "f18_type_a": FROZEN_F18_TYPE_A_REGISTRY_SHA256,
            "f18_type_b": FROZEN_F18_TYPE_B_REGISTRY_SHA256,
        },
        logical_continuity_hash=FROZEN_F19_LOGICAL_CONTINUITY_SHA256,
        rights=rights_summary,
        preconditions=preconditions,
        postconditions=postconditions,
        rollback_manifest_hash=rollback_sha,
        dry_run_result={
            "staged_build_ok": bool(staged_build.get("matches_f19_behavior")),
            "rollback_drills_ok": bool(drills.get("all_pass")),
            "reference_closure_ok": bool(ref_closure.get("ok")),
            "real_apply_executed": False,
            "apply_mode_preconditions_ok": bool(apply_preconditions.get("ok")),
        },
    )
    tx_sha = manifest_sha256(tx_manifest)

    write_json(workspace / "transaction_manifest.json", tx_manifest)
    write_json(workspace / "rollback_manifest.json", rollback_manifest)
    write_json(
        workspace / "transaction_diff_report.json",
        {
            "mutations": surface["mutations"],
            "counts": layers["counts"],
            "projection_policy": PROJECTION_POLICY,
            "conflicting_assertions": layers["counts"]["conflicting_assertions"],
            "current_wins_overwrite": False,
        },
    )

    after_snap = _canonical_snapshot(paths)
    non_mutation = before_snap == after_snap
    if not non_mutation:
        blocking.append("canonical_paths_mutated_during_dry_run")

    if surface["publication_paths_in_transaction"]:
        blocking.append("publication_in_transaction")

    if layers["counts"]["unresolved_continuity"] != 0:
        blocking.append("unresolved_continuity")

    if layers["counts"]["legacy_retained_assertions"] != 42:
        blocking.append("legacy_count_not_42")

    if not staged_build.get("matches_f19_behavior"):
        blocking.append("staged_build_mismatch_f19")

    if not engineering_ready:
        blocking.append(f"overall:{overall}")

    for gid, status in g_status.items():
        if status != "PASS":
            blocking.append(f"gate:{gid}")

    decision = DECISION_READY if not blocking else DECISION_BLOCKED

    governed = [m["path"] for m in surface["mutations"] if m["kind"] == KIND_GOVERNED]
    derived = [m["path"] for m in surface["mutations"] if m["kind"] == KIND_DERIVED]

    receipt = {
        "schema_version": "malidaba_canonical_refresh_transaction_dry_run_v1",
        "decision": decision,
        "f19_commit": FROZEN_F19_COMMIT,
        "base_commit": base_commit,
        "git_head": _git_head(paths.repo_root),
        "frozen_inputs": frozen_status,
        "frozen_input_hashes": frozen["hashes"],
        "canonical_mutation_paths": len(surface["mutations"]),
        "mutations": surface["mutations"],
        "publication_paths_in_transaction": surface["publication_paths_in_transaction"],
        "publication_paths_discovered": surface["publication_paths_discovered"],
        "counts": layers["counts"],
        "kun_logical_ids": layers["kun_logical_ids"],
        "provenance": provenance,
        "governed_canonical_inputs": governed,
        "deterministic_derived_outputs": derived,
        "projection_policy": PROJECTION_POLICY,
        "candidate_hashes_precomputed": candidate_hashes,
        "staging": staging,
        "staged_build": staged_build,
        "reference_closure": ref_closure,
        "future_edition_renumber": future,
        "rollback_drills": {
            "success_path": "PASS" if drills.get("success_path") else "FAIL",
            "fail_after_first_write": (
                "PASS" if drills.get("fail_after_first_write") else "FAIL"
            ),
            "fail_mid_transaction": (
                "PASS" if drills.get("fail_mid_transaction") else "FAIL"
            ),
            "fail_post_validation": (
                "PASS" if drills.get("fail_post_validation") else "FAIL"
            ),
        },
        "transaction_id": transaction_id,
        "transaction_manifest_sha256": tx_sha,
        "rollback_manifest_sha256": rollback_sha,
        "preconditions_dry_run": preconditions,
        "preconditions_apply_mode": apply_preconditions,
        "source_refresh_gates": {gid: gates[gid].to_dict() for gid in gates},
        "overall": overall,
        "engineering_ready": engineering_ready,
        "rights": rights_summary,
        "blocking_reasons": blocking,
        "real_canonical_writes": "NONE",
        "publication_writes": "NONE",
        "product_promotion": "NONE",
        "non_mutation": "PASS" if non_mutation else "FAIL",
        "git_diff_check": _git_diff_check(paths.repo_root),
        "web_scripts": "UNTOUCHED",
        "commit": "NOT_CREATED",
        "workspace": str(workspace),
        "apply_protocol": {
            "default": "validate/dry-run",
            "apply_flag": "--apply",
            "requires_transaction_id": True,
            "requires_expected_base_commit": True,
            "phases": [
                "prepare",
                "validate",
                "apply",
                "post-validate",
                "rollback-on-failure",
            ],
            "real_apply_executed": False,
        },
        "local_artifacts": {
            "transaction_manifest": str(workspace / "transaction_manifest.json"),
            "rollback_manifest": str(workspace / "rollback_manifest.json"),
            "staging_root": staging["staging_root"],
            "dry_run_receipt": str(workspace / "transaction_dry_run.json"),
        },
    }
    write_json(workspace / "transaction_dry_run.json", receipt)
    return receipt
