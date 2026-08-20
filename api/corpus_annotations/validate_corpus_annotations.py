"""Validate corpus_annotations_v1 tables (structure + optional segment chain)."""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

from corpus_annotations.event_timestamps import (
    parse_event_timestamp,
    validate_event_timestamp_field,
)
from corpus_segments.validate_corpus_segments import (
    SEGMENT_ID_RE,
    CorpusSegmentValidationError,
    validate_corpus_segments,
)

SCHEMA_VERSION = "corpus_annotations_v1"

ANNOTATION_ID_RE = re.compile(r"^cann_[a-z0-9]+(?:_[a-z0-9]+)*$")

ALLOWED_ANNOTATION_TYPES = {
    "transcript_raw",
    "transcript_normalized",
    "translation",
    "gloss",
    "orthography_note",
}

TRANSCRIPT_TYPES = {"transcript_raw", "transcript_normalized"}

ALLOWED_CREATION_METHODS = {
    "manual_transcription",
    "subtitle_import",
    "asr",
    "manual_translation",
    "machine_translation",
    "normalization",
    "llm_assisted",
    "manual_annotation",
    "import",
    "other",
}

MACHINE_CREATION_METHODS = {"asr", "machine_translation", "llm_assisted"}

ALLOWED_SCRIPTS = {"Latn", "Nkoo", "Arab", "mixed", "unknown"}
ALLOWED_CONFIDENCE = {"unknown", "low", "medium", "high"}

REQUIRED_FIELDS = {
    "schema_version",
    "annotation_id",
    "segment_id",
    "annotation_type",
    "content",
    "created_at",
    "creation_method",
    "created_by",
}

OPTIONAL_STRING_FIELDS = {
    "content_language",
    "script",
    "tool_name",
    "tool_version",
    "model_name",
    "model_version",
    "supersedes_annotation_id",
    "notes",
}

OPTIONAL_STRING_ARRAY_FIELDS = {
    "derived_from_annotation_ids",
}

OPTIONAL_OBJECT_ARRAY_FIELDS = {
    "uncertain_spans",
}

ALLOWED_FIELDS = (
    REQUIRED_FIELDS
    | OPTIONAL_STRING_FIELDS
    | OPTIONAL_STRING_ARRAY_FIELDS
    | OPTIONAL_OBJECT_ARRAY_FIELDS
)

FORBIDDEN_FIELDS = {
    "review_status",
    "accepted",
    "approved",
    "published",
    "promotion_status",
    "dictionary_candidate",
    "headword_candidate",
    "alias_candidate",
    "usable",
}

UNCERTAIN_SPAN_ALLOWED_FIELDS = {
    "start_char",
    "end_char",
    "reason",
    "surface_form",
    "alternatives",
    "confidence",
}


class CorpusAnnotationValidationError(ValueError):
    """Raised when a corpus annotation table is invalid."""


@dataclass(frozen=True)
class CorpusAnnotationRow:
    row: dict[str, Any]
    line_number: int

    @property
    def annotation_id(self) -> str:
        return str(self.row.get("annotation_id", ""))

    @property
    def segment_id(self) -> str:
        return str(self.row.get("segment_id", ""))


@dataclass(frozen=True)
class CorpusAnnotationValidationResult:
    rows: list[CorpusAnnotationRow]
    schema_versions: list[str]
    summary: dict[str, int] = field(default_factory=dict)


def _err(path: Path, line_number: int, message: str) -> CorpusAnnotationValidationError:
    return CorpusAnnotationValidationError(f"{path}:{line_number}: {message}")


def _require_non_empty_string(row: dict[str, Any], field_name: str, path: Path, line: int) -> str:
    value = row.get(field_name)
    if not isinstance(value, str) or not value.strip():
        raise _err(path, line, f"{field_name} must be a non-empty string")
    return value


def _parse_timestamp_for_compare(value: str) -> datetime:
    return parse_event_timestamp(value, field_name="timestamp")


