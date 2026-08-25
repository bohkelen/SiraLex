"""Validate corpus_source_artifacts_v1 tables (structure + optional source refs)."""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

from corpus_sources.validate_corpus_sources import (
    SOURCE_ID_RE,
    CorpusSourceValidationError,
    validate_corpus_sources,
)

SCHEMA_VERSION = "corpus_source_artifacts_v1"

ARTIFACT_ID_RE = re.compile(r"^cart_[a-z0-9]+(?:_[a-z0-9]+)*$")
SHA256_RE = re.compile(r"^[0-9a-fA-F]{64}$")
ISO_TIMESTAMP_SHAPE_RE = re.compile(
    r"^\d{4}-\d{2}-\d{2}"
    r"(?:[Tt]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?)?$"
)

ALLOWED_CAPTURE_METHODS = {
    "direct_recording",
    "manual_copy",
    "download",
    "scan",
    "export",
    "generated_derivative",
    "other",
}

REQUIRED_FIELDS = {
    "schema_version",
    "artifact_id",
    "source_id",
    "captured_at",
    "capture_method",
    "content_sha256",
    "byte_length",
    "media_type",
}

OPTIONAL_STRING_FIELDS = {
    "capture_tool",
    "capture_tool_version",
    "captured_by",
    "storage_ref",
    "rights_snapshot_ref",
    "notes",
    "updated_at",
}

OPTIONAL_STRING_ARRAY_FIELDS = {
    "derived_from_artifact_ids",
}

ALLOWED_FIELDS = REQUIRED_FIELDS | OPTIONAL_STRING_FIELDS | OPTIONAL_STRING_ARRAY_FIELDS

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
    "segment_id",
    "start_ms",
    "end_ms",
    "start_page",
    "end_page",
    "start_char",
    "end_char",
    "span_type",
}


class CorpusArtifactValidationError(ValueError):
    """Raised when a corpus artifact table is invalid."""


@dataclass(frozen=True)
class CorpusArtifactRow:
    row: dict[str, Any]
    line_number: int

    @property
    def artifact_id(self) -> str:
        return str(self.row.get("artifact_id", ""))

    @property
    def source_id(self) -> str:
        return str(self.row.get("source_id", ""))


@dataclass(frozen=True)
class CorpusArtifactValidationResult:
    rows: list[CorpusArtifactRow]
    schema_versions: list[str]
    summary: dict[str, int] = field(default_factory=dict)


def _err(path: Path, line_number: int, message: str) -> CorpusArtifactValidationError:
    return CorpusArtifactValidationError(f"{path}:{line_number}: {message}")


def _require_non_empty_string(row: dict[str, Any], field_name: str, path: Path, line: int) -> str:
    value = row.get(field_name)
    if not isinstance(value, str) or not value.strip():
        raise _err(path, line, f"{field_name} must be a non-empty string")
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


def _parse_timestamp_for_compare(value: str) -> datetime:
    if len(value) == 10:
        return datetime.fromisoformat(value + "T00:00:00")
    normalized = value.replace("Z", "+00:00") if value.endswith("Z") else value
    parsed = datetime.fromisoformat(normalized)
    if parsed.tzinfo is not None:
        return parsed.astimezone(timezone.utc).replace(tzinfo=None)
    return parsed


def validate_corpus_artifact_row(row: dict[str, Any], path: Path, line_number: int) -> None:
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

    artifact_id = _require_non_empty_string(row, "artifact_id", path, line_number)
    if not ARTIFACT_ID_RE.match(artifact_id):
        raise _err(
            path,
            line_number,
            "artifact_id must match ^cart_[a-z0-9]+(?:_[a-z0-9]+)*$",
        )

    source_id = _require_non_empty_string(row, "source_id", path, line_number)
    if not SOURCE_ID_RE.match(source_id):
        raise _err(
            path,
            line_number,
            "source_id must match ^csrc_[a-z0-9]+(?:_[a-z0-9]+)*$",
        )

    captured_at = _require_non_empty_string(row, "captured_at", path, line_number)
    _validate_timestamp("captured_at", captured_at, path, line_number)

    capture_method = _require_non_empty_string(row, "capture_method", path, line_number)
    if capture_method not in ALLOWED_CAPTURE_METHODS:
        raise _err(path, line_number, f"unsupported capture_method: {capture_method!r}")

    content_sha256 = _require_non_empty_string(row, "content_sha256", path, line_number)
    if not SHA256_RE.match(content_sha256):
        raise _err(path, line_number, "content_sha256 must be exactly 64 hexadecimal characters")

    byte_length = row.get("byte_length")
    if isinstance(byte_length, bool) or not isinstance(byte_length, int):
        raise _err(path, line_number, "byte_length must be an integer")
    if byte_length <= 0:
        raise _err(path, line_number, "byte_length must be > 0")

    media_type = _require_non_empty_string(row, "media_type", path, line_number)
    if "/" not in media_type:
        raise _err(path, line_number, "media_type must look like a MIME type (type/subtype)")

    for field_name in OPTIONAL_STRING_FIELDS:
        if field_name not in row:
            continue
        value = row[field_name]
        if value is None or not isinstance(value, str):
            raise _err(path, line_number, f"{field_name} must be a string")
        if field_name == "updated_at":
            if not value.strip():
                raise _err(path, line_number, "updated_at must be a non-empty string")
            _validate_timestamp("updated_at", value, path, line_number)

    capture_tool = row.get("capture_tool")
    capture_tool_version = row.get("capture_tool_version")
    if capture_tool_version is not None:
        if not isinstance(capture_tool, str) or not capture_tool.strip():
            raise _err(
                path,
                line_number,
                "capture_tool_version requires non-empty capture_tool",
            )

    if "updated_at" in row:
        updated_at = str(row["updated_at"])
        if _parse_timestamp_for_compare(updated_at) < _parse_timestamp_for_compare(captured_at):
            raise _err(
                path,
                line_number,
                "updated_at must not precede captured_at",
            )

    parent_ids: list[str] = []
    if "derived_from_artifact_ids" in row:
        parents = row["derived_from_artifact_ids"]
        if not isinstance(parents, list) or not all(isinstance(item, str) for item in parents):
            raise _err(
                path,
                line_number,
                "derived_from_artifact_ids must be an array of strings",
            )
        if any(not item.strip() for item in parents):
            raise _err(
                path,
                line_number,
                "derived_from_artifact_ids entries must be non-empty",
            )
        if len(parents) != len(set(parents)):
            raise _err(path, line_number, "derived_from_artifact_ids must not contain duplicates")
        for parent_id in parents:
            if not ARTIFACT_ID_RE.match(parent_id):
                raise _err(
                    path,
                    line_number,
                    f"derived_from_artifact_ids entry must match artifact_id syntax: {parent_id!r}",
                )
            if parent_id == artifact_id:
                raise _err(path, line_number, "derived_from_artifact_ids must not self-reference")
        parent_ids = parents

    if capture_method == "generated_derivative":
        if not parent_ids:
            raise _err(
                path,
                line_number,
                "generated_derivative requires non-empty derived_from_artifact_ids",
            )


