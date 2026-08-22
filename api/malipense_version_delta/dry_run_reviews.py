"""Dry-run import of Malidaba delta review worksheets (no persistence)."""

from __future__ import annotations

import argparse
import csv
import io
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .compare import load_jsonl_records
from .export_worksheet import (
    ALLOWED_DECISIONS,
    ALLOWED_ISSUE_CODES,
    REVIEW_FILL_COLUMNS,
    SUPPORTED_WORKSHEET_SCHEMAS,
    WORKSHEET_SCHEMA_V1,
    WORKSHEET_SCHEMA_V2,
    build_worksheet_row,
    context_columns_for_schema,
    worksheet_columns_for_schema,
)
from .review_triage import QUEUE_NEW_HEADWORD, build_triage_in_memory

REVIEW_INPUT_COLUMNS = set(REVIEW_FILL_COLUMNS)


class MalidabaReviewDryRunError(ValueError):
    """Raised when dry-run worksheet import fails hard."""


@dataclass
class MalidabaReviewDryRunResult:
    preview_rows: list[dict[str, Any]] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    summary: dict[str, int] = field(default_factory=dict)


def _split_multi(value: str) -> list[str]:
    text = value.strip()
    if not text:
        return []
    parts = re.split(r"[;|]", text)
    return [part.strip() for part in parts if part.strip()]


def _row_has_review_input(row: dict[str, str]) -> bool:
    return any(str(row.get(column, "")).strip() for column in REVIEW_INPUT_COLUMNS)


def _detect_worksheet_schema(sample_rows: list[dict[str, str]]) -> str:
    schemas = {
        (row.get("worksheet_schema") or "").strip()
        for row in sample_rows
        if (row.get("worksheet_schema") or "").strip()
    }
    if len(schemas) > 1:
        supported = schemas & SUPPORTED_WORKSHEET_SCHEMAS
        if len(supported) == 1:
            return next(iter(supported))
        raise MalidabaReviewDryRunError(
            f"mixed worksheet_schema values in one file: {sorted(schemas)}"
        )
    if schemas and schemas <= SUPPORTED_WORKSHEET_SCHEMAS:
        return next(iter(schemas))
    return WORKSHEET_SCHEMA_V2


def _batch_rows_for_subjects(
    triage,
    batch_subject_ids: list[str] | None,
) -> list[dict[str, Any]]:
    if not batch_subject_ids:
        return triage.batch_rows

    by_id = {str(r.get("review_subject_id")): r for r in triage.queues[QUEUE_NEW_HEADWORD]}
    fallback = {str(r.get("review_subject_id")): r for r in triage.batch_rows}
    rows: list[dict[str, Any]] = []
    for subject_id in batch_subject_ids:
        row = by_id.get(subject_id) or fallback.get(subject_id)
        if row is not None:
            rows.append(row)
    return rows


def _expected_rows_from_frozen_inputs(
    *,
    baseline_ir_path: Path,
    current_ir_path: Path,
    delta_path: Path,
    crawl_dir: Path,
    batch_subject_ids: list[str] | None = None,
    verify_hashes: bool = True,
    worksheet_schema: str = WORKSHEET_SCHEMA_V2,
) -> dict[str, dict[str, str]]:
    triage = build_triage_in_memory(
        baseline_ir_path=baseline_ir_path,
        current_ir_path=current_ir_path,
        delta_path=delta_path,
        crawl_dir=crawl_dir,
        verify_hashes=verify_hashes,
    )
    batch_rows = _batch_rows_for_subjects(triage, batch_subject_ids)

    current_records = load_jsonl_records(current_ir_path)
    by_id = {str(r.get("ir_id")): r for r in current_records if r.get("ir_id")}

    return {
        str(row.get("review_subject_id") or ""): build_worksheet_row(
            row,
            by_id.get(str(row.get("review_subject_id") or "")),
            delta_sha256=triage.summary["frozen_inputs"]["delta_sha256"],
            current_ir_sha256=triage.summary["frozen_inputs"]["current_ir_sha256"],
            worksheet_schema=worksheet_schema,
        )
        for row in batch_rows
    }


