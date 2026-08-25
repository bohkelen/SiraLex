"""Deterministic corpus annotation review worksheet CSV export."""

from __future__ import annotations

import argparse
import csv
import io
import json
import sys
from pathlib import Path
from typing import Any

from corpus_annotations.validate_corpus_annotations import (
    CorpusAnnotationRow,
    CorpusAnnotationValidationError,
    find_supersession_leaves,
    validate_corpus_annotations,
)
from corpus_artifacts.validate_corpus_artifacts import (
    CorpusArtifactValidationError,
    validate_corpus_artifacts,
)
from corpus_reviews.annotation_fingerprint import annotation_fingerprint_sha256
from corpus_segments.validate_corpus_segments import (
    CorpusSegmentValidationError,
    validate_corpus_segments,
)

WORKSHEET_SCHEMA_V2 = "corpus_annotation_review_worksheet_v2"
WORKSHEET_SCHEMA_V3 = "corpus_annotation_review_worksheet_v3"
# New exports use v3; dry-run continues to accept historical v2.
WORKSHEET_SCHEMA = WORKSHEET_SCHEMA_V3

SUPPORTED_WORKSHEET_SCHEMAS = {WORKSHEET_SCHEMA_V2, WORKSHEET_SCHEMA_V3}

CONTEXT_COLUMNS_V2 = [
    "worksheet_schema",
    "annotation_id",
    "annotation_type",
    "segment_id",
    "artifact_storage_ref",
    "content",
    "content_language",
    "script",
    "related_translation_english",
    "related_translation_english_annotation_ids",
    "related_translation_french",
    "related_translation_french_annotation_ids",
    "creation_method",
    "created_by",
    "tool_name",
    "tool_version",
    "model_name",
    "model_version",
    "uncertainty_summary",
    "supersedes_annotation_id",
    "is_current_leaf",
    "competing_leaf_count",
    "annotation_fingerprint_sha256",
]

CONTEXT_COLUMNS_V3 = [
    "worksheet_schema",
    "annotation_id",
    "annotation_type",
    "segment_id",
    "artifact_storage_ref",
    "content",
    "content_language",
    "script",
    "source_transcript",
    "source_transcript_annotation_ids",
    "related_translation_english",
    "related_translation_english_annotation_ids",
    "related_translation_french",
    "related_translation_french_annotation_ids",
    "creation_method",
    "created_by",
    "tool_name",
    "tool_version",
    "model_name",
    "model_version",
    "uncertainty_summary",
    "supersedes_annotation_id",
    "is_current_leaf",
    "competing_leaf_count",
    "annotation_fingerprint_sha256",
]

REVIEW_FILL_COLUMNS = [
    "review_id",
    "review_decision",
    "evidence_strength",
    "evidence_refs",
    "issue_codes",
    "review_notes",
    "reviewer_id",
    "reviewed_at",
    "review_method",
]

CONTEXT_COLUMNS = CONTEXT_COLUMNS_V3
WORKSHEET_COLUMNS_V2 = CONTEXT_COLUMNS_V2 + REVIEW_FILL_COLUMNS
WORKSHEET_COLUMNS_V3 = CONTEXT_COLUMNS_V3 + REVIEW_FILL_COLUMNS
WORKSHEET_COLUMNS = WORKSHEET_COLUMNS_V3

_ENGLISH_LABELS = {"english", "en"}
_FRENCH_LABELS = {"french", "fr", "français", "francais"}
_TRANSCRIPT_TYPES = {"transcript_raw", "transcript_normalized"}


class CorpusReviewWorksheetError(ValueError):
    """Raised when worksheet export fails."""


def context_columns_for_schema(schema: str) -> list[str]:
    if schema == WORKSHEET_SCHEMA_V2:
        return list(CONTEXT_COLUMNS_V2)
    if schema == WORKSHEET_SCHEMA_V3:
        return list(CONTEXT_COLUMNS_V3)
    raise CorpusReviewWorksheetError(f"unsupported worksheet_schema {schema!r}")