def _validate_uncertain_spans(
    content: str,
    spans: Any,
    path: Path,
    line: int,
) -> None:
    if not isinstance(spans, list):
        raise _err(path, line, "uncertain_spans must be an array")
    content_len = len(content)  # Unicode code points (Python 3 str)
    for index, span in enumerate(spans):
        prefix = f"uncertain_spans[{index}]"
        if not isinstance(span, dict):
            raise _err(path, line, f"{prefix} must be an object")
        unknown = sorted(set(span) - UNCERTAIN_SPAN_ALLOWED_FIELDS)
        if unknown:
            raise _err(path, line, f"{prefix} unknown fields: {', '.join(unknown)}")
        if "start_char" not in span or "end_char" not in span:
            raise _err(path, line, f"{prefix} requires start_char and end_char")
        start = span["start_char"]
        end = span["end_char"]
        if isinstance(start, bool) or not isinstance(start, int):
            raise _err(path, line, f"{prefix}.start_char must be an integer")
        if isinstance(end, bool) or not isinstance(end, int):
            raise _err(path, line, f"{prefix}.end_char must be an integer")
        if start < 0:
            raise _err(path, line, f"{prefix}.start_char must be >= 0")
        if end <= start:
            raise _err(path, line, f"{prefix}.end_char must be > start_char")
        if end > content_len:
            raise _err(
                path,
                line,
                f"{prefix}.end_char exceeds Unicode content length ({content_len})",
            )
        if "reason" in span and not isinstance(span["reason"], str):
            raise _err(path, line, f"{prefix}.reason must be a string")
        if "surface_form" in span:
            surface = span["surface_form"]
            if not isinstance(surface, str):
                raise _err(path, line, f"{prefix}.surface_form must be a string")
            expected = content[start:end]
            if surface != expected:
                raise _err(
                    path,
                    line,
                    f"{prefix}.surface_form must equal content[{start}:{end}]",
                )
        if "alternatives" in span:
            alternatives = span["alternatives"]
            if not isinstance(alternatives, list) or not all(
                isinstance(item, str) and item.strip() for item in alternatives
            ):
                raise _err(
                    path,
                    line,
                    f"{prefix}.alternatives must be an array of non-empty strings",
                )
        if "confidence" in span:
            confidence = span["confidence"]
            if confidence not in ALLOWED_CONFIDENCE:
                raise _err(path, line, f"{prefix}.confidence invalid: {confidence!r}")


def validate_corpus_annotation_row(row: dict[str, Any], path: Path, line_number: int) -> None:
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

    annotation_id = _require_non_empty_string(row, "annotation_id", path, line_number)
    if not ANNOTATION_ID_RE.match(annotation_id):
        raise _err(
            path,
            line_number,
            "annotation_id must match ^cann_[a-z0-9]+(?:_[a-z0-9]+)*$",
        )

    segment_id = _require_non_empty_string(row, "segment_id", path, line_number)
    if not SEGMENT_ID_RE.match(segment_id):
        raise _err(
            path,
            line_number,
            "segment_id must match ^cseg_[a-z0-9]+(?:_[a-z0-9]+)*$",
        )

    annotation_type = _require_non_empty_string(row, "annotation_type", path, line_number)
    if annotation_type not in ALLOWED_ANNOTATION_TYPES:
        raise _err(path, line_number, f"unsupported annotation_type: {annotation_type!r}")

    content = row.get("content")
    if not isinstance(content, str) or not content:
        raise _err(path, line_number, "content must be a non-empty string")

    created_at = _require_non_empty_string(row, "created_at", path, line_number)
    validate_event_timestamp_field(
        "created_at", created_at, path, line_number, error_factory=_err
    )

    creation_method = _require_non_empty_string(row, "creation_method", path, line_number)
    if creation_method not in ALLOWED_CREATION_METHODS:
        raise _err(path, line_number, f"unsupported creation_method: {creation_method!r}")

    _require_non_empty_string(row, "created_by", path, line_number)

    for field_name in OPTIONAL_STRING_FIELDS:
        if field_name not in row:
            continue
        value = row[field_name]
        if value is None or not isinstance(value, str):
            raise _err(path, line_number, f"{field_name} must be a string")

    if "script" in row and row["script"] not in ALLOWED_SCRIPTS:
        raise _err(path, line_number, f"unsupported script: {row['script']!r}")

    if annotation_type == "translation":
        language = row.get("content_language")
        if not isinstance(language, str) or not language.strip():
            raise _err(
                path,
                line_number,
                "content_language is required for annotation_type=translation",
            )

    tool_name = row.get("tool_name")
    tool_version = row.get("tool_version")
    model_name = row.get("model_name")
    model_version = row.get("model_version")
    if tool_version is not None and (
        not isinstance(tool_name, str) or not tool_name.strip()
    ):
        raise _err(path, line_number, "tool_version requires non-empty tool_name")
    if model_version is not None and (
        not isinstance(model_name, str) or not model_name.strip()
    ):
        raise _err(path, line_number, "model_version requires non-empty model_name")

    if creation_method in MACHINE_CREATION_METHODS:
        has_tool = isinstance(tool_name, str) and tool_name.strip()
        has_model = isinstance(model_name, str) and model_name.strip()
        if not has_tool and not has_model:
            raise _err(
                path,
                line_number,
                f"creation_method={creation_method!r} requires tool_name or model_name",
            )

    parent_ids: list[str] = []
    if "derived_from_annotation_ids" in row:
        parents = row["derived_from_annotation_ids"]
        if not isinstance(parents, list) or not all(isinstance(item, str) for item in parents):
            raise _err(
                path,
                line_number,
                "derived_from_annotation_ids must be an array of strings",
            )
        if any(not item.strip() for item in parents):
            raise _err(
                path,
                line_number,
                "derived_from_annotation_ids entries must be non-empty",
            )
        if len(parents) != len(set(parents)):
            raise _err(
                path,
                line_number,
                "derived_from_annotation_ids must not contain duplicates",
            )
        for parent_id in parents:
            if not ANNOTATION_ID_RE.match(parent_id):
                raise _err(
                    path,
                    line_number,
                    "derived_from_annotation_ids entry must match annotation_id syntax: "
                    f"{parent_id!r}",
                )
            if parent_id == annotation_id:
                raise _err(
                    path,
                    line_number,
                    "derived_from_annotation_ids must not self-reference",
                )
        parent_ids = parents

    if annotation_type == "transcript_normalized" and not parent_ids:
        raise _err(
            path,
            line_number,
            "transcript_normalized requires non-empty derived_from_annotation_ids",
        )

    if "supersedes_annotation_id" in row:
        superseded = row["supersedes_annotation_id"]
        if not isinstance(superseded, str) or not superseded.strip():
            raise _err(path, line_number, "supersedes_annotation_id must be a non-empty string")
        if not ANNOTATION_ID_RE.match(superseded):
            raise _err(
                path,
                line_number,
                "supersedes_annotation_id must match annotation_id syntax",
            )
        if superseded == annotation_id:
            raise _err(path, line_number, "supersedes_annotation_id must not self-reference")

    if "uncertain_spans" in row:
        _validate_uncertain_spans(content, row["uncertain_spans"], path, line_number)


