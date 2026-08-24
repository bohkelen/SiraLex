"""F16 Type-A ambiguous remap + Type-B missing-record worksheets and dry-runs."""

from __future__ import annotations

import csv
import hashlib
import io
import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from corpus_annotations.event_timestamps import parse_event_timestamp

from malipense_version_delta.canonical_json import canonical_dumps

from ..paths import FROZEN_ACCEPTANCE_SHA256

REMAP_WORKSHEET_SCHEMA = "malidaba_reference_remap_review_worksheet_v1"
REMAP_BATCH_ID = "malidaba_ambiguous_reference_remap_review_001"

MISSING_WORKSHEET_SCHEMA = "malidaba_missing_record_disposition_worksheet_v1"
MISSING_BATCH_ID = "malidaba_missing_record_disposition_review_001"

ALLOWED_REVIEW_METHODS = frozenset({"manual_review"})

REMAP_DECISIONS = frozenset(
    {
        "confirmed_remap",
        "no_current_equivalent",
        "retain_legacy_target",
        "needs_more_evidence",
    }
)
MISSING_DECISIONS = frozenset(
    {
        "retain_baseline_record",
        "current_equivalent_confirmed",
        "accept_source_removal",
        "needs_more_evidence",
    }
)

REMAP_ISSUE_CODES = frozenset(
    {
        "identity_uncertain",
        "multiple_homonyms",
        "no_compatible_successor",
        "legacy_target_still_needed",
        "other",
    }
)
MISSING_ISSUE_CODES = frozenset(
    {
        "product_visible_loss",
        "anchor_reused_different_headword",
        "identity_uncertain",
        "retain_for_product_continuity",
        "other",
    }
)

CROSS_REVIEW_CONTEXT_COLUMNS = [
    "cross_review_group_id",
    "cross_review_related",
    "cross_review_counterpart_type",
    "cross_review_counterpart_subject_id",
    "cross_review_constraint",
]

REMAP_CONTEXT_COLUMNS = [
    "worksheet_schema",
    "batch_id",
    "frozen_acceptance_sha256",
    "migration_subject_id",
    "baseline_ir_id",
    "baseline_source_record_id",
    "baseline_url",
    "baseline_headword",
    "baseline_nko",
    "baseline_semantic_summary",
    "candidate_count",
    "candidate_current_ir_ids",
    "candidate_source_record_ids",
    "candidate_headwords",
    "candidate_nko",
    "candidate_semantic_summaries",
    "affected_reference_count",
    "affected_reference_summaries",
    "migration_subject_fingerprint",
] + CROSS_REVIEW_CONTEXT_COLUMNS

MISSING_CONTEXT_COLUMNS = [
    "worksheet_schema",
    "batch_id",
    "frozen_acceptance_sha256",
    "baseline_ir_id",
    "baseline_source_record_id",
    "baseline_url",
    "headword",
    "headword_nko",
    "baseline_semantic_summary",
    "product_visibility_summary",
    "downstream_reference_summary",
    "possible_current_candidates",
    "f15_disposition",
    "subject_fingerprint",
] + CROSS_REVIEW_CONTEXT_COLUMNS

REVIEW_FILL_COLUMNS = [
    "review_decision",
    "selected_current_ir_id",
    "reviewer_id",
    "reviewed_at",
    "review_method",
    "issue_codes",
    "review_notes",
]

REMAP_COLUMNS = REMAP_CONTEXT_COLUMNS + REVIEW_FILL_COLUMNS
MISSING_COLUMNS = MISSING_CONTEXT_COLUMNS + REVIEW_FILL_COLUMNS


class TransitionWorksheetError(ValueError):
    """Raised when F16 worksheet export/dry-run fails hard."""


@dataclass
class TransitionDryRunResult:
    preview_rows: list[dict[str, Any]] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    summary: dict[str, int] = field(default_factory=dict)


