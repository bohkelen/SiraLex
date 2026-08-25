"""Validate corpus_sources_v1 registry tables (structure only)."""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path
from typing import Any

SCHEMA_VERSION = "corpus_sources_v1"

SOURCE_ID_RE = re.compile(r"^csrc_[a-z0-9]+(?:_[a-z0-9]+)*$")
# Shape gate before calendar parsing (stdlib validates real dates/times).
ISO_TIMESTAMP_SHAPE_RE = re.compile(
    r"^\d{4}-\d{2}-\d{2}"
    r"(?:[Tt]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?)?$"
)

ALLOWED_SOURCE_TYPES = {
    "owned_recording",
    "permissioned_recording",
    "public_video",
    "public_audio",
    "film_or_movie",
    "radio",
    "interview",
    "sermon",
    "speech",
    "oral_history",
    "subtitle_or_existing_transcript",
    "book_or_pdf",
    "other_text",
    "future_user_submission",
    "other",
}

ALLOWED_RIGHTS_BASIS = {
    "owned",
    "permissioned",
    "licensed",
    "public_domain",
    "reference_only",
    "unknown",
    "requires_review",
}

ALLOWED_RIGHTS_REVIEW_STATUS = {
    "unknown",
    "requires_rights_review",
    "reviewed",
    "publication_blocked",
}

ALLOWED_ASSESSMENT_CONFIDENCE = {"unknown", "low", "medium", "high"}

ALLOWED_USAGE_PERMISSION_KEYS = {
    "internal_analysis",
    "local_storage",
    "transcription",
    "translation",
    "corpus_storage",
    "short_excerpt_storage",
    "audio_redistribution",
    "transcript_redistribution",
    "dictionary_example_publication",
    "pronunciation_publication",
    "model_training",
    "model_evaluation",
    "commercial_redistribution",
}

ALLOWED_USAGE_PERMISSION_VALUES = {"allowed", "blocked", "unknown"}

# Publication/redistribution uses that contradict rights_review_status=publication_blocked.
PUBLICATION_USAGE_KEYS = {
    "audio_redistribution",
    "transcript_redistribution",
    "dictionary_example_publication",
    "pronunciation_publication",
    "commercial_redistribution",
}

FORBIDDEN_FIELDS = {"usable", "content_hash", "byte_length", "capture_method", "storage_ref"}

REQUIRED_FIELDS = {
    "schema_version",
    "source_id",
    "source_type",
    "registered_at",
    "rights_basis",
    "rights_review_status",
}

OPTIONAL_STRING_FIELDS = {
    "platform",
    "source_locator",
    "title",
    "creator_or_channel",
    "discovered_at",
    "updated_at",
    "claimed_language",
    "claimed_language_by",
    "assessed_language",
    "assessment_method",
    "assessment_confidence",
    "assessed_by",
    "region_claim",
    "speaker_origin_claim",
    "dialect_or_variety_claim",
    "media_quality_claim",
    "background_noise_or_music_claim",
    "license_reference",
    "permission_evidence_ref",
    "rights_notes",
    "rights_ref",
    "notes",
}

OPTIONAL_NUMBER_FIELDS = {
    "duration_if_known",
}

OPTIONAL_INT_FIELDS = {
    "page_count_if_known",
    "speaker_count_if_known",
}

OPTIONAL_BOOL_FIELDS = {
    "attribution_required",
}

OPTIONAL_STRING_ARRAY_FIELDS = {
    "languages_present_claim",
}

OPTIONAL_OBJECT_FIELDS = {
    "usage_permissions",
}

ALLOWED_FIELDS = (
    REQUIRED_FIELDS
    | OPTIONAL_STRING_FIELDS
    | OPTIONAL_NUMBER_FIELDS
    | OPTIONAL_INT_FIELDS
    | OPTIONAL_BOOL_FIELDS
    | OPTIONAL_STRING_ARRAY_FIELDS
    | OPTIONAL_OBJECT_FIELDS
)

TIMESTAMP_FIELDS = {"registered_at", "discovered_at", "updated_at"}


class CorpusSourceValidationError(ValueError):
    """Raised when a corpus source registry table is invalid."""