def read_corpus_annotation_rows(path: Path) -> list[CorpusAnnotationRow]:
    rows: list[CorpusAnnotationRow] = []
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
            rows.append(CorpusAnnotationRow(row=payload, line_number=line_number))
    return rows


def _detect_derivation_cycle(
    rows_by_id: dict[str, CorpusAnnotationRow],
    path: Path,
) -> None:
    visiting: set[str] = set()
    visited: set[str] = set()

    def visit(node_id: str, stack: list[str]) -> None:
        if node_id in visited:
            return
        if node_id in visiting:
            cycle = " -> ".join(stack[stack.index(node_id) :] + [node_id])
            raise CorpusAnnotationValidationError(
                f"{path}: derivation cycle detected: {cycle}"
            )
        visiting.add(node_id)
        row = rows_by_id.get(node_id)
        if row is not None:
            parents = row.row.get("derived_from_annotation_ids") or []
            if isinstance(parents, list):
                for parent_id in parents:
                    if isinstance(parent_id, str):
                        visit(parent_id, stack + [node_id])
        visiting.remove(node_id)
        visited.add(node_id)

    for annotation_id in rows_by_id:
        visit(annotation_id, [])


def _detect_supersession_cycle(
    rows_by_id: dict[str, CorpusAnnotationRow],
    path: Path,
) -> None:
    visiting: set[str] = set()
    visited: set[str] = set()

    def visit(node_id: str, stack: list[str]) -> None:
        if node_id in visited:
            return
        if node_id in visiting:
            cycle = " -> ".join(stack[stack.index(node_id) :] + [node_id])
            raise CorpusAnnotationValidationError(
                f"{path}: supersession cycle detected: {cycle}"
            )
        visiting.add(node_id)
        row = rows_by_id.get(node_id)
        if row is not None:
            superseded_id = row.row.get("supersedes_annotation_id")
            if isinstance(superseded_id, str) and superseded_id:
                visit(superseded_id, stack + [node_id])
        visiting.remove(node_id)
        visited.add(node_id)

    for annotation_id in rows_by_id:
        visit(annotation_id, [])


def _provenance_neighbors(row: CorpusAnnotationRow) -> list[str]:
    neighbors: list[str] = []
    parents = row.row.get("derived_from_annotation_ids") or []
    if isinstance(parents, list):
        for parent_id in parents:
            if isinstance(parent_id, str) and parent_id:
                neighbors.append(parent_id)
    superseded_id = row.row.get("supersedes_annotation_id")
    if isinstance(superseded_id, str) and superseded_id:
        neighbors.append(superseded_id)
    return neighbors


