"""Validate corpus_segments_v1 tables (structure + optional artifact refs)."""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path
from typing import Any

from corpus_artifacts.validate_corpus_artifacts import (
    ARTIFACT_ID_RE,
    CorpusArtifactValidationError,
    validate_corpus_artifacts,
)

SCHEMA_VERSION = "corpus_segments_v1"

SEGMENT_ID_RE = re.compile(r"^cseg_[a-z0-9]+(?:_[a-z0-9]+)*$")
ISO_TIMESTAMP_SHAPE_RE = re.compile(
    r"^\d{4}-\d{2}-\d{2}"
    r"(?:[Tt]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?)?$"
)

ALLOWED_SPAN_TYPES = {"time", "page", "text", "whole_artifact"}
ALLOWED_LANGUAGE_CONFIDENCE = {"unknown", "low", "medium", "high"}

TIME_FIELDS = {"start_ms", "end_ms"}
PAGE_FIELDS = {"start_page", "end_page"}
TEXT_FIELDS = {"start_char", "end_char"}
ALL_SPAN_FIELDS = TIME_FIELDS | PAGE_FIELDS | TEXT_FIELDS

REQUIRED_FIELDS = {
    "schema_version",
    "segment_id",
    "artifact_id",
    "span_type",
}

OPTIONAL_STRING_FIELDS = {
    "audio_quality",
    "background_noise",
    "segment_type",
    "speech_context",
    "notes",
    "registered_at",
    "updated_at",
    "language_assessment_method",
    "language_assessed_by",
    "language_assessment_confidence",
}

OPTIONAL_BOOL_FIELDS = {"speaker_overlap"}
OPTIONAL_STRING_ARRAY_FIELDS = {"speaker_labels", "languages_present"}

ALLOWED_FIELDS = (
    REQUIRED_FIELDS
    | ALL_SPAN_FIELDS
    | OPTIONAL_STRING_FIELDS
    | OPTIONAL_BOOL_FIELDS
    | OPTIONAL_STRING_ARRAY_FIELDS
)

FORBIDDEN_FIELDS = {
    "usable",
    "transcript",
    "raw_transcript",
    "normalized_transcript",
    "translation",
    "gloss",
    "orthography",
    "uncertain_spans",
    "dictionary_candidate",
    "source_id",
    "content_sha256",
    "byte_length",
    "capture_method",
    "storage_ref",
}


class CorpusSegmentValidationError(ValueError):
    """Raised when a corpus segment table is invalid."""


@dataclass(frozen=True)
class CorpusSegmentRow:
    row: dict[str, Any]
    line_number: int

    @property
    def segment_id(self) -> str:
        return str(self.row.get("segment_id", ""))

    @property
    def artifact_id(self) -> str:
        return str(self.row.get("artifact_id", ""))


@dataclass(frozen=True)
class CorpusSegmentValidationResult:
    rows: list[CorpusSegmentRow]
    schema_versions: list[str]
    summary: dict[str, int] = field(default_factory=dict)


def _err(path: Path, line_number: int, message: str) -> CorpusSegmentValidationError:
    return CorpusSegmentValidationError(f"{path}:{line_number}: {message}")


def _require_non_empty_string(row: dict[str, Any], field_name: str, path: Path, line: int) -> str:
    value = row.get(field_name)
    if not isinstance(value, str) or not value.strip():
        raise _err(path, line, f"{field_name} must be a non-empty string")
    return value


def _require_int(row: dict[str, Any], field_name: str, path: Path, line: int) -> int:
    if field_name not in row:
        raise _err(path, line, f"missing required field for span: {field_name}")
    value = row[field_name]
    if isinstance(value, bool) or not isinstance(value, int):
        raise _err(path, line, f"{field_name} must be an integer")
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