def dry_run_import_review_worksheet(
    worksheet_path: Path,
    *,
    baseline_ir_path: Path,
    current_ir_path: Path,
    delta_path: Path,
    crawl_dir: Path,
    expected_by_id: dict[str, dict[str, str]] | None = None,
    verify_hashes: bool = True,
) -> MalidabaReviewDryRunResult:
    """Validate worksheet rows against frozen F11 context; skip unreviewed rows."""
    text = worksheet_path.read_text(encoding="utf-8")
    reader = csv.DictReader(io.StringIO(text))
    if reader.fieldnames is None:
        raise MalidabaReviewDryRunError(f"{worksheet_path}: missing CSV header")

    header = list(reader.fieldnames)
    raw_rows = list(reader)
    normalized_preview = [
        {key: (raw.get(key) or "").strip() for key in header} for raw in raw_rows
    ]
    worksheet_schema = _detect_worksheet_schema(normalized_preview)
    expected_columns = worksheet_columns_for_schema(worksheet_schema)
    context_columns = context_columns_for_schema(worksheet_schema)

    missing = [c for c in expected_columns if c not in header]
    if missing:
        raise MalidabaReviewDryRunError(
            f"{worksheet_path}: missing required columns for {worksheet_schema}: "
            f"{', '.join(missing)}"
        )
    unexpected = [c for c in header if c not in expected_columns]
    if unexpected:
        raise MalidabaReviewDryRunError(
            f"{worksheet_path}: unknown columns: {', '.join(unexpected)}"
        )

    worksheet_subject_ids = [
        (raw.get("review_subject_id") or "").strip()
        for raw in raw_rows
        if (raw.get("review_subject_id") or "").strip()
    ]
    if expected_by_id is None:
        expected_by_id = _expected_rows_from_frozen_inputs(
            baseline_ir_path=baseline_ir_path,
            current_ir_path=current_ir_path,
            delta_path=delta_path,
            crawl_dir=crawl_dir,
            batch_subject_ids=worksheet_subject_ids,
            verify_hashes=verify_hashes,
            worksheet_schema=worksheet_schema,
        )

    result = MalidabaReviewDryRunResult()
    rows_read = 0
    rows_skipped = 0
    preview_count = 0
    error_count = 0
    stale_subject_errors = 0
    stale_context_errors = 0
    unknown_subject_errors = 0

    for line_number, raw in enumerate(raw_rows, start=2):
        rows_read += 1
        row = {key: (raw.get(key) or "").strip() for key in expected_columns}

        row_schema = row.get("worksheet_schema", "")
        if row_schema != worksheet_schema:
            error_count += 1
            result.errors.append(
                f"{worksheet_path}:{line_number}: worksheet_schema {row_schema!r} "
                f"does not match file schema {worksheet_schema!r}"
            )
            continue

        subject_id = row.get("review_subject_id") or ""
        expected = expected_by_id.get(subject_id)
        if expected is None:
            unknown_subject_errors += 1
            error_count += 1
            result.errors.append(
                f"{worksheet_path}:{line_number}: unknown review_subject_id {subject_id!r}"
            )
            continue

        if not _row_has_review_input(row):
            mismatched = [
                col for col in context_columns if row.get(col, "") != expected.get(col, "")
            ]
            if mismatched:
                stale_context_errors += 1
                error_count += 1
                if "current_record_fingerprint_sha256" in mismatched:
                    stale_subject_errors += 1
                    result.errors.append(
                        f"{worksheet_path}:{line_number}: FAIL STALE REVIEW SUBJECT "
                        f"(review_subject_id={subject_id!r})"
                    )
                else:
                    result.errors.append(
                        f"{worksheet_path}:{line_number}: FAIL STALE OR MODIFIED "
                        f"WORKSHEET CONTEXT ({', '.join(mismatched)})"
                    )
                continue
            rows_skipped += 1
            continue

        mismatched = [
            col for col in context_columns if row.get(col, "") != expected.get(col, "")
        ]
        if mismatched:
            stale_context_errors += 1
            error_count += 1
            if "current_record_fingerprint_sha256" in mismatched:
                stale_subject_errors += 1
                result.errors.append(
                    f"{worksheet_path}:{line_number}: FAIL STALE REVIEW SUBJECT "
                    f"(review_subject_id={subject_id!r})"
                )
            else:
                result.errors.append(
                    f"{worksheet_path}:{line_number}: FAIL STALE OR MODIFIED "
                    f"WORKSHEET CONTEXT ({', '.join(mismatched)})"
                )
            continue

        decision = row.get("review_decision") or ""
        if decision not in ALLOWED_DECISIONS:
            error_count += 1
            result.errors.append(
                f"{worksheet_path}:{line_number}: invalid review_decision {decision!r}"
            )
            continue

        for required in ("reviewer_id", "reviewed_at", "review_method"):
            if not row.get(required):
                error_count += 1
                result.errors.append(
                    f"{worksheet_path}:{line_number}: missing {required} for reviewed row"
                )
                break
        else:
            issue_codes = _split_multi(row.get("issue_codes") or "")
            invalid_codes = [c for c in issue_codes if c not in ALLOWED_ISSUE_CODES]
            if invalid_codes:
                error_count += 1
                result.errors.append(
                    f"{worksheet_path}:{line_number}: invalid issue_codes {invalid_codes!r}"
                )
                continue

            preview = {
                "review_subject_id": subject_id,
                "review_decision": decision,
                "reviewer_id": row.get("reviewer_id"),
                "reviewed_at": row.get("reviewed_at"),
                "review_method": row.get("review_method"),
                "issue_codes": issue_codes,
                "review_notes": row.get("review_notes") or "",
            }
            result.preview_rows.append(preview)
            preview_count += 1

    result.summary = {
        "rows_read": rows_read,
        "rows_skipped_unreviewed": rows_skipped,
        "preview_row_count": preview_count,
        "error_count": error_count,
        "stale_fingerprint_errors": stale_subject_errors,
        "stale_context_errors": stale_context_errors,
        "unknown_subject_errors": unknown_subject_errors,
        "worksheet_schema": worksheet_schema,
    }
    return result


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Dry-run Malidaba delta review worksheet import (no registry write)."
    )
    parser.add_argument("--worksheet", type=Path, required=True)
    parser.add_argument("--baseline-ir", type=Path, required=True)
    parser.add_argument("--current-ir", type=Path, required=True)
    parser.add_argument("--delta", type=Path, required=True)
    parser.add_argument("--crawl-dir", type=Path, required=True)
    args = parser.parse_args(argv)

    result = dry_run_import_review_worksheet(
        args.worksheet,
        baseline_ir_path=args.baseline_ir,
        current_ir_path=args.current_ir,
        delta_path=args.delta,
        crawl_dir=args.crawl_dir,
    )
    print(json.dumps({"summary": result.summary, "errors": result.errors[:20]}, indent=2))
    return 0 if result.summary.get("error_count", 0) == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