@dataclass(frozen=True)
class CorpusSourceRow:
    row: dict[str, Any]
    line_number: int

    @property
    def source_id(self) -> str:
        return str(self.row.get("source_id", ""))


@dataclass(frozen=True)
class CorpusSourceValidationResult:
    rows: list[CorpusSourceRow]
    schema_versions: list[str]
    summary: dict[str, int] = field(default_factory=dict)


def _err(path: Path, line_number: int, message: str) -> CorpusSourceValidationError:
    return CorpusSourceValidationError(f"{path}:{line_number}: {message}")


def _require_non_empty_string(row: dict[str, Any], field_name: str, path: Path, line: int) -> str:
    value = row.get(field_name)
    if not isinstance(value, str) or not value.strip():
        raise _err(path, line, f"{field_name} must be a non-empty string")
    return value


def _optional_string(row: dict[str, Any], field_name: str, path: Path, line: int) -> str | None:
    if field_name not in row:
        return None
    value = row[field_name]
    if value is None:
        raise _err(path, line, f"{field_name} must be a string when present (null not allowed)")
    if not isinstance(value, str):
        raise _err(path, line, f"{field_name} must be a string")
    return value


def _validate_timestamp(field_name: str, value: str, path: Path, line: int) -> None:
    if not ISO_TIMESTAMP_SHAPE_RE.match(value):
        raise _err(path, line, f"{field_name} must be an ISO-8601 date or timestamp")
    try:
        if len(value) == 10:
            date.fromisoformat(value)
            return
        normalized = value.replace("Z", "+00:00") if value.endswith("Z") else value
        datetime.fromisoformat(normalized)
    except ValueError as exc:
        raise _err(
            path,
            line,
            f"{field_name} is not a valid calendar date/time: {value!r}",
        ) from exc