def _detect_combined_provenance_cycle(
    rows_by_id: dict[str, CorpusAnnotationRow],
    path: Path,
) -> None:
    """Reject cycles across the union of derivation + supersession edges."""
    visiting: set[str] = set()
    visited: set[str] = set()

    def visit(node_id: str, stack: list[str]) -> None:
        if node_id in visited:
            return
        if node_id in visiting:
            cycle = " -> ".join(stack[stack.index(node_id) :] + [node_id])
            raise CorpusAnnotationValidationError(
                f"{path}: combined derivation/supersession cycle detected: {cycle}"
            )
        visiting.add(node_id)
        row = rows_by_id.get(node_id)
        if row is not None:
            for neighbor in _provenance_neighbors(row):
                visit(neighbor, stack + [node_id])
        visiting.remove(node_id)
        visited.add(node_id)

    for annotation_id in rows_by_id:
        visit(annotation_id, [])


def find_supersession_leaves(
    rows: list[CorpusAnnotationRow] | list[dict[str, Any]],
) -> list[str]:
    """Return annotation_ids that are not superseded by any other annotation.

    Deterministic sorted order. Multiple leaves may exist for competing
    same-type revisions. Chronology does not select a winner.
    """
    normalized: list[CorpusAnnotationRow] = []
    for item in rows:
        if isinstance(item, CorpusAnnotationRow):
            normalized.append(item)
        elif isinstance(item, dict):
            normalized.append(CorpusAnnotationRow(row=item, line_number=0))
        else:
            raise TypeError("rows must be CorpusAnnotationRow or dict objects")

    superseded_targets: set[str] = set()
    for item in normalized:
        target = item.row.get("supersedes_annotation_id")
        if isinstance(target, str) and target:
            superseded_targets.add(target)

    leaves = [
        item.annotation_id
        for item in normalized
        if item.annotation_id and item.annotation_id not in superseded_targets
    ]
    return sorted(leaves)


