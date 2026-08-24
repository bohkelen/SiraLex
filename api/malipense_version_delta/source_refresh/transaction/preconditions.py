"""Transaction preconditions for guarded canonical apply (fail-closed)."""

from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Any

from malipense_version_delta.canonical_json import sha256_file

from ..paths import (
    FROZEN_F18_TYPE_A_REGISTRY_SHA256,
    FROZEN_F18_TYPE_B_REGISTRY_SHA256,
    FROZEN_F19_COMMIT,
    SourceRefreshPaths,
)


def _git(repo: Path, *args: str) -> str:
    return subprocess.check_output(
        ["git", *args], cwd=repo, text=True, stderr=subprocess.DEVNULL
    ).strip()


def check_preconditions(
    paths: SourceRefreshPaths,
    *,
    expected_base_commit: str = FROZEN_F19_COMMIT,
    frozen_hashes: dict[str, str],
    mutations: list[dict[str, Any]],
    publication_in_plan: list[str],
    g_results: dict[str, str],
    staged_regression: dict[str, Any],
    rights: dict[str, str],
    allow_dirty_for_dry_run: bool = True,
) -> dict[str, Any]:
    """
    Evaluate apply preconditions.

    For F20 dry-run, tracked dirtiness from F20 code itself is expected; set
    allow_dirty_for_dry_run=True. Real --apply must use allow_dirty_for_dry_run=False.
    """
    failures: list[str] = []
    evidence: dict[str, Any] = {}

    try:
        head = _git(paths.repo_root, "rev-parse", "HEAD")
    except Exception:
        head = "UNKNOWN"
        failures.append("git_head_unreadable")
    evidence["git_head"] = head
    evidence["expected_base_commit"] = expected_base_commit
    if head != expected_base_commit:
        failures.append(
            f"base_commit_mismatch:head={head}:expected={expected_base_commit}"
        )

    try:
        dirty = _git(paths.repo_root, "status", "--porcelain")
    except Exception:
        dirty = "UNKNOWN"
        failures.append("git_status_unreadable")
    evidence["dirty_tracked_lines"] = [
        line for line in dirty.splitlines() if line and not line.startswith("??")
    ] if dirty != "UNKNOWN" else []
    web_scripts_dirty = any(
        "web/scripts" in line for line in (dirty.splitlines() if dirty != "UNKNOWN" else [])
    )
    evidence["web_scripts_present"] = web_scripts_dirty
    # Real apply: any tracked modification blocks. Dry-run may have F20 code dirty.
    if evidence["dirty_tracked_lines"] and not allow_dirty_for_dry_run:
        failures.append("dirty_tracked_working_tree")

    # Frozen Type-A / Type-B
    type_a = paths.f18_dir / "malidaba_continuity_reviews_v1.jsonl"
    type_b = paths.f18_dir / "malidaba_missing_disposition_reviews_v1.jsonl"
    if not type_a.is_file() or sha256_file(type_a) != FROZEN_F18_TYPE_A_REGISTRY_SHA256:
        failures.append("f18_type_a_registry_sha_mismatch")
    if not type_b.is_file() or sha256_file(type_b) != FROZEN_F18_TYPE_B_REGISTRY_SHA256:
        failures.append("f18_type_b_registry_sha_mismatch")

    for role, expected in frozen_hashes.items():
        # Presence already verified in freeze; re-check key roles
        if not expected:
            failures.append(f"frozen_hash_empty:{role}")

    for mut in mutations:
        before = mut.get("current_sha256")
        if mut.get("is_new_file"):
            continue
        # Destination-before must still match
        dest = paths.repo_root / mut["path"]
        if dest.is_file():
            actual = sha256_file(dest)
            if before and actual != before:
                failures.append(f"destination_before_mismatch:{mut['path']}")

    if publication_in_plan:
        failures.append(f"publication_paths_in_plan:{publication_in_plan}")

    # Mutation plan must never include web/scripts
    if any(m["path"].startswith("web/scripts") for m in mutations):
        failures.append("web_scripts_in_mutation_plan")

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
        if g_results.get(gid) != "PASS":
            failures.append(f"gate_not_pass:{gid}")

    if staged_regression.get("canonical_pass") != 30 or staged_regression.get(
        "canonical_fail"
    ) != 0:
        failures.append("canonical_regression_not_30_0")
    if staged_regression.get("staged_pass") != 30 or staged_regression.get(
        "staged_fail"
    ) != 0:
        failures.append("staged_regression_not_30_0")

    if rights.get("commercial") != "blocked":
        failures.append("rights_commercial_not_blocked")
    if rights.get("internal") != "allowed":
        failures.append("rights_internal_not_allowed")

    return {
        "ok": not failures,
        "failures": failures,
        "evidence": evidence,
        "mode": "dry_run" if allow_dirty_for_dry_run else "apply",
    }


def apply_would_block(preconditions: dict[str, Any]) -> bool:
    """True if a future --apply must refuse to write."""
    return not preconditions.get("ok")