def _json_cell(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _fingerprint(payload: dict[str, Any]) -> str:
    return hashlib.sha256(canonical_dumps(payload).encode("utf-8")).hexdigest()


def _split_multi(value: str) -> list[str]:
    text = value.strip()
    if not text:
        return []
    return [part.strip() for part in re.split(r"[;|]", text) if part.strip()]


def _row_has_review_input(row: dict[str, str]) -> bool:
    return any(str(row.get(column, "")).strip() for column in REVIEW_FILL_COLUMNS)


def remap_subject_fingerprint(subject: dict[str, Any]) -> str:
    payload = {
        "frozen_acceptance_sha256": FROZEN_ACCEPTANCE_SHA256,
        "baseline_ir_id": subject.get("baseline_ir_id"),
        "baseline_source_record_id": subject.get("baseline_source_record_id"),
        "baseline_url": subject.get("baseline_url"),
        "baseline_headword": subject.get("baseline_headword"),
        "baseline_nko": subject.get("baseline_nko"),
        "baseline_semantic_summary": subject.get("baseline_semantic_summary"),
        "candidate_current_ir_ids": subject.get("candidate_current_ir_ids"),
        "candidate_source_record_ids": subject.get("candidate_source_record_ids"),
        "candidate_headwords": subject.get("candidate_headwords"),
        "candidate_nko": subject.get("candidate_nko"),
        "candidate_semantic_summaries": subject.get("candidate_semantic_summaries"),
        "affected_references": subject.get("affected_references"),
        "cross_review_group_id": subject.get("cross_review_group_id"),
        "cross_review_related": subject.get("cross_review_related"),
        "cross_review_counterpart_type": subject.get("cross_review_counterpart_type"),
        "cross_review_counterpart_subject_id": subject.get(
            "cross_review_counterpart_subject_id"
        ),
        "cross_review_constraint": subject.get("cross_review_constraint"),
    }
    return _fingerprint(payload)


def build_ambiguous_remap_worksheet_row(subject: dict[str, Any]) -> dict[str, str]:
    cands = list(subject.get("candidate_current_ir_ids") or [])
    fingerprint = remap_subject_fingerprint(subject)
    return {
        "worksheet_schema": REMAP_WORKSHEET_SCHEMA,
        "batch_id": REMAP_BATCH_ID,
        "frozen_acceptance_sha256": FROZEN_ACCEPTANCE_SHA256,
        "migration_subject_id": str(subject.get("migration_subject_id") or ""),
        "baseline_ir_id": str(subject.get("baseline_ir_id") or ""),
        "baseline_source_record_id": str(subject.get("baseline_source_record_id") or ""),
        "baseline_url": str(subject.get("baseline_url") or ""),
        "baseline_headword": str(subject.get("baseline_headword") or ""),
        "baseline_nko": str(subject.get("baseline_nko") or ""),
        "baseline_semantic_summary": str(subject.get("baseline_semantic_summary") or ""),
        "candidate_count": str(len(cands)),
        "candidate_current_ir_ids": _json_cell(cands),
        "candidate_source_record_ids": _json_cell(
            subject.get("candidate_source_record_ids") or []
        ),
        "candidate_headwords": _json_cell(subject.get("candidate_headwords") or []),
        "candidate_nko": _json_cell(subject.get("candidate_nko") or []),
        "candidate_semantic_summaries": _json_cell(
            subject.get("candidate_semantic_summaries") or []
        ),
        "affected_reference_count": str(subject.get("affected_reference_count") or 0),
        "affected_reference_summaries": _json_cell(
            subject.get("affected_references") or []
        ),
        "migration_subject_fingerprint": fingerprint,
        "cross_review_group_id": str(subject.get("cross_review_group_id") or ""),
        "cross_review_related": str(subject.get("cross_review_related") or "false"),
        "cross_review_counterpart_type": str(
            subject.get("cross_review_counterpart_type") or ""
        ),
        "cross_review_counterpart_subject_id": str(
            subject.get("cross_review_counterpart_subject_id") or ""
        ),
        "cross_review_constraint": str(subject.get("cross_review_constraint") or ""),
        "review_decision": "",
        "selected_current_ir_id": "",
        "reviewer_id": "",
        "reviewed_at": "",
        "review_method": "",
        "issue_codes": "",
        "review_notes": "",
    }


def write_ambiguous_remap_worksheet(
    path: Path, ambiguous_subjects: list[dict[str, Any]]
) -> list[dict[str, str]]:
    rows = [build_ambiguous_remap_worksheet_row(s) for s in ambiguous_subjects]
    rows.sort(key=lambda r: (r["baseline_url"], r["baseline_headword"], r["baseline_ir_id"]))
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=REMAP_COLUMNS, lineterminator="\n")
        writer.writeheader()
        for row in rows:
            writer.writerow(row)
    return rows


