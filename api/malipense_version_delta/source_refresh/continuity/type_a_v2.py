"""Type-A continuity review worksheet v2 (one-to-many; blank for human)."""

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

CONTINUITY_WORKSHEET_SCHEMA = "malidaba_reference_continuity_review_worksheet_v2"
CONTINUITY_BATCH_ID = "malidaba_ambiguous_reference_continuity_review_001"

ALLOWED_REVIEW_METHODS = frozenset({"manual_review"})

CONTINUITY_DECISIONS = frozenset(
    {
        "confirmed_continuity",
        "legacy_only",
        "needs_more_evidence",
    }
)

CONTINUITY_ISSUE_CODES = frozenset(
    {
        "identity_uncertain",
        "multiple_homonyms",
        "polysemy_split",
        "no_compatible_successor",
        "legacy_target_still_needed",
        "other",
    }
)

CONTINUITY_CONTEXT_COLUMNS = [
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
    "continuity_subject_fingerprint",
]

CONTINUITY_FILL_COLUMNS = [
    "review_decision",
    "selected_current_ir_ids",
    "reviewer_id",
    "reviewed_at",
    "review_method",
    "issue_codes",
    "review_notes",
]

CONTINUITY_COLUMNS = CONTINUITY_CONTEXT_COLUMNS + CONTINUITY_FILL_COLUMNS


class ContinuityWorksheetError(ValueError):
    """Raised when Type-A v2 worksheet export/dry-run fails hard."""


@dataclass
class ContinuityDryRunResult:
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


def _parse_selected_ids(raw: str) -> list[str]:
    text = (raw or "").strip()
    if not text:
        return []
    if text.startswith("["):
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError as exc:
            raise ContinuityWorksheetError(
                f"selected_current_ir_ids is not valid JSON: {exc}"
            ) from exc
        if not isinstance(parsed, list):
            raise ContinuityWorksheetError(
                "selected_current_ir_ids JSON must be a list"
            )
        return [str(x) for x in parsed if str(x).strip()]
    return _split_multi(text)


def _row_has_review_input(row: dict[str, str]) -> bool:
    return any(str(row.get(column, "")).strip() for column in CONTINUITY_FILL_COLUMNS)


def continuity_subject_fingerprint(subject: dict[str, Any]) -> str:
    payload = {
        "frozen_acceptance_sha256": FROZEN_ACCEPTANCE_SHA256,
        "migration_subject_id": subject.get("migration_subject_id"),
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
    }
    return _fingerprint(payload)


def build_continuity_worksheet_row(subject: dict[str, Any]) -> dict[str, str]:
    cands = list(subject.get("candidate_current_ir_ids") or [])
    fingerprint = continuity_subject_fingerprint(subject)
    return {
        "worksheet_schema": CONTINUITY_WORKSHEET_SCHEMA,
        "batch_id": CONTINUITY_BATCH_ID,
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
        "continuity_subject_fingerprint": fingerprint,
        "review_decision": "",
        "selected_current_ir_ids": "",
        "reviewer_id": "",
        "reviewed_at": "",
        "review_method": "",
        "issue_codes": "",
        "review_notes": "",
    }


def write_continuity_worksheet(
    path: Path, ambiguous_subjects: list[dict[str, Any]]
) -> list[dict[str, str]]:
    rows = [build_continuity_worksheet_row(s) for s in ambiguous_subjects]
    rows.sort(
        key=lambda r: (r["baseline_url"], r["baseline_headword"], r["baseline_ir_id"])
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle, fieldnames=CONTINUITY_COLUMNS, lineterminator="\n"
        )
        writer.writeheader()
        for row in rows:
            writer.writerow(row)
    return rows


def dry_run_continuity_worksheet(
    worksheet_path: Path,
    *,
    expected_rows: list[dict[str, str]],
) -> ContinuityDryRunResult:
    text = worksheet_path.read_text(encoding="utf-8")
    reader = csv.DictReader(io.StringIO(text))
    if reader.fieldnames is None:
        raise ContinuityWorksheetError(f"{worksheet_path}: missing CSV header")
    header = list(reader.fieldnames)
    missing = [c for c in CONTINUITY_COLUMNS if c not in header]
    if missing:
        raise ContinuityWorksheetError(
            f"{worksheet_path}: missing required columns: {', '.join(missing)}"
        )
    unexpected = [c for c in header if c not in CONTINUITY_COLUMNS]
    if unexpected:
        raise ContinuityWorksheetError(
            f"{worksheet_path}: unknown columns: {', '.join(unexpected)}"
        )

    expected_by_id = {r["migration_subject_id"]: r for r in expected_rows}
    result = ContinuityDryRunResult()
    rows_read = 0
    rows_skipped = 0
    preview_count = 0
    error_count = 0
    stale_context_errors = 0

    for line_number, raw in enumerate(reader, start=2):
        rows_read += 1
        row = {key: (raw.get(key) or "").strip() for key in CONTINUITY_COLUMNS}
        subject_id = row.get("migration_subject_id") or ""
        expected = expected_by_id.get(subject_id)
        if expected is None:
            error_count += 1
            result.errors.append(
                f"{worksheet_path}:{line_number}: unknown migration_subject_id "
                f"{subject_id!r}"
            )
            continue

        if not _row_has_review_input(row):
            mismatched = [
                col
                for col in CONTINUITY_CONTEXT_COLUMNS
                if row.get(col, "") != expected.get(col, "")
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
            col
            for col in CONTINUITY_CONTEXT_COLUMNS
            if row.get(col, "") != expected.get(col, "")
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
        if decision not in CONTINUITY_DECISIONS:
            error_count += 1
            result.errors.append(
                f"{worksheet_path}:{line_number}: invalid review_decision {decision!r}"
            )
            continue

        try:
            selected_ids = _parse_selected_ids(row.get("selected_current_ir_ids") or "")
        except ContinuityWorksheetError as exc:
            error_count += 1
            result.errors.append(f"{worksheet_path}:{line_number}: {exc}")
            continue

        try:
            candidates_raw = json.loads(expected.get("candidate_current_ir_ids") or "[]")
        except json.JSONDecodeError:
            candidates_raw = []
        candidate_ids = {
            str(item)
            for item in candidates_raw
            if isinstance(item, str) and item
        }

        if decision == "confirmed_continuity":
            if not selected_ids:
                error_count += 1
                result.errors.append(
                    f"{worksheet_path}:{line_number}: confirmed_continuity requires "
                    "selected_current_ir_ids (one or more)"
                )
                continue
            bad = [i for i in selected_ids if i not in candidate_ids]
            if bad:
                error_count += 1
                result.errors.append(
                    f"{worksheet_path}:{line_number}: selected_current_ir_ids "
                    f"not in frozen candidates: {', '.join(bad)}"
                )
                continue
        elif decision in {"legacy_only", "needs_more_evidence"} and selected_ids:
            error_count += 1
            result.errors.append(
                f"{worksheet_path}:{line_number}: {decision} requires empty "
                "selected_current_ir_ids"
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
        bad_codes = [c for c in codes if c not in CONTINUITY_ISSUE_CODES]
        if bad_codes:
            error_count += 1
            result.errors.append(
                f"{worksheet_path}:{line_number}: unknown issue_codes: "
                f"{', '.join(bad_codes)}"
            )
            continue

        preview_count += 1
        result.preview_rows.append(
            {
                "migration_subject_id": subject_id,
                "review_decision": decision,
                "selected_current_ir_ids": selected_ids,
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
