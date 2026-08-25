"""Rights-aware search regression for publication candidate."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from malipense_version_delta.source_refresh.transition.differential import (
    replay_regression_suite,
)
from source_registry.load import SOURCE_OWNER

from .model import (
    REGRESSION_EXPECTED_OWNER_RIGHTS_EXCLUSION,
    REGRESSION_PASS,
    REGRESSION_UNEXPECTED_PUBLICATION_CANDIDATE_DEFECT,
)


def run_publication_regression(
    *,
    repo_root: Path,
    internal_records: Path,
    internal_search: Path,
    candidate_records: Path,
    candidate_search: Path,
    regression_dir: Path,
    overlay: dict[str, str] | None = None,
) -> dict[str, Any]:
    """
    Compare publication candidate against INTERNAL_FULL regression surface.

    Classifies each case as PASS, EXPECTED_OWNER_RIGHTS_EXCLUSION, or defect.
    """
    from distribution_compliance.classify import classify_record_for_noncommercial
    from malipense_version_delta.compare import load_jsonl_records
    from source_registry.load import load_source_registry

    registry = load_source_registry(repo_root)
    eligible_ids = {
        str(r["ir_id"])
        for r in load_jsonl_records(candidate_records)
        if r.get("ir_id")
    }
    owner_ids = {
        str(r["ir_id"])
        for r in load_jsonl_records(internal_records)
        if str(r.get("source_id") or "") == SOURCE_OWNER and r.get("ir_id")
    }

    internal_results = replay_regression_suite(
        search_index_path=internal_search,
        records_path=internal_records,
        regression_dir=regression_dir,
        overlay=overlay or {},
    )
    candidate_results = replay_regression_suite(
        search_index_path=candidate_search,
        records_path=candidate_records,
        regression_dir=regression_dir,
        overlay=overlay or {},
    )
    by_id_internal = {r.case_id: r for r in internal_results}

    cases: list[dict[str, Any]] = []
    pass_n = expected_excl = unexpected = 0

    for cres in candidate_results:
        ires = by_id_internal.get(cres.case_id)
        expected_ids = set(cres.expected_ir_ids)
        actual_ids = set(cres.comparable_actual())
        missing_ids = expected_ids - actual_ids

        if cres.ok:
            label = REGRESSION_PASS
            pass_n += 1
        elif ires is not None and ires.ok and not cres.ok:
            if expected_ids and expected_ids.issubset(owner_ids):
                label = REGRESSION_EXPECTED_OWNER_RIGHTS_EXCLUSION
                expected_excl += 1
            elif missing_ids and missing_ids.issubset(owner_ids):
                label = REGRESSION_EXPECTED_OWNER_RIGHTS_EXCLUSION
                expected_excl += 1
            elif expected_ids and expected_ids.isdisjoint(eligible_ids):
                label = REGRESSION_EXPECTED_OWNER_RIGHTS_EXCLUSION
                expected_excl += 1
            else:
                label = REGRESSION_UNEXPECTED_PUBLICATION_CANDIDATE_DEFECT
                unexpected += 1
        elif ires is not None and not ires.ok and not cres.ok:
            label = REGRESSION_EXPECTED_OWNER_RIGHTS_EXCLUSION
            expected_excl += 1
        else:
            label = REGRESSION_UNEXPECTED_PUBLICATION_CANDIDATE_DEFECT
            unexpected += 1

        cases.append(
            {
                "case_id": cres.case_id,
                "label": label,
                "ok": cres.ok,
                "expected_ir_ids": cres.expected_ir_ids,
                "actual_ir_ids": cres.comparable_actual(),
            }
        )

    return {
        "pass": pass_n,
        "expected_owner_rights_exclusion": expected_excl,
        "unexpected_defects": unexpected,
        "internal_pass": sum(1 for r in internal_results if r.ok),
        "internal_fail": sum(1 for r in internal_results if not r.ok),
        "cases": cases,
    }
