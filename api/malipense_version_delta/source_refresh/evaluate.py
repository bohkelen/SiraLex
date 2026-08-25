"""Orchestrate Malidaba SOURCE_REFRESH_ACCEPTANCE dry-run evaluation."""

from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Any

from malipense_version_delta.canonical_json import sha256_file, write_json
from malipense_version_delta.compare import load_jsonl_records

from .destructive_change import evaluate_g9_destructive_change
from .evidence_gates import (
    count_nested_lxp2_pages,
    evaluate_frozen_hashes,
    evaluate_g1_source_capture,
    evaluate_g2_parser_compatibility,
    evaluate_g3_baseline_regression,
    evaluate_g4_structural_coverage,
    evaluate_g5_delta_deterministic,
    evaluate_g6_review_evidence,
    evaluate_g10_rights,
)
from .isolated_build import evaluate_g8_isolated_build
from .model import (
    ACCEPTANCE_SCHEMA_VERSION,
    OVERALL_ENGINEERING_READY,
    GateResult,
    RightsPosture,
    SourceRefreshAcceptance,
    derive_overall_decision,
)
from .paths import (
    FROZEN_BASELINE_IR_SHA256,
    FROZEN_CURRENT_IR_SHA256,
    FROZEN_DELTA_SHA256,
    FROZEN_REVIEW_REGISTRY_SHA256,
    SourceRefreshPaths,
    default_paths,
)
from .reference_integrity import evaluate_g7_reference_integrity


def _git_head(repo_root: Path) -> str:
    try:
        out = subprocess.check_output(
            ["git", "rev-parse", "HEAD"],
            cwd=repo_root,
            text=True,
        ).strip()
        return out
    except Exception:
        return "UNKNOWN"