def _validate_span(row: dict[str, Any], span_type: str, path: Path, line: int) -> None:
    present_span_fields = set(row) & ALL_SPAN_FIELDS

    if span_type == "whole_artifact":
        if present_span_fields:
            raise _err(
                path,
                line,
                "span_type=whole_artifact must not include span bound fields: "
                + ", ".join(sorted(present_span_fields)),
            )
        return

    if span_type == "time":
        allowed = TIME_FIELDS
    elif span_type == "page":
        allowed = PAGE_FIELDS
    elif span_type == "text":
        allowed = TEXT_FIELDS
    else:
        raise _err(path, line, f"unsupported span_type: {span_type!r}")

    unexpected = present_span_fields - allowed
    if unexpected:
        raise _err(
            path,
            line,
            f"span_type={span_type} has incompatible span fields: "
            + ", ".join(sorted(unexpected)),
        )
    missing = allowed - present_span_fields
    if missing:
        raise _err(
            path,
            line,
            f"span_type={span_type} missing required fields: "
            + ", ".join(sorted(missing)),
        )

    if span_type == "time":
        start_ms = _require_int(row, "start_ms", path, line)
        end_ms = _require_int(row, "end_ms", path, line)
        if start_ms < 0:
            raise _err(path, line, "start_ms must be >= 0")
        if end_ms <= start_ms:
            raise _err(path, line, "end_ms must be > start_ms")
    elif span_type == "page":
        start_page = _require_int(row, "start_page", path, line)
        end_page = _require_int(row, "end_page", path, line)
        if start_page < 1:
            raise _err(path, line, "start_page must be >= 1")
        if end_page < start_page:
            raise _err(path, line, "end_page must be >= start_page")
    else:  # text
        start_char = _require_int(row, "start_char", path, line)
        end_char = _require_int(row, "end_char", path, line)
        if start_char < 0:
            raise _err(path, line, "start_char must be >= 0")
        if end_char <= start_char:
            raise _err(path, line, "end_char must be > start_char")


def validate_corpus_segment_row(row: dict[str, Any], path: Path, line_number: int) -> None:
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

    segment_id = _require_non_empty_string(row, "segment_id", path, line_number)
    if not SEGMENT_ID_RE.match(segment_id):
        raise _err(
            path,
            line_number,
            "segment_id must match ^cseg_[a-z0-9]+(?:_[a-z0-9]+)*$",
        )

    artifact_id = _require_non_empty_string(row, "artifact_id", path, line_number)
    if not ARTIFACT_ID_RE.match(artifact_id):
        raise _err(
            path,
            line_number,
            "artifact_id must match ^cart_[a-z0-9]+(?:_[a-z0-9]+)*$",
        )

    span_type = _require_non_empty_string(row, "span_type", path, line_number)
    if span_type not in ALLOWED_SPAN_TYPES:
        raise _err(path, line_number, f"unsupported span_type: {span_type!r}")
    _validate_span(row, span_type, path, line_number)

    for field_name in OPTIONAL_STRING_FIELDS:
        if field_name not in row:
            continue
        value = row[field_name]
        if value is None or not isinstance(value, str):
            raise _err(path, line_number, f"{field_name} must be a string")
        if field_name in {"registered_at", "updated_at"}:
            if not value.strip():
                raise _err(path, line_number, f"{field_name} must be a non-empty string")
            _validate_timestamp(field_name, value, path, line_number)

    if "speaker_overlap" in row and not isinstance(row["speaker_overlap"], bool):
        raise _err(path, line_number, "speaker_overlap must be a boolean")

    if "speaker_labels" in row:
        labels = row["speaker_labels"]
        if not isinstance(labels, list) or not all(isinstance(item, str) for item in labels):
            raise _err(path, line_number, "speaker_labels must be an array of strings")
        if any(not item.strip() for item in labels):
            raise _err(path, line_number, "speaker_labels entries must be non-empty")

    languages_present = row.get("languages_present")
    languages_nonempty = False
    if languages_present is not None:
        if not isinstance(languages_present, list) or not all(
            isinstance(item, str) for item in languages_present
        ):
            raise _err(path, line_number, "languages_present must be an array of strings")
        if any(not item.strip() for item in languages_present):
            raise _err(path, line_number, "languages_present entries must be non-empty")
        languages_nonempty = len(languages_present) > 0

    method = row.get("language_assessment_method")
    method_text = method.strip() if isinstance(method, str) else ""
    assessed_by = row.get("language_assessed_by")
    assessed_by_text = assessed_by.strip() if isinstance(assessed_by, str) else ""
    confidence = row.get("language_assessment_confidence")

    if confidence is not None:
        if not isinstance(confidence, str):
            raise _err(path, line_number, "language_assessment_confidence must be a string")
        if confidence not in ALLOWED_LANGUAGE_CONFIDENCE:
            raise _err(
                path,
                line_number,
                f"invalid language_assessment_confidence: {confidence!r}",
            )

    if languages_nonempty:
        if not method_text:
            raise _err(
                path,
                line_number,
                "language_assessment_method is required when languages_present is non-empty",
            )
        if not assessed_by_text:
            raise _err(
                path,
                line_number,
                "language_assessed_by is required when languages_present is non-empty",
            )
    else:
        orphan_fields: list[str] = []
        if method_text:
            orphan_fields.append("language_assessment_method")
        if assessed_by_text:
            orphan_fields.append("language_assessed_by")
        if confidence is not None:
            orphan_fields.append("language_assessment_confidence")
        if orphan_fields:
            raise _err(
                path,
                line_number,
                "language assessment provenance requires non-empty languages_present: "
                + ", ".join(orphan_fields),
            )