def validate_corpus_source_row(row: dict[str, Any], path: Path, line_number: int) -> None:
    if not isinstance(row, dict):
        raise _err(path, line_number, "expected JSON object")

    forbidden_present = sorted(set(row) & FORBIDDEN_FIELDS)
    if forbidden_present:
        raise _err(
            path,
            line_number,
            f"forbidden fields: {', '.join(forbidden_present)}",
        )

    unknown = sorted(set(row) - ALLOWED_FIELDS)
    if unknown:
        raise _err(path, line_number, f"unknown fields: {', '.join(unknown)}")

    missing = sorted(REQUIRED_FIELDS - set(row))
    if missing:
        raise _err(path, line_number, f"missing required fields: {', '.join(missing)}")

    schema_version = _require_non_empty_string(row, "schema_version", path, line_number)
    if schema_version != SCHEMA_VERSION:
        raise _err(
            path,
            line_number,
            f"schema_version must be {SCHEMA_VERSION!r}, got {schema_version!r}",
        )

    source_id = _require_non_empty_string(row, "source_id", path, line_number)
    if not SOURCE_ID_RE.match(source_id):
        raise _err(
            path,
            line_number,
            "source_id must match ^csrc_[a-z0-9]+(?:_[a-z0-9]+)*$",
        )

    source_type = _require_non_empty_string(row, "source_type", path, line_number)
    if source_type not in ALLOWED_SOURCE_TYPES:
        raise _err(path, line_number, f"unsupported source_type: {source_type!r}")

    registered_at = _require_non_empty_string(row, "registered_at", path, line_number)
    _validate_timestamp("registered_at", registered_at, path, line_number)

    rights_basis = _require_non_empty_string(row, "rights_basis", path, line_number)
    if rights_basis not in ALLOWED_RIGHTS_BASIS:
        raise _err(path, line_number, f"invalid rights_basis: {rights_basis!r}")

    rights_review_status = _require_non_empty_string(
        row, "rights_review_status", path, line_number
    )
    if rights_review_status not in ALLOWED_RIGHTS_REVIEW_STATUS:
        raise _err(
            path,
            line_number,
            f"invalid rights_review_status: {rights_review_status!r}",
        )

    for field_name in OPTIONAL_STRING_FIELDS:
        value = _optional_string(row, field_name, path, line_number)
        if value is not None and field_name in TIMESTAMP_FIELDS:
            if not value.strip():
                raise _err(path, line_number, f"{field_name} must be a non-empty string")
            _validate_timestamp(field_name, value, path, line_number)

    claimed_language = row.get("claimed_language")
    if claimed_language is not None and not isinstance(claimed_language, str):
        raise _err(path, line_number, "claimed_language must be a string")
    claimed_language_text = (
        claimed_language.strip() if isinstance(claimed_language, str) else ""
    )

    claimed_by = row.get("claimed_language_by")
    if claimed_by is not None and not isinstance(claimed_by, str):
        raise _err(path, line_number, "claimed_language_by must be a string")
    claimed_by_text = claimed_by.strip() if isinstance(claimed_by, str) else ""

    if claimed_language_text and not claimed_by_text:
        raise _err(
            path,
            line_number,
            "claimed_language_by is required when claimed_language is set",
        )
    if claimed_by_text and not claimed_language_text:
        raise _err(
            path,
            line_number,
            "claimed_language_by requires non-empty claimed_language",
        )

    assessed_language = row.get("assessed_language")
    if assessed_language is not None and not isinstance(assessed_language, str):
        raise _err(path, line_number, "assessed_language must be a string")
    assessed_language_text = (
        assessed_language.strip() if isinstance(assessed_language, str) else ""
    )

    assessment_method = row.get("assessment_method")
    if assessment_method is not None and not isinstance(assessment_method, str):
        raise _err(path, line_number, "assessment_method must be a string")
    assessment_method_text = (
        assessment_method.strip() if isinstance(assessment_method, str) else ""
    )

    assessed_by = row.get("assessed_by")
    if assessed_by is not None and not isinstance(assessed_by, str):
        raise _err(path, line_number, "assessed_by must be a string")
    assessed_by_text = assessed_by.strip() if isinstance(assessed_by, str) else ""

    assessment_confidence = row.get("assessment_confidence")
    if assessment_confidence is not None:
        if not isinstance(assessment_confidence, str):
            raise _err(path, line_number, "assessment_confidence must be a string")
        if assessment_confidence not in ALLOWED_ASSESSMENT_CONFIDENCE:
            raise _err(
                path,
                line_number,
                f"invalid assessment_confidence: {assessment_confidence!r}",
            )

    if assessed_language_text:
        if not assessment_method_text:
            raise _err(
                path,
                line_number,
                "assessment_method is required when assessed_language is set",
            )
        if not assessed_by_text:
            raise _err(
                path,
                line_number,
                "assessed_by is required when assessed_language is set",
            )
    else:
        orphan_fields: list[str] = []
        if assessment_method_text:
            orphan_fields.append("assessment_method")
        if assessed_by_text:
            orphan_fields.append("assessed_by")
        if assessment_confidence is not None:
            orphan_fields.append("assessment_confidence")
        if orphan_fields:
            raise _err(
                path,
                line_number,
                "assessment provenance fields require non-empty assessed_language: "
                + ", ".join(orphan_fields),
            )

    if "languages_present_claim" in row:
        values = row["languages_present_claim"]
        if not isinstance(values, list) or not all(isinstance(item, str) for item in values):
            raise _err(path, line_number, "languages_present_claim must be an array of strings")
        if any(not item.strip() for item in values):
            raise _err(path, line_number, "languages_present_claim entries must be non-empty")

    for field_name in OPTIONAL_NUMBER_FIELDS:
        if field_name not in row:
            continue
        value = row[field_name]
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise _err(path, line_number, f"{field_name} must be a number")
        if value < 0:
            raise _err(path, line_number, f"{field_name} must be >= 0")

    for field_name in OPTIONAL_INT_FIELDS:
        if field_name not in row:
            continue
        value = row[field_name]
        if isinstance(value, bool) or not isinstance(value, int):
            raise _err(path, line_number, f"{field_name} must be an integer")
        if value < 0:
            raise _err(path, line_number, f"{field_name} must be >= 0")

    for field_name in OPTIONAL_BOOL_FIELDS:
        if field_name not in row:
            continue
        if not isinstance(row[field_name], bool):
            raise _err(path, line_number, f"{field_name} must be a boolean")

    if "usage_permissions" in row:
        permissions = row["usage_permissions"]
        if not isinstance(permissions, dict):
            raise _err(path, line_number, "usage_permissions must be an object")
        for key, value in permissions.items():
            if key not in ALLOWED_USAGE_PERMISSION_KEYS:
                raise _err(path, line_number, f"unsupported usage_permissions key: {key!r}")
            if value not in ALLOWED_USAGE_PERMISSION_VALUES:
                raise _err(
                    path,
                    line_number,
                    f"usage_permissions[{key!r}] must be one of "
                    f"{sorted(ALLOWED_USAGE_PERMISSION_VALUES)}",
                )
        if rights_review_status == "publication_blocked":
            contradictions = sorted(
                key
                for key in PUBLICATION_USAGE_KEYS
                if permissions.get(key) == "allowed"
            )
            if contradictions:
                raise _err(
                    path,
                    line_number,
                    "rights_review_status=publication_blocked contradicts "
                    f"usage_permissions allowed for: {', '.join(contradictions)}",
                )