def evaluate_source_refresh_acceptance(
    paths: SourceRefreshPaths | None = None,
    *,
    skip_isolated_build: bool = False,
    baseline_reparse_cache: Path | None = None,
) -> SourceRefreshAcceptance:
    """
    Evaluate all SOURCE_REFRESH_ACCEPTANCE gates against frozen inputs.

    Produces local/gitignored manifests under paths.output_dir.
    Never mutates canonical IR/snapshots/bundles/shared tables.
    """
    paths = paths or default_paths()
    paths.output_dir.mkdir(parents=True, exist_ok=True)

    gates: dict[str, GateResult] = {}

    frozen = evaluate_frozen_hashes(paths)
    if frozen.status == "BLOCK":
        # Fail closed: still emit G1–G10 as BLOCK with frozen reason where needed
        for gid in (
            "G1_SOURCE_CAPTURE_VALID",
            "G2_PARSER_COMPATIBILITY_PASS",
            "G3_BASELINE_REGRESSION_PASS",
            "G4_CURRENT_STRUCTURAL_COVERAGE_PASS",
            "G5_DELTA_DETERMINISTIC",
            "G6_DELTA_REVIEW_EVIDENCE_SUFFICIENT",
            "G7_DOWNSTREAM_REFERENCE_INTEGRITY_PASS",
            "G8_ISOLATED_BUILD_REGRESSION_PASS",
            "G9_NO_UNREVIEWED_DESTRUCTIVE_CHANGE",
            "G10_RIGHTS_POSTURE_RECORDED",
        ):
            gates[gid] = GateResult(
                gid, "BLOCK", {"frozen_inputs": frozen.evidence}, frozen.block_reason
            )
        rights = RightsPosture(
            claimed_license="unknown",
            internal_source_maintenance="unknown",
            noncommercial_distribution="unknown",
            commercial_distribution="unknown",
        )
        overall, reasons = derive_overall_decision(gates)
        acceptance = SourceRefreshAcceptance(
            schema_version=ACCEPTANCE_SCHEMA_VERSION,
            base_commit=_git_head(paths.repo_root),
            frozen_inputs={
                "baseline_ir_sha256_expected": FROZEN_BASELINE_IR_SHA256,
                "current_ir_sha256_expected": FROZEN_CURRENT_IR_SHA256,
                "delta_sha256_expected": FROZEN_DELTA_SHA256,
                "review_registry_sha256_expected": FROZEN_REVIEW_REGISTRY_SHA256,
                "frozen_gate": frozen.to_dict(),
            },
            gates=gates,
            review_leaf_counts={},
            reference_integrity_counts={},
            isolated_build={},
            destructive_change_counts={},
            rights_posture=rights,
            overall_decision=overall,
            blocking_reasons=reasons,
            engineering_ready=False,
            publication_authorized=False,
            product_candidates_authorized=False,
        )
        write_json(paths.acceptance_json, acceptance.to_dict())
        return acceptance

    gates["G1_SOURCE_CAPTURE_VALID"] = evaluate_g1_source_capture(paths)

    baseline_records = load_jsonl_records(paths.baseline_ir)
    current_records = load_jsonl_records(paths.current_ir)
    delta_rows = load_jsonl_records(paths.delta)

    nested, checked = count_nested_lxp2_pages(paths.crawl_dir)
    gates["G2_PARSER_COMPATIBILITY_PASS"] = evaluate_g2_parser_compatibility(
        baseline_records,
        current_records,
        nested_lxp2_pages=nested,
        pages_checked=checked,
    )

    reparse_cache = baseline_reparse_cache or (
        paths.repo_root
        / "data"
        / "malidaba_delta"
        / "current"
        / "f11_gates"
        / "baseline_reparse.jsonl"
    )
    gates["G3_BASELINE_REGRESSION_PASS"] = evaluate_g3_baseline_regression(
        baseline_records,
        baseline_crawl_dir=paths.baseline_crawl_dir,
        reparse_cache=reparse_cache if reparse_cache.is_file() else None,
    )

    gates["G4_CURRENT_STRUCTURAL_COVERAGE_PASS"] = evaluate_g4_structural_coverage(
        current_records
    )
    gates["G5_DELTA_DETERMINISTIC"] = evaluate_g5_delta_deterministic(
        baseline_records,
        current_records,
        frozen_delta_path=paths.delta,
    )
    gates["G6_DELTA_REVIEW_EVIDENCE_SUFFICIENT"] = evaluate_g6_review_evidence(paths)

    g7, _manifest, ref_counts = evaluate_g7_reference_integrity(
        paths, delta_rows=delta_rows
    )
    gates["G7_DOWNSTREAM_REFERENCE_INTEGRITY_PASS"] = g7

    gates["G8_ISOLATED_BUILD_REGRESSION_PASS"] = evaluate_g8_isolated_build(
        paths, skip_heavy_build=skip_isolated_build
    )

    g9, _disp, destructive_counts = evaluate_g9_destructive_change(
        paths, delta_rows=delta_rows
    )
    gates["G9_NO_UNREVIEWED_DESTRUCTIVE_CHANGE"] = g9

    g10 = evaluate_g10_rights(paths)
    gates["G10_RIGHTS_POSTURE_RECORDED"] = g10
    rights = RightsPosture(
        claimed_license=str(g10.evidence.get("claimed_license") or "CC BY-NC-SA 4.0"),
        internal_source_maintenance=str(
            g10.evidence.get("internal_source_maintenance") or "unknown"
        ),
        noncommercial_distribution=str(
            g10.evidence.get("noncommercial_distribution") or "unknown"
        ),
        commercial_distribution=str(
            g10.evidence.get("commercial_distribution") or "unknown"
        ),
        notes=list(g10.evidence.get("notes") or []),
    )

    overall, reasons = derive_overall_decision(gates)
    review_leaf_counts = dict(
        gates["G6_DELTA_REVIEW_EVIDENCE_SUFFICIENT"].evidence.get("leaf_decisions") or {}
    )
    review_leaf_counts["current_leaves"] = gates[
        "G6_DELTA_REVIEW_EVIDENCE_SUFFICIENT"
    ].evidence.get("current_leaves")
    review_leaf_counts["rows"] = gates[
        "G6_DELTA_REVIEW_EVIDENCE_SUFFICIENT"
    ].evidence.get("rows")

    isolated = dict(gates["G8_ISOLATED_BUILD_REGRESSION_PASS"].evidence)

    acceptance = SourceRefreshAcceptance(
        schema_version=ACCEPTANCE_SCHEMA_VERSION,
        base_commit=_git_head(paths.repo_root),
        frozen_inputs={
            "baseline_ir_sha256": FROZEN_BASELINE_IR_SHA256,
            "current_ir_sha256": FROZEN_CURRENT_IR_SHA256,
            "delta_sha256": FROZEN_DELTA_SHA256,
            "review_registry_sha256": FROZEN_REVIEW_REGISTRY_SHA256,
            "baseline_ir_path": str(paths.baseline_ir),
            "current_ir_path": str(paths.current_ir),
            "delta_path": str(paths.delta),
            "crawl_dir": str(paths.crawl_dir),
            "review_registry_path": str(paths.review_registry),
        },
        gates=gates,
        review_leaf_counts=review_leaf_counts,
        reference_integrity_counts=ref_counts,
        isolated_build=isolated,
        destructive_change_counts=destructive_counts,
        rights_posture=rights,
        overall_decision=overall,
        blocking_reasons=reasons,
        engineering_ready=(overall == OVERALL_ENGINEERING_READY),
        publication_authorized=False,
        product_candidates_authorized=False,
    )
    write_json(paths.acceptance_json, acceptance.to_dict())
    return acceptance


def run_source_refresh_acceptance(
    *,
    repo_root: Path | None = None,
    skip_isolated_build: bool = False,
) -> SourceRefreshAcceptance:
    return evaluate_source_refresh_acceptance(
        default_paths(repo_root),
        skip_isolated_build=skip_isolated_build,
    )