def validate_corpus_annotations(
    path: Path,
    *,
    segments_path: Path | None = None,
    artifacts_path: Path | None = None,
    sources_path: Path | None = None,
) -> CorpusAnnotationValidationResult:
    if (artifacts_path is not None or sources_path is not None) and segments_path is None:
        raise CorpusAnnotationValidationError(
            "--artifacts/--sources require --segments so the annotation→segment "
            "chain can be validated"
        )

    known_segment_ids: set[str] | None = None
    if segments_path is not None:
        try:
            segment_result = validate_corpus_segments(
                segments_path,
                artifacts_path=artifacts_path,
                sources_path=sources_path,
            )
        except CorpusSegmentValidationError as exc:
            raise CorpusAnnotationValidationError(
                f"segments table validation failed ({segments_path}): {exc}"
            ) from exc
        known_segment_ids = {row.segment_id for row in segment_result.rows}

    rows = read_corpus_annotation_rows(path)
    seen_ids: dict[str, int] = {}
    schema_versions: list[str] = []
    rows_by_id: dict[str, CorpusAnnotationRow] = {}

    for item in rows:
        validate_corpus_annotation_row(item.row, path, item.line_number)
        annotation_id = item.annotation_id
        if annotation_id in seen_ids:
            raise _err(
                path,
                item.line_number,
                f"duplicate annotation_id {annotation_id!r} "
                f"(first seen on line {seen_ids[annotation_id]})",
            )
        seen_ids[annotation_id] = item.line_number
        rows_by_id[annotation_id] = item
        schema_versions.append(str(item.row["schema_version"]))
        if known_segment_ids is not None and item.segment_id not in known_segment_ids:
            raise _err(
                path,
                item.line_number,
                f"unknown segment_id {item.segment_id!r} (not found in {segments_path})",
            )

    for item in rows:
        parents = item.row.get("derived_from_annotation_ids") or []
        if isinstance(parents, list):
            for parent_id in parents:
                parent = rows_by_id.get(parent_id)
                if parent is None:
                    raise _err(
                        path,
                        item.line_number,
                        f"unknown derived_from_annotation_id {parent_id!r}",
                    )
                if parent.segment_id != item.segment_id:
                    raise _err(
                        path,
                        item.line_number,
                        "derived_from_annotation_ids must reference the same segment "
                        f"(parent {parent_id!r} has segment {parent.segment_id!r})",
                    )
                if item.row.get("annotation_type") == "transcript_normalized":
                    parent_type = parent.row.get("annotation_type")
                    if parent_type not in TRANSCRIPT_TYPES:
                        raise _err(
                            path,
                            item.line_number,
                            "transcript_normalized must derive from transcript_raw "
                            f"or transcript_normalized (parent {parent_id!r} is "
                            f"{parent_type!r})",
                        )
                item_created = _parse_timestamp_for_compare(str(item.row["created_at"]))
                parent_created = _parse_timestamp_for_compare(str(parent.row["created_at"]))
                if item_created < parent_created:
                    raise _err(
                        path,
                        item.line_number,
                        "derived annotation created_at must be >= parent "
                        f"created_at ({parent_id!r})",
                    )

        superseded_id = item.row.get("supersedes_annotation_id")
        if isinstance(superseded_id, str) and superseded_id:
            superseded = rows_by_id.get(superseded_id)
            if superseded is None:
                raise _err(
                    path,
                    item.line_number,
                    f"unknown supersedes_annotation_id {superseded_id!r}",
                )
            if superseded.segment_id != item.segment_id:
                raise _err(
                    path,
                    item.line_number,
                    "supersedes_annotation_id must reference the same segment "
                    f"(target {superseded_id!r} has segment {superseded.segment_id!r})",
                )
            item_type = item.row.get("annotation_type")
            superseded_type = superseded.row.get("annotation_type")
            if item_type != superseded_type:
                raise _err(
                    path,
                    item.line_number,
                    "supersedes_annotation_id must preserve annotation_type "
                    f"(got {item_type!r}, target {superseded_id!r} is {superseded_type!r})",
                )
            item_created = _parse_timestamp_for_compare(str(item.row["created_at"]))
            superseded_created = _parse_timestamp_for_compare(
                str(superseded.row["created_at"])
            )
            if item_created < superseded_created:
                raise _err(
                    path,
                    item.line_number,
                    "superseding annotation created_at must be >= superseded "
                    f"annotation created_at ({superseded_id!r})",
                )

    _detect_derivation_cycle(rows_by_id, path)
    _detect_supersession_cycle(rows_by_id, path)
    _detect_combined_provenance_cycle(rows_by_id, path)

    type_counts: dict[str, int] = {}
    for item in rows:
        annotation_type = str(item.row["annotation_type"])
        type_counts[annotation_type] = type_counts.get(annotation_type, 0) + 1

    summary = {
        "row_count": len(rows),
        "unique_annotation_ids": len(seen_ids),
        "segment_cross_reference": 1 if known_segment_ids is not None else 0,
        "artifact_cross_reference": 1 if artifacts_path is not None else 0,
        "source_cross_reference": 1 if sources_path is not None else 0,
        **{f"annotation_type.{key}": value for key, value in sorted(type_counts.items())},
    }
    return CorpusAnnotationValidationResult(
        rows=rows,
        schema_versions=sorted(set(schema_versions)),
        summary=summary,
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Validate corpus_annotations_v1 JSONL (structure only)."
    )
    parser.add_argument("corpus_annotations", type=Path)
    parser.add_argument(
        "--segments",
        type=Path,
        default=None,
        help="Optional corpus_segments_v1.jsonl (fully validated) for segment_id refs",
    )
    parser.add_argument(
        "--artifacts",
        type=Path,
        default=None,
        help="Optional artifacts file; requires --segments",
    )
    parser.add_argument(
        "--sources",
        type=Path,
        default=None,
        help="Optional sources file; requires --segments and --artifacts",
    )
    parser.add_argument("--output-report", type=Path, default=None)
    args = parser.parse_args(argv)

    try:
        result = validate_corpus_annotations(
            args.corpus_annotations,
            segments_path=args.segments,
            artifacts_path=args.artifacts,
            sources_path=args.sources,
        )
    except CorpusAnnotationValidationError as exc:
        print(f"corpus_annotations validation FAILED: {exc}", file=sys.stderr)
        return 1

    print("corpus_annotations validation PASSED")
    print(f"rows={result.summary.get('row_count', 0)}")
    print(f"schema_versions={','.join(result.schema_versions) or '(none)'}")
    if args.output_report is not None:
        payload = {
            "ok": True,
            "schema_version": SCHEMA_VERSION,
            "summary": result.summary,
            "schema_versions": result.schema_versions,
            "annotation_ids": [row.annotation_id for row in result.rows],
        }
        args.output_report.parent.mkdir(parents=True, exist_ok=True)
        args.output_report.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
