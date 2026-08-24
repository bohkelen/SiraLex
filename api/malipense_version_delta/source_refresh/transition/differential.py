"""Differential G8: compare canonical vs virtual-refresh regression results.

A source refresh is responsible for regressions it introduces or worsens,
not for unrelated historical failures that already exist on the canonical
product.
"""

from __future__ import annotations

from dataclasses import dataclass, replace
from pathlib import Path
from typing import Any

from malipense_version_delta.compare import load_jsonl_records

from .id_remap import apply_overlay_to_ir_list

PASS_BOTH = "PASS_BOTH"
FAIL_BOTH_SAME_REASON = "FAIL_BOTH_SAME_REASON"
FAIL_CANONICAL_PASS_REFRESH = "FAIL_CANONICAL_PASS_REFRESH"
PASS_CANONICAL_FAIL_REFRESH = "PASS_CANONICAL_FAIL_REFRESH"
FAIL_BOTH_DIFFERENT_REASON = "FAIL_BOTH_DIFFERENT_REASON"


@dataclass
class RegressionCaseResult:
    case_id: str
    ok: bool
    expected_ir_ids: list[str]
    actual_ir_ids: list[str]
    actual_resolved_target_ir_ids: list[str] | None
    actual_status: str
    actual_count: int
    mismatches: list[str]
    error: str | None = None

    def comparable_actual(self) -> list[str]:
        if self.actual_resolved_target_ir_ids is not None:
            return list(self.actual_resolved_target_ir_ids)
        return list(self.actual_ir_ids)


def replay_regression_suite(
    *,
    search_index_path: Path,
    records_path: Path,
    regression_dir: Path,
    overlay: dict[str, str] | None = None,
) -> list[RegressionCaseResult]:
    from query_evidence.replay import load_search_index
    from search_regression.replay import TargetResolutionError, replay_case
    from search_regression.schema import load_matrix_jsonl

    overlay = overlay or {}
    search_index = load_search_index(search_index_path)
    records_by_id = {
        str(r["ir_id"]): r for r in load_jsonl_records(records_path) if r.get("ir_id")
    }
    results: list[RegressionCaseResult] = []
    for matrix in sorted(regression_dir.glob("search_regression_matrix*.jsonl")):
        for case in load_matrix_jsonl(matrix):
            original = list(case.expected_ir_ids)
            mapped = apply_overlay_to_ir_list(original, overlay)
            virtual_case = replace(case, expected_ir_ids=mapped) if overlay else case
            try:
                replay = replay_case(
                    search_index, virtual_case, records_by_id=records_by_id
                )
                results.append(
                    RegressionCaseResult(
                        case_id=case.case_id,
                        ok=bool(replay.expected_match),
                        expected_ir_ids=mapped if overlay else original,
                        actual_ir_ids=list(replay.actual_ir_ids),
                        actual_resolved_target_ir_ids=replay.actual_resolved_target_ir_ids,
                        actual_status=str(replay.actual_result_status),
                        actual_count=int(replay.actual_result_count),
                        mismatches=list(replay.mismatches),
                    )
                )
            except TargetResolutionError as exc:
                results.append(
                    RegressionCaseResult(
                        case_id=case.case_id,
                        ok=False,
                        expected_ir_ids=mapped if overlay else original,
                        actual_ir_ids=[],
                        actual_resolved_target_ir_ids=None,
                        actual_status="resolution_error",
                        actual_count=0,
                        mismatches=[str(exc)],
                        error=str(exc),
                    )
                )
    return results


def _overlay_ids(ids: list[str], overlay: dict[str, str]) -> list[str]:
    return apply_overlay_to_ir_list(ids, overlay)


