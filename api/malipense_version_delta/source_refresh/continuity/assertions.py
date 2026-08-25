"""Field-level edition assertion continuity (no current-wins overwrite)."""

from __future__ import annotations

from typing import Any

from malipense_version_delta.canonical_json import canonical_dumps

from ..model import (
    ASSERTION_BOTH,
    ASSERTION_CONFLICT,
    ASSERTION_CURRENT,
    ASSERTION_LEGACY,
    ASSERTION_NEEDS_REVIEW,
)

# Source-derived fields evaluated independently (not whole-record replacement).
CONTINUITY_FIELDS = (
    "headword_latin",
    "headword_nko_provided",
    "pos",
    "variants",
    "senses",
    "glosses",
    "examples",
    "idioms_or_subentries",
    "cross_references",
)

EDITION_BASELINE = "baseline_edition"
EDITION_CURRENT = "current_edition"


def _field_value(record: dict[str, Any] | None, field: str) -> Any:
    if not record:
        return None
    fields = record.get("fields_raw") or {}
    if field == "headword_latin":
        return fields.get("headword_latin")
    if field == "headword_nko_provided":
        return fields.get("headword_nko_provided")
    if field == "pos":
        return fields.get("pos") or fields.get("part_of_speech")
    if field == "variants":
        return fields.get("variants") or fields.get("variant_forms") or []
    if field == "senses":
        return fields.get("senses") or []
    if field == "glosses":
        senses = fields.get("senses") or []
        return [
            {
                "gloss_fr": s.get("gloss_fr"),
                "gloss_en": s.get("gloss_en"),
                "gloss_ru": s.get("gloss_ru"),
            }
            for s in senses
            if isinstance(s, dict)
        ]
    if field == "examples":
        senses = fields.get("senses") or []
        out: list[Any] = []
        for s in senses:
            if not isinstance(s, dict):
                continue
            ex = s.get("examples") or s.get("example") or []
            if isinstance(ex, list):
                out.extend(ex)
            elif ex:
                out.append(ex)
        return out
    if field == "idioms_or_subentries":
        return fields.get("idioms") or fields.get("subentries") or []
    if field == "cross_references":
        return fields.get("cross_references") or fields.get("see_also") or []
    return fields.get(field)


def _canonical(value: Any) -> str:
    return canonical_dumps(value)


def _empty(value: Any) -> bool:
    return value is None or value == "" or value == [] or value == {}


def classify_field_assertion(
    *,
    baseline_value: Any,
    current_value: Any,
) -> str:
    """Classify one field without overwriting either edition."""
    b_empty = _empty(baseline_value)
    c_empty = _empty(current_value)
    if b_empty and c_empty:
        return ASSERTION_NEEDS_REVIEW
    if b_empty and not c_empty:
        return ASSERTION_CURRENT
    if c_empty and not b_empty:
        return ASSERTION_LEGACY
    if _canonical(baseline_value) == _canonical(current_value):
        return ASSERTION_BOTH
    return ASSERTION_CONFLICT


def build_edition_assertions(
    *,
    baseline_record: dict[str, Any] | None,
    current_record: dict[str, Any] | None,
    baseline_ir_id: str | None,
    current_ir_id: str | None,
) -> list[dict[str, Any]]:
    """
    Preserve both edition assertions with provenance.

    Never flattens into one false current-edition record.
    Never applies current-wins overwrite.
    """
    rows: list[dict[str, Any]] = []
    for field in CONTINUITY_FIELDS:
        b_val = _field_value(baseline_record, field)
        c_val = _field_value(current_record, field)
        status = classify_field_assertion(baseline_value=b_val, current_value=c_val)
        rows.append(
            {
                "field": field,
                "assertion_class": status,
                "baseline_edition": {
                    "edition": EDITION_BASELINE,
                    "ir_id": baseline_ir_id,
                    "value": b_val,
                    "present": not _empty(b_val),
                },
                "current_edition": {
                    "edition": EDITION_CURRENT,
                    "ir_id": current_ir_id,
                    "value": c_val,
                    "present": not _empty(c_val),
                },
                "current_wins_overwrite": False,
                "legacy_relabeled_as_current": False,
            }
        )
    return rows


def legacy_only_assertions(
    *,
    baseline_record: dict[str, Any] | None,
    baseline_ir_id: str,
) -> list[dict[str, Any]]:
    """Baseline-only continuity: all present fields are LEGACY_SUPPORTED."""
    rows: list[dict[str, Any]] = []
    for field in CONTINUITY_FIELDS:
        b_val = _field_value(baseline_record, field)
        if _empty(b_val):
            continue
        rows.append(
            {
                "field": field,
                "assertion_class": ASSERTION_LEGACY,
                "baseline_edition": {
                    "edition": EDITION_BASELINE,
                    "ir_id": baseline_ir_id,
                    "value": b_val,
                    "present": True,
                },
                "current_edition": {
                    "edition": EDITION_CURRENT,
                    "ir_id": None,
                    "value": None,
                    "present": False,
                },
                "current_wins_overwrite": False,
                "legacy_relabeled_as_current": False,
            }
        )
    return rows


def assertion_summary(rows: list[dict[str, Any]]) -> dict[str, int]:
    counts = {
        ASSERTION_BOTH: 0,
        ASSERTION_CURRENT: 0,
        ASSERTION_LEGACY: 0,
        ASSERTION_CONFLICT: 0,
        ASSERTION_NEEDS_REVIEW: 0,
    }
    for row in rows:
        key = str(row.get("assertion_class") or "")
        if key in counts:
            counts[key] += 1
    return counts


def forbid_legacy_relabel_as_current(assertion: dict[str, Any]) -> None:
    """Fail closed if a legacy-only assertion were marked as current edition."""
    if (
        assertion.get("assertion_class") == ASSERTION_LEGACY
        and assertion.get("legacy_relabeled_as_current")
    ):
        raise ValueError("legacy_assertion_cannot_be_relabeled_current")
