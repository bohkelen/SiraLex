"""Validate corpus_annotation_reviews_v1 tables (structure + optional annotation chain)."""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from corpus_annotations.event_timestamps import (
    parse_event_timestamp,
    validate_event_timestamp_field,
)
from corpus_annotations.validate_corpus_annotations import (
    ANNOTATION_ID_RE,
    CorpusAnnotationRow,
    CorpusAnnotationValidationError,
    validate_corpus_annotations,
)

SCHEMA_VERSION = "corpus_annotation_reviews_v1"

REVIEW_ID_RE = re.compile(r"^crev_[a-z0-9]+(?:_[a-z0-9]+)*$")

ALLOWED_DECISIONS = {"accepted", "rejected", "needs_more_evidence"}

ALLOWED_REVIEW_METHODS = {
    "manual_review",
    "trusted_speaker_review",
    "linguistic_review",
    "collaborative_review",
    "other",
}

ALLOWED_EVIDENCE_STRENGTH = {
    "unknown",
    "weak",
    "moderate",
    "strong",
    "very_strong",
}

ALLOWED_ISSUE_CODES = {
    "unclear_audio",
    "segment_boundary_problem",
    "speaker_overlap",
    "language_identity_uncertain",
    "orthography_uncertain",
    "unknown_word",
    "translation_uncertain",
    "meaning_uncertain",
    "code_switching",
    "rights_block",
    "needs_second_reviewer",
    "other",
}

REQUIRED_FIELDS = {
    "schema_version",
    "review_id",
    "annotation_id",
    "reviewer_id",
    "reviewed_at",
    "review_method",
    "decision",
}

OPTIONAL_STRING_FIELDS = {
    "evidence_strength",
    "review_notes",
    "supersedes_review_id",
}

OPTIONAL_STRING_ARRAY_FIELDS = {
    "evidence_refs",
    "issue_codes",
}

ALLOWED_FIELDS = REQUIRED_FIELDS | OPTIONAL_STRING_FIELDS | OPTIONAL_STRING_ARRAY_FIELDS

FORBIDDEN_FIELDS = {
    "promotion_status",
    "dictionary_candidate",
    "headword_candidate",
    "alias_candidate",
    "publish",
    "published",
    "bundle_id",
    "search_index_mapping",
    "approved",
    "accepted",
    "review_status",
    "usable",
}


class CorpusReviewValidationError(ValueError):
    """Raised when a corpus annotation review table is invalid."""


@dataclass(frozen=True)
class CorpusReviewRow:
    row: dict[str, Any]
    line_number: int

    @property
    def review_id(self) -> str:
        return str(self.row.get("review_id", ""))

    @property
    def annotation_id(self) -> str:
        return str(self.row.get("annotation_id", ""))

    @property
    def reviewer_id(self) -> str:
        return str(self.row.get("reviewer_id", ""))


@dataclass(frozen=True)
class CorpusReviewValidationResult:
    rows: list[CorpusReviewRow]
    schema_versions: list[str]
    summary: dict[str, int] = field(default_factory=dict)


def _err(path: Path, line_number: int, message: str) -> CorpusReviewValidationError:
    return CorpusReviewValidationError(f"{path}:{line_number}: {message}")


def _require_non_empty_string(row: dict[str, Any], field_name: str, path: Path, line: int) -> str:
    value = row.get(field_name)
    if not isinstance(value, str) or not value.strip():
        raise _err(path, line, f"{field_name} must be a non-empty string")
    return value


def _validate_string_array(
    row: dict[str, Any],
    field_name: str,
    path: Path,
    line: int,
    *,
    allowed: set[str] | None = None,
) -> None:
    if field_name not in row:
        return
    value = row[field_name]
    if not isinstance(value, list):
        raise _err(path, line, f"{field_name} must be an array of strings")
    seen: set[str] = set()
    for item in value:
        if not isinstance(item, str) or not item.strip():
            raise _err(path, line, f"{field_name} entries must be non-empty strings")
        if item in seen:
            raise _err(path, line, f"{field_name} contains duplicate {item!r}")
        seen.add(item)
        if allowed is not None and item not in allowed:
            raise _err(path, line, f"unsupported {field_name} value {item!r}")


