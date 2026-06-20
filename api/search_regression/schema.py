"""Schema and loaders for the Phase 7L search regression matrix."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

CASE_SCHEMA_VERSION = "search_regression_case_v1"
MANIFEST_SCHEMA_VERSION = "search_regression_matrix_manifest_v1"

QUERY_UNICODE_FORMS = frozenset({"nfc", "nfd", "mixed", "not_applicable"})
DIRECTIONS = frozenset({"source_to_target", "target_to_source"})
RESULT_STATUSES = frozenset({"miss", "hit_single", "hit_multi"})
MATCHED_KEY_TYPES = frozenset(
    {"casefold", "diacritics_insensitive", "punct_stripped", "nospace", "none"}
)
REVIEW_STATUSES = frozenset({"approved"})
CASE_FAMILIES = frozenset(
    {
        "source_exact_hit",
        "source_multi_hit",
        "target_exact_hit",
        "source_alias_hit",
        "source_supplement_hit",
        "punctuation_normalization",
        "diacritic_normalization",
        "spacing_normalization",
        "unicode_canonicalization",
        "deep_ladder_hit",
        "intentional_no_hit",
        "target_side_ambiguity",
        "historical_regression",
    }
)

REQUIRED_CASE_FIELDS = (
    "case_id",
    "query",
    "query_unicode_form",
    "direction",
    "expected_result_status",
    "expected_result_count",
    "expected_ir_ids",
    "expected_matched_key_type",
    "expected_matched_key",
    "expected_deep_ladder",
    "case_family",
    "source_of_expectation",
    "bundle_id",
    "norm_version",
    "review_status",
)


class MatrixLoadError(Exception):
    """Raised when matrix JSONL or manifest cannot be loaded."""


@dataclass(frozen=True)
class SearchRegressionCase:
    case_id: str
    query: str
    query_unicode_form: str
    direction: str
    expected_result_status: str
    expected_result_count: int
    expected_ir_ids: list[str]
    expected_matched_key_type: str
    expected_matched_key: str | None
    expected_deep_ladder: bool
    case_family: str
    source_of_expectation: str
    bundle_id: str
    norm_version: str
    review_status: str
    case_tags: list[str] | None = None
    notes: str | None = None

    @classmethod
    def from_dict(cls, raw: dict[str, Any], *, line_number: int) -> SearchRegressionCase:
        if not isinstance(raw, dict):
            raise MatrixLoadError(f"line {line_number}: expected JSON object")

        missing = [field for field in REQUIRED_CASE_FIELDS if field not in raw]
        if missing:
            raise MatrixLoadError(
                f"line {line_number}: missing required fields: {', '.join(missing)}"
            )

        query = raw["query"]
        if not isinstance(query, str):
            raise MatrixLoadError(f"line {line_number}: query must be a string")

        expected_ir_ids = raw["expected_ir_ids"]
        if not isinstance(expected_ir_ids, list) or not all(
            isinstance(item, str) for item in expected_ir_ids
        ):
            raise MatrixLoadError(f"line {line_number}: expected_ir_ids must be a string list")

        case_tags = raw.get("case_tags")
        if case_tags is not None:
            if not isinstance(case_tags, list) or not all(
                isinstance(item, str) for item in case_tags
            ):
                raise MatrixLoadError(f"line {line_number}: case_tags must be a string array")

        notes = raw.get("notes")
        if notes is not None and not isinstance(notes, str):
            raise MatrixLoadError(f"line {line_number}: notes must be a string")

        expected_matched_key = raw["expected_matched_key"]
        if expected_matched_key is not None and not isinstance(expected_matched_key, str):
            raise MatrixLoadError(f"line {line_number}: expected_matched_key must be string or null")

        if not isinstance(raw["expected_result_count"], int):
            raise MatrixLoadError(f"line {line_number}: expected_result_count must be an integer")

        if not isinstance(raw["expected_deep_ladder"], bool):
            raise MatrixLoadError(f"line {line_number}: expected_deep_ladder must be a boolean")

        return cls(
            case_id=str(raw["case_id"]),
            query=query,
            query_unicode_form=str(raw["query_unicode_form"]),
            direction=str(raw["direction"]),
            expected_result_status=str(raw["expected_result_status"]),
            expected_result_count=raw["expected_result_count"],
            expected_ir_ids=list(expected_ir_ids),
            expected_matched_key_type=str(raw["expected_matched_key_type"]),
            expected_matched_key=expected_matched_key,
            expected_deep_ladder=raw["expected_deep_ladder"],
            case_family=str(raw["case_family"]),
            source_of_expectation=str(raw["source_of_expectation"]),
            bundle_id=str(raw["bundle_id"]),
            norm_version=str(raw["norm_version"]),
            review_status=str(raw["review_status"]),
            case_tags=list(case_tags) if case_tags is not None else None,
            notes=notes,
        )


@dataclass(frozen=True)
class MatrixManifest:
    schema_version: str
    matrix_schema_version: str
    bundle_id: str
    catalog_version: str
    norm_version: str
    search_index_sha256: str
    bundle_content_sha256: str
    case_count: int
    purpose: str | None = None

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> MatrixManifest:
        if not isinstance(raw, dict):
            raise MatrixLoadError("manifest must be a JSON object")

        required = (
            "schema_version",
            "matrix_schema_version",
            "bundle_id",
            "catalog_version",
            "norm_version",
            "search_index_sha256",
            "bundle_content_sha256",
            "case_count",
        )
        missing = [field for field in required if field not in raw]
        if missing:
            raise MatrixLoadError(f"manifest missing required fields: {', '.join(missing)}")

        purpose = raw.get("purpose")
        if purpose is not None and not isinstance(purpose, str):
            raise MatrixLoadError("manifest purpose must be a string")

        if not isinstance(raw["case_count"], int):
            raise MatrixLoadError("manifest case_count must be an integer")

        return cls(
            schema_version=str(raw["schema_version"]),
            matrix_schema_version=str(raw["matrix_schema_version"]),
            bundle_id=str(raw["bundle_id"]),
            catalog_version=str(raw["catalog_version"]),
            norm_version=str(raw["norm_version"]),
            search_index_sha256=str(raw["search_index_sha256"]),
            bundle_content_sha256=str(raw["bundle_content_sha256"]),
            case_count=raw["case_count"],
            purpose=purpose,
        )


def load_matrix_jsonl(path: Path | str) -> list[SearchRegressionCase]:
    """Load matrix rows preserving each query literal exactly as authored in JSON."""
    source_path = Path(path)
    cases: list[SearchRegressionCase] = []

    with source_path.open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            text = line.strip()
            if not text:
                raise MatrixLoadError(f"line {line_number}: blank line")
            try:
                raw = json.loads(text)
            except json.JSONDecodeError as exc:
                raise MatrixLoadError(f"line {line_number}: invalid JSON: {exc}") from exc
            cases.append(SearchRegressionCase.from_dict(raw, line_number=line_number))

    return cases


def load_matrix_manifest(path: Path | str) -> MatrixManifest:
    source_path = Path(path)
    try:
        raw = json.loads(source_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise MatrixLoadError(f"manifest invalid JSON: {exc}") from exc
    return MatrixManifest.from_dict(raw)