def read_corpus_artifact_rows(path: Path) -> list[CorpusArtifactRow]:
    rows: list[CorpusArtifactRow] = []
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
            rows.append(CorpusArtifactRow(row=payload, line_number=line_number))
    return rows


def validate_corpus_artifacts(
    path: Path,
    *,
    sources_path: Path | None = None,
) -> CorpusArtifactValidationResult:
    known_source_ids: set[str] | None = None
    if sources_path is not None:
        try:
            source_result = validate_corpus_sources(sources_path)
        except CorpusSourceValidationError as exc:
            raise CorpusArtifactValidationError(
                f"sources table validation failed ({sources_path}): {exc}"
            ) from exc
        known_source_ids = {row.source_id for row in source_result.rows}

    rows = read_corpus_artifact_rows(path)
    seen_ids: dict[str, int] = {}
    schema_versions: list[str] = []
    rows_by_id: dict[str, CorpusArtifactRow] = {}

    for item in rows:
        validate_corpus_artifact_row(item.row, path, item.line_number)
        artifact_id = item.artifact_id
        if artifact_id in seen_ids:
            raise _err(
                path,
                item.line_number,
                f"duplicate artifact_id {artifact_id!r} "
                f"(first seen on line {seen_ids[artifact_id]})",
            )
        seen_ids[artifact_id] = item.line_number
        rows_by_id[artifact_id] = item
        schema_versions.append(str(item.row["schema_version"]))
        if known_source_ids is not None and item.source_id not in known_source_ids:
            raise _err(
                path,
                item.line_number,
                f"unknown source_id {item.source_id!r} (not found in {sources_path})",
            )

    for item in rows:
        parents = item.row.get("derived_from_artifact_ids")
        if not isinstance(parents, list) or not parents:
            continue
        for parent_id in parents:
            parent = rows_by_id.get(parent_id)
            if parent is None:
                raise _err(
                    path,
                    item.line_number,
                    f"unknown derived_from_artifact_id {parent_id!r}",
                )
            if parent.source_id != item.source_id:
                raise _err(
                    path,
                    item.line_number,
                    "generated/derived artifact source_id must match parent "
                    f"{parent_id!r} source_id "
                    f"(got {item.source_id!r}, parent has {parent.source_id!r}); "
                    "multi-source composite artifacts are deferred",
                )

    method_counts: dict[str, int] = {}
    for item in rows:
        method = str(item.row["capture_method"])
        method_counts[method] = method_counts.get(method, 0) + 1

    summary = {
        "row_count": len(rows),
        "unique_artifact_ids": len(seen_ids),
        "source_cross_reference": 1 if known_source_ids is not None else 0,
        **{f"capture_method.{key}": value for key, value in sorted(method_counts.items())},
    }
    return CorpusArtifactValidationResult(
        rows=rows,
        schema_versions=sorted(set(schema_versions)),
        summary=summary,
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Validate corpus_source_artifacts_v1 JSONL (structure only)."
    )
    parser.add_argument("corpus_artifacts", type=Path)
    parser.add_argument(
        "--sources",
        type=Path,
        default=None,
        help="Optional corpus_sources_v1.jsonl (fully validated) for source_id refs",
    )
    parser.add_argument("--output-report", type=Path, default=None)
    args = parser.parse_args(argv)

    try:
        result = validate_corpus_artifacts(args.corpus_artifacts, sources_path=args.sources)
    except CorpusArtifactValidationError as exc:
        print(f"corpus_artifacts validation FAILED: {exc}", file=sys.stderr)
        return 1

    print("corpus_artifacts validation PASSED")
    print(f"rows={result.summary.get('row_count', 0)}")
    print(f"schema_versions={','.join(result.schema_versions) or '(none)'}")
    if args.output_report is not None:
        payload = {
            "ok": True,
            "schema_version": SCHEMA_VERSION,
            "summary": result.summary,
            "schema_versions": result.schema_versions,
            "artifact_ids": [row.artifact_id for row in result.rows],
        }
        args.output_report.parent.mkdir(parents=True, exist_ok=True)
        args.output_report.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