def missing_subject_fingerprint(subject: dict[str, Any]) -> str:
    payload = {
        "frozen_acceptance_sha256": FROZEN_ACCEPTANCE_SHA256,
        "baseline_ir_id": subject.get("baseline_ir_id"),
        "baseline_source_record_id": subject.get("baseline_source_record_id"),
        "baseline_url": subject.get("baseline_url"),
        "headword": subject.get("headword"),
        "headword_nko": subject.get("headword_nko"),
        "baseline_semantic_summary": subject.get("baseline_semantic_summary"),
        "product_visibility_summary": subject.get("product_visibility_summary"),
        "downstream_reference_summary": subject.get("downstream_reference_summary"),
        "possible_current_candidates": subject.get("possible_current_candidates"),
        "f15_disposition": subject.get("f15_disposition"),
        "cross_review_group_id": subject.get("cross_review_group_id"),
        "cross_review_related": subject.get("cross_review_related"),
        "cross_review_counterpart_type": subject.get("cross_review_counterpart_type"),
        "cross_review_counterpart_subject_id": subject.get(
            "cross_review_counterpart_subject_id"
        ),
        "cross_review_constraint": subject.get("cross_review_constraint"),
    }
    return _fingerprint(payload)


def build_missing_worksheet_row(subject: dict[str, Any]) -> dict[str, str]:
    fingerprint = missing_subject_fingerprint(subject)
    return {
        "worksheet_schema": MISSING_WORKSHEET_SCHEMA,
        "batch_id": MISSING_BATCH_ID,
        "frozen_acceptance_sha256": FROZEN_ACCEPTANCE_SHA256,
        "baseline_ir_id": str(subject.get("baseline_ir_id") or ""),
        "baseline_source_record_id": str(subject.get("baseline_source_record_id") or ""),
        "baseline_url": str(subject.get("baseline_url") or ""),
        "headword": str(subject.get("headword") or ""),
        "headword_nko": str(subject.get("headword_nko") or ""),
        "baseline_semantic_summary": str(subject.get("baseline_semantic_summary") or ""),
        "product_visibility_summary": str(
            subject.get("product_visibility_summary") or ""
        ),
        "downstream_reference_summary": _json_cell(
            subject.get("downstream_reference_summary") or []
        ),
        "possible_current_candidates": _json_cell(
            subject.get("possible_current_candidates") or []
        ),
        "f15_disposition": str(subject.get("f15_disposition") or ""),
        "subject_fingerprint": fingerprint,
        "cross_review_group_id": str(subject.get("cross_review_group_id") or ""),
        "cross_review_related": str(subject.get("cross_review_related") or "false"),
        "cross_review_counterpart_type": str(
            subject.get("cross_review_counterpart_type") or ""
        ),
        "cross_review_counterpart_subject_id": str(
            subject.get("cross_review_counterpart_subject_id") or ""
        ),
        "cross_review_constraint": str(subject.get("cross_review_constraint") or ""),
        "review_decision": "",
        "selected_current_ir_id": "",
        "reviewer_id": "",
        "reviewed_at": "",
        "review_method": "",
        "issue_codes": "",
        "review_notes": "",
    }


