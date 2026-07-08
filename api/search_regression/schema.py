"""Schema and loaders for search regression matrices and manifests."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

CASE_SCHEMA_VERSION = "search_regression_case_v1"
MANIFEST_SCHEMA_VERSION = "search_regression_matrix_manifest_v1"
MATRIX_FAMILIES = frozenset({"phase7l_pinned", "phase7n2a_additive"})

QUERY_UNICODE_FORMS = frozenset({"nfc", "nfd", "mixed", "not_applicable"})
DIRECTIONS = frozenset({"source_to_target", "target_to_source"})
RESULT_STATUSES = frozenset({"miss", "hit_single", "hit_multi"})
EXPECTED_ID_SPACES = frozenset({"direct_ir_ids", "resolved_target_ir_ids"})
DEFAULT_EXPECTED_ID_SPACE = "direct_ir_ids"
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


def _load_error(line_number: int, field: str, message: str) -> MatrixLoadError:
    return MatrixLoadError(f"line {line_number}: {field} {message}")


def _require_string(raw: dict[str, Any], field: str, *, line_number: int) -> str:
    value = raw[field]
    if not isinstance(value, str):
        raise _load_error(line_number, field, "must be a string")
    return value


def _require_int_not_bool(raw: dict[str, Any], field: str, *, line_number: int) -> int:
    value = raw[field]
    if isinstance(value, bool):
        raise _load_error(line_number, field, "must not be a boolean")
    if not isinstance(value, int):
        raise _load_error(line_number, field, "must be an integer")
    return value


def _require_bool(raw: dict[str, Any], field: str, *, line_number: int) -> bool:
    value = raw[field]
    if type(value) is not bool:
        raise _load_error(line_number, field, "must be a boolean")
    return value


def _require_string_list(raw: dict[str, Any], field: str, *, line_number: int) -> list[str]:
    value = raw[field]
    if not isinstance(value, list) or not all(isinstance(item, str) for item in value):
        raise _load_error(line_number, field, "must be a string list")
    return list(value)


def _optional_string_list(
    raw: dict[str, Any],
    field: str,
    *,
    line_number: int,
) -> list[str] | None:
    if field not in raw or raw[field] is None:
        return None
    value = raw[field]
    if not isinstance(value, list) or not all(isinstance(item, str) for item in value):
        raise _load_error(line_number, field, "must be a string array")
    return list(value)


def _optional_string(raw: dict[str, Any], field: str, *, line_number: int) -> str | None:
    if field not in raw or raw[field] is None:
        return None
    value = raw[field]
    if not isinstance(value, str):
        raise _load_error(line_number, field, "must be a string")
    return value


def _require_string_or_null(raw: dict[str, Any], field: str, *, line_number: int) -> str | None:
    value = raw[field]
    if value is None:
        return None
    if not isinstance(value, str):
        raise _load_error(line_number, field, "must be string or null")
    return value


def _manifest_error(field: str, message: str) -> MatrixLoadError:
    return MatrixLoadError(f"manifest {field} {message}")


def _manifest_require_string(raw: dict[str, Any], field: str) -> str:
    value = raw[field]
    if not isinstance(value, str):
        raise _manifest_error(field, "must be a string")
    return value


def _manifest_require_int_not_bool(raw: dict[str, Any], field: str) -> int:
    value = raw[field]
    if isinstance(value, bool):
        raise _manifest_error(field, "must not be a boolean")
    if not isinstance(value, int):
        raise _manifest_error(field, "must be an integer")
    return value


def _manifest_optional_string(raw: dict[str, Any], field: str) -> str | None:
    if field not in raw or raw[field] is None:
        return None
    value = raw[field]
    if not isinstance(value, str):
        raise _manifest_error(field, "must be a string")
    return value


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
    expected_id_space: str = DEFAULT_EXPECTED_ID_SPACE
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

        case_id = _require_string(raw, "case_id", line_number=line_number)
        query = _require_string(raw, "query", line_number=line_number)
        query_unicode_form = _require_string(
            raw, "query_unicode_form", line_number=line_number
        )
        direction = _require_string(raw, "direction", line_number=line_number)
        expected_result_status = _require_string(
            raw, "expected_result_status", line_number=line_number
        )
        expected_result_count = _require_int_not_bool(
            raw, "expected_result_count", line_number=line_number
        )
        expected_ir_ids = _require_string_list(
            raw, "expected_ir_ids", line_number=line_number
        )
        expected_matched_key_type = _require_string(
            raw, "expected_matched_key_type", line_number=line_number
        )
        expected_matched_key = _require_string_or_null(
            raw, "expected_matched_key", line_number=line_number
        )
        expected_deep_ladder = _require_bool(
            raw, "expected_deep_ladder", line_number=line_number
        )
        case_family = _require_string(raw, "case_family", line_number=line_number)
        source_of_expectation = _require_string(
            raw, "source_of_expectation", line_number=line_number
        )
        bundle_id = _require_string(raw, "bundle_id", line_number=line_number)
        norm_version = _require_string(raw, "norm_version", line_number=line_number)
        review_status = _require_string(raw, "review_status", line_number=line_number)
        expected_id_space_raw = _optional_string(
            raw, "expected_id_space", line_number=line_number
        )
        expected_id_space = (
            DEFAULT_EXPECTED_ID_SPACE
            if expected_id_space_raw is None
            else expected_id_space_raw
        )
        if expected_id_space not in EXPECTED_ID_SPACES:
            allowed = ", ".join(sorted(EXPECTED_ID_SPACES))
            raise _load_error(
                line_number,
                "expected_id_space",
                f"must be one of {{{allowed}}}, got {expected_id_space!r}",
            )
        case_tags = _optional_string_list(raw, "case_tags", line_number=line_number)
        notes = _optional_string(raw, "notes", line_number=line_number)

        return cls(
            case_id=case_id,
            query=query,
            query_unicode_form=query_unicode_form,
            direction=direction,
            expected_result_status=expected_result_status,
            expected_result_count=expected_result_count,
            expected_ir_ids=expected_ir_ids,
            expected_matched_key_type=expected_matched_key_type,
            expected_matched_key=expected_matched_key,
            expected_deep_ladder=expected_deep_ladder,
            case_family=case_family,
            source_of_expectation=source_of_expectation,
            bundle_id=bundle_id,
            norm_version=norm_version,
            review_status=review_status,
            expected_id_space=expected_id_space,
            case_tags=case_tags,
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
    matrix_family: str = "phase7l_pinned"
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

        schema_version = _manifest_require_string(raw, "schema_version")
        matrix_schema_version = _manifest_require_string(raw, "matrix_schema_version")
        bundle_id = _manifest_require_string(raw, "bundle_id")
        catalog_version = _manifest_require_string(raw, "catalog_version")
        norm_version = _manifest_require_string(raw, "norm_version")
        search_index_sha256 = _manifest_require_string(raw, "search_index_sha256")
        bundle_content_sha256 = _manifest_require_string(raw, "bundle_content_sha256")
        case_count = _manifest_require_int_not_bool(raw, "case_count")
        matrix_family = _manifest_optional_string(raw, "matrix_family") or "phase7l_pinned"
        if matrix_family not in MATRIX_FAMILIES:
            allowed = ", ".join(sorted(MATRIX_FAMILIES))
            raise _manifest_error(
                "matrix_family",
                f"must be one of {{{allowed}}}, got {matrix_family!r}",
            )
        purpose = _manifest_optional_string(raw, "purpose")

        return cls(
            schema_version=schema_version,
            matrix_schema_version=matrix_schema_version,
            bundle_id=bundle_id,
            catalog_version=catalog_version,
            norm_version=norm_version,
            search_index_sha256=search_index_sha256,
            bundle_content_sha256=bundle_content_sha256,
            case_count=case_count,
            matrix_family=matrix_family,
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