def validate_corpus_review_row(row: dict[str, Any], path: Path, line_number: int) -> None:
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
            f"schema_version must be {SCHEMA_VERSION!r} (got {schema_version!r})",
        )

    review_id = _require_non_empty_string(row, "review_id", path, line_number)
    if not REVIEW_ID_RE.match(review_id):
        raise _err(path, line_number, f"review_id must match {REVIEW_ID_RE.pattern}")

    annotation_id = _require_non_empty_string(row, "annotation_id", path, line_number)
    if not ANNOTATION_ID_RE.match(annotation_id):
        raise _err(
            path,
            line_number,
            f"annotation_id must match {ANNOTATION_ID_RE.pattern}",
        )

    _require_non_empty_string(row, "reviewer_id", path, line_number)
    reviewed_at = _require_non_empty_string(row, "reviewed_at", path, line_number)
    validate_event_timestamp_field(
        "reviewed_at", reviewed_at, path, line_number, error_factory=_err
    )

    review_method = _require_non_empty_string(row, "review_method", path, line_number)
    if review_method not in ALLOWED_REVIEW_METHODS:
        raise _err(path, line_number, f"unsupported review_method {review_method!r}")

    decision = _require_non_empty_string(row, "decision", path, line_number)
    if decision not in ALLOWED_DECISIONS:
        raise _err(path, line_number, f"unsupported decision {decision!r}")

    if "evidence_strength" in row:
        strength = _require_non_empty_string(row, "evidence_strength", path, line_number)
        if strength not in ALLOWED_EVIDENCE_STRENGTH:
            raise _err(path, line_number, f"unsupported evidence_strength {strength!r}")

    if "review_notes" in row:
        notes = row["review_notes"]
        if not isinstance(notes, str) or not notes.strip():
            raise _err(path, line_number, "review_notes must be a non-empty string when present")

    if "supersedes_review_id" in row:
        supersedes = _require_non_empty_string(row, "supersedes_review_id", path, line_number)
        if not REVIEW_ID_RE.match(supersedes):
            raise _err(
                path,
                line_number,
                f"supersedes_review_id must match {REVIEW_ID_RE.pattern}",
            )
        if supersedes == review_id:
            raise _err(path, line_number, "self-supersession is not allowed")

    _validate_string_array(row, "evidence_refs", path, line_number)
    _validate_string_array(row, "issue_codes", path, line_number, allowed=ALLOWED_ISSUE_CODES)


