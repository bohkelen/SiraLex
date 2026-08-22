"""Export Malidaba delta human-review worksheet CSV (non-authoritative)."""

from __future__ import annotations

import argparse
import csv
import io
import json
import sys
from pathlib import Path
from typing import Any

from .compare import load_jsonl_records
from .frozen_inputs import FROZEN_CURRENT_IR_SHA256, FROZEN_DELTA_SHA256, verify_frozen_inputs
from .review_descriptors import gloss_summary

WORKSHEET_SCHEMA = "malidaba_delta_review_worksheet_v1"
BATCH_ID = "malidaba_new_headword_review_batch_001"

CONTEXT_COLUMNS = [
    "worksheet_schema",
    "batch_id",
    "delta_sha256",
    "current_ir_sha256",
    "review_subject_id",
    "delta_class",
    "source_section_class",
    "identity_confidence",
    "url_canonical",
    "source_record_id",
    "headword_latin",
    "headword_nko",
    "pos",
    "variants_json",
    "gloss_fr_json",
    "gloss_en_json",
    "gloss_ru_json",
    "sense_summary_json",
    "example_count",
    "idiom_or_subentry_count",
    "current_record_fingerprint_sha256",
    "headword_group_id",
    "headword_group_size",
]

REVIEW_FILL_COLUMNS = [
    "review_decision",
    "reviewer_id",
    "reviewed_at",
    "review_method",
    "issue_codes",
    "review_notes",
]

WORKSHEET_COLUMNS = CONTEXT_COLUMNS + REVIEW_FILL_COLUMNS

ALLOWED_DECISIONS = frozenset(
    {
        "confirmed_source_delta",
        "reject_delta_extraction",
        "needs_more_evidence",
    }
)

ALLOWED_ISSUE_CODES = frozenset(
    {
        "parser_or_extraction_error",
        "identity_uncertain",
        "source_section_uncertain",
        "duplicate_or_homonym_question",
        "missing_expected_gloss",
        "source_record_incomplete",
        "rights_question",
        "needs_source_inspection",
        "other",
    }
)


class MalidabaReviewWorksheetError(ValueError):
    """Raised when worksheet export fails."""


def _json_cell(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def build_worksheet_row(
    queue_row: dict[str, Any],
    current_record: dict[str, Any] | None,
    *,
    delta_sha256: str,
    current_ir_sha256: str,
    batch_id: str = BATCH_ID,
) -> dict[str, str]:
    """Build one CSV row with read-only context and blank review fields."""
    fields = (current_record or {}).get("fields_raw") or {}
    gloss = gloss_summary(current_record) if current_record else {}
    reviewability = queue_row.get("reviewability") or {}

    return {
        "worksheet_schema": WORKSHEET_SCHEMA,
        "batch_id": batch_id,
        "delta_sha256": delta_sha256,
        "current_ir_sha256": current_ir_sha256,
        "review_subject_id": str(queue_row.get("review_subject_id") or ""),
        "delta_class": str(queue_row.get("delta_class") or ""),
        "source_section_class": str(queue_row.get("source_section_class") or ""),
        "identity_confidence": str(queue_row.get("identity_confidence") or ""),
        "url_canonical": str(queue_row.get("url_canonical") or ""),
        "source_record_id": str(queue_row.get("source_record_id") or ""),
        "headword_latin": str(queue_row.get("headword_latin") or ""),
        "headword_nko": str(fields.get("headword_nko_provided") or ""),
        "pos": str(fields.get("ps_raw") or ""),
        "variants_json": _json_cell(fields.get("variants_raw") or []),
        "gloss_fr_json": _json_cell(gloss.get("gloss_fr_list") or []),
        "gloss_en_json": _json_cell(gloss.get("gloss_en_list") or []),
        "gloss_ru_json": _json_cell(gloss.get("gloss_ru_list") or []),
        "sense_summary_json": _json_cell(
            {
                "sense_count": gloss.get("sense_count", 0),
                "has_sense": (reviewability.get("has_sense") is True),
            }
        ),
        "example_count": str(reviewability.get("example_count", 0)),
        "idiom_or_subentry_count": str(reviewability.get("idiom_or_subentry_count", 0)),
        "current_record_fingerprint_sha256": str(
            queue_row.get("current_record_fingerprint_sha256") or ""
        ),
        "headword_group_id": str(queue_row.get("headword_group_id") or ""),
        "headword_group_size": str(queue_row.get("headword_group_size") or "1"),
        "review_decision": "",
        "reviewer_id": "",
        "reviewed_at": "",
        "review_method": "",
        "issue_codes": "",
        "review_notes": "",
    }


def export_batch_worksheet(
    *,
    batch_rows: list[dict[str, Any]],
    current_ir_path: Path,
    output_path: Path,
    delta_sha256: str = FROZEN_DELTA_SHA256,
    current_ir_sha256: str = FROZEN_CURRENT_IR_SHA256,
    batch_id: str = BATCH_ID,
) -> dict[str, Any]:
    """Write batch worksheet CSV with blank review columns."""
    current_records = load_jsonl_records(current_ir_path)
    by_id = {str(r.get("ir_id")): r for r in current_records if r.get("ir_id")}

    rows = [
        build_worksheet_row(
            queue_row,
            by_id.get(str(queue_row.get("review_subject_id") or "")),
            delta_sha256=delta_sha256,
            current_ir_sha256=current_ir_sha256,
            batch_id=batch_id,
        )
        for queue_row in batch_rows
    ]

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8", newline="\n") as handle:
        writer = csv.DictWriter(handle, fieldnames=WORKSHEET_COLUMNS, lineterminator="\n")
        writer.writeheader()
        for row in rows:
            writer.writerow(row)

    return {
        "worksheet_schema": WORKSHEET_SCHEMA,
        "batch_id": batch_id,
        "row_count": len(rows),
        "output_path": str(output_path),
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Export Malidaba delta review worksheet CSV (local/gitignored)."
    )
    parser.add_argument(
        "--queue-path",
        type=Path,
        required=True,
        help="Path to new_headword_evidence.jsonl or pre-selected batch JSONL",
    )
    parser.add_argument("--current-ir", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument(
        "--subject-ids",
        type=Path,
        default=None,
        help="Optional newline file of review_subject_id values to include",
    )
    args = parser.parse_args(argv)

    queue_rows = load_jsonl_records(args.queue_path)
    if args.subject_ids:
        wanted = {
            line.strip()
            for line in args.subject_ids.read_text(encoding="utf-8").splitlines()
            if line.strip()
        }
        queue_rows = [r for r in queue_rows if r.get("review_subject_id") in wanted]

    meta = export_batch_worksheet(
        batch_rows=queue_rows,
        current_ir_path=args.current_ir,
        output_path=args.output,
    )
    print(json.dumps(meta, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