def write_missing_disposition_worksheet(
    path: Path, missing_subjects: list[dict[str, Any]]
) -> list[dict[str, str]]:
    rows = [build_missing_worksheet_row(s) for s in missing_subjects]
    rows.sort(key=lambda r: (r["baseline_url"], r["headword"], r["baseline_ir_id"]))
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=MISSING_COLUMNS, lineterminator="\n")
        writer.writeheader()
        for row in rows:
            writer.writerow(row)
    return rows


def _dry_run_generic(
    worksheet_path: Path,
    *,
    expected_columns: list[str],
    context_columns: list[str],
    expected_by_id: dict[str, dict[str, str]],
    id_column: str,
    allowed_decisions: frozenset[str],
    allowed_issue_codes: frozenset[str],
    candidate_column: str,
    decisions_requiring_selection: frozenset[str],
    decisions_forbidding_selection: frozenset[str],
) -> TransitionDryRunResult:
    text = worksheet_path.read_text(encoding="utf-8")
    reader = csv.DictReader(io.StringIO(text))
    if reader.fieldnames is None:
        raise TransitionWorksheetError(f"{worksheet_path}: missing CSV header")
    header = list(reader.fieldnames)
    missing = [c for c in expected_columns if c not in header]
    if missing:
        raise TransitionWorksheetError(
            f"{worksheet_path}: missing required columns: {', '.join(missing)}"
        )
    unexpected = [c for c in header if c not in expected_columns]
    if unexpected:
        raise TransitionWorksheetError(
            f"{worksheet_path}: unknown columns: {', '.join(unexpected)}"
        )

    result = TransitionDryRunResult()
    rows_read = 0
    rows_skipped = 0
    preview_count = 0
    error_count = 0
    stale_context_errors = 0

    for line_number, raw in enumerate(reader, start=2):
        rows_read += 1
        row = {key: (raw.get(key) or "").strip() for key in expected_columns}
        subject_id = row.get(id_column) or ""
        expected = expected_by_id.get(subject_id)
        if expected is None:
            error_count += 1
            result.errors.append(
                f"{worksheet_path}:{line_number}: unknown {id_column} {subject_id!r}"
            )
            continue

        if not _row_has_review_input(row):
            mismatched = [
                col for col in context_columns if row.get(col, "") != expected.get(col, "")
            ]
            if mismatched:
                stale_context_errors += 1
                error_count += 1
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
            result.errors.append(
                f"{worksheet_path}:{line_number}: FAIL STALE OR MODIFIED "
                f"WORKSHEET CONTEXT ({', '.join(mismatched)})"
            )
            continue

        decision = row.get("review_decision") or ""
        if decision not in allowed_decisions:
            error_count += 1
            result.errors.append(
                f"{worksheet_path}:{line_number}: invalid review_decision {decision!r}"
            )
            continue

        selected = row.get("selected_current_ir_id") or ""
        try:
            candidates_raw = json.loads(expected.get(candidate_column) or "[]")
        except json.JSONDecodeError:
            candidates_raw = []
        candidate_ids: set[str] = set()
        if isinstance(candidates_raw, list):
            for item in candidates_raw:
                if isinstance(item, str) and item:
                    candidate_ids.add(item)
                elif isinstance(item, dict) and item.get("ir_id"):
                    candidate_ids.add(str(item["ir_id"]))
                elif item is not None and not isinstance(item, (dict, list)):
                    candidate_ids.add(str(item))


        if decision in decisions_requiring_selection:
            if not selected:
                error_count += 1
                result.errors.append(
                    f"{worksheet_path}:{line_number}: {decision} requires "
                    "selected_current_ir_id"
                )
                continue
            if selected not in candidate_ids:
                error_count += 1
                result.errors.append(
                    f"{worksheet_path}:{line_number}: selected_current_ir_id "
                    f"{selected!r} is not a frozen presented candidate"
                )
                continue
        if decision in decisions_forbidding_selection and selected:
            error_count += 1
            result.errors.append(
                f"{worksheet_path}:{line_number}: {decision} requires blank "
                "selected_current_ir_id"
            )
            continue

        reviewer = row.get("reviewer_id") or ""
        if not reviewer:
            error_count += 1
            result.errors.append(
                f"{worksheet_path}:{line_number}: missing reviewer_id"
            )
            continue

        reviewed_at = row.get("reviewed_at") or ""
        try:
            parse_event_timestamp(reviewed_at)
        except Exception:
            error_count += 1
            result.errors.append(
                f"{worksheet_path}:{line_number}: invalid reviewed_at {reviewed_at!r}"
            )
            continue

        method = row.get("review_method") or ""
        if method not in ALLOWED_REVIEW_METHODS:
            error_count += 1
            result.errors.append(
                f"{worksheet_path}:{line_number}: invalid review_method {method!r}"
            )
            continue

        codes = _split_multi(row.get("issue_codes") or "")
        bad = [c for c in codes if c not in allowed_issue_codes]
        if bad:
            error_count += 1
            result.errors.append(
                f"{worksheet_path}:{line_number}: unknown issue_codes: {', '.join(bad)}"
            )
            continue

        preview_count += 1
        result.preview_rows.append(
            {
                id_column: subject_id,
                "review_decision": decision,
                "selected_current_ir_id": selected,
                "reviewer_id": reviewer,
                "reviewed_at": reviewed_at,
                "review_method": method,
                "issue_codes": codes,
                "review_notes": row.get("review_notes") or "",
            }
        )

    result.summary = {
        "rows_read": rows_read,
        "rows_skipped_unreviewed": rows_skipped,
        "preview_row_count": preview_count,
        "error_count": error_count,
        "stale_context_errors": stale_context_errors,
    }
    return result