def worksheet_columns_for_schema(schema: str) -> list[str]:
    return context_columns_for_schema(schema) + list(REVIEW_FILL_COLUMNS)


def _uncertainty_summary(row: dict[str, Any]) -> str:
    spans = row.get("uncertain_spans")
    if not isinstance(spans, list) or not spans:
        return ""
    parts: list[str] = []
    for span in spans:
        if not isinstance(span, dict):
            continue
        start = span.get("start_char")
        end = span.get("end_char")
        reason = span.get("reason") or ""
        confidence = span.get("confidence") or ""
        chunk = f"{start}-{end}"
        if reason:
            chunk += f":{reason}"
        if confidence:
            chunk += f"/{confidence}"
        parts.append(chunk)
    return "; ".join(parts)


def _competing_leaf_counts(
    rows: list[CorpusAnnotationRow],
    leaf_ids: set[str],
) -> dict[str, int]:
    counts: dict[tuple[str, str], int] = {}
    for item in rows:
        if item.annotation_id not in leaf_ids:
            continue
        key = (item.segment_id, str(item.row.get("annotation_type", "")))
        counts[key] = counts.get(key, 0) + 1
    result: dict[str, int] = {}
    for item in rows:
        key = (item.segment_id, str(item.row.get("annotation_type", "")))
        result[item.annotation_id] = counts.get(key, 0)
    return result


def _normalize_language_label(value: str) -> str:
    return value.strip().lower()


def _related_translations_for_segment(
    annotation_rows: list[CorpusAnnotationRow],
    *,
    segment_id: str,
    leaf_ids: set[str],
    exclude_annotation_id: str | None = None,
) -> dict[str, list[CorpusAnnotationRow]]:
    """Collect current translation leaves on the same segment, grouped by language family."""
    english: list[CorpusAnnotationRow] = []
    french: list[CorpusAnnotationRow] = []
    for item in annotation_rows:
        if exclude_annotation_id and item.annotation_id == exclude_annotation_id:
            continue
        if item.annotation_id not in leaf_ids:
            continue
        if item.segment_id != segment_id:
            continue
        if item.row.get("annotation_type") != "translation":
            continue
        label = _normalize_language_label(str(item.row.get("content_language", "")))
        if label in _ENGLISH_LABELS:
            english.append(item)
        elif label in _FRENCH_LABELS:
            french.append(item)
    english.sort(key=lambda item: item.annotation_id)
    french.sort(key=lambda item: item.annotation_id)
    return {"english": english, "french": french}


def _source_transcripts_from_derivation(
    item: CorpusAnnotationRow,
    rows_by_id: dict[str, CorpusAnnotationRow],
) -> list[CorpusAnnotationRow]:
    parents = item.row.get("derived_from_annotation_ids") or []
    if not isinstance(parents, list):
        return []
    found: list[CorpusAnnotationRow] = []
    for parent_id in parents:
        if not isinstance(parent_id, str) or not parent_id:
            continue
        parent = rows_by_id.get(parent_id)
        if parent is None:
            continue
        if parent.row.get("annotation_type") in _TRANSCRIPT_TYPES:
            found.append(parent)
    found.sort(key=lambda row: row.annotation_id)
    return found


def _join_contents(items: list[CorpusAnnotationRow]) -> str:
    return " | ".join(str(item.row.get("content", "")) for item in items)


def _join_annotation_ids(items: list[CorpusAnnotationRow]) -> str:
    return ";".join(item.annotation_id for item in items)


