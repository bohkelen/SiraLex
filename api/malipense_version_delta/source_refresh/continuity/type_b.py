"""Encode and dry-run human Type-B retain_baseline_record × 42 (F17)."""

from __future__ import annotations

import csv
from collections import Counter
from pathlib import Path
from typing import Any

from ..transition.worksheets import (
    MISSING_COLUMNS,
    build_missing_worksheet_row,
)
from .logical import RIGHTS_CC_BY_NC_SA

# Human governance session constants (mechanical encoding of supplied decision).
TYPE_B_REVIEWER_ID = "Reviewer_001"
TYPE_B_REVIEW_METHOD = "manual_review"
TYPE_B_REVIEW_DECISION = "retain_baseline_record"
# One timezone-aware timestamp for this human review session.
TYPE_B_REVIEWED_AT = "2026-08-24T12:00:00+00:00"

SOURCE_ID_MALIPENSE = "src_malipense"


def encode_type_b_retain_all(
    subjects: list[dict[str, Any]],
) -> list[dict[str, str]]:
    """Fill human Type-B decisions without inventing issue_codes/notes."""
    rows: list[dict[str, str]] = []
    for subject in subjects:
        row = build_missing_worksheet_row(subject)
        row["review_decision"] = TYPE_B_REVIEW_DECISION
        row["selected_current_ir_id"] = ""
        row["reviewer_id"] = TYPE_B_REVIEWER_ID
        row["reviewed_at"] = TYPE_B_REVIEWED_AT
        row["review_method"] = TYPE_B_REVIEW_METHOD
        row["issue_codes"] = ""
        row["review_notes"] = ""
        rows.append(row)
    rows.sort(key=lambda r: (r["baseline_url"], r["headword"], r["baseline_ir_id"]))
    return rows


def write_type_b_completed_worksheet(
    path: Path, rows: list[dict[str, str]]
) -> list[dict[str, str]]:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=MISSING_COLUMNS, lineterminator="\n")
        writer.writeheader()
        for row in rows:
            writer.writerow(row)
    return rows


def type_b_decision_counts(preview_rows: list[dict[str, Any]]) -> dict[str, int]:
    return dict(Counter(str(r.get("review_decision") or "") for r in preview_rows))


def type_b_rights_inheritance() -> dict[str, str]:
    return {
        "source_id": SOURCE_ID_MALIPENSE,
        "claimed_license": RIGHTS_CC_BY_NC_SA,
        "note": (
            "Retained legacy Malidaba assertions remain src_malipense evidence; "
            "retention is not SiraLex ownership and does not authorize commercial use."
        ),
    }
