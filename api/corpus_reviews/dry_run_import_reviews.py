"""Dry-run import of completed corpus annotation review worksheets."""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from corpus_annotations.validate_corpus_annotations import (
    CorpusAnnotationValidationError,
    validate_corpus_annotations,
)
from corpus_reviews.export_review_worksheet import (
    CONTEXT_COLUMNS,
    REVIEW_FILL_COLUMNS,
    WORKSHEET_COLUMNS,
    WORKSHEET_SCHEMA,
    build_worksheet_rows,
)
from corpus_reviews.validate_corpus_reviews import (
    ALLOWED_DECISIONS,
    REVIEW_ID_RE,
    SCHEMA_VERSION,
    CorpusReviewValidationError,
    validate_corpus_review_row,
    validate_corpus_review_table,
)

REVIEW_INPUT_COLUMNS = set(REVIEW_FILL_COLUMNS)


class CorpusReviewDryRunError(ValueError):
    """Raised when dry-run worksheet import fails hard."""


@dataclass
class CorpusReviewDryRunResult:
    preview_rows: list[dict[str, Any]] = field(default_factory=list)
    diagnostic_candidates: list[dict[str, Any]] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    summary: dict[str, int] = field(default_factory=dict)


def _split_multi(value: str) -> list[str]:
    text = value.strip()
    if not text:
        return []
    parts = re.split(r"[;|]", text)
    return [part.strip() for part in parts if part.strip()]


def _sanitize_id_fragment(value: str) -> str:
    lowered = value.strip().lower()
    cleaned = re.sub(r"[^a-z0-9]+", "_", lowered).strip("_")
    return cleaned or "x"


def generate_review_id(preview: dict[str, Any]) -> str:
    """Deterministic review_id from immutable review-creation fields (no review_id)."""
    digest_payload = {
        "annotation_id": preview.get("annotation_id"),
        "decision": preview.get("decision"),
        "evidence_refs": preview.get("evidence_refs") or [],
        "evidence_strength": preview.get("evidence_strength"),
        "issue_codes": preview.get("issue_codes") or [],
        "review_method": preview.get("review_method"),
        "review_notes": preview.get("review_notes"),
        "reviewed_at": preview.get("reviewed_at"),
        "reviewer_id": preview.get("reviewer_id"),
    }
    canonical = json.dumps(
        digest_payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False
    )
    digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()[:12]
    ann = _sanitize_id_fragment(str(preview.get("annotation_id", "")).removeprefix("cann_"))
    candidate = f"crev_{ann}_{digest}"
    if REVIEW_ID_RE.match(candidate):
        return candidate
    return f"crev_{_sanitize_id_fragment(ann)}_{digest}"


def _row_has_review_input(row: dict[str, str]) -> bool:
    return any(str(row.get(column, "")).strip() for column in REVIEW_INPUT_COLUMNS)