def classify_case(
    canonical: RegressionCaseResult,
    refresh: RegressionCaseResult,
    overlay: dict[str, str],
) -> dict[str, Any]:
    if canonical.ok and refresh.ok:
        klass = PASS_BOTH
        worsened = False
    elif (not canonical.ok) and refresh.ok:
        klass = FAIL_CANONICAL_PASS_REFRESH
        worsened = False
    elif canonical.ok and (not refresh.ok):
        klass = PASS_CANONICAL_FAIL_REFRESH
        worsened = True
    else:
        canon_actual = _overlay_ids(canonical.comparable_actual(), overlay)
        refresh_actual = refresh.comparable_actual()
        same = (
            canon_actual == refresh_actual
            and canonical.actual_status == refresh.actual_status
            and canonical.actual_count == refresh.actual_count
        )
        if same:
            klass = FAIL_BOTH_SAME_REASON
            worsened = False
        else:
            klass = FAIL_BOTH_DIFFERENT_REASON
            worsened = refresh.actual_count < canonical.actual_count or (
                canonical.actual_status != refresh.actual_status
                and refresh.actual_status in {"miss", "resolution_error"}
            )
    return {
        "case_id": canonical.case_id,
        "class": klass,
        "canonical_ok": canonical.ok,
        "refresh_ok": refresh.ok,
        "canonical_status": canonical.actual_status,
        "refresh_status": refresh.actual_status,
        "canonical_count": canonical.actual_count,
        "refresh_count": refresh.actual_count,
        "canonical_actual": canonical.comparable_actual(),
        "refresh_actual": refresh.comparable_actual(),
        "canonical_expected": canonical.expected_ir_ids,
        "refresh_expected": refresh.expected_ir_ids,
        "canonical_mismatches": canonical.mismatches,
        "refresh_mismatches": refresh.mismatches,
        "worsened": worsened,
        "blocks_transition": klass == PASS_CANONICAL_FAIL_REFRESH or worsened,
    }


def classify_suites(
    canonical: list[RegressionCaseResult],
    refresh: list[RegressionCaseResult],
    overlay: dict[str, str],
) -> dict[str, Any]:
    by_canon = {r.case_id: r for r in canonical}
    by_refresh = {r.case_id: r for r in refresh}
    case_ids = sorted(set(by_canon) | set(by_refresh))
    rows: list[dict[str, Any]] = []
    for case_id in case_ids:
        c = by_canon.get(case_id)
        r = by_refresh.get(case_id)
        if c is None or r is None:
            rows.append(
                {
                    "case_id": case_id,
                    "class": PASS_CANONICAL_FAIL_REFRESH if c and not r else "MISSING_PAIR",
                    "canonical_ok": bool(c and c.ok),
                    "refresh_ok": bool(r and r.ok),
                    "worsened": True,
                    "blocks_transition": True,
                    "canonical_mismatches": [] if c is None else c.mismatches,
                    "refresh_mismatches": [] if r is None else r.mismatches,
                }
            )
            continue
        rows.append(classify_case(c, r, overlay))

    introduced = [x for x in rows if x["class"] == PASS_CANONICAL_FAIL_REFRESH]
    worsened = [
        x
        for x in rows
        if x["class"] == FAIL_BOTH_DIFFERENT_REASON and x.get("worsened")
    ]
    unchanged_preexisting = [x for x in rows if x["class"] == FAIL_BOTH_SAME_REASON]
    fixed = [x for x in rows if x["class"] == FAIL_CANONICAL_PASS_REFRESH]
    both_pass = [x for x in rows if x["class"] == PASS_BOTH]

    canon_pass = sum(1 for r in canonical if r.ok)
    refresh_pass = sum(1 for r in refresh if r.ok)
    return {
        "cases": rows,
        "canonical_pass": canon_pass,
        "canonical_fail": len(canonical) - canon_pass,
        "refresh_pass": refresh_pass,
        "refresh_fail": len(refresh) - refresh_pass,
        "transition_introduced_failures": len(introduced),
        "transition_worsened_failures": len(worsened),
        "unchanged_preexisting_failures": len(unchanged_preexisting),
        "fixed_failures": len(fixed),
        "pass_both": len(both_pass),
        "introduced_case_ids": [x["case_id"] for x in introduced],
        "worsened_case_ids": [x["case_id"] for x in worsened],
        "unchanged_preexisting_case_ids": [x["case_id"] for x in unchanged_preexisting],
        "fixed_case_ids": [x["case_id"] for x in fixed],
        "g8_pass": len(introduced) == 0 and len(worsened) == 0,
    }
