"""Validate the Phase 7H phrase miss review JSONL artifact.

This script is intentionally read-only and stdlib-only. It validates the review
dataset structure and safety invariants without importing runtime search,
bundle generation, alias, supplement, normalization, catalog, or UI code.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Any


SCHEMA_VERSION = "phrase_miss_review_v1"
EXPECTED_SOURCE_BUNDLE_ID = "bundle_full_20260609_phase7f_alias_candidate"
EXPECTED_SOURCE_CATALOG_VERSION = (
    "norm-v3-featured-enriched-source-aliases-2-source-index-supplements-2"
)

REQUIRED_FIELDS = {
    "schema_version",
    "review_id",
    "query",
    "query_locale",
    "search_direction",
    "current_result",
    "related_single_terms",
    "related_phrase_terms",
    "candidate_target_entry",
    "candidate_resolved_ir_ids",
    "category",
    "risk",
    "recommendation",
    "rationale",
    "review_status",
    "reviewer",
    "reviewed_at",
    "source_bundle_id",
    "source_catalog_version",
    "notes",
}

RELATED_TERM_FIELDS = {"term", "result_status", "resolved_ir_ids", "note"}

SEARCH_DIRECTIONS = {"source_to_target", "target_to_source"}
RESULT_STATUSES = {"hit", "miss", "partial related terms only"}
CATEGORIES = {
    "true_phrase_entry_missing",
    "phrase_exists_but_index_does_not_expose_it",
    "compositional_phrase_should_decompose",
    "inflected_phrase_form",
    "bad_query_typo_unsupported_phrase",
    "should_remain_no_hit",
}
RISKS = {"low", "medium", "high"}
RECOMMENDATIONS = {
    "approve_for_future_phrase_alias",
    "defer_for_human_review",
    "reject_keep_no_hit",
    "evidence_only",
}
REVIEW_STATUSES = {"candidate", "approved", "rejected", "deferred"}


class PhraseReviewValidationError(ValueError):
    """Raised when the phrase review dataset fails validation."""


@dataclass(frozen=True)
class ValidationSummary:
    row_count: int
    status_counts: Counter[str]

    @property
    def approved_rows(self) -> int:
        return self.status_counts.get("approved", 0)

    @property
    def candidate_rows(self) -> int:
        return self.status_counts.get("candidate", 0)

    @property
    def deferred_rows(self) -> int:
        return self.status_counts.get("deferred", 0)

    @property
    def rejected_rows(self) -> int:
        return self.status_counts.get("rejected", 0)


def _line_error(path: Path, line_number: int, message: str) -> PhraseReviewValidationError:
    return PhraseReviewValidationError(f"{path}:{line_number}: {message}")


def _is_non_empty_string(value: Any) -> bool:
    return isinstance(value, str) and value.strip() != ""


def _require_enum(path: Path, line_number: int, row: dict[str, Any], field: str, allowed: set[str]) -> None:
    value = row.get(field)
    if value not in allowed:
        allowed_values = ", ".join(sorted(allowed))
        raise _line_error(path, line_number, f"{field} must be one of: {allowed_values}")


def _validate_related_terms(
    path: Path,
    line_number: int,
    row: dict[str, Any],
    field: str,
) -> None:
    value = row.get(field)
    if not isinstance(value, list):
        raise _line_error(path, line_number, f"{field} must be a list")

    for index, item in enumerate(value):
        item_path = f"{field}[{index}]"
        if not isinstance(item, dict):
            raise _line_error(path, line_number, f"{item_path} must be a JSON object")

        missing = sorted(RELATED_TERM_FIELDS - set(item))
        if missing:
            raise _line_error(path, line_number, f"{item_path} missing required fields: {missing}")

        if item.get("result_status") not in RESULT_STATUSES:
            allowed_values = ", ".join(sorted(RESULT_STATUSES))
            raise _line_error(
                path,
                line_number,
                f"{item_path}.result_status must be one of: {allowed_values}",
            )

        if not isinstance(item.get("resolved_ir_ids"), list):
            raise _line_error(path, line_number, f"{item_path}.resolved_ir_ids must be a list")


def _validate_row(path: Path, line_number: int, row: dict[str, Any]) -> None:
    missing = sorted(REQUIRED_FIELDS - set(row))
    if missing:
        raise _line_error(path, line_number, f"missing required fields: {missing}")

    if row.get("schema_version") != SCHEMA_VERSION:
        raise _line_error(path, line_number, f"schema_version must be {SCHEMA_VERSION!r}")

    _require_enum(path, line_number, row, "search_direction", SEARCH_DIRECTIONS)
    _require_enum(path, line_number, row, "current_result", RESULT_STATUSES)
    _require_enum(path, line_number, row, "category", CATEGORIES)
    _require_enum(path, line_number, row, "risk", RISKS)
    _require_enum(path, line_number, row, "recommendation", RECOMMENDATIONS)
    _require_enum(path, line_number, row, "review_status", REVIEW_STATUSES)

    if row.get("source_bundle_id") != EXPECTED_SOURCE_BUNDLE_ID:
        raise _line_error(
            path,
            line_number,
            f"source_bundle_id must be {EXPECTED_SOURCE_BUNDLE_ID!r}",
        )
    if row.get("source_catalog_version") != EXPECTED_SOURCE_CATALOG_VERSION:
        raise _line_error(
            path,
            line_number,
            f"source_catalog_version must be {EXPECTED_SOURCE_CATALOG_VERSION!r}",
        )

    if not isinstance(row.get("candidate_resolved_ir_ids"), list):
        raise _line_error(path, line_number, "candidate_resolved_ir_ids must be a list")

    _validate_related_terms(path, line_number, row, "related_single_terms")
    _validate_related_terms(path, line_number, row, "related_phrase_terms")

    review_status = row.get("review_status")
    candidate_ids = row.get("candidate_resolved_ir_ids")

    if review_status == "approved":
        if not _is_non_empty_string(row.get("reviewer")):
            raise _line_error(path, line_number, "approved row requires non-empty reviewer")
        if not _is_non_empty_string(row.get("reviewed_at")):
            raise _line_error(path, line_number, "approved row requires non-empty reviewed_at")
        if not candidate_ids:
            raise _line_error(
                path,
                line_number,
                "approved row requires non-empty candidate_resolved_ir_ids",
            )

    if review_status == "rejected" and candidate_ids:
        if not (_is_non_empty_string(row.get("notes")) or _is_non_empty_string(row.get("rationale"))):
            raise _line_error(
                path,
                line_number,
                "rejected row with candidate_resolved_ir_ids requires non-empty notes or rationale",
            )


def validate_phrase_review(path: Path) -> ValidationSummary:
    """Validate a phrase review JSONL file and return row/status counts."""
    rows: list[dict[str, Any]] = []
    seen_review_ids: dict[str, int] = {}
    seen_queries: dict[str, int] = {}
    status_counts: Counter[str] = Counter()

    with path.open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, 1):
            if not line.strip():
                raise _line_error(path, line_number, "blank line")

            try:
                payload = json.loads(line)
            except json.JSONDecodeError as exc:
                raise _line_error(path, line_number, f"invalid JSON: {exc}") from exc

            if not isinstance(payload, dict):
                raise _line_error(path, line_number, "line must be a JSON object")

            _validate_row(path, line_number, payload)

            review_id = payload["review_id"]
            if review_id in seen_review_ids:
                first_line = seen_review_ids[review_id]
                raise _line_error(
                    path,
                    line_number,
                    f"duplicate review_id {review_id!r}; first seen on line {first_line}",
                )
            seen_review_ids[review_id] = line_number

            query = payload["query"]
            if query in seen_queries:
                first_line = seen_queries[query]
                raise _line_error(
                    path,
                    line_number,
                    f"duplicate query {query!r}; first seen on line {first_line}",
                )
            seen_queries[query] = line_number

            status_counts[payload["review_status"]] += 1
            rows.append(payload)

    return ValidationSummary(row_count=len(rows), status_counts=status_counts)


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("jsonl", type=Path, help="Phrase miss review JSONL file")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_arg_parser().parse_args(argv)
    try:
        summary = validate_phrase_review(args.jsonl)
    except PhraseReviewValidationError as exc:
        print(f"Phrase review validation FAILED: {exc}", file=sys.stderr)
        return 1

    print(f"validated {summary.row_count} phrase review rows")
    print(f"approved rows: {summary.approved_rows}")
    print(f"candidate rows: {summary.candidate_rows}")
    print(f"deferred rows: {summary.deferred_rows}")
    print(f"rejected rows: {summary.rejected_rows}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