def dry_run_import_review_worksheet(
    worksheet_path: Path,
    annotations_path: Path,
    *,
    segments_path: Path | None = None,
    artifacts_path: Path | None = None,
    sources_path: Path | None = None,
    include_superseded: bool = False,
) -> CorpusReviewDryRunResult:
    try:
        annotation_result = validate_corpus_annotations(
            annotations_path,
            segments_path=segments_path,
            artifacts_path=artifacts_path,
            sources_path=sources_path,
        )
    except CorpusAnnotationValidationError as exc:
        raise CorpusReviewDryRunError(
            f"annotations table validation failed ({annotations_path}): {exc}"
        ) from exc

    annotations_by_id = {item.annotation_id: item for item in annotation_result.rows}
    expected_by_id = {
        row["annotation_id"]: row
        for row in build_worksheet_rows(
            annotation_result.rows,
            include_superseded=include_superseded,
        )
    }

    text = worksheet_path.read_text(encoding="utf-8")
    reader = csv.DictReader(io.StringIO(text))
    if reader.fieldnames is None:
        raise CorpusReviewDryRunError(f"{worksheet_path}: missing CSV header")

    header = list(reader.fieldnames)
    missing_columns = [column for column in WORKSHEET_COLUMNS if column not in header]
    if missing_columns:
        raise CorpusReviewDryRunError(
            f"{worksheet_path}: missing required columns: {', '.join(missing_columns)}"
        )
    unexpected = [column for column in header if column not in WORKSHEET_COLUMNS]
    if unexpected:
        raise CorpusReviewDryRunError(
            f"{worksheet_path}: unknown unexpected columns: {', '.join(unexpected)}"
        )

    result = CorpusReviewDryRunResult()
    rows_read = 0
    rows_skipped = 0
    decision_counts = {key: 0 for key in ALLOWED_DECISIONS}
    stale_subject_errors = 0
    stale_context_errors = 0
    unknown_annotation_errors = 0
    schema_errors = 0
    pending_previews: list[tuple[int, dict[str, Any]]] = []
    diagnostic_candidates: list[dict[str, Any]] = []

    for line_number, raw in enumerate(reader, start=2):
        rows_read += 1
        row = {key: (raw.get(key) or "").strip() for key in WORKSHEET_COLUMNS}

        worksheet_schema = row.get("worksheet_schema", "")
        if not worksheet_schema:
            schema_errors += 1
            result.errors.append(
                f"{worksheet_path}:{line_number}: missing worksheet_schema"
            )
            continue
        if worksheet_schema != WORKSHEET_SCHEMA:
            schema_errors += 1
            result.errors.append(
                f"{worksheet_path}:{line_number}: unsupported worksheet_schema "
                f"{worksheet_schema!r} (expected {WORKSHEET_SCHEMA!r})"
            )
            continue

        if not _row_has_review_input(row):
            # Still verify context integrity for unreviewed rows? Spec says dry-run
            # against unedited worksheet expects all skipped with 0 errors. Context
            # check for unreviewed rows ensures the worksheet wasn't tampered with
            # before human fill — validate context whenever annotation_id present.
            annotation_id = row["annotation_id"]
            expected = expected_by_id.get(annotation_id)
            if expected is None:
                unknown_annotation_errors += 1
                result.errors.append(
                    f"{worksheet_path}:{line_number}: unknown annotation_id "
                    f"{annotation_id!r}"
                )
                continue
            mismatched = [
                column
                for column in CONTEXT_COLUMNS
                if row.get(column, "") != expected.get(column, "")
            ]
            if mismatched:
                stale_context_errors += 1
                result.errors.append(
                    f"{worksheet_path}:{line_number}: FAIL STALE OR MODIFIED "
                    f"WORKSHEET CONTEXT ({', '.join(mismatched)})"
                )
                continue
            rows_skipped += 1
            continue

        annotation_id = row["annotation_id"]
        if not annotation_id:
            result.errors.append(f"{worksheet_path}:{line_number}: missing annotation_id")
            continue

        expected = expected_by_id.get(annotation_id)
        if expected is None or annotation_id not in annotations_by_id:
            unknown_annotation_errors += 1
            result.errors.append(
                f"{worksheet_path}:{line_number}: unknown annotation_id {annotation_id!r}"
            )
            continue

        mismatched = [
            column
            for column in CONTEXT_COLUMNS
            if row.get(column, "") != expected.get(column, "")
        ]
        if mismatched:
            stale_context_errors += 1
            if "annotation_fingerprint_sha256" in mismatched:
                stale_subject_errors += 1
                result.errors.append(
                    f"{worksheet_path}:{line_number}: FAIL STALE REVIEW SUBJECT "
                    f"(annotation_id={annotation_id!r})"
                )
            else:
                result.errors.append(
                    f"{worksheet_path}:{line_number}: FAIL STALE OR MODIFIED "
                    f"WORKSHEET CONTEXT ({', '.join(mismatched)})"
                )
            continue

        decision = row["review_decision"]
        reviewer_id = row["reviewer_id"]
        reviewed_at = row["reviewed_at"]
        review_method = row["review_method"]

        incomplete = [
            name
            for name, value in [
                ("review_decision", decision),
                ("reviewer_id", reviewer_id),
                ("reviewed_at", reviewed_at),
                ("review_method", review_method),
            ]
            if not value
        ]
        if incomplete:
            result.errors.append(
                f"{worksheet_path}:{line_number}: incomplete reviewer metadata: "
                f"{', '.join(incomplete)}"
            )
            continue

        preview: dict[str, Any] = {
            "schema_version": SCHEMA_VERSION,
            "annotation_id": annotation_id,
            "reviewer_id": reviewer_id,
            "reviewed_at": reviewed_at,
            "review_method": review_method,
            "decision": decision,
        }
        if row["evidence_strength"]:
            preview["evidence_strength"] = row["evidence_strength"]
        evidence_refs = _split_multi(row["evidence_refs"])
        if evidence_refs:
            preview["evidence_refs"] = evidence_refs
        issue_codes = _split_multi(row["issue_codes"])
        if issue_codes:
            preview["issue_codes"] = issue_codes
        if row["review_notes"]:
            preview["review_notes"] = row["review_notes"]

        review_id = row["review_id"] or generate_review_id(preview)
        preview["review_id"] = review_id

        try:
            validate_corpus_review_row(preview, worksheet_path, line_number)
        except CorpusReviewValidationError as exc:
            result.errors.append(str(exc))
            continue

        if decision in decision_counts:
            decision_counts[decision] += 1
        pending_previews.append((line_number, preview))
        diagnostic_candidates.append(preview)

    if not result.errors and pending_previews:
        try:
            validate_corpus_review_table(
                [preview for _, preview in pending_previews],
                path=worksheet_path,
                annotations_by_id=annotations_by_id,
                annotation_cross_reference=True,
                segment_cross_reference=segments_path is not None,
                artifact_cross_reference=artifacts_path is not None,
                source_cross_reference=sources_path is not None,
            )
        except CorpusReviewValidationError as exc:
            result.errors.append(str(exc))

    if not result.errors:
        result.preview_rows = [preview for _, preview in pending_previews]
    else:
        result.preview_rows = []
    result.diagnostic_candidates = diagnostic_candidates

    result.summary = {
        "rows_read": rows_read,
        "rows_skipped_unreviewed": rows_skipped,
        "preview_row_count": len(result.preview_rows),
        "diagnostic_candidate_count": len(diagnostic_candidates),
        "error_count": len(result.errors),
        "stale_fingerprint_errors": stale_subject_errors,
        "stale_context_errors": stale_context_errors,
        "unknown_annotation_errors": unknown_annotation_errors,
        "worksheet_schema_errors": schema_errors,
        **{f"decision.{key}": value for key, value in sorted(decision_counts.items())},
    }
    return result


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Dry-run convert a completed corpus review worksheet into preview "
            "corpus_annotation_reviews_v1 rows (no production write)."
        )
    )
    parser.add_argument("worksheet_csv", type=Path)
    parser.add_argument(
        "--annotations",
        type=Path,
        required=True,
        help="corpus_annotations_v1.jsonl used to validate subjects/fingerprints",
    )
    parser.add_argument("--segments", type=Path, default=None)
    parser.add_argument("--artifacts", type=Path, default=None)
    parser.add_argument("--sources", type=Path, default=None)
    parser.add_argument(
        "--include-superseded",
        action="store_true",
        help="Expected worksheet was exported with --include-superseded",
    )
    parser.add_argument(
        "--preview-jsonl",
        type=Path,
        default=None,
        help="Optional path to write preview review JSONL only if dry-run fully passes",
    )
    args = parser.parse_args(argv)
    try:
        result = dry_run_import_review_worksheet(
            args.worksheet_csv,
            args.annotations,
            segments_path=args.segments,
            artifacts_path=args.artifacts,
            sources_path=args.sources,
            include_superseded=args.include_superseded,
        )
    except CorpusReviewDryRunError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    ok = len(result.errors) == 0
    if args.preview_jsonl is not None:
        if not ok:
            print(
                "ERROR: refusing to write --preview-jsonl because dry-run has errors",
                file=sys.stderr,
            )
        else:
            with args.preview_jsonl.open("w", encoding="utf-8") as handle:
                for row in result.preview_rows:
                    handle.write(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n")

    payload = {
        "ok": ok,
        "summary": result.summary,
        "errors": result.errors,
        "preview_rows": result.preview_rows,
        "diagnostic_candidates": [] if ok else result.diagnostic_candidates,
    }
    print(json.dumps(payload, indent=2, sort_keys=True, ensure_ascii=False))
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
