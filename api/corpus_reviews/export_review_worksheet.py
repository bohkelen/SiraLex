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
from corpus_reviews.annotation_fingerprint import annotation_fingerprint_sha256

WORKSHEET_SCHEMA = "corpus_annotation_review_worksheet_v1"

CONTEXT_COLUMNS = [
    "worksheet_schema",
    "annotation_id",
    "annotation_type",
    "segment_id",
    "content",
    "content_language",
    "script",
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

WORKSHEET_COLUMNS = CONTEXT_COLUMNS + REVIEW_FILL_COLUMNS


class CorpusReviewWorksheetError(ValueError):
    """Raised when worksheet export fails."""


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


def build_worksheet_rows(
    annotation_rows: list[CorpusAnnotationRow],
    *,
    include_superseded: bool = False,
    annotation_type: str | None = None,
) -> list[dict[str, str]]:
    leaf_ids = set(find_supersession_leaves(annotation_rows))
    competing = _competing_leaf_counts(annotation_rows, leaf_ids)

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
        worksheet_rows.append(
            {
                "worksheet_schema": WORKSHEET_SCHEMA,
                "annotation_id": item.annotation_id,
                "annotation_type": str(row.get("annotation_type", "")),
                "segment_id": item.segment_id,
                "content": str(row.get("content", "")),
                "content_language": str(row.get("content_language", "")),
                "script": str(row.get("script", "")),
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
        )
    return worksheet_rows


def worksheet_rows_to_csv(rows: list[dict[str, str]]) -> str:
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=WORKSHEET_COLUMNS, lineterminator="\n")
    writer.writeheader()
    for row in rows:
        writer.writerow({column: row.get(column, "") for column in WORKSHEET_COLUMNS})
    return buffer.getvalue()


def export_review_worksheet(
    annotations_path: Path,
    *,
    include_superseded: bool = False,
    annotation_type: str | None = None,
    segments_path: Path | None = None,
    artifacts_path: Path | None = None,
    sources_path: Path | None = None,
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

    rows = build_worksheet_rows(
        result.rows,
        include_superseded=include_superseded,
        annotation_type=annotation_type,
    )
    csv_text = worksheet_rows_to_csv(rows)
    leaf_count = sum(1 for row in rows if row["is_current_leaf"] == "true")
    summary = {
        "annotation_row_count": len(result.rows),
        "worksheet_row_count": len(rows),
        "current_leaf_rows": leaf_count,
        "include_superseded": 1 if include_superseded else 0,
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
        help="Optional filter to a single annotation_type",
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
