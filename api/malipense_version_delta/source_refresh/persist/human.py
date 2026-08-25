"""Frozen human Type-A / Type-B worksheet expectations (F18)."""

from __future__ import annotations

from malipense_version_delta.canonical_json import sha256_file

from ..paths import (
    FROZEN_F17_TYPE_A_COMPLETED_WORKSHEET_SHA256,
    FROZEN_F17_TYPE_B_COMPLETED_WORKSHEET_SHA256,
    SourceRefreshPaths,
)

TYPE_A_REVIEWER_ID = "Reviewer_001"
TYPE_A_REVIEW_METHOD = "manual_review"
TYPE_A_REVIEWED_AT = "2026-08-24T13:15:00+00:00"

TYPE_B_REVIEWER_ID = "Reviewer_001"
TYPE_B_REVIEW_METHOD = "manual_review"
TYPE_B_REVIEWED_AT = "2026-08-24T12:00:00+00:00"

# Exact human Type-A continuity selections keyed by baseline_ir_id.
EXPECTED_TYPE_A_SELECTIONS: dict[str, str] = {
    "50da089833d1173a": "85a55bf8072fbb53",  # bári
    "753fa18e0a6df4ab": "294714956aec1624",  # kùn — to / for
    "e28e149f57ab616b": "6ce45fcce8546c6f",  # kùn — head / hair / end
    "43b64456edacdbe0": "eccca9525fe88a67",  # sí
    "755e1dd98e5f4535": "b0c569ca42cf6d71",  # ɲá
}


class FrozenHumanWorksheetError(ValueError):
    """Raised when local reviewed worksheets differ from the human-supplied freeze."""


def verify_frozen_human_worksheets(paths: SourceRefreshPaths) -> dict[str, str]:
    type_a = (
        paths.f17_dir / "malidaba_ambiguous_reference_continuity_review_001.csv"
    )
    type_b = paths.f17_dir / "malidaba_missing_record_disposition_review_001.csv"
    if not type_a.is_file():
        raise FrozenHumanWorksheetError(f"missing Type-A worksheet {type_a}")
    if not type_b.is_file():
        raise FrozenHumanWorksheetError(f"missing Type-B worksheet {type_b}")
    a_sha = sha256_file(type_a)
    b_sha = sha256_file(type_b)
    if a_sha != FROZEN_F17_TYPE_A_COMPLETED_WORKSHEET_SHA256:
        raise FrozenHumanWorksheetError(
            f"Type-A worksheet SHA mismatch: expected "
            f"{FROZEN_F17_TYPE_A_COMPLETED_WORKSHEET_SHA256}, got {a_sha}"
        )
    if b_sha != FROZEN_F17_TYPE_B_COMPLETED_WORKSHEET_SHA256:
        raise FrozenHumanWorksheetError(
            f"Type-B worksheet SHA mismatch: expected "
            f"{FROZEN_F17_TYPE_B_COMPLETED_WORKSHEET_SHA256}, got {b_sha}"
        )
    return {
        "type_a_worksheet_sha256": a_sha,
        "type_b_worksheet_sha256": b_sha,
        "type_a_path": str(type_a),
        "type_b_path": str(type_b),
    }