def read_corpus_segment_rows(path: Path) -> list[CorpusSegmentRow]:
    rows: list[CorpusSegmentRow] = []
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
            rows.append(CorpusSegmentRow(row=payload, line_number=line_number))
    return rows


def validate_corpus_segments(
    path: Path,
    *,
    artifacts_path: Path | None = None,
    sources_path: Path | None = None,
) -> CorpusSegmentValidationResult:
    if sources_path is not None and artifacts_path is None:
        raise CorpusSegmentValidationError(
            "--sources requires --artifacts so the segment→artifact→source chain "
            "can be validated"
        )

    known_artifact_ids: set[str] | None = None
    if artifacts_path is not None:
        try:
            artifact_result = validate_corpus_artifacts(
                artifacts_path,
                sources_path=sources_path,
            )
        except CorpusArtifactValidationError as exc:
            raise CorpusSegmentValidationError(
                f"artifacts table validation failed ({artifacts_path}): {exc}"
            ) from exc
        known_artifact_ids = {row.artifact_id for row in artifact_result.rows}

    rows = read_corpus_segment_rows(path)
    seen_ids: dict[str, int] = {}
    schema_versions: list[str] = []

    for item in rows:
        validate_corpus_segment_row(item.row, path, item.line_number)
        segment_id = item.segment_id
        if segment_id in seen_ids:
            raise _err(
                path,
                item.line_number,
                f"duplicate segment_id {segment_id!r} "
                f"(first seen on line {seen_ids[segment_id]})",
            )
        seen_ids[segment_id] = item.line_number
        schema_versions.append(str(item.row["schema_version"]))
        if known_artifact_ids is not None and item.artifact_id not in known_artifact_ids:
            raise _err(
                path,
                item.line_number,
                f"unknown artifact_id {item.artifact_id!r} (not found in {artifacts_path})",
            )

    span_counts: dict[str, int] = {}
    for item in rows:
        span_type = str(item.row["span_type"])
        span_counts[span_type] = span_counts.get(span_type, 0) + 1

    summary = {
        "row_count": len(rows),
        "unique_segment_ids": len(seen_ids),
        "artifact_cross_reference": 1 if known_artifact_ids is not None else 0,
        "source_cross_reference": 1 if sources_path is not None else 0,
        **{f"span_type.{key}": value for key, value in sorted(span_counts.items())},
    }
    return CorpusSegmentValidationResult(
        rows=rows,
        schema_versions=sorted(set(schema_versions)),
        summary=summary,
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Validate corpus_segments_v1 JSONL (structure only)."
    )
    parser.add_argument("corpus_segments", type=Path)
    parser.add_argument(
        "--artifacts",
        type=Path,
        default=None,
        help="Optional corpus_source_artifacts_v1.jsonl (fully validated) for refs",
    )
    parser.add_argument(
        "--sources",
        type=Path,
        default=None,
        help="Optional corpus_sources_v1.jsonl; requires --artifacts for full chain",
    )
    parser.add_argument("--output-report", type=Path, default=None)
    args = parser.parse_args(argv)

    try:
        result = validate_corpus_segments(
            args.corpus_segments,
            artifacts_path=args.artifacts,
            sources_path=args.sources,
        )
    except CorpusSegmentValidationError as exc:
        print(f"corpus_segments validation FAILED: {exc}", file=sys.stderr)
        return 1

    print("corpus_segments validation PASSED")
    print(f"rows={result.summary.get('row_count', 0)}")
    print(f"schema_versions={','.join(result.schema_versions) or '(none)'}")
    if args.output_report is not None:
        payload = {
            "ok": True,
            "schema_version": SCHEMA_VERSION,
            "summary": result.summary,
            "schema_versions": result.schema_versions,
            "segment_ids": [row.segment_id for row in result.rows],
        }
        args.output_report.parent.mkdir(parents=True, exist_ok=True)
        args.output_report.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
