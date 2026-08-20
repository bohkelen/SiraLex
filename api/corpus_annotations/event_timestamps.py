"""Timezone-aware ISO-8601 event timestamps for corpus annotations/reviews."""

from __future__ import annotations

import re
from datetime import datetime, timezone
from pathlib import Path

EVENT_TIMESTAMP_SHAPE_RE = re.compile(
    r"^\d{4}-\d{2}-\d{2}"
    r"[Tt]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?"
    r"(?:Z|[+-]\d{2}:\d{2})$"
)


class EventTimestampError(ValueError):
    """Raised when an event timestamp is malformed or not comparable."""


def parse_event_timestamp(value: str, *, field_name: str = "timestamp") -> datetime:
    """Parse a full ISO-8601 datetime with explicit timezone into UTC.

    Rejects date-only and timezone-naive values.
    """
    text = value.strip()
    if not EVENT_TIMESTAMP_SHAPE_RE.match(text):
        raise EventTimestampError(
            f"{field_name} must be a full ISO-8601 datetime with explicit timezone "
            f"(got {value!r})"
        )
    normalized = text[:-1] + "+00:00" if text.endswith("Z") else text
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError as exc:
        raise EventTimestampError(
            f"{field_name} is not a valid datetime: {value!r}"
        ) from exc
    if parsed.tzinfo is None:
        raise EventTimestampError(
            f"{field_name} must include an explicit timezone (got {value!r})"
        )
    return parsed.astimezone(timezone.utc)


def validate_event_timestamp_field(
    field_name: str,
    value: str,
    path: Path,
    line: int,
    *,
    error_factory,
) -> datetime:
    """Validate and return a comparable UTC datetime, or raise via error_factory."""
    try:
        return parse_event_timestamp(value, field_name=field_name)
    except EventTimestampError as exc:
        raise error_factory(path, line, str(exc)) from exc