def dry_run_ambiguous_remap_worksheet(
    worksheet_path: Path,
    *,
    expected_rows: list[dict[str, str]] | None = None,
) -> TransitionDryRunResult:
    if expected_rows is None:
        # Rebuild expected from file context only when caller supplies rows.
        raise TransitionWorksheetError(
            "expected_rows required for ambiguous remap dry-run"
        )
    expected_by_id = {r["migration_subject_id"]: r for r in expected_rows}
    return _dry_run_generic(
        worksheet_path,
        expected_columns=REMAP_COLUMNS,
        context_columns=REMAP_CONTEXT_COLUMNS,
        expected_by_id=expected_by_id,
        id_column="migration_subject_id",
        allowed_decisions=REMAP_DECISIONS,
        allowed_issue_codes=REMAP_ISSUE_CODES,
        candidate_column="candidate_current_ir_ids",
        decisions_requiring_selection=frozenset({"confirmed_remap"}),
        decisions_forbidding_selection=frozenset(
            {"no_current_equivalent", "retain_legacy_target", "needs_more_evidence"}
        ),
    )


def dry_run_missing_disposition_worksheet(
    worksheet_path: Path,
    *,
    expected_rows: list[dict[str, str]] | None = None,
) -> TransitionDryRunResult:
    if expected_rows is None:
        raise TransitionWorksheetError(
            "expected_rows required for missing disposition dry-run"
        )
    expected_by_id = {r["baseline_ir_id"]: r for r in expected_rows}
    return _dry_run_generic(
        worksheet_path,
        expected_columns=MISSING_COLUMNS,
        context_columns=MISSING_CONTEXT_COLUMNS,
        expected_by_id=expected_by_id,
        id_column="baseline_ir_id",
        allowed_decisions=MISSING_DECISIONS,
        allowed_issue_codes=MISSING_ISSUE_CODES,
        candidate_column="possible_current_candidates",
        decisions_requiring_selection=frozenset({"current_equivalent_confirmed"}),
        decisions_forbidding_selection=frozenset(
            {
                "retain_baseline_record",
                "accept_source_removal",
                "needs_more_evidence",
            }
        ),
    )
