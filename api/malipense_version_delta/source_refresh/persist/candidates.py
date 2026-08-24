"""Build F18 Type-A / Type-B candidate review rows from completed worksheets."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from ..continuity.type_a_v2 import (
    CONTINUITY_BATCH_ID,
    CONTINUITY_WORKSHEET_SCHEMA,
    dry_run_continuity_worksheet,
)
from ..continuity.type_b import TYPE_B_REVIEW_DECISION
from ..paths import FROZEN_ACCEPTANCE_SHA256
from ..transition.worksheets import (
    MISSING_BATCH_ID,
    MISSING_WORKSHEET_SCHEMA,
    dry_run_missing_disposition_worksheet,
)
from .human import (
    EXPECTED_TYPE_A_SELECTIONS,
    TYPE_A_REVIEW_METHOD,
    TYPE_A_REVIEWED_AT,
    TYPE_A_REVIEWER_ID,
    FrozenHumanWorksheetError,
)
from .identity import TYPE_A_SCHEMA, TYPE_B_SCHEMA, generate_review_id


def type_a_candidates_from_worksheet(
    worksheet_path: Path,
    *,
    expected_blank_rows: list[dict[str, str]],
) -> tuple[list[dict[str, Any]], dict[str, int]]:
    dry = dry_run_continuity_worksheet(
        worksheet_path, expected_rows=expected_blank_rows
    )
    if dry.summary.get("error_count"):
        raise FrozenHumanWorksheetError(
            "Type-A dry-run errors:\n" + "\n".join(dry.errors)
        )
    expected_by_id = {r["migration_subject_id"]: r for r in expected_blank_rows}
    candidates: list[dict[str, Any]] = []
    for preview in dry.preview_rows:
        expected = expected_by_id[preview["migration_subject_id"]]
        baseline_ir_id = expected["baseline_ir_id"]
        selected = list(preview.get("selected_current_ir_ids") or [])
        wanted = EXPECTED_TYPE_A_SELECTIONS.get(baseline_ir_id)
        if wanted is None or selected != [wanted]:
            raise FrozenHumanWorksheetError(
                f"Type-A selection mismatch for {baseline_ir_id}: "
                f"expected {[wanted]}, got {selected}"
            )
        if preview.get("review_decision") != "confirmed_continuity":
            raise FrozenHumanWorksheetError(
                f"Type-A decision mismatch for {baseline_ir_id}: "
                f"{preview.get('review_decision')!r}"
            )
        if preview.get("reviewer_id") != TYPE_A_REVIEWER_ID:
            raise FrozenHumanWorksheetError("Type-A reviewer_id mismatch")
        if preview.get("review_method") != TYPE_A_REVIEW_METHOD:
            raise FrozenHumanWorksheetError("Type-A review_method mismatch")
        if preview.get("reviewed_at") != TYPE_A_REVIEWED_AT:
            raise FrozenHumanWorksheetError("Type-A reviewed_at mismatch")
        if expected.get("worksheet_schema") != CONTINUITY_WORKSHEET_SCHEMA:
            raise FrozenHumanWorksheetError("Type-A schema mismatch")
        row: dict[str, Any] = {
            "schema_version": TYPE_A_SCHEMA,
            "review_subject_id": preview["migration_subject_id"],
            "batch_id": CONTINUITY_BATCH_ID,
            "frozen_acceptance_sha256": FROZEN_ACCEPTANCE_SHA256,
            "continuity_subject_fingerprint": expected["continuity_subject_fingerprint"],
            "baseline_ir_id": baseline_ir_id,
            "selected_current_ir_ids": selected,
            "review_decision": preview["review_decision"],
            "reviewer_id": preview["reviewer_id"],
            "reviewed_at": preview["reviewed_at"],
            "review_method": preview["review_method"],
            "issue_codes": list(preview.get("issue_codes") or []),
            "review_notes": str(preview.get("review_notes") or ""),
        }
        row["review_id"] = generate_review_id(row, schema_version=TYPE_A_SCHEMA)
        candidates.append(row)
    candidates.sort(key=lambda r: str(r["review_id"]))
    return candidates, dict(dry.summary)


def type_b_candidates_from_worksheet(
    worksheet_path: Path,
    *,
    expected_blank_rows: list[dict[str, str]],
) -> tuple[list[dict[str, Any]], dict[str, int]]:
    dry = dry_run_missing_disposition_worksheet(
        worksheet_path, expected_rows=expected_blank_rows
    )
    if dry.summary.get("error_count"):
        raise FrozenHumanWorksheetError(
            "Type-B dry-run errors:\n" + "\n".join(dry.errors)
        )
    expected_by_id = {r["baseline_ir_id"]: r for r in expected_blank_rows}
    candidates: list[dict[str, Any]] = []
    for preview in dry.preview_rows:
        bid = str(preview.get("baseline_ir_id") or "")
        expected = expected_by_id[bid]
        if preview.get("review_decision") != TYPE_B_REVIEW_DECISION:
            raise FrozenHumanWorksheetError(
                f"Type-B decision mismatch for {bid}: {preview.get('review_decision')!r}"
            )
        if str(preview.get("selected_current_ir_id") or ""):
            raise FrozenHumanWorksheetError(
                f"Type-B selected_current_ir_id must be blank for {bid}"
            )
        if expected.get("worksheet_schema") != MISSING_WORKSHEET_SCHEMA:
            raise FrozenHumanWorksheetError("Type-B schema mismatch")
        row: dict[str, Any] = {
            "schema_version": TYPE_B_SCHEMA,
            "review_subject_id": bid,
            "batch_id": MISSING_BATCH_ID,
            "frozen_acceptance_sha256": FROZEN_ACCEPTANCE_SHA256,
            "subject_fingerprint": expected["subject_fingerprint"],
            "baseline_ir_id": bid,
            "selected_current_ir_id": "",
            "review_decision": preview["review_decision"],
            "reviewer_id": preview["reviewer_id"],
            "reviewed_at": preview["reviewed_at"],
            "review_method": preview["review_method"],
            "issue_codes": list(preview.get("issue_codes") or []),
            "review_notes": str(preview.get("review_notes") or ""),
        }
        row["review_id"] = generate_review_id(row, schema_version=TYPE_B_SCHEMA)
        candidates.append(row)
    candidates.sort(key=lambda r: str(r["review_id"]))
    return candidates, dict(dry.summary)