def read_corpus_source_rows(path: Path) -> list[CorpusSourceRow]:
    rows: list[CorpusSourceRow] = []
    with path.open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, 1):
            text = line.strip()
            if not text:
                continue
            try:
                payload = json.loads(text)
            except json.JSONDecodeError as exc:
                raise _err(path, line_number, f"invalid JSON: {exc}") from exc
            if not isinstance(payload, dict):
                raise _err(path, line_number, "expected JSON object")
            rows.append(CorpusSourceRow(row=payload, line_number=line_number))
    return rows


def validate_corpus_sources(path: Path) -> CorpusSourceValidationResult:
    """Validate a corpus_sources_v1 JSONL file. Fail closed on structural errors."""
    rows = read_corpus_source_rows(path)
    seen_ids: dict[str, int] = {}
    schema_versions: list[str] = []

    for item in rows:
        validate_corpus_source_row(item.row, path, item.line_number)
        source_id = item.source_id
        if source_id in seen_ids:
            raise _err(
                path,
                item.line_number,
                f"duplicate source_id {source_id!r} "
                f"(first seen on line {seen_ids[source_id]})",
            )
        seen_ids[source_id] = item.line_number
        schema_versions.append(str(item.row["schema_version"]))

    rights_counts: dict[str, int] = {}
    type_counts: dict[str, int] = {}
    for item in rows:
        rights = str(item.row["rights_review_status"])
        rights_counts[rights] = rights_counts.get(rights, 0) + 1
        source_type = str(item.row["source_type"])
        type_counts[source_type] = type_counts.get(source_type, 0) + 1

    summary = {
        "row_count": len(rows),
        "unique_source_ids": len(seen_ids),
        **{f"rights_review_status.{key}": value for key, value in sorted(rights_counts.items())},
        **{f"source_type.{key}": value for key, value in sorted(type_counts.items())},
    }
    return CorpusSourceValidationResult(
        rows=rows,
        schema_versions=sorted(set(schema_versions)),
        summary=summary,
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Validate a corpus_sources_v1 JSONL registry (structure only)."
    )
    parser.add_argument("corpus_sources", type=Path, help="Path to corpus_sources_v1.jsonl")
    parser.add_argument(
        "--output-report",
        type=Path,
        default=None,
        help="Optional JSON report path",
    )
    args = parser.parse_args(argv)

    try:
        result = validate_corpus_sources(args.corpus_sources)
    except CorpusSourceValidationError as exc:
        print(f"corpus_sources validation FAILED: {exc}", file=sys.stderr)
        return 1

    print("corpus_sources validation PASSED")
    print(f"rows={result.summary.get('row_count', 0)}")
    print(f"schema_versions={','.join(result.schema_versions) or '(none)'}")
    if args.output_report is not None:
        payload = {
            "ok": True,
            "schema_version": SCHEMA_VERSION,
            "summary": result.summary,
            "schema_versions": result.schema_versions,
            "source_ids": [row.source_id for row in result.rows],
        }
        args.output_report.parent.mkdir(parents=True, exist_ok=True)
        args.output_report.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