def build_worksheet_rows(
    annotation_rows: list[CorpusAnnotationRow],
    *,
    include_superseded: bool = False,
    annotation_type: str | None = None,
    artifact_storage_by_segment: dict[str, str] | None = None,
    worksheet_schema: str = WORKSHEET_SCHEMA_V3,
) -> list[dict[str, str]]:
    if worksheet_schema not in SUPPORTED_WORKSHEET_SCHEMAS:
        raise CorpusReviewWorksheetError(
            f"unsupported worksheet_schema {worksheet_schema!r}"
        )

    leaf_ids = set(find_supersession_leaves(annotation_rows))
    competing = _competing_leaf_counts(annotation_rows, leaf_ids)
    storage_by_segment = artifact_storage_by_segment or {}
    rows_by_id = {item.annotation_id: item for item in annotation_rows}

    selected: list[CorpusAnnotationRow] = []
    for item in annotation_rows:
        if not include_superseded and item.annotation_id not in leaf_ids:
            continue
        if annotation_type is not None and item.row.get("annotation_type") != annotation_type:
            continue
        selected.append(item)

    selected.sort(key=lambda item: item.annotation_id)

    worksheet_rows: list[dict[str, str]] = []
    for item in selected:
        row = item.row
        related = _related_translations_for_segment(
            annotation_rows,
            segment_id=item.segment_id,
            leaf_ids=leaf_ids,
            exclude_annotation_id=item.annotation_id,
        )
        source_transcripts: list[CorpusAnnotationRow] = []
        if worksheet_schema == WORKSHEET_SCHEMA_V3 and row.get("annotation_type") == "translation":
            source_transcripts = _source_transcripts_from_derivation(item, rows_by_id)

        built: dict[str, str] = {
            "worksheet_schema": worksheet_schema,
            "annotation_id": item.annotation_id,
            "annotation_type": str(row.get("annotation_type", "")),
            "segment_id": item.segment_id,
            "artifact_storage_ref": storage_by_segment.get(item.segment_id, ""),
            "content": str(row.get("content", "")),
            "content_language": str(row.get("content_language", "")),
            "script": str(row.get("script", "")),
            "related_translation_english": _join_contents(related["english"]),
            "related_translation_english_annotation_ids": _join_annotation_ids(
                related["english"]
            ),
            "related_translation_french": _join_contents(related["french"]),
            "related_translation_french_annotation_ids": _join_annotation_ids(
                related["french"]
            ),
            "creation_method": str(row.get("creation_method", "")),
            "created_by": str(row.get("created_by", "")),
            "tool_name": str(row.get("tool_name", "")),
            "tool_version": str(row.get("tool_version", "")),
            "model_name": str(row.get("model_name", "")),
            "model_version": str(row.get("model_version", "")),
            "uncertainty_summary": _uncertainty_summary(row),
            "supersedes_annotation_id": str(row.get("supersedes_annotation_id", "")),
            "is_current_leaf": "true" if item.annotation_id in leaf_ids else "false",
            "competing_leaf_count": str(competing.get(item.annotation_id, 0)),
            "annotation_fingerprint_sha256": annotation_fingerprint_sha256(row),
            "review_id": "",
            "review_decision": "",
            "evidence_strength": "",
            "evidence_refs": "",
            "issue_codes": "",
            "review_notes": "",
            "reviewer_id": "",
            "reviewed_at": "",
            "review_method": "",
        }
        if worksheet_schema == WORKSHEET_SCHEMA_V3:
            built["source_transcript"] = _join_contents(source_transcripts)
            built["source_transcript_annotation_ids"] = _join_annotation_ids(
                source_transcripts
            )
        worksheet_rows.append(built)
    return worksheet_rows


def worksheet_rows_to_csv(
    rows: list[dict[str, str]],
    *,
    worksheet_schema: str = WORKSHEET_SCHEMA_V3,
) -> str:
    columns = worksheet_columns_for_schema(worksheet_schema)
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=columns, lineterminator="\n")
    writer.writeheader()
    for row in rows:
        writer.writerow({column: row.get(column, "") for column in columns})
    return buffer.getvalue()


