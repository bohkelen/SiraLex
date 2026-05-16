"""Lifecycle resolution for correction records."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone

from .helpers import canonical_json, parse_iso8601_utc
from .models import CorrectionRecord, Rejection


def _updated_at_key(record: CorrectionRecord) -> datetime:
    try:
        return parse_iso8601_utc(record.updated_at)
    except ValueError:
        return datetime.min.replace(tzinfo=timezone.utc)


def resolve_latest_lifecycle_records(
    records: list[CorrectionRecord],
) -> tuple[list[CorrectionRecord], list[Rejection]]:
    """
    Keep only latest lifecycle row per correction_id.

    Active per-record tie-breakers (single-correctionset mode):
    1. timestamps.updated_at descending
    2. source line number descending
    3. canonical JSON string descending

    Note: correctionset_version is manifest-level and shared in this mode, so it is
    intentionally non-operative here. It is reserved for future multi-correctionset
    ingestion modes.
    """
    grouped: dict[str, list[CorrectionRecord]] = defaultdict(list)
    for record in records:
        grouped[record.correction_id].append(record)

    latest_records: list[CorrectionRecord] = []
    rejections: list[Rejection] = []

    for correction_id in sorted(grouped.keys()):
        group = grouped[correction_id]
        sorted_group = sorted(
            group,
            key=lambda rec: (
                _updated_at_key(rec),
                rec.source_line_number,
                canonical_json(rec.raw),
            ),
            reverse=True,
        )
        latest = sorted_group[0]
        latest_records.append(latest)

        for older in sorted_group[1:]:
            rejections.append(
                Rejection(
                    correction_id=older.correction_id,
                    target_ir_id=older.target_ir_id,
                    reason_code="non_latest_lifecycle_version",
                    detail=f"superseded by newer lifecycle row for correction_id={correction_id}",
                )
            )

    return latest_records, rejections