def read_corpus_review_rows(path: Path) -> list[CorpusReviewRow]:
    rows: list[CorpusReviewRow] = []
    with path.open(encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            text = line.strip()
            if not text:
                continue
            try:
                payload = json.loads(text)
            except json.JSONDecodeError as exc:
                raise _err(path, line_number, f"invalid JSON: {exc}") from exc
            if not isinstance(payload, dict):
                raise _err(path, line_number, "expected JSON object")
            rows.append(CorpusReviewRow(row=payload, line_number=line_number))
    return rows


def _normalize_review_rows(
    rows: list[CorpusReviewRow] | list[dict[str, Any]],
    *,
    path: Path,
) -> list[CorpusReviewRow]:
    normalized: list[CorpusReviewRow] = []
    for index, item in enumerate(rows, start=1):
        if isinstance(item, CorpusReviewRow):
            normalized.append(item)
        elif isinstance(item, dict):
            normalized.append(CorpusReviewRow(row=item, line_number=index))
        else:
            raise TypeError("rows must be CorpusReviewRow or dict objects")
    # Preserve explicit line numbers from CorpusReviewRow; path is for errors only.
    _ = path
    return normalized


def _detect_review_supersession_cycle(
    rows_by_id: dict[str, CorpusReviewRow],
    path: Path,
) -> None:
    visiting: set[str] = set()
    visited: set[str] = set()

    def visit(node_id: str, stack: list[str]) -> None:
        if node_id in visited:
            return
        if node_id in visiting:
            cycle = " -> ".join(stack[stack.index(node_id) :] + [node_id])
            raise CorpusReviewValidationError(
                f"{path}: review supersession cycle detected: {cycle}"
            )
        visiting.add(node_id)
        row = rows_by_id.get(node_id)
        if row is not None:
            superseded_id = row.row.get("supersedes_review_id")
            if isinstance(superseded_id, str) and superseded_id:
                visit(superseded_id, stack + [node_id])
        visiting.remove(node_id)
        visited.add(node_id)

    for review_id in rows_by_id:
        visit(review_id, [])


def validate_corpus_review_table(
    rows: list[CorpusReviewRow] | list[dict[str, Any]],
    *,
    path: Path,
    annotations_by_id: dict[str, CorpusAnnotationRow] | None = None,
    annotation_cross_reference: bool = False,
    segment_cross_reference: bool = False,
    artifact_cross_reference: bool = False,
    source_cross_reference: bool = False,
) -> CorpusReviewValidationResult:
    """Canonical table-level validation for file or in-memory preview rows."""
    normalized = _normalize_review_rows(rows, path=path)
    seen_ids: dict[str, int] = {}
    schema_versions: list[str] = []
    rows_by_id: dict[str, CorpusReviewRow] = {}

    for item in normalized:
        validate_corpus_review_row(item.row, path, item.line_number)
        review_id = item.review_id
        if review_id in seen_ids:
            raise _err(
                path,
                item.line_number,
                f"duplicate review_id {review_id!r} "
                f"(first seen on line {seen_ids[review_id]})",
            )
        seen_ids[review_id] = item.line_number
        rows_by_id[review_id] = item
        schema_versions.append(str(item.row["schema_version"]))
        if annotations_by_id is not None:
            annotation = annotations_by_id.get(item.annotation_id)
            if annotation is None:
                raise _err(
                    path,
                    item.line_number,
                    f"unknown annotation_id {item.annotation_id!r}",
                )
            reviewed_at = parse_event_timestamp(
                str(item.row["reviewed_at"]), field_name="reviewed_at"
            )
            created_at = parse_event_timestamp(
                str(annotation.row["created_at"]), field_name="created_at"
            )
            if reviewed_at < created_at:
                raise _err(
                    path,
                    item.line_number,
                    "reviewed_at must be >= annotation created_at "
                    f"({item.annotation_id!r})",
                )

    for item in normalized:
        superseded_id = item.row.get("supersedes_review_id")
        if not isinstance(superseded_id, str) or not superseded_id:
            continue
        superseded = rows_by_id.get(superseded_id)
        if superseded is None:
            raise _err(
                path,
                item.line_number,
                f"unknown supersedes_review_id {superseded_id!r}",
            )
        if superseded.annotation_id != item.annotation_id:
            raise _err(
                path,
                item.line_number,
                "supersedes_review_id must reference the same annotation_id "
                f"(target {superseded_id!r} has annotation "
                f"{superseded.annotation_id!r})",
            )
        if superseded.reviewer_id != item.reviewer_id:
            raise _err(
                path,
                item.line_number,
                "supersedes_review_id must reference the same reviewer_id "
                f"(target {superseded_id!r} has reviewer {superseded.reviewer_id!r})",
            )
        item_reviewed = parse_event_timestamp(
            str(item.row["reviewed_at"]), field_name="reviewed_at"
        )
        superseded_reviewed = parse_event_timestamp(
            str(superseded.row["reviewed_at"]), field_name="reviewed_at"
        )
        if item_reviewed < superseded_reviewed:
            raise _err(
                path,
                item.line_number,
                "superseding review reviewed_at must be >= superseded "
                f"reviewed_at ({superseded_id!r})",
            )

    _detect_review_supersession_cycle(rows_by_id, path)

    decision_counts: dict[str, int] = {}
    for item in normalized:
        decision = str(item.row["decision"])
        decision_counts[decision] = decision_counts.get(decision, 0) + 1

    summary = {
        "row_count": len(normalized),
        "unique_review_ids": len(seen_ids),
        "annotation_cross_reference": 1 if annotation_cross_reference else 0,
        "segment_cross_reference": 1 if segment_cross_reference else 0,
        "artifact_cross_reference": 1 if artifact_cross_reference else 0,
        "source_cross_reference": 1 if source_cross_reference else 0,
        **{f"decision.{key}": value for key, value in sorted(decision_counts.items())},
    }
    return CorpusReviewValidationResult(
        rows=normalized,
        schema_versions=sorted(set(schema_versions)),
        summary=summary,
    )


def validate_corpus_reviews(
    path: Path,
    *,
    annotations_path: Path | None = None,
    segments_path: Path | None = None,
    artifacts_path: Path | None = None,
    sources_path: Path | None = None,
) -> CorpusReviewValidationResult:
    if (
        segments_path is not None or artifacts_path is not None or sources_path is not None
    ) and annotations_path is None:
        raise CorpusReviewValidationError(
            "--segments/--artifacts/--sources require --annotations so the "
            "review→annotation chain can be validated"
        )

    annotations_by_id: dict[str, CorpusAnnotationRow] | None = None
    if annotations_path is not None:
        try:
            annotation_result = validate_corpus_annotations(
                annotations_path,
                segments_path=segments_path,
                artifacts_path=artifacts_path,
                sources_path=sources_path,
            )
        except CorpusAnnotationValidationError as exc:
            raise CorpusReviewValidationError(
                f"annotations table validation failed ({annotations_path}): {exc}"
            ) from exc
        annotations_by_id = {row.annotation_id: row for row in annotation_result.rows}

    rows = read_corpus_review_rows(path)
    return validate_corpus_review_table(
        rows,
        path=path,
        annotations_by_id=annotations_by_id,
        annotation_cross_reference=annotations_path is not None,
        segment_cross_reference=segments_path is not None,
        artifact_cross_reference=artifacts_path is not None,
        source_cross_reference=sources_path is not None,
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Validate corpus_annotation_reviews_v1 JSONL (structure only)."
    )
    parser.add_argument("corpus_reviews", type=Path)
    parser.add_argument(
        "--annotations",
        type=Path,
        default=None,
        help="Optional corpus_annotations_v1.jsonl (fully validated) for annotation_id refs",
    )
    parser.add_argument(
        "--segments",
        type=Path,
        default=None,
        help="Optional segments file; requires --annotations",
    )
    parser.add_argument(
        "--artifacts",
        type=Path,
        default=None,
        help="Optional artifacts file; requires --annotations",
    )
    parser.add_argument(
        "--sources",
        type=Path,
        default=None,
        help="Optional sources file; requires --annotations",
    )
    args = parser.parse_args(argv)
    try:
        result = validate_corpus_reviews(
            args.corpus_reviews,
            annotations_path=args.annotations,
            segments_path=args.segments,
            artifacts_path=args.artifacts,
            sources_path=args.sources,
        )
    except CorpusReviewValidationError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    print(json.dumps({"ok": True, "summary": result.summary}, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