def _artifact_storage_by_segment(
    *,
    segments_path: Path | None,
    artifacts_path: Path | None,
    sources_path: Path | None,
) -> dict[str, str]:
    if segments_path is None or artifacts_path is None:
        return {}
    try:
        segment_result = validate_corpus_segments(
            segments_path,
            artifacts_path=artifacts_path,
            sources_path=sources_path,
        )
        artifact_result = validate_corpus_artifacts(
            artifacts_path,
            sources_path=sources_path,
        )
    except (CorpusSegmentValidationError, CorpusArtifactValidationError) as exc:
        raise CorpusReviewWorksheetError(
            f"segment/artifact tables required for artifact_storage_ref failed: {exc}"
        ) from exc

    artifacts_by_id = {
        item.artifact_id: str(item.row.get("storage_ref", "") or "")
        for item in artifact_result.rows
    }
    mapping: dict[str, str] = {}
    for item in segment_result.rows:
        mapping[item.segment_id] = artifacts_by_id.get(item.artifact_id, "")
    return mapping


def export_review_worksheet(
    annotations_path: Path,
    *,
    include_superseded: bool = False,
    annotation_type: str | None = None,
    segments_path: Path | None = None,
    artifacts_path: Path | None = None,
    sources_path: Path | None = None,
    worksheet_schema: str = WORKSHEET_SCHEMA_V3,
) -> tuple[str, dict[str, int]]:
    try:
        result = validate_corpus_annotations(
            annotations_path,
            segments_path=segments_path,
            artifacts_path=artifacts_path,
            sources_path=sources_path,
        )
    except CorpusAnnotationValidationError as exc:
        raise CorpusReviewWorksheetError(
            f"annotations table validation failed ({annotations_path}): {exc}"
        ) from exc

    storage_by_segment = _artifact_storage_by_segment(
        segments_path=segments_path,
        artifacts_path=artifacts_path,
        sources_path=sources_path,
    )

    rows = build_worksheet_rows(
        result.rows,
        include_superseded=include_superseded,
        annotation_type=annotation_type,
        artifact_storage_by_segment=storage_by_segment,
        worksheet_schema=worksheet_schema,
    )
    csv_text = worksheet_rows_to_csv(rows, worksheet_schema=worksheet_schema)
    leaf_count = sum(1 for row in rows if row["is_current_leaf"] == "true")
    summary = {
        "annotation_row_count": len(result.rows),
        "worksheet_row_count": len(rows),
        "current_leaf_rows": leaf_count,
        "include_superseded": 1 if include_superseded else 0,
        "artifact_storage_context": 1 if storage_by_segment else 0,
        "worksheet_schema_v3": 1 if worksheet_schema == WORKSHEET_SCHEMA_V3 else 0,
    }
    return csv_text, summary


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=(
            f"Export {WORKSHEET_SCHEMA} CSV from corpus_annotations_v1 "
            "(derived working artifact; not authority)."
        )
    )
    parser.add_argument("corpus_annotations", type=Path)
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=None,
        help="Write CSV to this path (default: stdout)",
    )
    parser.add_argument(
        "--include-superseded",
        action="store_true",
        help="Include superseded historical revisions (default: current leaves only)",
    )
    parser.add_argument(
        "--annotation-type",
        default=None,
        help="Optional filter to a single annotation_type (e.g. transcript_raw)",
    )
    parser.add_argument("--segments", type=Path, default=None)
    parser.add_argument("--artifacts", type=Path, default=None)
    parser.add_argument("--sources", type=Path, default=None)
    args = parser.parse_args(argv)
    try:
        csv_text, summary = export_review_worksheet(
            args.corpus_annotations,
            include_superseded=args.include_superseded,
            annotation_type=args.annotation_type,
            segments_path=args.segments,
            artifacts_path=args.artifacts,
            sources_path=args.sources,
        )
    except CorpusReviewWorksheetError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    if args.output is not None:
        args.output.write_text(csv_text, encoding="utf-8")
    else:
        sys.stdout.write(csv_text)
    print(json.dumps({"ok": True, "summary": summary}, indent=2, sort_keys=True), file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
